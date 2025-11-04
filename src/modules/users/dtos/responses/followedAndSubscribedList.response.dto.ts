import { ApiProperty } from '@nestjs/swagger';

export class FollowedAndSubscribedListResponseDto {
  @ApiProperty()
  followingUsers: { id: string; name: string; documentCount: number }[];

  @ApiProperty()
  subscribedFacultyIds: { id: string; name: string; documentCount: number }[];

  @ApiProperty()
  subscribedSubjectIds: { id: string; name: string; documentCount: number }[];

  constructor(partial: Partial<FollowedAndSubscribedListResponseDto>) {
    Object.assign(this, partial);
  }
}
