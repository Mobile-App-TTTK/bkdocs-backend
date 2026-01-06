import { Test, TestingModule } from '@nestjs/testing';
import { S3Service } from './s3.service';
import { ConfigService } from '@nestjs/config';
import {
  HeadBucketCommand,
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { InternalServerErrorException } from '@nestjs/common';

describe('S3Service', () => {
  let service: S3Service;
  let s3Client: any;
  let configService: ConfigService;

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.from('test file content'),
    size: 1024,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  beforeEach(async () => {
    const mockS3Client = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: 'S3_CLIENT',
          useValue: mockS3Client,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'S3_BUCKET') return 'test-bucket';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
    s3Client = module.get('S3_CLIENT') as any;
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should check if bucket exists', async () => {
      s3Client.send.mockResolvedValueOnce({});

      await service.onModuleInit();

      expect(s3Client.send).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
    });

    it('should create bucket if it does not exist', async () => {
      const notFoundError: any = new Error('Not Found');
      notFoundError.name = 'NotFound';

      s3Client.send.mockRejectedValueOnce(notFoundError).mockResolvedValueOnce({});

      await service.onModuleInit();

      expect(s3Client.send).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
      expect(s3Client.send).toHaveBeenCalledWith(expect.any(CreateBucketCommand));
    });

    it('should handle 404 errors and create bucket', async () => {
      const notFoundError: any = new Error('Not Found');
      notFoundError.$metadata = { httpStatusCode: 404 };

      s3Client.send.mockRejectedValueOnce(notFoundError).mockResolvedValueOnce({});

      await service.onModuleInit();

      expect(s3Client.send).toHaveBeenCalledWith(expect.any(CreateBucketCommand));
    });

    it('should handle other errors gracefully', async () => {
      const otherError = new Error('Some other error');
      s3Client.send.mockRejectedValueOnce(otherError);

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('uploadFile', () => {
    it('should upload file to S3', async () => {
      s3Client.send.mockResolvedValueOnce({});

      const result = await service.uploadFile(mockFile, 'documents');

      expect(result).toContain('documents/');
      expect(result).toContain(mockFile.originalname);
      expect(s3Client.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    });

    it('should upload file with default folder', async () => {
      s3Client.send.mockResolvedValueOnce({});

      const result = await service.uploadFile(mockFile);

      expect(result).toContain('documents/');
    });

    it('should throw InternalServerErrorException on upload failure', async () => {
      s3Client.send.mockRejectedValueOnce(new Error('Upload failed'));

      await expect(service.uploadFile(mockFile, 'documents')).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it('should upload file to custom folder', async () => {
      s3Client.send.mockResolvedValueOnce({});

      const result = await service.uploadFile(mockFile, 'avatars');

      expect(result).toContain('avatars/');
    });

    it('should handle special characters in filename', async () => {
      s3Client.send.mockResolvedValueOnce({});

      const specialFile = {
        ...mockFile,
        originalname: 'tài-liệu (đặc-biệt).pdf',
      };

      const result = await service.uploadFile(specialFile, 'documents');

      expect(result).toContain('documents/');
      expect(s3Client.send).toHaveBeenCalled();
    });

    it('should generate unique keys for same filename', async () => {
      s3Client.send.mockResolvedValue({});

      const result1 = await service.uploadFile(mockFile, 'documents');
      const result2 = await service.uploadFile(mockFile, 'documents');

      expect(result1).not.toBe(result2);
    });

    it('should upload to different folders', async () => {
      s3Client.send.mockResolvedValue({});

      const folders = ['documents', 'images', 'avatars', 'thumbnails'];
      const results = await Promise.all(
        folders.map((folder) => service.uploadFile(mockFile, folder))
      );

      folders.forEach((folder, index) => {
        expect(results[index]).toContain(`${folder}/`);
      });
    });

    it('should handle concurrent uploads', async () => {
      s3Client.send.mockResolvedValue({});

      const uploads = Array.from({ length: 5 }, (_, i) => ({
        ...mockFile,
        originalname: `file-${i}.pdf`,
      }));

      const results = await Promise.all(
        uploads.map((file) => service.uploadFile(file, 'documents'))
      );

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toContain('documents/');
      });
    });

    it('should include timestamp in file key', async () => {
      s3Client.send.mockResolvedValue({});

      const result = await service.uploadFile(mockFile, 'documents');

      expect(result).toMatch(/documents\/\d+-[a-f0-9-]+-test\.pdf/);
    });

    it('should preserve file extension', async () => {
      s3Client.send.mockResolvedValue({});

      const pdfFile = { ...mockFile, originalname: 'document.pdf' };
      const pdfResult = await service.uploadFile(pdfFile);

      const docxFile = { ...mockFile, originalname: 'document.docx' };
      const docxResult = await service.uploadFile(docxFile);

      expect(pdfResult).toContain('.pdf');
      expect(docxResult).toContain('.docx');
    });
  });

  describe('getFileBuffer', () => {
    it('should retrieve file buffer from S3', async () => {
      const mockChunks = [Buffer.from('file'), Buffer.from(' content')];
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        },
      };

      s3Client.send.mockResolvedValueOnce({ Body: mockStream });

      const result = await service.getFileBuffer('documents/file.pdf');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('file content');
      expect(s3Client.send).toHaveBeenCalledWith(expect.any(GetObjectCommand));
    });

    it('should throw InternalServerErrorException on retrieval failure', async () => {
      s3Client.send.mockRejectedValueOnce(new Error('S3 Error'));

      await expect(service.getFileBuffer('documents/file.pdf')).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it('should handle large file buffers', async () => {
      const largeChunk = Buffer.alloc(10 * 1024 * 1024); // 10MB
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield largeChunk;
        },
      };

      s3Client.send.mockResolvedValueOnce({ Body: mockStream });

      const result = await service.getFileBuffer('documents/large-file.pdf');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(10 * 1024 * 1024);
    });

    it('should handle multiple chunks', async () => {
      const chunks = [Buffer.from('chunk1'), Buffer.from('chunk2'), Buffer.from('chunk3')];
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
      };

      s3Client.send.mockResolvedValueOnce({ Body: mockStream });

      const result = await service.getFileBuffer('documents/file.pdf');

      expect(result.toString()).toBe('chunk1chunk2chunk3');
    });

    it('should handle empty file', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          // No chunks
        },
      };

      s3Client.send.mockResolvedValueOnce({ Body: mockStream });

      const result = await service.getFileBuffer('documents/empty.pdf');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(0);
    });

    it('should include file key in GetObjectCommand', async () => {
      const fileKey = 'documents/test-file.pdf';
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('content');
        },
      };

      s3Client.send.mockResolvedValueOnce({ Body: mockStream });

      await service.getFileBuffer(fileKey);

      expect(s3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Key: fileKey,
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle timeout errors', async () => {
      s3Client.send.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(service.uploadFile(mockFile)).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle network errors in getFileBuffer', async () => {
      s3Client.send.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.getFileBuffer('documents/file.pdf')).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it('should log errors appropriately', async () => {
      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');
      s3Client.send.mockRejectedValueOnce(new Error('S3 Error'));

      await expect(service.getFileBuffer('documents/file.pdf')).rejects.toThrow();

      expect(loggerErrorSpy).toHaveBeenCalled();
    });
  });

  describe('file operations', () => {
    it('should handle files with no extension', async () => {
      s3Client.send.mockResolvedValue({});

      const noExtFile = { ...mockFile, originalname: 'README' };
      const result = await service.uploadFile(noExtFile);

      expect(result).toContain('documents/');
      expect(result).toContain('README');
    });

    it('should handle files with multiple dots', async () => {
      s3Client.send.mockResolvedValue({});

      const multiDotFile = { ...mockFile, originalname: 'my.file.name.pdf' };
      const result = await service.uploadFile(multiDotFile);

      expect(result).toContain('my.file.name.pdf');
    });

    it('should handle very long filenames', async () => {
      s3Client.send.mockResolvedValue({});

      const longName = 'a'.repeat(200) + '.pdf';
      const longFile = { ...mockFile, originalname: longName };
      const result = await service.uploadFile(longFile);

      expect(result).toContain('documents/');
    });
  });
});
