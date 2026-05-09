export interface UserSession {
  sessionId: string;
  userId: string;
  socketId: string;
  connectedAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}