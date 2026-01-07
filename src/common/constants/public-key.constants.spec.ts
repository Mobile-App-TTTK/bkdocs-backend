import { IS_PUBLIC_KEY } from './public-key.constants';

describe('Public Key Constants', () => {
  it('should have IS_PUBLIC_KEY defined', () => {
    expect(IS_PUBLIC_KEY).toBeDefined();
  });

  it('should have correct value for IS_PUBLIC_KEY', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  it('should be a string', () => {
    expect(typeof IS_PUBLIC_KEY).toBe('string');
  });

  it('should not be empty', () => {
    expect(IS_PUBLIC_KEY.length).toBeGreaterThan(0);
  });
});
