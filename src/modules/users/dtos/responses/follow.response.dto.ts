export class FollowResponseDto {
  action: 'followed' | 'unfollowed' | 'noop';
  isFollowing: boolean;
  followersCount: number;

  constructor(partial: Partial<FollowResponseDto>) {
    Object.assign(this, partial);
  }
}
