import { CallHandler, ExecutionContext } from '@nestjs/common';
import { throwError, of } from 'rxjs';
import { SentryInterceptor } from './sentry.interceptor';
import * as Sentry from '@sentry/node';

jest.mock('@sentry/node');

describe('SentryInterceptor', () => {
  let interceptor: SentryInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new SentryInterceptor();
    mockExecutionContext = {} as ExecutionContext;
    mockCallHandler = {
      handle: jest.fn(),
    } as any;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should pass through successful requests', (done) => {
    const testData = { success: true };
    mockCallHandler.handle = jest.fn().mockReturnValue(of(testData));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual(testData);
        expect(Sentry.captureException).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('should capture exceptions with Sentry', (done) => {
    const testError = new Error('Test error');
    mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => testError));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      error: (error) => {
        expect(error).toBe(testError);
        expect(Sentry.captureException).toHaveBeenCalledWith(testError);
        done();
      },
    });
  });

  it('should capture HTTP exceptions', (done) => {
    const httpError = new Error('Bad Request');
    mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => httpError));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      error: (error) => {
        expect(error).toBe(httpError);
        expect(Sentry.captureException).toHaveBeenCalledWith(httpError);
        done();
      },
    });
  });

  it('should not interfere with multiple successful requests', (done) => {
    mockCallHandler.handle = jest
      .fn()
      .mockReturnValueOnce(of({ data: 1 }))
      .mockReturnValueOnce(of({ data: 2 }));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual({ data: 1 });
      },
    });

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual({ data: 2 });
        expect(Sentry.captureException).not.toHaveBeenCalled();
        done();
      },
    });
  });
});
