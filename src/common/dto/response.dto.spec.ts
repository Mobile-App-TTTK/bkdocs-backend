import { ResponseDto } from './response.dto';

describe('ResponseDto', () => {
  describe('success', () => {
    it('should create success response with data', () => {
      const data = { id: 1, name: 'Test' };
      const result = ResponseDto.success(data);

      expect(result).toBeInstanceOf(ResponseDto);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.message).toBe('Thành công');
      expect(result.statusCode).toBeUndefined();
    });

    it('should create success response with custom message', () => {
      const data = { id: 1 };
      const message = 'Created successfully';
      const result = ResponseDto.success(data, message);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.message).toBe(message);
    });

    it('should create success response with null data', () => {
      const result = ResponseDto.success(null);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should create success response with undefined data', () => {
      const result = ResponseDto.success(undefined);

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });
  });

  describe('error', () => {
    it('should create error response with message and status code', () => {
      const message = 'Error occurred';
      const statusCode = 400;
      const result = ResponseDto.error(message, statusCode);

      expect(result).toBeInstanceOf(ResponseDto);
      expect(result.success).toBe(false);
      expect(result.message).toBe(message);
      expect(result.statusCode).toBe(statusCode);
      expect(result.data).toBeUndefined();
    });

    it('should create error response with default message', () => {
      const result = ResponseDto.error('Not found', 404);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Not found');
      expect(result.statusCode).toBe(404);
    });

    it('should create error response with 500 status', () => {
      const result = ResponseDto.error('Internal server error', 500);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
    });
  });

  describe('constructor', () => {
    it('should initialize with all properties', () => {
      const dto = new ResponseDto(true, { test: 'data' }, 'Success', 200);

      expect(dto.success).toBe(true);
      expect(dto.data).toEqual({ test: 'data' });
      expect(dto.message).toBe('Success');
      expect(dto.statusCode).toBe(200);
    });

    it('should initialize with minimal properties', () => {
      const dto = new ResponseDto(false, null, 'Error');

      expect(dto.success).toBe(false);
      expect(dto.data).toBeNull();
      expect(dto.message).toBe('Error');
      expect(dto.statusCode).toBeUndefined();
    });
  });
});
