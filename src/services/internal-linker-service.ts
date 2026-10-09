import { ContentRepository } from '../repositories/content-repository.js';

export class InternalLinkerService {
  constructor(private contents = new ContentRepository()) {}

  async injectLinks(tenantId: string, projectId: string, contentId: string) {
    const current = await this.contents.findById(tenantId, contentId);
    if (!current) throw Object.assign(new Error('CONTENT_NOT_FOUND'), { statusCode: 404 });
    const all = await this.contents.list(tenantId, projectId, 'ready');
    const candidates = all.filter((item: any) => item.id !== contentId && item.published_url).slice(0, 3);
    if (!candidates.length) return { injected: 0 };
    let html = current.content_html || '';
    const links = candidates.map((item: any) => `<a href="${item.canonical_url || item.published_url}">${item.title}</a>`).join(', ');
    html += `\n<section><h2>Bài viết liên quan</h2><p>${links}</p></section>`;
    await this.contents.updateHtml(tenantId, contentId, html);
    return { injected: candidates.length };
  }
}
