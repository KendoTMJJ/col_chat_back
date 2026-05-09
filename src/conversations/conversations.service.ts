import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { Conversation } from './interfaces/conversation.interface';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SessionEvents } from '../events/app-events.enum';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  // DECISIÓN: almacenamiento en memoria alineado con el patrón de Phase 1.
  // Swap por un repositorio de DB sin cambiar la interfaz pública del servicio.
  private readonly conversations = new Map<string, Conversation>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  create(dto: CreateConversationDto): Conversation {
    const conversation: Conversation = {
      id: uuidv4(),
      title: dto.title,
      participantIds: [...dto.participantIds],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: dto.metadata,
    };

    this.conversations.set(conversation.id, conversation);
    this.eventEmitter.emit(SessionEvents.CONVERSATION_CREATED, conversation);
    this.logger.log(`Conversación creada: ${conversation.id}`);

    return conversation;
  }

  findById(id: string): Conversation {
    const conv = this.conversations.get(id);
    if (!conv) throw new NotFoundException(`Conversación ${id} no encontrada`);
    return conv;
  }

  findAll(): Conversation[] {
    return [...this.conversations.values()];
  }

  findByParticipant(userId: string): Conversation[] {
    return [...this.conversations.values()].filter(c =>
      c.participantIds.includes(userId),
    );
  }

  addParticipant(conversationId: string, userId: string): Conversation {
    const conv = this.findById(conversationId);

    if (!conv.participantIds.includes(userId)) {
      conv.participantIds.push(userId);
      conv.updatedAt = new Date();
      this.eventEmitter.emit(SessionEvents.CONVERSATION_USER_JOINED, { conv, userId });
    }

    return conv;
  }

  removeParticipant(conversationId: string, userId: string): void {
    const conv = this.findById(conversationId);
    conv.participantIds = conv.participantIds.filter(id => id !== userId);
    conv.updatedAt = new Date();
    this.eventEmitter.emit(SessionEvents.CONVERSATION_USER_LEFT, { conv, userId });
  }

  isParticipant(conversationId: string, userId: string): boolean {
    try {
      const conv = this.findById(conversationId);
      return conv.participantIds.includes(userId);
    } catch {
      return false;
    }
  }
}