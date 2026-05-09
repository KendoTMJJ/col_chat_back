import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Phase 1
import { SessionsModule } from './sessions/sessions.module';

// Phase 2
import { ChatModule } from './chat/chat.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      // DECISIÓN: wildcard true permite suscribirse con patrones tipo
      // 'message.*' o 'session.*' en listeners futuros.
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),
    // Phase 1
    SessionsModule,
    // Phase 2
    ConversationsModule,
    MessagesModule,
    ChatModule,
    RagModule,
  ],
})
export class AppModule {}