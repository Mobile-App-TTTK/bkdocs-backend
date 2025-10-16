import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export const ApiErrorResponseSwaggerWrapper = (options?: {
  status?: number;
  description?: string;
}) => {
  const status = options?.status ?? 500;
  const description = options?.description ?? 'Lỗi hệ thống';

  return applyDecorators(
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: status },
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: description },
        },
      },
    }),
  );
};
