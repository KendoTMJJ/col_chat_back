export enum SessionEvents {
  // ─── Phase 1: Sessions ──────────────────────────────────────
  SESSION_CREATED      = 'session.created',
  SESSION_RECONNECTED  = 'session.reconnected',
  SESSION_ACTIVITY     = 'session.activity',
  SESSION_EXPIRED      = 'session.expired',
  SESSION_DISCONNECTED = 'session.disconnected',

  // ─── Phase 2: Conversations ─────────────────────────────────
  CONVERSATION_CREATED     = 'conversation.created',
  CONVERSATION_USER_JOINED = 'conversation.user.joined',
  CONVERSATION_USER_LEFT   = 'conversation.user.left',
  CONVERSATION_RESET       = 'conversation.reset',

  // ─── Phase 2: Messages ───────────────────────────────────────
  MESSAGE_CREATED   = 'message.created',
  MESSAGE_DELIVERED = 'message.delivered',

  // ─── Phase 2: RAG ────────────────────────────────────────────
  RAG_REQUEST_SENT      = 'rag.request.sent',
  RAG_RESPONSE_RECEIVED = 'rag.response.received',
  RAG_ERROR             = 'rag.error',
}