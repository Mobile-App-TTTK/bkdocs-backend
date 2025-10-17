import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@common/enums/user-role.enum';
import { ROLES_KEY } from '@common/constants/roles-key.constants';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);