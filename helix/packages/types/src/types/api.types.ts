/**
 * RFC 7807 Problem Details shape
 * https://datatracker.ietf.org/doc/html/rfc7807
 */
export interface ApiProblemDetail {
  /** URI reference identifying the problem type */
  type: string;
  /** Human-readable summary of the problem type */
  title: string;
  /** HTTP status code */
  status: number;
  /** Human-readable explanation specific to this occurrence */
  detail: string;
  /** URI reference identifying the specific occurrence */
  instance?: string;
  /** Validation errors (for 422 responses) */
  errors?: Array<{ field: string; message: string }>;
}
