import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { UserSession } from './session.model';
import { SessionEvents } from '../events/app-events.enum';

const SESSION_TTL_MS = 20000;

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly sessions = new Map<string, UserSession>();
  // Índice inverso: userId → sessionId (para reconexión)
  private readonly userIndex = new Map<string, string>();

  constructor(private readonly eventEmitter: EventEmitter2) {
    // Limpieza periódica cada 5 minutos
    setInterval(() => this.purgeExpiredSessions(), 20000);
  }

  // ─── Creación / Reconexión ────────────────────────────────────────────────

  createOrReconnect(userId: string, socketId: string): UserSession {
    const existingSessionId = this.userIndex.get(userId);

    if (existingSessionId) {
      const existing = this.sessions.get(existingSessionId);
      if (existing && !this.isExpired(existing)) {
        return this.reconnect(existing, socketId);
      }
    }

    return this.create(userId, socketId);
  }

  private create(userId: string, socketId: string): UserSession {
    const session: UserSession = {
      sessionId: uuidv4(),
      userId,
      socketId,
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      isActive: true,
    };

    this.sessions.set(session.sessionId, session);
    this.userIndex.set(userId, session.sessionId);

    this.eventEmitter.emit(SessionEvents.SESSION_CREATED, session);
    this.logger.log(`Sesión creada: ${session.sessionId} para usuario ${userId}`);

    return session;
  }

  private reconnect(session: UserSession, newSocketId: string): UserSession {
    const updated: UserSession = {
      ...session,
      socketId: newSocketId,
      lastActivityAt: new Date(),
      isActive: true,
    };

    this.sessions.set(session.sessionId, updated);
    this.eventEmitter.emit(SessionEvents.SESSION_RECONNECTED, updated);
    this.logger.log(`Reconexión: ${session.sessionId} → nuevo socket ${newSocketId}`);

    return updated;
  }

  // ─── Actividad ────────────────────────────────────────────────────────────

  touch(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivityAt = new Date();
    this.eventEmitter.emit(SessionEvents.SESSION_ACTIVITY, session);
  }

  // ─── Desconexión ──────────────────────────────────────────────────────────

  markDisconnected(socketId: string): void {
    const session = this.findBySocketId(socketId);
    if (!session) return;

    session.isActive = false;
    this.eventEmitter.emit(SessionEvents.SESSION_DISCONNECTED, session);
    this.logger.log(`Socket desconectado: ${socketId}, sesión marcada inactiva`);
  }

  // ─── Expiración ───────────────────────────────────────────────────────────

  private purgeExpiredSessions(): void {
    for (const [id, session] of this.sessions.entries()) {
      if (this.isExpired(session)) {
        this.sessions.delete(id);
        this.userIndex.delete(session.userId);
        this.eventEmitter.emit(SessionEvents.SESSION_EXPIRED, session);
        this.logger.warn(`Sesión expirada y eliminada: ${id}`);
      }
    }
  }

  private isExpired(session: UserSession): boolean {
    return Date.now() - session.lastActivityAt.getTime() > SESSION_TTL_MS;
  }

  // ─── Consultas ────────────────────────────────────────────────────────────

  findBySocketId(socketId: string): UserSession | undefined {
    return [...this.sessions.values()].find(s => s.socketId === socketId);
  }

  findByUserId(userId: string): UserSession | undefined {
    const id = this.userIndex.get(userId);
    return id ? this.sessions.get(id) : undefined;
  }

  getAll(): UserSession[] {
    return [...this.sessions.values()];
  }
}