import { IsString, IsArray, IsOptional, MinLength, ArrayMinSize } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsArray()
  @ArrayMinSize(1)
  participantIds!: string[];

  @IsOptional()
  metadata?: Record<string, unknown>;
}