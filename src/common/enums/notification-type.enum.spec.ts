import { NotificationType } from './notification-type.enum';

describe('NotificationType Enum', () => {
  it('should have DOCUMENT type', () => {
    expect(NotificationType.DOCUMENT).toBe('document');
  });

  it('should have DOCUMENT_APPROVED type', () => {
    expect(NotificationType.DOCUMENT_APPROVED).toBe('document_approved');
  });

  it('should have COMMENT type', () => {
    expect(NotificationType.COMMENT).toBe('comment');
  });

  it('should have PROFILE type', () => {
    expect(NotificationType.PROFILE).toBe('profile');
  });

  it('should have exactly 4 values', () => {
    const values = Object.values(NotificationType);
    expect(values.length).toBe(4);
  });

  it('should contain all expected values', () => {
    const values = Object.values(NotificationType);
    expect(values).toContain('document');
    expect(values).toContain('document_approved');
    expect(values).toContain('comment');
    expect(values).toContain('profile');
  });
});
