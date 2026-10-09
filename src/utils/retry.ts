import { logger } from './logger.js';

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number; maxDelay?: number; label?: string } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000, label = 'operation' } = options;
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt >= maxRetries || !isRetryable(err)) throw err;
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500, maxDelay);
      logger.warn({ label, attempt, delay, error: err.message }, 'Retrying after backoff');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

function isRetryable(err: any): boolean {
  if (err.retryable === false) return false;
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') return true;
  if (err.statusCode === 429 || err.statusCode === 503 || err.statusCode === 504) return true;
  return false;
}
