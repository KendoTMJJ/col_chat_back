const { io } = require('socket.io-client');

const USER_ID = 'user-abc-123';

const socket = io('http://localhost:3000', {
  query: { userId: USER_ID },
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});

// ─────────────────────────────
// 🔌 CONEXIÓN
// ─────────────────────────────

socket.on('connect', () => {
  console.log('✅ Conectado:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Desconectado:', reason);
});

// ─────────────────────────────
// 🧠 SESIONES
// ─────────────────────────────

socket.on('session:ready', ({ sessionId }) => {
  console.log('🟢 Sesión activa:', sessionId);
});

socket.on('session:resumed', (data) => {
  console.log('🔄 Reconectada:', data);
});

socket.on('session:expired', (data) => {
  console.warn('⏳ Expirada:', data);
});

// ─────────────────────────────
// 📡 PING / ACTIVIDAD
// ─────────────────────────────

setInterval(() => {
  console.log('📡 ping');
  socket.emit('ping');
}, 5000);

// ─────────────────────────────
// 💥 SIMULACIÓN DE CAÍDA
// ─────────────────────────────

setTimeout(() => {
  console.log('\n💥 Simulando desconexión...\n');
  socket.disconnect();
}, 15000);

// ─────────────────────────────
// 🔄 SIMULACIÓN DE RECONEXIÓN
// ─────────────────────────────

setTimeout(() => {
  console.log('\n🔄 Reconectando...\n');
  socket.connect();
}, 22000);