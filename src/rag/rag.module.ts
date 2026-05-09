import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RagService } from './rag.service';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10_000,
      maxRedirects: 3,
    }),
    MessagesModule,
  ],
  providers: [RagService],
})
export class RagModule {}