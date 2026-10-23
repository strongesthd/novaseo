import { describe, expect, it } from 'vitest';
import { checkContentQuality } from '../src/utils/content-quality-check.js';

describe('content quality checks', () => {
  it('treats regex syntax in a keyword as literal text', () => {
    const markdown = `## Guide\n${Array.from({ length: 1500 }, (_, index) => `term${index}`).join(' ')}`;
    expect(() => checkContentQuality({
      title: 'A sufficiently descriptive content title',
      markdown,
      primaryKeyword: '[a+b',
    })).not.toThrow();
  });
});
