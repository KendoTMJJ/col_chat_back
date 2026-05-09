import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/chat', {
  query: { userId: 'user-001' },
});

socket.on('session:ready', ({ sessionId }) => {
  console.log('Sesión:', sessionId);

  // Crear conversación
  socket.emit('conversation:create', {
    title: 'Soporte técnico',
    participantIds: ['user-001', 'user-002'],
  });
});

socket.on('conversation:created', (conv) => {
  // Enviar mensaje a la conversación recién creada
  socket.emit('message:send', {
    conversationId: conv.id,
    content: '¿Cómo configuro el módulo de sesiones?',
  });
});

socket.on('message:new',  (msg) => console.log('[USER]', msg.content));
socket.on('message:rag',  (msg) => console.log('[RAG ]', msg.content));
socket.on('rag:error',    (err) => console.error('[RAG ERROR]', err));