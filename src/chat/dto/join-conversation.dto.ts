import { IsString, IsNotEmpty } from 'class-validator';

export class JoinConversationDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;
}