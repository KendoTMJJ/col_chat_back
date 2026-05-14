import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { UserSession } from './session.model';
import { SessionEvents } from '../events/app-events.enum';

const SESSION_TTL_MS = 3 * 60 * 1000; // ← 30 minutos

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly sessions = new Map<string, UserSession>();

  constructor(private readonly eventEmitter: EventEmitter2) {
    // Limpieza periódica cada 5 minutos
    setInterval(() => this.purgeExpiredSessions(), 3 * 60 * 1000);
  }

  // ─── Creación / Reconexión ────────────────────────────────────────────────

  private readonly tabIndex = new Map<string, string>(); // tabId → sessionId

  createOrReconnect(
    userId: string,
    tabId: string,
    socketId: string,
    rol: string,
  ): UserSession {
    const existingId = this.tabIndex.get(tabId);

    if (existingId) {
      const existing = this.sessions.get(existingId);
      if (existing && !this.isExpired(existing)) {
        existing.sockets.add(socketId);
        existing.isActive = true;
        existing.lastActivityAt = new Date();
        return existing;
      }
    }

    return this.create(userId, tabId, socketId, rol);
  }

  private create(
    userId: string,
    tabId: string,
    socketId: string,
    rol: string,
  ): UserSession {
    const session: UserSession = {
      sessionId: uuidv4(),
      userId,
      tabId,
      sockets: new Set([socketId]), // ← Set en vez de string
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      isActive: true,
      conversationId: null,
      history: [],
      rol,
      canEditRag: rol === 'superadmin',
    };

    this.sessions.set(session.sessionId, session);
    this.tabIndex.set(tabId, session.sessionId); // ← índice por tabId
    this.eventEmitter.emit(SessionEvents.SESSION_CREATED, session);
    return session;
  }

  // ─── Actividad ────────────────────────────────────────────────────────────

  touch(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivityAt = new Date();
    this.eventEmitter.emit(SessionEvents.SESSION_ACTIVITY, session);
  }

  findByConversationId(conversationId: string): UserSession | undefined {
    return [...this.sessions.values()].find(
      (s) => s.conversationId === conversationId,
    );
  }

  // ─── Desconexión ──────────────────────────────────────────────────────────

  markDisconnected(socketId: string): void {
    const session = this.findBySocketId(socketId);
    if (!session) return;

    session.isActive = false;
    this.eventEmitter.emit(SessionEvents.SESSION_DISCONNECTED, session);
    this.logger.log(
      `Socket desconectado: ${socketId}, sesión marcada inactiva`,
    );
  }

  // ─── Expiración ───────────────────────────────────────────────────────────

  private purgeExpiredSessions(): void {
    for (const [id, session] of this.sessions.entries()) {
      if (this.isExpired(session)) {
        this.sessions.delete(id);
        this.tabIndex.delete(session.tabId);
        this.eventEmitter.emit(SessionEvents.SESSION_EXPIRED, session);
        this.logger.warn(`Sesión expirada y eliminada: ${id}`);
      }
    }
  }

  private isExpired(session: UserSession): boolean {
    return Date.now() - session.lastActivityAt.getTime() > SESSION_TTL_MS;
  }

  // ─── Reset de conversación ────────────────────────────────────────────────

  resetConversation(sessionId: string): UserSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.history = [];
    session.conversationId = null;
    session.lastActivityAt = new Date();

    this.eventEmitter.emit(SessionEvents.CONVERSATION_RESET, session);
    this.logger.log(`Conversación reiniciada: sesión ${sessionId}`);
    return session;
  }

  // ─── Consultas ────────────────────────────────────────────────────────────

  findBySocketId(socketId: string): UserSession | undefined {
    return [...this.sessions.values()].find((s) => s.sockets.has(socketId));
  }

  getAll(): UserSession[] {
    return [...this.sessions.values()];
  }
}
