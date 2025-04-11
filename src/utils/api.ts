import { z } from 'zod';

/**
 * Generic API error handler to process common error types
 * @param error - The error to handle
 * @returns Response object with appropriate status code and error message
 */
export const handleError = (error: unknown) => {
  if (error instanceof z.ZodError) {
    return new Response(JSON.stringify({
      error: 'Validation Error',
      details: error.errors
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.error('API Error:', error);
  return new Response(JSON.stringify({
    error: 'Internal Server Error'
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
}; 