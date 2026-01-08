import { Status } from './status.enum';

describe('Status Enum', () => {
  it('should have ACTIVE status', () => {
    expect(Status.ACTIVE).toBe('active');
  });

  it('should have INACTIVE status', () => {
    expect(Status.INACTIVE).toBe('inactive');
  });

  it('should have PENDING status', () => {
    expect(Status.PENDING).toBe('pending');
  });

  it('should have exactly 3 values', () => {
    const values = Object.values(Status);
    expect(values.length).toBe(3);
  });

  it('should contain all expected values', () => {
    const values = Object.values(Status);
    expect(values).toContain('active');
    expect(values).toContain('inactive');
    expect(values).toContain('pending');
  });
});
