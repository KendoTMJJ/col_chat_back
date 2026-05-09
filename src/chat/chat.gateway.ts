import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';

import { SessionsService } from '../sessions/sessions.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import { SessionEvents } from '../events/app-events.enum';

import { SendMessageDto } from './dto/send-message.dto';
import { JoinConversationDto } from './dto/join-conversation.dto';
import { CreateConversationDto } from '../conversations/dto/create-conversation.dto';
import type { Message } from '../messages/interfaces/message.interface';
import { RagResponse } from '../rag/interfaces/rag-response.interface';

const ROOM = (conversationId: string) => `conv:${conversationId}`;

@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    // El gateway delega toda la lógica de sesión al servicio existente.
    private readonly sessionsService: SessionsService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  // ─── Ciclo de vida  ───────────────────────────────────

  handleConnection(client: Socket): void {
    const userId = client.handshake.query.userId as string;

    if (!userId) {
      client.emit('error', { message: 'userId requerido en query params' });
      client.disconnect();
      return;
    }

    const session = this.sessionsService.createOrReconnect(userId, client.id);
    client.data.userId = userId;
    client.data.sessionId = session.sessionId;

    client.emit('session:ready', { sessionId: session.sessionId, userId });
    this.logger.log(`Cliente conectado: ${userId} → socket ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.sessionsService.markDisconnected(client.id);

    // Notificar a todas las salas en las que estaba el usuario
    const userId = client.data.userId;
    if (userId) {
      this.conversationsService
        .findByParticipant(userId)
        .forEach(conv => {
          client.to(ROOM(conv.id)).emit('user:left', { userId, conversationId: conv.id });
        });
    }
  }

  // ─── Mensajes del cliente ─────────────────────────────────────────────────

  @SubscribeMessage('conversation:create')
  handleCreateConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateConversationDto,
  ) {
    const userId = client.data.userId as string;

    // El creador siempre es participante
    if (!dto.participantIds.includes(userId)) {
      dto.participantIds.push(userId);
    }

    const conversation = this.conversationsService.create(dto);

    // Unir al creador automáticamente
    client.join(ROOM(conversation.id));
    client.emit('conversation:created', conversation);

    return conversation;
  }

  @SubscribeMessage('conversation:join')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinConversationDto,
  ) {
    const userId = client.data.userId as string;

    const conversation = this.conversationsService.findById(dto.conversationId);
    this.conversationsService.addParticipant(dto.conversationId, userId);

    client.join(ROOM(dto.conversationId));

    // Notificar a los demás en la sala
    client.to(ROOM(dto.conversationId)).emit('user:joined', {
      userId,
      conversationId: dto.conversationId,
    });

    // Enviar historial al nuevo participante
    const history = this.messagesService.findByConversation(dto.conversationId);
    client.emit('conversation:history', { conversation, messages: history });

    return { joined: true, conversationId: dto.conversationId };
  }

  @SubscribeMessage('conversation:leave')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinConversationDto,
  ) {
    const userId = client.data.userId as string;

    this.conversationsService.removeParticipant(dto.conversationId, userId);
    client.leave(ROOM(dto.conversationId));
    client.to(ROOM(dto.conversationId)).emit('user:left', {
      userId,
      conversationId: dto.conversationId,
    });

    return { left: true };
  }

  @SubscribeMessage('message:send')
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const userId = client.data.userId as string;

    // Guardar sesión activa (Phase 1 touch)
    this.sessionsService.touch(client.data.sessionId);

    // Validar participación
    if (!this.conversationsService.isParticipant(dto.conversationId, userId)) {
      throw new WsException('No eres participante de esta conversación');
    }

    const message = this.messagesService.create({
      conversationId: dto.conversationId,
      senderId: userId,
      content: dto.content,
      metadata: dto.metadata,
    });

    // El broadcast se hace en el listener de evento para mantener separación
    return { queued: true, messageId: message.id };
  }

  // ─── Listeners de eventos internos ───────────────────────────────────────

  @OnEvent(SessionEvents.MESSAGE_CREATED)
  broadcastNewMessage(message: Message): void {
    // DECISIÓN: el broadcast ocurre vía evento y no directamente en el handler de WebSocket. Así otros 
    // productores (e.g. un HTTP controller) también pueden crear mensajes y verlos reflejados en tiempo real.
    if (message.type !== 'user') return;

    this.server
      .to(ROOM(message.conversationId))
      .emit('message:new', message);
  }

  @OnEvent(SessionEvents.RAG_RESPONSE_RECEIVED)
  broadcastRagResponse({ ragMessage }: { ragResponse: RagResponse; ragMessage: Message }): void {
    // El mensaje RAG ya fue persistido por RagService antes de emitir el evento.
    // Aquí solo se distribuye a los clientes de la sala.
    this.server
      .to(ROOM(ragMessage.conversationId))
      .emit('message:rag', ragMessage);
  }

  @OnEvent(SessionEvents.RAG_ERROR)
  notifyRagError(payload: { conversationId: string; error: string }): void {
    this.server
      .to(ROOM(payload.conversationId))
      .emit('rag:error', { message: 'El servicio RAG no pudo responder', detail: payload.error });
  }

  @OnEvent(SessionEvents.SESSION_EXPIRED)
  handleSessionExpired(session: { userId: string }): void {
    // Notificar al usuario vía su sala personal (definida en Phase 1)
    this.server
      .to(`user:${session.userId}`)
      .emit('session:expired', { message: 'Sesión expirada. Reconéctate.' });
  }
}