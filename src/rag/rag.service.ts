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
const RAG_SERVICE_URL = String(process.env.RAG_SERVICE_URL);

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

    // ─── MODO REAL: RAG maneja su propia memoria por session_id ─────────────
    // const context = this.messagesService.getContext(message.conversationId, 10);

    // ─── MODO SIMULADO: descomentar si se quiere pasar contexto manual ───────
    // const context = this.messagesService.getContext(message.conversationId, 10);

    const request: RagRequest = {
      conversationId: message.conversationId,
      messageId: message.id,
      query: message.content,
      // context,
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

    // ─── MODO REAL ───────────────────────────────────────────────────────────
    const { data } = await firstValueFrom(
      this.httpService.post<{ respuesta: string }>(
        `${RAG_SERVICE_URL}/rag_memory/`,
        {
          session_id: request.conversationId,
          consulta: request.query,
        },
      ),
    );

    return {
      conversationId: request.conversationId,
      originMessageId: request.messageId,
      answer: data.respuesta,
      latencyMs: Date.now() - start,
    };
    // ─────────────────────────────────────────────────────────────────────────

    // ─── MODO SIMULADO ───────────────────────────────────────────────────────
    // await this.simulateLatency();
    // return {
    //   conversationId: request.conversationId,
    //   originMessageId: request.messageId,
    //   answer: `[RAG simulado] Respuesta para: "${request.query}"`,
    //   sources: ['doc-001', 'doc-042'],
    //   confidence: 0.87,
    //   latencyMs: Date.now() - start,
    // };
    // ─────────────────────────────────────────────────────────────────────────
  }

  private simulateLatency(): Promise<void> {
    const ms = 300 + Math.random() * 500;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async uploadDocument(
    file: Express.Multer.File,
  ): Promise<{ message: string }> {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), // ← Uint8Array en vez de cast
      file.originalname,
    );

    await firstValueFrom(
      this.httpService.post(`${RAG_SERVICE_URL}/documentos/`, formData),
    );

    return { message: 'Documento subido correctamente' };
  }
}
