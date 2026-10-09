import { logger } from './logger.js';

type State = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: State = 'closed';
  private failureCount = 0;
  private nextRetry = 0;

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 30_000,
    private readonly label: string = 'circuit',
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() < this.nextRetry) throw Object.assign(new Error('CIRCUIT_OPEN'), { retryable: false });
      this.state = 'half-open';
      logger.info({ label: this.label }, 'Circuit half-open, retrying');
    }

    try {
      const result = await fn();
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failureCount = 0;
        logger.info({ label: this.label }, 'Circuit closed');
      }
      return result;
    } catch (err: any) {
      this.failureCount++;
      if (this.failureCount >= this.threshold) {
        this.state = 'open';
        this.nextRetry = Date.now() + this.timeout;
        logger.warn({ label: this.label, failureCount: this.failureCount, nextRetry: this.nextRetry }, 'Circuit opened');
      }
      throw err;
    }
  }
}