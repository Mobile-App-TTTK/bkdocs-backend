export class CreateNotificationDto {
  type: string;
  targetId: string;
  message: string;
  userId: string;

  constructor(partial?: Partial<CreateNotificationDto>) {
    Object.assign(this, partial);
  }
}
