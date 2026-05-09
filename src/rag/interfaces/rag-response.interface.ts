export interface RagRequest {
  conversationId: string;
  messageId: string;
  query: string;
  context?: string[];            // mensajes previos pasados como contexto
}

export interface RagResponse {
  conversationId: string;
  originMessageId: string;
  answer: string;
  sources?: string[];
  confidence?: number;
  latencyMs?: number;
}