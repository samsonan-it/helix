import { ArgumentMetadata } from '@nestjs/common';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe';
import { z, ZodError } from 'zod';

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

const metadata: ArgumentMetadata = { type: 'body' };

describe('ZodValidationPipe', () => {
  let pipe: ZodValidationPipe<{ name: string; age: number }>;

  beforeEach(() => {
    pipe = new ZodValidationPipe(testSchema);
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should pass and return parsed value for valid input', () => {
    const input = { name: 'Alice', age: 30 };
    const result = pipe.transform(input, metadata);
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('should throw ZodError for invalid input (missing required fields)', () => {
    expect(() => pipe.transform({}, metadata)).toThrow(ZodError);
  });

  it('should throw ZodError for wrong type', () => {
    expect(() => pipe.transform({ name: '', age: -1 }, metadata)).toThrow(ZodError);
  });

  it('should throw ZodError for partial input', () => {
    expect(() => pipe.transform({ name: 'Alice' }, metadata)).toThrow(ZodError);
  });
});
