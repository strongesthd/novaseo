import { ContentRepository } from '../repositories/content-repository.js';
import { ClusterRepository } from '../repositories/cluster-repository.js';
import { ProjectRepository } from '../repositories/project-repository.js';

export class ContentGenerationService {
  constructor(private contents = new ContentRepository(), private clusters = new ClusterRepository(), private projects = new ProjectRepository()) {}

  async generate(tenantId: string, input: { projectId: string; clusterId: string; format: 'html' | 'markdown'; minWords: number; generateShortVideoScripts: boolean; language: string }) {
    const project = await this.projects.findById(tenantId, input.projectId);
    if (!project) throw Object.assign(new Error('PROJECT_NOT_FOUND'), { statusCode: 404 });
    const cluster = await this.clusters.findById(tenantId, input.clusterId);
    if (!cluster) throw Object.assign(new Error('CLUSTER_NOT_FOUND'), { statusCode: 404 });
    const title = this.buildTitle(cluster.primary_keyword);
    const markdown = this.buildContent(project, cluster, input.minWords);
    const html = this.toHtml(title, markdown);
    const quality = checkContentQuality({ title, markdown, primaryKeyword: cluster.primary_keyword });
    if (!quality.passed) throw Object.assign(new Error('CONTENT_QUALITY_CHECK_FAILED'), { statusCode: 400, issues: quality.issues });
    const scripts = input.generateShortVideoScripts ? this.buildScripts(cluster.primary_keyword, project) : [];
    const content = await this.contents.create({ tenantId, projectId: input.projectId, clusterId: input.clusterId, title, slug: this.slugify(title), markdown, html, scripts, payload: { format: input.format, language: input.language, qualityIssues: quality.issues } });
    return { contentId: content.id, title, wordCount: markdown.split(/\s+/).length, scripts: scripts.length, qualityIssues: quality.issues };
  }

  private buildTitle(keyword: string): string { return `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}: Hướng dẫn toàn diện ${new Date().getFullYear()}`; }

  private buildContent(project: any, cluster: any, minWords: number): string {
    const keyword = cluster.primary_keyword;
    const brand = project.name;
    const product = (project.brand_context?.products?.[0]) || keyword;
    const sections = [ 'Tổng quan', 'Vì sao chủ đề này quan trọng', 'Tiêu chí lựa chọn', 'Hướng dẫn chi tiết', 'Sai lầm thường gặp', 'Kinh nghiệm thực tế', 'Câu hỏi thường gặp', 'Kết luận và CTA' ];
    const paragraphs: string[] = [`# ${this.buildTitle(keyword)}`, ``, `Chủ đề **${keyword}** đang được người dùng ${project.target_audience?.region || 'Việt Nam'} quan tâm. ${brand} tổng hợp hướng dẫn thực chiến giúp bạn ra quyết định đúng và tối ưu hiệu quả.`];
    let index = 0;
    while (paragraphs.join(' ').split(/\s+/).length < minWords) {
      const section = sections[index % sections.length];
      paragraphs.push(``, `## ${section}`, ``, `${section} là yếu tố then chốt khi khai thác ${keyword}. Với sản phẩm ${product}, bạn nên tập trung vào chất lượng nội dung, trải nghiệm người dùng và mức độ phù hợp nhu cầu. Khi tối ưu ${keyword}, hãy phân tích từ khóa liên quan, đối thủ và hành vi tìm kiếm để xây dựng cấu trúc rõ ràng, hữu ích và đáng tin cậy cho ${brand}.`);
      index++;
    }
    return paragraphs.join('\n');
  }

  private toHtml(title: string, markdown: string): string {
    const body = markdown.split('\n').map(line => line.startsWith('# ') ? `<h1>${line.slice(2)}</h1>` : line.startsWith('## ') ? `<h2>${line.slice(3)}</h2>` : line.trim() ? `<p>${line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>` : '').join('\n');
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`;
  }

  private buildScripts(keyword: string, project: any) {
    return [
      { platform: 'tiktok', hook: `Bạn đang tìm ${keyword}?`, scenes: [{ text: `Giới thiệu vấn đề về ${keyword}` }, { text: `Giải pháp từ ${project.name}` }], voiceOver: `Hôm nay ${project.name} sẽ chia sẻ về ${keyword}.`, onScreenText: keyword, cta: 'Theo dõi để xem thêm', durationSeconds: 30, hashtags: ['#seo', '#tiktok'] },
      { platform: 'reels', hook: `3 điều về ${keyword}`, scenes: [{ text: `Điều 1: hiểu đúng ${keyword}` }, { text: 'Điều 2: tránh sai lầm' }], voiceOver: `Ba điều cần biết về ${keyword}.`, onScreenText: keyword, cta: 'Lưu lại ngay', durationSeconds: 25, hashtags: ['#reels', '#tips'] },
      { platform: 'shorts', hook: `${keyword} trong 45 giây`, scenes: [{ text: 'Vấn đề' }, { text: 'Giải pháp' }], voiceOver: `Tóm tắt ${keyword} trong 45 giây.`, onScreenText: keyword, cta: 'Đăng ký kênh', durationSeconds: 45, hashtags: ['#shorts', '#howto'] }
    ];
  }

  private slugify(value: string): string { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
}
import { checkContentQuality } from '../utils/content-quality-check.js';
