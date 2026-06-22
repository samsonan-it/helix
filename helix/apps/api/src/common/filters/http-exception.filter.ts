import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';

const BASE_URL = 'https://helix.stada.com/errors/';

interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
  blockers?: Array<{ id: string; title: string; status: string }>;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let problem: ProblemDetail;

    if (exception instanceof ZodError) {
      problem = {
        type: `${BASE_URL}validation-error`,
        title: 'Validation Error',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: 'The request body failed validation.',
        errors: exception.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      };
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const isObject = typeof exceptionResponse === 'object' && exceptionResponse !== null;
      const detail = isObject
        ? (exceptionResponse as { message?: string })?.message ?? exception.message
        : (exceptionResponse as string);
      const code = isObject ? (exceptionResponse as { code?: string })?.code : undefined;
      const blockers = isObject
        ? (exceptionResponse as { blockers?: Array<{ id: string; title: string; status: string }> })?.blockers
        : undefined;

      problem = {
        type: `${BASE_URL}${status}`,
        title: exception.message,
        status,
        detail: Array.isArray(detail) ? detail.join(', ') : (detail as string),
        ...(code !== undefined && { code }),
        ...(blockers !== undefined && { blockers }),
      };
    } else {
      problem = {
        type: `${BASE_URL}internal-server-error`,
        title: 'Internal Server Error',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        detail: 'An unexpected error occurred.',
      };
    }

    response
      .status(problem.status)
      .set('Content-Type', 'application/problem+json')
      .json({
        ...problem,
        instance: request.url,
      });
  }
}
