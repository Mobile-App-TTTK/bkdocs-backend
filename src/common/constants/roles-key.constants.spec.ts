import { ROLES_KEY } from './roles-key.constants';

describe('Roles Key Constants', () => {
  it('should have ROLES_KEY defined', () => {
    expect(ROLES_KEY).toBeDefined();
  });

  it('should have correct value for ROLES_KEY', () => {
    expect(ROLES_KEY).toBe('roles');
  });

  it('should be a string', () => {
    expect(typeof ROLES_KEY).toBe('string');
  });

  it('should not be empty', () => {
    expect(ROLES_KEY.length).toBeGreaterThan(0);
  });
});
