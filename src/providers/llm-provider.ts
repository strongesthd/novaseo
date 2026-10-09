export interface ContentGenerationInput {
  title: string;
  primaryKeyword: string;
  intent: string;
  language?: string;
  minWords?: number;
  brandContext?: Record<string, unknown>;
  targetAudience?: Record<string, unknown>;
}

export interface GeneratedContent {
  title: string;
  markdown: string;
  html: string;
  metaDescription: string;
  faq: Array<{ question: string; answer: string }>;
  cta: string;
  scripts: Array<Record<string, unknown>>;
}

export interface LlmProvider {
  generateContent(input: ContentGenerationInput): Promise<GeneratedContent>;
}

export class TemplateLlmProvider implements LlmProvider {
  async generateContent(input: ContentGenerationInput): Promise<GeneratedContent> {
    const language = input.language ?? 'vi';
    const keyword = input.primaryKeyword.trim();
    const title = input.title.trim() || `${keyword}: hướng dẫn thực tế`;
    const audience = input.targetAudience?.segments;
    const audienceText = Array.isArray(audience) ? audience.join(', ') : 'người đọc quan tâm';
    const sections = [
      `# ${title}`,
      `\n## Tổng quan`,
      `\nBài viết này cung cấp thông tin thực tế về **${keyword}** cho ${audienceText}. Nội dung được trình bày theo ngữ cảnh ${input.intent} và ưu tiên trải nghiệm đọc tự nhiên.`,
      `\n## Điều cần biết về ${keyword}`,
      `\nKhi lựa chọn hoặc triển khai ${keyword}, hãy bắt đầu bằng mục tiêu cụ thể, nguồn thông tin đáng tin cậy và tiêu chí đánh giá rõ ràng. So sánh các phương án theo nhu cầu, ngân sách và khả năng duy trì trong dài hạn.`,
      `\n## Quy trình thực hiện`,
      `\n1. Xác định nhu cầu và bối cảnh sử dụng.\n2. Thu thập dữ liệu từ nhiều nguồn.\n3. Đánh giá ưu nhược điểm bằng tiêu chí nhất quán.\n4. Thử nghiệm ở quy mô nhỏ trước khi mở rộng.\n5. Theo dõi kết quả và cải thiện định kỳ.`,
      `\n## Kinh nghiệm tối ưu`,
      `\nHãy ưu tiên tính phù hợp thay vì chạy theo một lựa chọn phổ biến. Ghi lại các giả định, kiểm chứng thông tin quan trọng và cập nhật quyết định khi dữ liệu thay đổi. Cách tiếp cận này giúp kết quả ổn định hơn và giảm chi phí sửa sai.`,
      `\n## Kết luận`,
      `\n${keyword} sẽ hiệu quả hơn khi được triển khai theo mục tiêu, dữ liệu và kế hoạch đo lường cụ thể.`,
    ];
    const markdown = sections.join('\n');
    const html = markdown
      .split('\n')
      .map((line) => line.startsWith('# ') ? `<h1>${line.slice(2)}</h1>` : line.startsWith('## ') ? `<h2>${line.slice(3)}</h2>` : line ? `<p>${line}</p>` : '')
      .join('\n');
    return {
      title,
      markdown,
      html,
      metaDescription: `Thông tin thực tế và quy trình triển khai ${keyword} phù hợp với nhu cầu của bạn.`,
      faq: [
        { question: `${keyword} phù hợp với ai?`, answer: `Phù hợp với người có mục tiêu rõ ràng và cần một quy trình dễ áp dụng.` },
        { question: `Nên bắt đầu ${keyword} như thế nào?`, answer: 'Bắt đầu bằng việc xác định nhu cầu, ngân sách và tiêu chí đánh giá.' },
      ],
      cta: 'Xem thêm hướng dẫn và bắt đầu với bước phù hợp nhất hôm nay.',
      scripts: [
        { platform: 'tiktok', hook: `${keyword} có gì đáng chú ý?`, scene: 'Minh họa vấn đề và giải pháp', voiceOver: `Tìm hiểu nhanh về ${keyword}.`, onScreenText: keyword, cta: 'Lưu video để xem lại', durationSeconds: 30, hashtags: [keyword] },
        { platform: 'reels', hook: 'Ba bước dễ áp dụng', scene: 'Ba cảnh chuyển nhanh', voiceOver: `Áp dụng ${keyword} theo ba bước đơn giản.`, onScreenText: '3 bước', cta: 'Theo dõi để biết thêm', durationSeconds: 30, hashtags: [keyword] },
        { platform: 'youtube_shorts', hook: `Sai lầm thường gặp với ${keyword}`, scene: 'Nêu sai lầm và cách tránh', voiceOver: 'Kiểm tra các tiêu chí trước khi quyết định.', onScreenText: 'Tránh sai lầm', cta: 'Xem hướng dẫn đầy đủ', durationSeconds: 45, hashtags: [keyword] },
      ],
    };
  }
}
