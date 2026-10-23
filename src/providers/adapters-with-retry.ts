import {
  Indexer,
  IndexingEngine,
  IndexResult,
  KeywordMiner,
  KeywordRecord,
  MiningPlatform,
  Publisher,
  PublishingPlatform,
  PublishResult,
} from './contracts/index.js';
import { GenericKeywordMiner, HttpIndexer, HttpPublisher } from './adapters.js';
import { retryWithBackoff } from '../utils/retry.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';

export class ResilientKeywordMiner implements KeywordMiner {
  private readonly breaker: CircuitBreaker;
  private readonly adapter: GenericKeywordMiner;

  constructor(public readonly platform: MiningPlatform) {
    this.breaker = new CircuitBreaker(5, 30_000, `miner:${platform}`);
    this.adapter = new GenericKeywordMiner(platform);
  }

  mine(input: { seeds: string[]; locale: string; country: string; limit: number; credentials?: Record<string, unknown> }): Promise<KeywordRecord[]> {
    return this.breaker.execute(() => retryWithBackoff(
      () => this.adapter.mine(input),
      { maxRetries: 3, label: `mine:${this.platform}` },
    ));
  }
}

export class ResilientPublisher implements Publisher {
  private readonly breaker: CircuitBreaker;
  private readonly adapter: HttpPublisher;

  constructor(public readonly platform: PublishingPlatform) {
    this.breaker = new CircuitBreaker(5, 30_000, `publisher:${platform}`);
    this.adapter = new HttpPublisher(platform);
  }

  publish(input: Parameters<Publisher['publish']>[0]): Promise<PublishResult> {
    return this.breaker.execute(() => retryWithBackoff(
      () => this.adapter.publish(input),
      { maxRetries: 3, label: `publish:${this.platform}` },
    ));
  }
}

export class ResilientIndexer implements Indexer {
  private readonly breaker: CircuitBreaker;
  private readonly adapter: HttpIndexer;

  constructor(public readonly engine: IndexingEngine) {
    this.breaker = new CircuitBreaker(5, 30_000, `indexer:${engine}`);
    this.adapter = new HttpIndexer(engine);
  }

  submit(urls: string[], credentials?: Record<string, unknown>): Promise<IndexResult> {
    return this.breaker.execute(() => retryWithBackoff(
      () => this.adapter.submit(urls, credentials),
      { maxRetries: 3, label: `index:${this.engine}` },
    ));
  }
}
