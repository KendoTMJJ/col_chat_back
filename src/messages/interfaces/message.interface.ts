// DECISIÓN: el tipo 'rag' permite distinguir respuestas automáticas
// del sistema de las respuestas de usuarios en el cliente
export type MessageType = 'user' | 'rag' | 'system';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;              // userId o 'rag-system'
  content: string;
  type: MessageType;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}