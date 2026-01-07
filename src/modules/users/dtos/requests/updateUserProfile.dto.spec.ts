import { UpdateUserProfileDto } from './updateUserProfile.dto';

describe('UpdateUserProfileDto', () => {
  it('should be defined', () => {
    const dto = new UpdateUserProfileDto({});
    expect(dto).toBeDefined();
  });

  it('should create dto with all fields', () => {
    const data = {
      name: 'John Doe',
      facultyId: '4e5fe7ad-5163-4278-8592-8a89e67a17c5',
      intakeYear: 2022,
    };
    const dto = new UpdateUserProfileDto(data);

    expect(dto.name).toBe(data.name);
    expect(dto.facultyId).toBe(data.facultyId);
    expect(dto.intakeYear).toBe(data.intakeYear);
  });

  it('should create dto with partial fields', () => {
    const dto = new UpdateUserProfileDto({ name: 'Jane Doe' });

    expect(dto.name).toBe('Jane Doe');
    expect(dto.facultyId).toBeUndefined();
    expect(dto.intakeYear).toBeUndefined();
  });

  it('should create dto with empty object', () => {
    const dto = new UpdateUserProfileDto({});

    expect(dto.name).toBeUndefined();
    expect(dto.facultyId).toBeUndefined();
    expect(dto.intakeYear).toBeUndefined();
  });

  it('should handle facultyId only', () => {
    const dto = new UpdateUserProfileDto({ facultyId: 'faculty-123' });

    expect(dto.facultyId).toBe('faculty-123');
    expect(dto.name).toBeUndefined();
  });

  it('should handle intakeYear only', () => {
    const dto = new UpdateUserProfileDto({ intakeYear: 2023 });

    expect(dto.intakeYear).toBe(2023);
    expect(dto.name).toBeUndefined();
  });
});
