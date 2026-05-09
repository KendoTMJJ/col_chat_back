export interface Conversation {
  id: string;
  title: string;
  participantIds: string[];       // userIds
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}