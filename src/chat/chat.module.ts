import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { SessionsModule } from '../sessions/sessions.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      secret: String(process.env.JWT_SECRET),
    }),
    SessionsModule,
    ConversationsModule,
    MessagesModule,
  ],
  providers: [ChatGateway],
})
export class ChatModule {}
