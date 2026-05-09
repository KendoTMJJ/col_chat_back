import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SessionEvents } from '../events/app-events.enum';
import type { Message } from '../messages/interfaces/message.interface';
import { MessagesService } from '../messages/messages.service';
import { RagRequest, RagResponse } from './interfaces/rag-response.interface';

// DECISIÓN: RAG_SERVICE_URL se externaliza a variables de entorno.
// En producción usar ConfigService de @nestjs/config.
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL ?? 'http://localhost:8000';

// DECISIÓN: solo los mensajes de tipo 'user' disparan el RAG.
// Los mensajes 'rag' y 'system' no deben crear ciclos de llamada.
const RAG_ELIGIBLE_TYPES = new Set<string>(['user']);

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly messagesService: MessagesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(SessionEvents.MESSAGE_CREATED, { async: true })
  async handleMessageCreated(message: Message): Promise<void> {
    if (!RAG_ELIGIBLE_TYPES.has(message.type)) return;

    const context = this.messagesService.getContext(message.conversationId, 10);

    const request: RagRequest = {
      conversationId: message.conversationId,
      messageId: message.id,
      query: message.content,
      context,
    };

    this.eventEmitter.emit(SessionEvents.RAG_REQUEST_SENT, request);

    try {
      const ragResponse = await this.callRagEndpoint(request);

      // Persiste la respuesta como mensaje de tipo 'rag'
      const ragMessage = this.messagesService.createRagMessage(
        message.conversationId,
        ragResponse.answer,
        { sources: ragResponse.sources, confidence: ragResponse.confidence },
      );

      this.eventEmitter.emit(SessionEvents.RAG_RESPONSE_RECEIVED, {
        ragResponse,
        ragMessage,
      });

      this.logger.log(
        `RAG respondió en ${ragResponse.latencyMs}ms para conversación ${message.conversationId}`,
      );
    } catch (error) {
      this.logger.error(`Error llamando al RAG: ${(error as Error).message}`);
      this.eventEmitter.emit(SessionEvents.RAG_ERROR, {
        conversationId: message.conversationId,
        originMessageId: message.id,
        error: (error as Error).message,
      });
    }
  }

  private async callRagEndpoint(request: RagRequest): Promise<RagResponse> {
    const start = Date.now();

    // ─── MODO SIMULADO ──────────────────────────────────────────────────────
    // DECISIÓN: la simulación replica la latencia real (~300-800ms) y el
    // contrato de respuesta del endpoint RAG. 
    // Reemplazar por el bloque HTTP real de abajo cuando el servicio RAG esté disponible.
    await this.simulateLatency();

    return {
      conversationId: request.conversationId,
      originMessageId: request.messageId,
      answer: `[RAG simulado] Respuesta para: "${request.query}"`,
      sources: ['doc-001', 'doc-042'],
      confidence: 0.87,
      latencyMs: Date.now() - start,
    };
    // ────────────────────────────────────────────────────────────────────────

    // ─── MODO REAL (descomentar cuando RAG esté disponible) ─────────────────
    // const { data } = await firstValueFrom(
    //   this.httpService.post<RagResponse>(`${RAG_SERVICE_URL}/query`, {
    //     query: request.query,
    //     conversation_id: request.conversationId,
    //     context: request.context,
    //   }),
    // );
    // return { ...data, latencyMs: Date.now() - start };
    // ────────────────────────────────────────────────────────────────────────
  }

  private simulateLatency(): Promise<void> {
    const ms = 300 + Math.random() * 500;
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}