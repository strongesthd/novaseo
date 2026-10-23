import { ContentRepository } from '../repositories/content-repository.js';
import { escapeHtml } from '../utils/html.js';

export class InternalLinkerService {
  constructor(private contents = new ContentRepository()) {}

  async injectLinks(tenantId: string, projectId: string, contentId: string) {
    const current = await this.contents.findById(tenantId, contentId);
    if (!current || current.project_id !== projectId) throw Object.assign(new Error('CONTENT_NOT_FOUND'), { statusCode: 404 });
    const candidates = await this.contents.findLinkCandidates(tenantId, projectId, contentId, 3);
    if (!candidates.length) return { injected: 0 };
    let html = current.content_html || '';
    const links = candidates.map((item: any) => {
      const target = item.canonical_url || item.published_url;
      try {
        if (new URL(target).protocol !== 'https:') return escapeHtml(item.title);
      } catch {
        return escapeHtml(item.title);
      }
      return `<a href="${escapeHtml(target)}" rel="noopener">${escapeHtml(item.title)}</a>`;
    }).join(', ');
    html += `\n<section><h2>Bài viết liên quan</h2><p>${links}</p></section>`;
    await this.contents.updateHtml(tenantId, contentId, html);
    return { injected: candidates.length };
  }
}
