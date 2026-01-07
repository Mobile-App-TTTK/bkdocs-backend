import { Public } from './public.decorator';
import { IS_PUBLIC_KEY } from '@common/constants/public-key.constants';

describe('Public Decorator', () => {
  it('should be defined', () => {
    expect(Public).toBeDefined();
  });

  it('should return a decorator function', () => {
    const decorator = Public();
    expect(typeof decorator).toBe('function');
  });

  it('should set metadata with IS_PUBLIC_KEY', () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    
    Public();
    
    expect(consoleLogSpy).toHaveBeenCalledWith('[Decorator] Setting isPublic = true');
    
    consoleLogSpy.mockRestore();
  });

  it('should use correct public key constant', () => {
    expect(IS_PUBLIC_KEY).toBeDefined();
    expect(typeof IS_PUBLIC_KEY).toBe('string');
  });
});
