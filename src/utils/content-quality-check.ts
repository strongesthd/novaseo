type QualityIssue = { rule: string; severity: 'error' | 'warning'; message: string };

export function checkContentQuality(input: { title: string; html?: string; markdown?: string; primaryKeyword?: string }): { passed: boolean; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];
  const text = input.markdown || input.html || '';
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  // Minimum word count
  if (wordCount < 1500) issues.push({ rule: 'MIN_WORD_COUNT', severity: 'error', message: `Content has ${wordCount} words, minimum is 1500` });

  // Keyword stuffing
  if (input.primaryKeyword) {
    const keywordCount = (text.match(new RegExp(input.primaryKeyword, 'gi')) || []).length;
    const density = (keywordCount / wordCount) * 100;
    if (density > 3) issues.push({ rule: 'KEYWORD_STUFFING', severity: 'warning', message: `Keyword density is ${density.toFixed(1)}%, recommended max 3%` });
  }

  // Repetitive phrases
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const uniqueSentences = new Set(sentences.map((s) => s.trim().toLowerCase()));
  if (sentences.length > 10 && uniqueSentences.size < sentences.length * 0.7) {
    issues.push({ rule: 'REPETITIVE_CONTENT', severity: 'warning', message: 'Content contains repetitive sentences' });
  }

  // Missing headings
  const hasHeadings = /^##?\s+/m.test(text) || /<h[1-6]>/i.test(text);
  if (!hasHeadings) issues.push({ rule: 'MISSING_HEADINGS', severity: 'warning', message: 'Content should include headings for structure' });

  // Title length
  if (input.title.length < 30) issues.push({ rule: 'TITLE_TOO_SHORT', severity: 'warning', message: 'Title should be at least 30 characters for SEO' });
  if (input.title.length > 70) issues.push({ rule: 'TITLE_TOO_LONG', severity: 'warning', message: 'Title should be under 70 characters for search snippets' });

  return { passed: !issues.some((i) => i.severity === 'error'), issues };
}