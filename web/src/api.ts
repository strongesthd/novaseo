export type Envelope<T> = { data: T };

export type User = {
  id: string;
  email: string;
  displayName: string;
};

export type Tenant = {
  id: string;
  name: string;
  role: string;
};

export type Project = {
  id: string;
  name: string;
  industry: string;
  brandContext?: Record<string, unknown>;
  targetAudience?: Record<string, unknown>;
  toneOfVoice?: string;
  targetPlatforms: string[];
  platformSettings?: Record<string, Record<string, string>>;
  status: string;
  createdAt?: string;
};

export type Cluster = {
  id: string;
  platform: string;
  clusterName: string;
  primaryKeyword: string;
  intent: string;
  clusterData: {
    keywords?: string[];
    volume?: number;
    competition?: number;
    source?: string;
  };
  createdAt?: string;
};

export type ContentItem = {
  id: string;
  title: string;
  slug?: string;
  content_markdown?: string;
  content_html?: string;
  published_url?: string;
  short_video_scripts?: Array<Record<string, unknown>>;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type Job = {
  jobId: string;
  type: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: Record<string, unknown>;
  error?: { code?: string; message?: string };
  createdAt: string;
  updatedAt: string;
};

let activeTenantId = '';

export function setActiveTenant(id: string) {
  activeTenantId = id;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (activeTenantId && path.startsWith('/api/v1/seo/')) headers.set('X-Tenant-Id', activeTenantId);
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Yêu cầu thất bại (${response.status})`);
  }
  return payload as T;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  setupStatus: () => request<Envelope<{ hasOwner: boolean }>>('/api/v1/auth/setup-status'),
  setup: (body: { name: string; email: string; password: string; workspace: string }) =>
    request('/api/v1/auth/setup', json('POST', body)),
  login: (body: { email: string; password: string }) =>
    request('/api/v1/auth/login', json('POST', body)),
  me: () => request<Envelope<{ user: User; tenants: Tenant[] }>>('/api/v1/auth/me'),
  logout: () => request<void>('/api/v1/auth/logout', json('POST')),
  projects: () => request<Envelope<Project[]>>('/api/v1/seo/projects'),
  project: (id: string) => request<Envelope<Project>>(`/api/v1/seo/projects/${id}`),
  createProject: (body: Record<string, unknown>) =>
    request<Envelope<Project>>('/api/v1/seo/projects', json('POST', body)),
  updateProject: (id: string, body: Record<string, unknown>) =>
    request<Envelope<Project>>(`/api/v1/seo/projects/${id}`, json('PATCH', body)),
  clusters: (projectId: string) =>
    request<Envelope<Cluster[]>>(`/api/v1/seo/keywords/clusters/${projectId}?page=1&limit=100`),
  mine: (body: Record<string, unknown>) =>
    request<Envelope<{ jobId: string; status: string }>>('/api/v1/seo/keywords/mine', json('POST', body)),
  contents: (projectId: string) =>
    request<Envelope<ContentItem[]>>(`/api/v1/seo/content/${projectId}?page=1&limit=100`),
  generate: (body: Record<string, unknown>) =>
    request<Envelope<{ jobId: string; status: string }>>('/api/v1/seo/content/generate', json('POST', body)),
  updateContent: (id: string, body: { title?: string; contentMarkdown?: string }) =>
    request<Envelope<ContentItem>>(`/api/v1/seo/content/${id}`, json('PATCH', body)),
  publish: (body: Record<string, unknown>) =>
    request<Envelope<{ jobId: string; status: string }>>('/api/v1/seo/content/publish', json('POST', body)),
  jobs: () => request<Envelope<Job[]>>('/api/v1/seo/jobs'),
  job: (id: string) => request<Envelope<Job>>(`/api/v1/seo/jobs/${id}`),
};
