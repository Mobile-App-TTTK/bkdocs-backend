import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SaveFcmTokenDto {
  @ApiProperty({
    description: 'FCM token từ device',
    example: 'dK1Z2X3Y4...',
  })
  @IsNotEmpty({ message: 'FCM token không được để trống' })
  @IsString({ message: 'FCM token phải là chuỗi' })
  fcmToken: string;
}
