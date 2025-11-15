import { ApiProperty } from '@nestjs/swagger';

export class FollowedAndSubscribedListResponseDto {
  @ApiProperty()
  followingUsers: { id: string; name: string; documentCount: number; imageUrl: string }[];

  @ApiProperty()
  subscribedFacultyIds: { id: string; name: string; documentCount: number; imageUrl: string }[];

  @ApiProperty()
  subscribedSubjectIds: { id: string; name: string; documentCount: number; imageUrl: string }[];

  constructor(partial: Partial<FollowedAndSubscribedListResponseDto>) {
    Object.assign(this, partial);
  }
}
