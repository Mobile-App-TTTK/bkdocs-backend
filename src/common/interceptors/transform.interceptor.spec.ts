import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseInterceptor } from './transform.interceptor';
import { ResponseDto } from '@common/dto/response.dto';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<any>;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();

    mockExecutionContext = {} as ExecutionContext;

    mockCallHandler = {
      handle: jest.fn(),
    } as any;
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should wrap data in ResponseDto.success', (done) => {
    const testData = { id: 1, name: 'Test' };
    mockCallHandler.handle = jest.fn().mockReturnValue(of(testData));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
      expect(result).toBeInstanceOf(ResponseDto);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(testData);
      done();
    });
  });

  it('should not wrap if data is already ResponseDto', (done) => {
    const responseDto = ResponseDto.success({ id: 1 });
    mockCallHandler.handle = jest.fn().mockReturnValue(of(responseDto));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
      expect(result).toBe(responseDto);
      expect(result.success).toBe(true);
      done();
    });
  });

  it('should handle null data', (done) => {
    mockCallHandler.handle = jest.fn().mockReturnValue(of(null));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
      expect(result).toBeInstanceOf(ResponseDto);
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      done();
    });
  });

  it('should handle undefined data', (done) => {
    mockCallHandler.handle = jest.fn().mockReturnValue(of(undefined));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
      expect(result).toBeInstanceOf(ResponseDto);
      expect(result.success).toBe(true);
      done();
    });
  });

  it('should handle array data', (done) => {
    const arrayData = [{ id: 1 }, { id: 2 }];
    mockCallHandler.handle = jest.fn().mockReturnValue(of(arrayData));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
      expect(result).toBeInstanceOf(ResponseDto);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(arrayData);
      expect(Array.isArray(result.data)).toBe(true);
      done();
    });
  });

  it('should handle string data', (done) => {
    const stringData = 'Hello World';
    mockCallHandler.handle = jest.fn().mockReturnValue(of(stringData));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
      expect(result).toBeInstanceOf(ResponseDto);
      expect(result.success).toBe(true);
      expect(result.data).toBe(stringData);
      done();
    });
  });
});
