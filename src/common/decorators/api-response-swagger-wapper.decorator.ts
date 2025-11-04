import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ResponseDto } from '../dto/response.dto';

export const ApiResponseSwaggerWrapper = <TModel extends Type<any>>(
  model: TModel,
  options?: { status?: number; description?: string; isArray?: boolean }
) => {
  const status = options?.status ?? 200;
  const description = options?.description ?? 'Thành công';
  const isArray = options?.isArray ?? false;

  return applyDecorators(
    ApiExtraModels(ResponseDto, model),
    ApiResponse({
      status,
      description,
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                type: 'object',
                properties: {
                  statusCode: { type: 'number', example: status },
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: description },
                  data: isArray
                    ? {
                        type: 'array',
                        items: { $ref: getSchemaPath(model) },
                      }
                    : { $ref: getSchemaPath(model) },
                },
              },
            ],
          },
        },
      },
    })
  );
};
