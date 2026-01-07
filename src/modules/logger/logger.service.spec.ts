import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from './logger.service';

describe('AppLoggerService', () => {
  let service: AppLoggerService;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppLoggerService],
    }).compile();

    service = module.get<AppLoggerService>(AppLoggerService);

    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should log message with LOG prefix', () => {
      const message = 'Test log message';
      service.log(message);

      expect(consoleLogSpy).toHaveBeenCalledWith('🟢 [LOG]', message);
    });

    it('should handle empty message', () => {
      service.log('');
      expect(consoleLogSpy).toHaveBeenCalledWith('🟢 [LOG]', '');
    });
  });

  describe('error', () => {
    it('should log error message with ERROR prefix', () => {
      const message = 'Test error message';
      service.error(message);

      expect(consoleErrorSpy).toHaveBeenCalledWith('🔴 [ERROR]', message, undefined);
    });

    it('should log error with trace', () => {
      const message = 'Test error';
      const trace = 'Error stack trace';
      service.error(message, trace);

      expect(consoleErrorSpy).toHaveBeenCalledWith('🔴 [ERROR]', message, trace);
    });
  });

  describe('warn', () => {
    it('should log warning message with WARN prefix', () => {
      const message = 'Test warning message';
      service.warn(message);

      expect(consoleWarnSpy).toHaveBeenCalledWith('🟡 [WARN]', message);
    });
  });

  describe('debug', () => {
    it('should log debug message with DEBUG prefix', () => {
      const message = 'Test debug message';
      service.debug(message);

      expect(consoleDebugSpy).toHaveBeenCalledWith('🔵 [DEBUG]', message);
    });
  });

  describe('verbose', () => {
    it('should log verbose message with VERBOSE prefix', () => {
      const message = 'Test verbose message';
      service.verbose(message);

      expect(consoleInfoSpy).toHaveBeenCalledWith('🟣 [VERBOSE]', message);
    });
  });
});
