import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { Message, MessageType } from './interfaces/message.interface';
import { CreateMessageDto } from './dto/create-message.dto';
import { SessionEvents } from '../events/app-events.enum';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  // DECISIÓN: mensajes indexados por conversationId para recuperación O(1).
  // Cada entrada es un array ordenado por inserción (cronológico).
  private readonly store = new Map<string, Message[]>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  create(dto: CreateMessageDto, type: MessageType = 'user'): Message {
    const message: Message = {
      id: uuidv4(),
      conversationId: dto.conversationId,
      senderId: dto.senderId,
      content: dto.content,
      type,
      createdAt: new Date(),
      metadata: dto.metadata,
    };

    this.persist(message);
    this.eventEmitter.emit(SessionEvents.MESSAGE_CREATED, message);
    this.logger.log(`Mensaje creado: ${message.id} en conversación ${message.conversationId}`);

    return message;
  }

  // Usado internamente por RagService para persistir la respuesta del RAG
  createRagMessage(conversationId: string, content: string, metadata?: Record<string, unknown>): Message {
    return this.create(
      { conversationId, senderId: 'rag-system', content, metadata },
      'rag',
    );
  }

  findByConversation(conversationId: string): Message[] {
    return this.store.get(conversationId) ?? [];
  }

  // Retorna los últimos N mensajes como contexto para el RAG
  getContext(conversationId: string, limit = 10): string[] {
    const messages = this.findByConversation(conversationId);
    return messages
      .slice(-limit)
      .map(m => `[${m.type.toUpperCase()}] ${m.senderId}: ${m.content}`);
  }

  private persist(message: Message): void {
    const existing = this.store.get(message.conversationId) ?? [];
    existing.push(message);
    this.store.set(message.conversationId, existing);
  }
}