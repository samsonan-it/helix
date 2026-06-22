import { HttpException, HttpStatus, UnprocessableEntityException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common/interfaces';
import { ZodError, z } from 'zod';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

function createMockHost(url = '/test'): ArgumentsHost {
  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const mockRequest = { url };

  return {
    switchToHttp: jest.fn().mockReturnValue({
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn().mockReturnValue(mockRequest),
    }),
  } as unknown as ArgumentsHost;
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('HttpException handling', () => {
    it('should serialize 404 HttpException to RFC 7807 shape', () => {
      const host = createMockHost('/api/v1/not-found');
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, host);

      const responseMock = host.switchToHttp().getResponse() as {
        status: jest.Mock;
        set: jest.Mock;
        json: jest.Mock;
      };
      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.set).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
      expect(responseMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('helix.stada.com/errors/'),
          title: expect.any(String),
          status: 404,
          detail: expect.any(String),
          instance: '/api/v1/not-found',
        }),
      );
    });

    it('should pass blockers array from UnprocessableEntityException', () => {
      const host = createMockHost('/api/v1/admin/countries/abc/deactivate');
      const blockers = [{ id: 'd1', title: 'Demand 1', status: 'IN_REVIEW' }];
      const exception = new UnprocessableEntityException({ blockers });

      filter.catch(exception, host);

      const json = (host.switchToHttp().getResponse() as { json: jest.Mock }).json.mock.calls[0][0];
      expect(json.status).toBe(422);
      expect(json.blockers).toEqual(blockers);
    });

    it('should serialize 400 HttpException', () => {
      const host = createMockHost();
      const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

      filter.catch(exception, host);

      const json = (host.switchToHttp().getResponse() as { json: jest.Mock }).json.mock.calls[0][0];
      expect(json.status).toBe(400);
    });
  });

  describe('ZodError handling', () => {
    it('should serialize ZodError to RFC 7807 shape with errors array', () => {
      const host = createMockHost('/api/v1/demands');
      const schema = z.object({ name: z.string(), age: z.number() });
      let zodError: ZodError | undefined;
      try {
        schema.parse({ name: 123, age: 'bad' });
      } catch (err) {
        zodError = err as ZodError;
      }

      filter.catch(zodError!, host);

      const json = (host.switchToHttp().getResponse() as { json: jest.Mock }).json.mock.calls[0][0];
      expect(json.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(json.errors).toBeDefined();
      expect(Array.isArray(json.errors)).toBe(true);
      expect(json.errors.length).toBeGreaterThan(0);
      expect(json.errors[0]).toHaveProperty('field');
      expect(json.errors[0]).toHaveProperty('message');
    });

    it('should return status 422 for ZodError', () => {
      const host = createMockHost();
      const schema = z.object({ required: z.string() });
      let zodError!: ZodError;
      try {
        schema.parse({});
      } catch (e) {
        zodError = e as ZodError;
      }

      filter.catch(zodError, host);

      const responseMock = host.switchToHttp().getResponse() as { status: jest.Mock };
      expect(responseMock.status).toHaveBeenCalledWith(422);
    });
  });

  describe('Unknown error handling', () => {
    it('should return 500 for unknown errors', () => {
      const host = createMockHost();
      const unknownError = new Error('Something blew up');

      filter.catch(unknownError, host);

      const responseMock = host.switchToHttp().getResponse() as {
        status: jest.Mock;
        json: jest.Mock;
      };
      expect(responseMock.status).toHaveBeenCalledWith(500);
      const json = responseMock.json.mock.calls[0][0];
      expect(json.status).toBe(500);
      expect(json.type).toContain('internal-server-error');
    });

    it('should return 500 for non-Error throws', () => {
      const host = createMockHost();

      filter.catch('just a string', host);

      const responseMock = host.switchToHttp().getResponse() as { status: jest.Mock };
      expect(responseMock.status).toHaveBeenCalledWith(500);
    });
  });
});
