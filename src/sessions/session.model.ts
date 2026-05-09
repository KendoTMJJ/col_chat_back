export interface UserSession {
  sessionId: string;
  userId: string;
  tabId: string;
  sockets: Set<string>;
  connectedAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  conversationId: string | null;
  history: Array<{
    sender: 'user' | 'bot';
    message: string;
  }>;
  rol: string;
  canEditRag: boolean;
}
