import { GenericKeywordMiner, HttpIndexer, HttpPublisher } from './adapters.js';
import { KeywordMiner, MiningPlatform, Publisher, PublishingPlatform, Indexer, IndexingEngine } from './contracts/index.js';

const miningPlatforms: MiningPlatform[] = ['google', 'shopee', 'lazada', 'tiktok', 'youtube'];
const publishingPlatforms: PublishingPlatform[] = ['wordpress', 'shopify', 'webhook', 'tiktok', 'youtube'];
const indexingEngines: IndexingEngine[] = ['google', 'indexnow'];

export class KeywordMinerFactory {
  static create(platform: string): KeywordMiner {
    if (!miningPlatforms.includes(platform as MiningPlatform)) throw new Error('UNSUPPORTED_MINING_PLATFORM');
    return new GenericKeywordMiner(platform as MiningPlatform);
  }
}
export class PublisherFactory {
  static create(platform: string): Publisher {
    if (!publishingPlatforms.includes(platform as PublishingPlatform)) throw new Error('UNSUPPORTED_PUBLISHING_PLATFORM');
    return new HttpPublisher(platform as PublishingPlatform);
  }
}
export class IndexerFactory {
  static create(engine: string): Indexer {
    if (!indexingEngines.includes(engine as IndexingEngine)) throw new Error('UNSUPPORTED_INDEXING_ENGINE');
    return new HttpIndexer(engine as IndexingEngine);
  }
}
