import { validate } from 'class-validator';
import { LoginUserDto } from './login-user.dto';

describe('LoginUserDto', () => {
  it('should be defined', () => {
    const dto = new LoginUserDto();
    expect(dto).toBeDefined();
  });

  it('should validate a valid login dto', async () => {
    const dto = new LoginUserDto();
    dto.email = 'test@example.com';
    dto.password = 'password123';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation with invalid email', async () => {
    const dto = new LoginUserDto();
    dto.email = 'invalid-email';
    dto.password = 'password123';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('email');
  });

  it('should fail validation with empty password', async () => {
    const dto = new LoginUserDto();
    dto.email = 'test@example.com';
    dto.password = '';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('password');
  });

  it('should fail validation with missing email', async () => {
    const dto = new LoginUserDto();
    dto.password = 'password123';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
