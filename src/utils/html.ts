export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

export function renderMarkdownToHtml(markdown: string): string {
  let inList = false;
  const output: string[] = [];
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) output.push('</ul>');
      inList = false;
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      if (inList) output.push('</ul>');
      inList = false;
      const level = heading[1].length;
      output.push(`<h${level}>${formatInline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) output.push('<ul>');
      inList = true;
      output.push(`<li>${formatInline(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }
    if (inList) output.push('</ul>');
    inList = false;
    output.push(`<p>${formatInline(line)}</p>`);
  }
  if (inList) output.push('</ul>');
  return output.join('\n');
}

function formatInline(value: string): string {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
