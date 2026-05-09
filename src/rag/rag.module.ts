import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RagService } from './rag.service';
import { MessagesModule } from '../messages/messages.module';
import { RagController } from './rag.controller';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      secret: String(process.env.JWT_SECRET),
    }),
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 5,
    }),
    MessagesModule,
  ],
  controllers: [RagController],
  providers: [RagService],
})
export class RagModule {}
