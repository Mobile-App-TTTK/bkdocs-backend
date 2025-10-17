// src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '@common/constants/public-key.constants';
export const Public = () => {
  console.log('[Decorator] Setting isPublic = true'); // 🧠 test log
  return SetMetadata(IS_PUBLIC_KEY, true);
};
