import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './role.guard';
import { ROLES_KEY } from '@common/constants/roles-key.constants';
import { UserRole } from '@common/enums/user-role.enum';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    let mockContext: ExecutionContext;
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        user: {
          userId: '123',
          email: 'test@example.com',
          role: UserRole.STUDENT,
        },
      };

      mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as any;
    });

    it('should return true if no roles are required', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return true if user has required role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.STUDENT]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException if user does not have required role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow('Bạn không có quyền truy cập');
    });

    it('should throw ForbiddenException if user is not present', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.STUDENT]);
      mockRequest.user = null;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should allow admin role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
      mockRequest.user.role = UserRole.ADMIN;

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should check multiple roles', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.ADMIN, UserRole.STUDENT]);
      mockRequest.user.role = UserRole.STUDENT;

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });
});
