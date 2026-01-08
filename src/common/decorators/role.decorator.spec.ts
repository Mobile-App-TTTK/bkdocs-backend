import { Roles } from './role.decorator';
import { UserRole } from '@common/enums/user-role.enum';
import { ROLES_KEY } from '@common/constants/roles-key.constants';

describe('Roles Decorator', () => {
  it('should be defined', () => {
    expect(Roles).toBeDefined();
  });

  it('should return a decorator function with single role', () => {
    const decorator = Roles(UserRole.ADMIN);
    expect(typeof decorator).toBe('function');
  });

  it('should return a decorator function with multiple roles', () => {
    const decorator = Roles(UserRole.ADMIN, UserRole.STUDENT);
    expect(typeof decorator).toBe('function');
  });

  it('should use correct roles key constant', () => {
    expect(ROLES_KEY).toBeDefined();
    expect(typeof ROLES_KEY).toBe('string');
  });

  it('should handle empty roles array', () => {
    const decorator = Roles();
    expect(typeof decorator).toBe('function');
  });

  it('should handle STUDENT role', () => {
    const decorator = Roles(UserRole.STUDENT);
    expect(decorator).toBeDefined();
  });
});
