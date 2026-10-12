import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Activity, ArrowRight, ArrowUpRight, BookOpen,
  Check, ChevronDown, ChevronRight, CircleHelp, Clock3, Command,
  FileText, FolderKanban, Globe2, Hash, LayoutDashboard, LoaderCircle, LogOut,
  Menu, MoreHorizontal, Plus, RefreshCw, Search, Send, Settings2, ShieldCheck,
  Sparkles, Target, Upload, Wand2, X,
} from 'lucide-react';
import { api, Cluster, ContentItem, Job, Project, setActiveTenant, Tenant, User } from './api';

type Screen = 'overview' | 'projects' | 'keywords' | 'content' | 'publishing' | 'jobs' | 'integrations';
type AuthMode = 'checking' | 'setup' | 'login' | 'app';
type ToastKind = 'success' | 'error';
type ToastState = { message: string; kind: ToastKind } | undefined;

const screenMeta: Record<Screen, { title: string; subtitle: string; icon: typeof LayoutDashboard }> = {
  overview: { title: 'Tổng quan', subtitle: 'Tình hình SEO và nội dung của workspace', icon: LayoutDashboard },
  projects: { title: 'Dự án SEO', subtitle: 'Quản lý website, thương hiệu và mục tiêu tăng trưởng', icon: FolderKanban },
  keywords: { title: 'Nghiên cứu từ khóa', subtitle: 'Khám phá chủ đề và nhóm ý định tìm kiếm', icon: Hash },
  content: { title: 'Thư viện nội dung', subtitle: 'Soạn, biên tập và tối ưu nội dung SEO', icon: FileText },
  publishing: { title: 'Xuất bản', subtitle: 'Phân phối nội dung đến các kênh đã kết nối', icon: Upload },
  jobs: { title: 'Tác vụ', subtitle: 'Theo dõi tiến độ xử lý của hệ thống', icon: Activity },
  integrations: { title: 'Tích hợp', subtitle: 'Cấu hình các kênh xuất bản theo từng dự án', icon: Globe2 },
};

const channelLabels: Record<string, string> = {
  google: 'Google', shopee: 'Shopee', lazada: 'Lazada', tiktok: 'TikTok',
  youtube: 'YouTube', wordpress: 'WordPress', shopify: 'Shopify', webhook: 'Webhook',
};

const publishingChannels = ['wordpress', 'shopify', 'webhook', 'tiktok', 'youtube'];
const miningChannels = ['google', 'shopee', 'lazada', 'tiktok', 'youtube'];

function friendlyDate(value?: string) {
  if (!value) return 'Vừa tạo';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Vừa tạo' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date);
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
}

function App() {
  const [mode, setMode] = useState<AuthMode>('checking');
  const [user, setUser] = useState<User>();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [screen, setScreen] = useState<Screen>('overview');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [toast, setToast] = useState<ToastState>();
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<'project' | undefined>();
  const [apiOnline, setApiOnline] = useState<boolean>();
  const selectedProject = projects.find((item) => item.id === projectId);

  const notify = useCallback((message: string, kind: ToastKind = 'success') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(undefined), 3800);
  }, []);

  const applyProfile = useCallback((profile: { user: User; tenants: Tenant[] }) => {
    setUser(profile.user);
    setTenants(profile.tenants);
    const saved = sessionStorage.getItem(`novaseo-tenant:${profile.user.id}`);
    const nextTenant = profile.tenants.find((item) => item.id === saved) || profile.tenants[0];
    setTenantId(nextTenant?.id || '');
    setActiveTenant(nextTenant?.id || '');
    setMode('app');
  }, []);

  useEffect(() => {
    let alive = true;
    const boot = async () => {
      try {
        const status = await api.setupStatus();
        if (!alive) return;
        if (!status.data.hasOwner) {
          setMode('setup');
          return;
        }
        try {
          const profile = await api.me();
          if (alive) applyProfile(profile.data);
        } catch {
          if (alive) setMode('login');
        }
      } catch (error) {
        if (alive) {
          setMode('login');
          notify(`Không kết nối được API: ${errorText(error)}`, 'error');
        }
      }
    };
    void boot();
    return () => { alive = false; };
  }, [applyProfile, notify]);

  useEffect(() => {
    const check = () => fetch('/health', { cache: 'no-store' })
      .then((response) => setApiOnline(response.ok))
      .catch(() => setApiOnline(false));
    void check();
    const timer = window.setInterval(check, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const syncHash = () => {
      const value = window.location.hash.replace(/^#\/?/, '') as Screen;
      if (value in screenMeta) setScreen(value);
      else setScreen('overview');
    };
    if (!window.location.hash) window.location.hash = '#overview';
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    if (tenantId && user) sessionStorage.setItem(`novaseo-tenant:${user.id}`, tenantId);
    setActiveTenant(tenantId);
  }, [tenantId, user]);

  const refreshWorkspace = useCallback(async (preferredProjectId?: string) => {
    if (mode !== 'app' || !tenantId) return;
    setLoadingWorkspace(true);
    try {
      const [projectResponse, jobResponse] = await Promise.all([api.projects(), api.jobs()]);
      setProjects(projectResponse.data);
      setJobs(jobResponse.data);
      const requestedId = preferredProjectId || projectId;
      const currentId = projectResponse.data.some((item) => item.id === requestedId)
        ? requestedId
        : projectResponse.data[0]?.id || '';
      setProjectId(currentId);
      if (currentId) {
        const [clusterResponse, contentResponse] = await Promise.all([
          api.clusters(currentId),
          api.contents(currentId),
        ]);
        setClusters(clusterResponse.data);
        setContents(contentResponse.data);
      } else {
        setClusters([]);
        setContents([]);
      }
    } catch (error) {
      notify(errorText(error), 'error');
    } finally {
      setLoadingWorkspace(false);
    }
  }, [mode, notify, projectId, tenantId]);

  useEffect(() => {
    if (mode === 'app') void refreshWorkspace();
  }, [mode, tenantId, refreshWorkspace]);

  useEffect(() => {
    if (mode !== 'app' || !jobs.some((job) => job.status === 'queued' || job.status === 'processing')) return;
    const timer = window.setInterval(() => {
      void api.jobs().then((response) => {
        setJobs(response.data);
        if (projectId) {
          Promise.all([api.clusters(projectId), api.contents(projectId)]).then(([clusterResponse, contentResponse]) => {
            setClusters(clusterResponse.data);
            setContents(contentResponse.data);
          }).catch(() => undefined);
        }
      }).catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [jobs, mode, projectId]);

  const onTenantChange = (id: string) => {
    setTenantId(id);
    setProjectId('');
    setProjects([]);
    setClusters([]);
    setContents([]);
  };

  const onAuthenticated = async () => {
    const profile = await api.me();
    applyProfile(profile.data);
    window.location.hash = '#overview';
    notify('Đăng nhập thành công');
  };

  const signOut = async () => {
    await api.logout().catch(() => undefined);
    setUser(undefined);
    setMode('login');
    setProjects([]);
    setJobs([]);
  };

  const navigate = (next: Screen) => {
    window.location.hash = `#${next}`;
    setMobileNav(false);
  };

  const startJob = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      await refreshWorkspace();
      notify(done);
    } catch (error) {
      notify(errorText(error), 'error');
    }
  };

  if (mode === 'checking') {
    return <div className="boot-screen"><div className="brand-mark"><Command size={20} /></div><LoaderCircle className="spin" size={18} /><span>Đang kết nối NovaSEO</span></div>;
  }
  if (mode === 'setup' || mode === 'login') {
    return <AuthScreen mode={mode} onDone={onAuthenticated} notify={notify} />;
  }

  const pageMeta = screenMeta[screen];

  return (
    <div className="app-shell">
      {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Đóng menu" />}
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#overview" onClick={() => navigate('overview')}>
          <span className="brand-mark"><Command size={19} strokeWidth={2.5} /></span>
          <span className="brand-word">nova<span>seo</span></span>
          <span className="brand-version">BETA</span>
        </a>

        <div className="workspace-picker">
          <div className="workspace-avatar">{(tenants.find((item) => item.id === tenantId)?.name || 'N').slice(0, 1).toUpperCase()}</div>
          <div className="workspace-copy">
            <small>WORKSPACE</small>
            <select aria-label="Chọn workspace" value={tenantId} onChange={(event) => onTenantChange(event.target.value)}>
              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
            </select>
          </div>
          <ChevronDown size={15} />
        </div>

        <nav className="side-nav" aria-label="Điều hướng chính">
          <NavGroup title="WORKSPACE">
            <NavItem id="overview" active={screen} icon={<LayoutDashboard size={17} />} onClick={navigate}>Tổng quan</NavItem>
            <NavItem id="projects" active={screen} icon={<FolderKanban size={17} />} onClick={navigate}>Dự án SEO <span className="nav-count">{projects.length}</span></NavItem>
          </NavGroup>
          <NavGroup title="TĂNG TRƯỞNG">
            <NavItem id="keywords" active={screen} icon={<Hash size={17} />} onClick={navigate}>Từ khóa</NavItem>
            <NavItem id="content" active={screen} icon={<FileText size={17} />} onClick={navigate}>Nội dung <span className="nav-count">{contents.length}</span></NavItem>
            <NavItem id="publishing" active={screen} icon={<Send size={17} />} onClick={navigate}>Xuất bản</NavItem>
          </NavGroup>
          <NavGroup title="VẬN HÀNH">
            <NavItem id="jobs" active={screen} icon={<Activity size={17} />} onClick={navigate}>Tác vụ</NavItem>
            <NavItem id="integrations" active={screen} icon={<Globe2 size={17} />} onClick={navigate}>Tích hợp</NavItem>
          </NavGroup>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className={`status-dot ${apiOnline === false ? 'offline' : ''}`} />
            <span>{apiOnline === false ? 'API mất kết nối' : apiOnline === true ? 'API đang hoạt động' : 'Đang kiểm tra API'}</span>
            <button className="icon-button tiny" title="Kiểm tra API" aria-label="Kiểm tra API" onClick={() => fetch('/health', { cache: 'no-store' }).then((response) => setApiOnline(response.ok)).catch(() => setApiOnline(false))}><RefreshCw size={13} /></button>
          </div>
          <button className="account-row" onClick={signOut} title="Đăng xuất">
            <span className="user-avatar">{user?.displayName.slice(0, 1).toUpperCase()}</span>
            <span className="account-copy"><strong>{user?.displayName}</strong><small>{user?.email}</small></span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <button className="icon-button menu-toggle" onClick={() => setMobileNav(true)} aria-label="Mở menu"><Menu size={19} /></button>
          <div className="breadcrumbs"><span>NovaSEO</span><ChevronRight size={14} /><strong>{pageMeta.title}</strong></div>
          <div className="topbar-actions">
            <div className="project-switcher">
              <FolderKanban size={15} />
              <select aria-label="Chọn dự án" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                {!projects.length && <option value="">Chưa có dự án</option>}
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <ChevronDown size={14} />
            </div>
            <button className="icon-button" title="Trợ giúp" aria-label="Trợ giúp" onClick={() => notify('Tài liệu hướng dẫn sẽ sớm có mặt.')}><CircleHelp size={18} /></button>
            <button className="top-avatar" title={user?.email}>{user?.displayName.slice(0, 1).toUpperCase()}</button>
          </div>
        </header>

        <div className="page-area">
          <div className="page-heading">
            <div>
              <div className="eyebrow">{tenants.find((item) => item.id === tenantId)?.name || 'WORKSPACE'}</div>
              <h1>{pageMeta.title}</h1>
              <p>{pageMeta.subtitle}</p>
            </div>
            <div className="page-heading-actions">
              <button className="button button-secondary" onClick={() => void refreshWorkspace()} disabled={loadingWorkspace}><RefreshCw size={15} className={loadingWorkspace ? 'spin' : ''} /> Làm mới</button>
              {(screen === 'overview' || screen === 'projects') && <button className="button button-primary" onClick={() => setModal('project')}><Plus size={16} /> Dự án mới</button>}
            </div>
          </div>

          {screen === 'overview' && <Overview projects={projects} clusters={clusters} contents={contents} jobs={jobs} project={selectedProject} navigate={navigate} onCreate={() => setModal('project')} />}
          {screen === 'projects' && <ProjectsPage
            projects={projects}
            onCreate={() => setModal('project')}
            onSelectProject={(id) => { setProjectId(id); navigate('overview'); }}
            onOpenSettings={(id) => { setProjectId(id); navigate('integrations'); }}
          />}
          {screen === 'keywords' && <KeywordsPage project={selectedProject} clusters={clusters} onStart={startJob} onGenerate={(cluster) => {
            if (!selectedProject) { notify('Hãy tạo dự án trước.', 'error'); return; }
            void startJob(() => api.generate({ projectId: selectedProject.id, clusterId: cluster.id, format: 'markdown', minWords: 1500, generateShortVideoScripts: true, targetPlatforms: selectedProject.targetPlatforms, language: 'vi' }), 'Đã đưa yêu cầu tạo nội dung vào hàng đợi');
            navigate('content');
          }} navigate={navigate} />}
          {screen === 'content' && <ContentPage project={selectedProject} contents={contents} clusters={clusters} refresh={refreshWorkspace} notify={notify} navigate={navigate} />}
          {screen === 'publishing' && <PublishingPage project={selectedProject} contents={contents} onStart={startJob} navigate={navigate} />}
          {screen === 'jobs' && <JobsPage jobs={jobs} onRefresh={refreshWorkspace} />}
          {screen === 'integrations' && <IntegrationsPage project={selectedProject} projects={projects} onProjectChange={setProjectId} onSaved={refreshWorkspace} notify={notify} />}
        </div>
      </main>

      {modal === 'project' && <ProjectModal onClose={() => setModal(undefined)} onCreated={async (project) => {
        setModal(undefined);
        setProjectId(project.id);
        await refreshWorkspace(project.id);
        notify('Đã tạo dự án');
        navigate('integrations');
      }} />}
      {toast && <div className={`toast toast-${toast.kind}`} role="status"><span className="toast-icon">{toast.kind === 'success' ? <Check size={16} /> : <X size={16} />}</span>{toast.message}</div>}
    </div>
  );
}

function NavGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div className="nav-group"><div className="nav-group-title">{title}</div>{children}</div>;
}

function NavItem({ id, active, icon, onClick, children }: { id: Screen; active: Screen; icon: ReactNode; onClick: (screen: Screen) => void; children: ReactNode }) {
  return <a href={`#${id}`} className={`nav-item ${active === id ? 'nav-item-active' : ''}`} onClick={(event) => { event.preventDefault(); onClick(id); }}>{icon}<span>{children}</span>{active === id && <span className="active-indicator" />}</a>;
}

function AuthScreen({ mode, onDone, notify }: { mode: 'setup' | 'login'; onDone: () => Promise<void>; notify: (message: string, kind?: 'success' | 'error') => void }) {
  const [isSetup, setIsSetup] = useState(mode === 'setup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', workspace: '' });

  useEffect(() => setIsSetup(mode === 'setup'), [mode]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isSetup) {
        await api.setup(form);
      } else {
        await api.login({ email: form.email, password: form.password });
      }
      await onDone();
    } catch (cause) {
      const message = errorText(cause);
      setError(message);
      notify(message, 'error');
      if (message.includes('already complete')) setIsSetup(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-aside">
        <a className="brand brand-light" href="#"><span className="brand-mark"><Command size={19} strokeWidth={2.5} /></span><span className="brand-word">nova<span>seo</span></span></a>
        <div className="auth-aside-content">
          <div className="auth-kicker"><span /> SEO WORKSPACE</div>
          <h1>Biến dữ liệu tìm kiếm thành tăng trưởng.</h1>
          <p>Một nơi để nghiên cứu từ khóa, xây dựng nội dung và vận hành SEO trên nhiều kênh.</p>
          <div className="auth-workflow">
            <span className="workflow-step"><Hash size={16} /></span><span className="workflow-line" />
            <span className="workflow-step"><Wand2 size={16} /></span><span className="workflow-line" />
            <span className="workflow-step"><Upload size={16} /></span>
            <div className="workflow-labels"><span>Nghiên cứu</span><span>Sản xuất</span><span>Phân phối</span></div>
          </div>
        </div>
        <div className="auth-aside-foot"><ShieldCheck size={15} /> Dữ liệu workspace được tách biệt theo tenant</div>
      </div>
      <div className="auth-main">
        <div className="auth-mobile-brand"><span className="brand-mark"><Command size={19} /></span><span className="brand-word">nova<span>seo</span></span></div>
        <div className="auth-form-wrap">
          <div className="auth-form-head">
            <div className="eyebrow">{isSetup ? 'BẮT ĐẦU SỬ DỤNG' : 'CHÀO MỪNG TRỞ LẠI'}</div>
            <h2>{isSetup ? 'Tạo workspace đầu tiên' : 'Đăng nhập NovaSEO'}</h2>
            <p>{isSetup ? 'Tạo tài khoản owner để khởi tạo workspace riêng.' : 'Đăng nhập để tiếp tục quản lý hoạt động SEO.'}</p>
          </div>
          <form className="auth-form" onSubmit={submit}>
            {isSetup && <>
              <Field label="Tên của bạn"><input autoComplete="name" required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nguyễn Minh Anh" /></Field>
              <Field label="Tên workspace"><input required maxLength={200} value={form.workspace} onChange={(event) => setForm({ ...form, workspace: event.target.value })} placeholder="Marketing team" /></Field>
            </>}
            <Field label="Email"><input autoComplete="email" type="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="ban@congty.vn" /></Field>
            <Field label="Mật khẩu"><input autoComplete={isSetup ? 'new-password' : 'current-password'} type="password" required minLength={12} maxLength={200} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Tối thiểu 12 ký tự" /></Field>
            {error && <div className="form-error">{error}</div>}
            <button className="button button-primary auth-submit" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : null}{isSetup ? 'Tạo workspace' : 'Đăng nhập'}<ArrowRight size={16} /></button>
          </form>
          <div className="auth-security"><LockBadge /> Phiên đăng nhập bảo mật, tự hết hạn sau 8 giờ</div>
        </div>
        <div className="auth-main-foot"><span>© {new Date().getFullYear()} NovaSEO</span><span>Được xây dựng cho đội ngũ tăng trưởng</span></div>
      </div>
    </div>
  );
}

function LockBadge() {
  return <span className="lock-badge"><ShieldCheck size={15} /></span>;
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`field ${className}`}><span className="field-label">{label}</span>{children}</label>;
}

function Overview({ projects, clusters, contents, jobs, project, navigate, onCreate }: {
  projects: Project[]; clusters: Cluster[]; contents: ContentItem[]; jobs: Job[]; project?: Project;
  navigate: (screen: Screen) => void; onCreate: () => void;
}) {
  const pending = jobs.filter((job) => job.status === 'queued' || job.status === 'processing');
  const complete = jobs.filter((job) => job.status === 'completed').length;
  const failure = jobs.filter((job) => job.status === 'failed').length;
  const stats = [
    { label: 'DỰ ÁN HOẠT ĐỘNG', value: projects.filter((item) => item.status === 'active').length, note: `${projects.length} tổng dự án`, icon: FolderKanban, color: 'mint' },
    { label: 'NHÓM TỪ KHÓA', value: clusters.length, note: project?.name || 'Chọn dự án để xem', icon: Hash, color: 'amber' },
    { label: 'BÀI VIẾT', value: contents.length, note: `${contents.filter((item) => item.status === 'published').length} đã xuất bản`, icon: FileText, color: 'coral' },
    { label: 'TÁC VỤ ĐANG CHẠY', value: pending.length, note: `${complete} hoàn tất · ${failure} lỗi`, icon: Activity, color: 'blue' },
  ];

  return (
    <>
      <section className="overview-banner">
        <div className="banner-copy">
          <div className="banner-kicker"><Sparkles size={14} /> SEO CONTROL ROOM</div>
          <h2>{project ? `Chào mừng trở lại, ${project.name}` : 'Bắt đầu với dự án SEO đầu tiên'}</h2>
          <p>{project ? 'Theo dõi quy trình từ nghiên cứu từ khóa đến xuất bản nội dung.' : 'Tạo workspace cho thương hiệu, sau đó thiết lập dự án để bắt đầu nghiên cứu và sản xuất nội dung.'}</p>
          <div className="banner-actions">
            {projects.length ? <button className="button button-white" onClick={() => navigate('keywords')}><Target size={15} /> Nghiên cứu từ khóa</button> : <button className="button button-white" onClick={onCreate}><Plus size={16} /> Tạo dự án</button>}
            <button className="button button-quiet-light" onClick={() => navigate('jobs')}>Xem tác vụ <ArrowRight size={15} /></button>
          </div>
        </div>
        <div className="banner-visual" aria-hidden="true">
          <div className="visual-grid"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
          <div className="visual-chart"><div className="chart-top"><span>ORGANIC VISIBILITY</span><ArrowUpRight size={16} /></div><strong>{projects.length ? 'SEO' : '01'}</strong><div className="chart-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div>
          <div className="visual-float float-a"><Hash size={14} /> keyword map</div>
          <div className="visual-float float-b"><FileText size={14} /> content flow</div>
        </div>
      </section>

      <section className="metric-grid" aria-label="Chỉ số tổng quan">
        {stats.map(({ label, value, note, icon: Icon, color }, index) => (
          <div className="metric" key={label}>
            <div className="metric-top"><span>{label}</span><span className={`metric-icon ${color}`}><Icon size={17} /></span></div>
            <div className="metric-value">{value.toLocaleString('vi-VN')}</div>
            <div className="metric-note"><span className={`metric-trend trend-${index}`}><ArrowUpRight size={13} /></span>{note}</div>
          </div>
        ))}
      </section>

      <div className="section-row">
        <section className="panel panel-jobs">
          <div className="panel-heading"><div><h3>Tác vụ gần đây</h3><p>Theo dõi các quy trình đang xử lý</p></div><button className="text-button" onClick={() => navigate('jobs')}>Tất cả tác vụ <ArrowRight size={14} /></button></div>
          <JobTable jobs={jobs.slice(0, 5)} compact />
        </section>
        <section className="panel panel-projects">
          <div className="panel-heading"><div><h3>Dự án của bạn</h3><p>Workspace đang hoạt động</p></div><button className="icon-button" title="Mở dự án" aria-label="Mở dự án" onClick={() => navigate('projects')}><MoreHorizontal size={18} /></button></div>
          {projects.length ? <div className="mini-project-list">{projects.slice(0, 4).map((item) => <button className={`mini-project ${item.id === project?.id ? 'mini-project-current' : ''}`} key={item.id} onClick={() => navigate('projects')}><span className="project-monogram">{item.name.slice(0, 1).toUpperCase()}</span><span className="mini-project-copy"><strong>{item.name}</strong><small>{item.industry || 'Chưa phân loại'} · {item.targetPlatforms?.length || 0} kênh</small></span><ChevronRight size={15} /></button>)}</div> : <EmptyInline icon={<FolderKanban size={20} />} title="Chưa có dự án" action="Tạo dự án" onClick={onCreate} />}
        </section>
      </div>

      <section className="workflow-strip">
        <div className="workflow-intro"><div className="eyebrow">QUY TRÌNH SEO</div><h3>Từ ý định tìm kiếm đến nội dung xuất bản</h3><p>Một luồng công việc liền mạch trong cùng dự án.</p></div>
        <WorkflowItem number="01" title="Nghiên cứu" detail="Từ khóa & intent" icon={<Search size={17} />} onClick={() => navigate('keywords')} />
        <span className="workflow-arrow"><ArrowRight size={16} /></span>
        <WorkflowItem number="02" title="Sản xuất" detail="Nội dung & brief" icon={<BookOpen size={17} />} onClick={() => navigate('content')} />
        <span className="workflow-arrow"><ArrowRight size={16} /></span>
        <WorkflowItem number="03" title="Phân phối" detail="Kênh & indexing" icon={<Upload size={17} />} onClick={() => navigate('publishing')} />
      </section>
    </>
  );
}

function WorkflowItem({ number, title, detail, icon, onClick }: { number: string; title: string; detail: string; icon: ReactNode; onClick: () => void }) {
  return <button className="workflow-item" onClick={onClick}><span className="workflow-number">{number}</span><span className="workflow-icon">{icon}</span><span className="workflow-item-copy"><strong>{title}</strong><small>{detail}</small></span></button>;
}

function ProjectsPage({ projects, onCreate, onSelectProject, onOpenSettings }: {
  projects: Project[]; onCreate: () => void; onSelectProject: (id: string) => void; onOpenSettings: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = projects.filter((project) =>
    `${project.name} ${project.industry} ${project.id}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <section className="panel data-panel">
      <div className="panel-toolbar"><div className="toolbar-title"><FolderKanban size={18} /><strong>{projects.length} dự án</strong></div><div className="toolbar-actions"><div className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm dự án" aria-label="Tìm dự án" /></div><button className="button button-primary" onClick={onCreate}><Plus size={16} /> Dự án mới</button></div></div>
      {projects.length && filtered.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>TÊN DỰ ÁN</th><th>NGÀNH</th><th>KÊNH MỤC TIÊU</th><th>TRẠNG THÁI</th><th>CẬP NHẬT</th><th /></tr></thead><tbody>{filtered.map((project) => <tr key={project.id}><td><button className="project-open-button" onClick={() => onSelectProject(project.id)}><span className="project-monogram">{project.name.slice(0, 1).toUpperCase()}</span><span><strong>{project.name}</strong><small>{project.id.slice(0, 8)}</small></span></button></td><td>{project.industry}</td><td><ChannelList channels={project.targetPlatforms || []} /></td><td><StatusPill status={project.status} /></td><td>{friendlyDate(project.createdAt)}</td><td><button className="icon-button" title="Cấu hình tích hợp" aria-label={`Cấu hình ${project.name}`} onClick={() => onOpenSettings(project.id)}><Settings2 size={16} /></button></td></tr>)}</tbody></table></div>
        : projects.length ? <EmptyInline icon={<Search size={20} />} title="Không tìm thấy dự án" action="Thử từ khóa khác" />
          : <EmptyState icon={<FolderKanban size={25} />} title="Chưa có dự án SEO" description="Tạo dự án để lưu cấu hình thương hiệu, đối tượng và mục tiêu kênh." action="Tạo dự án đầu tiên" onClick={onCreate} />}
      <div className="panel-footnote"><ShieldCheck size={14} /> Dữ liệu dự án được tách biệt trong workspace hiện tại.</div>
    </section>
  );
}

function ProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (project: Project) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', industry: '', domain: '', description: '', products: '', region: 'Việt Nam', audience: '', tone: 'Chuyên gia, gần gũi' });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await api.createProject({
        name: form.name,
        industry: form.industry,
        brandContext: { domain: form.domain, description: form.description, products: form.products.split(',').map((item) => item.trim()).filter(Boolean) },
        targetAudience: { region: form.region, segments: form.audience.split(',').map((item) => item.trim()).filter(Boolean) },
        toneOfVoice: form.tone,
        targetPlatforms: [],
        platformSettings: {},
      });
      onCreated(response.data);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Tạo dự án SEO" subtitle="Thiết lập nền tảng cho quy trình SEO của thương hiệu." onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        <div className="form-grid">
          <Field label="Tên dự án"><input required maxLength={200} autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: NovaTech Organic" /></Field>
          <Field label="Ngành hàng"><input required maxLength={150} value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} placeholder="Công nghệ, làm đẹp..." /></Field>
        </div>
        <Field label="Website"><input type="url" value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })} placeholder="https://example.com" /></Field>
        <Field label="Bối cảnh thương hiệu"><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Sản phẩm, lợi thế và thông tin cần giữ nhất quán" /></Field>
        <div className="form-grid">
          <Field label="Sản phẩm / dịch vụ"><input value={form.products} onChange={(event) => setForm({ ...form, products: event.target.value })} placeholder="Phân cách bằng dấu phẩy" /></Field>
          <Field label="Thị trường"><input value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} placeholder="Việt Nam" /></Field>
        </div>
        <Field label="Đối tượng mục tiêu"><input value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })} placeholder="Chủ shop, marketer..." /></Field>
        <Field label="Giọng thương hiệu"><input value={form.tone} onChange={(event) => setForm({ ...form, tone: event.target.value })} /></Field>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Hủy</button><button className="button button-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Tạo dự án</button></div>
      </form>
    </Modal>
  );
}

function KeywordsPage({ project, clusters, onStart, onGenerate, navigate }: {
  project?: Project; clusters: Cluster[]; onStart: (action: () => Promise<unknown>, done: string) => void;
  onGenerate: (cluster: Cluster) => void; navigate: (screen: Screen) => void;
}) {
  const [seeds, setSeeds] = useState('');
  const [platform, setPlatform] = useState('google');
  const [limit, setLimit] = useState(100);
  const [filter, setFilter] = useState('');
  const [intent, setIntent] = useState('all');
  const filtered = useMemo(() => clusters.filter((cluster) =>
    (!filter || `${cluster.primaryKeyword} ${cluster.clusterName}`.toLowerCase().includes(filter.toLowerCase())) &&
    (intent === 'all' || cluster.intent === intent),
  ), [clusters, filter, intent]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!project) return;
    const seedKeywords = seeds.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean);
    if (!seedKeywords.length) return;
    void onStart(() => api.mine({ projectId: project.id, seedKeywords, platform, locale: 'vi-VN', country: 'VN', limit }), 'Đã bắt đầu nghiên cứu từ khóa');
    setSeeds('');
  };

  if (!project) return <EmptyState icon={<Target size={25} />} title="Chưa có dự án để nghiên cứu" description="Tạo dự án trước để lưu nhóm từ khóa đúng workspace." action="Mở dự án" onClick={() => navigate('projects')} />;

  return (
    <>
      <div className="keyword-layout">
        <section className="panel keyword-form-panel">
          <div className="panel-heading"><div><h3>Khám phá từ khóa</h3><p>Chọn nguồn và nhập cụm chủ đề gốc.</p></div><span className="panel-heading-icon"><Search size={17} /></span></div>
          <form onSubmit={submit} className="stack-form">
            <Field label="Dự án"><div className="static-select"><FolderKanban size={15} /><span>{project.name}</span><ChevronDown size={14} /></div></Field>
            <Field label="Nền tảng"><select value={platform} onChange={(event) => setPlatform(event.target.value)}>{miningChannels.map((channel) => <option key={channel} value={channel}>{channelLabels[channel]}</option>)}</select></Field>
            <Field label="Từ khóa hạt giống"><textarea required rows={5} value={seeds} onChange={(event) => setSeeds(event.target.value)} placeholder={'nghiên cứu từ khóa\nseo website\ntối ưu nội dung'} /><small className="field-hint">Mỗi dòng một cụm từ khóa</small></Field>
            <Field label="Số lượng tối đa"><div className="number-control"><button type="button" onClick={() => setLimit(Math.max(10, limit - 10))} aria-label="Giảm số lượng">−</button><input type="number" min={1} max={500} value={limit} onChange={(event) => setLimit(Number(event.target.value))} /><button type="button" onClick={() => setLimit(Math.min(500, limit + 10))} aria-label="Tăng số lượng">+</button></div></Field>
            <div className="provider-note"><Activity size={15} /><span>Provider hiện dùng dữ liệu gợi ý mẫu. Search volume thật cần tích hợp nguồn dữ liệu SEO.</span></div>
            <button className="button button-primary button-wide"><Search size={16} /> Nghiên cứu từ khóa</button>
          </form>
        </section>
        <section className="panel keyword-results-panel">
          <div className="panel-heading"><div><h3>Nhóm từ khóa</h3><p>{clusters.length} nhóm đã lưu trong {project.name}</p></div><div className="results-badge"><Hash size={14} /> {clusters.length}</div></div>
          <div className="table-toolbar">
            <div className="search-box"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Tìm từ khóa" aria-label="Tìm từ khóa" /></div>
            <select aria-label="Lọc theo intent" value={intent} onChange={(event) => setIntent(event.target.value)}><option value="all">Tất cả intent</option><option value="informational">Thông tin</option><option value="commercial">Thương mại</option><option value="transactional">Giao dịch</option><option value="navigational">Điều hướng</option></select>
          </div>
          <div className="table-scroll"><table className="data-table keyword-table"><thead><tr><th>TỪ KHÓA CHÍNH</th><th>INTENT</th><th>NỀN TẢNG</th><th>VOLUME</th><th /></tr></thead><tbody>{filtered.map((cluster) => <tr key={cluster.id}><td><div className="keyword-primary"><strong>{cluster.primaryKeyword}</strong><small>{cluster.clusterData?.keywords?.length || 1} từ khóa liên quan</small></div></td><td><IntentPill intent={cluster.intent} /></td><td><ChannelList channels={[cluster.platform]} /></td><td><span className="muted-value">{cluster.clusterData?.volume ? cluster.clusterData.volume.toLocaleString('vi-VN') : '—'}</span></td><td><button className="icon-button" title="Tạo nội dung từ nhóm từ khóa" aria-label="Tạo nội dung" onClick={() => onGenerate(cluster)}><Wand2 size={16} /></button></td></tr>)}</tbody></table>
            {!filtered.length && <EmptyInline icon={<Hash size={20} />} title={clusters.length ? 'Không tìm thấy từ khóa' : 'Chưa có dữ liệu từ khóa'} action={clusters.length ? undefined : 'Thêm từ khóa hạt giống ở bên trái'} onClick={clusters.length ? undefined : undefined} />}
          </div>
          <div className="panel-footnote"><ShieldCheck size={14} /> {filtered.length} / {clusters.length} nhóm từ khóa · Volume chỉ hiển thị khi provider trả dữ liệu.</div>
        </section>
      </div>
      <section className="info-band"><div className="info-icon"><Sparkles size={17} /></div><div><strong>Biến insight thành nội dung</strong><p>Chọn một nhóm từ khóa để bắt đầu brief và tạo bài viết trong đúng dự án.</p></div><button className="text-button" onClick={() => navigate('content')}>Thư viện nội dung <ArrowRight size={14} /></button></section>
    </>
  );
}

function ContentPage({ project, contents, clusters, refresh, notify, navigate }: {
  project?: Project; contents: ContentItem[]; clusters: Cluster[];
  refresh: () => Promise<void>; notify: (message: string, kind?: 'success' | 'error') => void; navigate: (screen: Screen) => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftClusterId, setDraftClusterId] = useState('');
  const selected = contents.find((item) => item.id === selectedId);
  const visible = contents.filter((item) => !query || item.title.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (selectedId && contents.some((content) => content.id === selectedId)) return;
    const item = contents[0];
    setSelectedId(item?.id || '');
    setTitle(item?.title || '');
    setMarkdown(item?.content_markdown || '');
  }, [contents, selectedId]);

  const createDraft = () => {
    if (!project) return;
    if (!clusters.length) { navigate('keywords'); notify('Hãy nghiên cứu từ khóa trước khi tạo nội dung.', 'error'); return; }
    setDraftClusterId(clusters[0].id);
    setDraftOpen(true);
  };

  const queueDraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!project) return;
    const cluster = clusters.find((item) => item.id === draftClusterId);
    if (!cluster) { notify('Hãy chọn nhóm từ khóa.', 'error'); return; }
    setGenerating(true);
    try {
      await api.generate({ projectId: project.id, clusterId: cluster.id, format: 'markdown', minWords: 1500, generateShortVideoScripts: true, targetPlatforms: project.targetPlatforms, language: 'vi' });
      setDraftOpen(false);
      await refresh();
      notify('Đã đưa yêu cầu tạo bài vào hàng đợi');
    } catch (error) {
      notify(errorText(error), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.updateContent(selected.id, { title, contentMarkdown: markdown });
      await refresh();
      notify('Đã lưu nội dung');
    } catch (error) {
      notify(errorText(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!project) return <EmptyState icon={<FileText size={25} />} title="Chọn dự án để xem nội dung" description="Bài viết được tổ chức theo từng dự án SEO." action="Mở dự án" onClick={() => navigate('projects')} />;

  return (
    <section className="editor-workspace">
      <aside className="content-list-panel">
        <div className="content-list-head"><div><strong>Nội dung</strong><span>{contents.length} bài viết</span></div><button className="icon-button" title="Tạo nội dung" aria-label="Tạo nội dung" onClick={() => void createDraft()} disabled={generating}>{generating ? <LoaderCircle className="spin" size={16} /> : <Plus size={17} />}</button></div>
        <div className="content-search"><Search size={14} /><input placeholder="Tìm bài viết" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="content-list">{visible.map((item) => <button className={`content-list-item ${item.id === selectedId ? 'content-list-item-active' : ''}`} key={item.id} onClick={() => { setSelectedId(item.id); setTitle(item.title); setMarkdown(item.content_markdown || ''); }}><span className="content-list-icon"><FileText size={16} /></span><span className="content-list-copy"><strong>{item.title}</strong><small>{friendlyDate(item.updated_at || item.created_at)}</small></span><StatusPill status={item.status} compact /></button>)}
          {!visible.length && <div className="list-empty"><FileText size={19} /><span>Chưa có bài viết trong dự án.</span><button className="text-button" onClick={() => navigate('keywords')}>Nghiên cứu từ khóa <ArrowRight size={13} /></button></div>}
        </div>
      </aside>
      <div className="editor-main">
        {selected ? <>
          <div className="editor-toolbar"><div className="editor-status"><StatusPill status={selected.status} /><span>·</span><span>Cập nhật {friendlyDate(selected.updated_at)}</span></div><div className="editor-actions"><button className="button button-secondary" onClick={() => navigate('publishing')}><Upload size={15} /> Xuất bản</button><button className="button button-primary" onClick={() => void save()} disabled={saving}>{saving ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />} Lưu thay đổi</button></div></div>
          <div className="editor-title"><input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Tiêu đề bài viết" /><div><span><Globe2 size={14} /> {project.name}</span><span><Clock3 size={14} /> {markdown.trim() ? markdown.trim().split(/\s+/).length : 0} từ</span></div></div>
          <div className="editor-split"><div className="markdown-editor"><div className="subpanel-heading"><span><BookOpen size={15} /> MARKDOWN</span><span>Autosave tắt</span></div><textarea spellCheck value={markdown} onChange={(event) => setMarkdown(event.target.value)} aria-label="Nội dung Markdown" /></div><div className="markdown-preview"><div className="subpanel-heading"><span><EyeIcon /> XEM TRƯỚC</span><span>LIVE PREVIEW</span></div><article className="prose"><ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown || '*Bản xem trước nội dung sẽ hiện ở đây.*'}</ReactMarkdown></article></div></div>
          {!!selected.short_video_scripts?.length && <details className="scripts-details"><summary><Sparkles size={15} /> Kịch bản video ngắn <span>{selected.short_video_scripts.length}</span><ChevronDown size={15} /></summary><div className="script-grid">{selected.short_video_scripts.map((script, index) => <div className="script-item" key={index}><strong>{String(script.platform || `Kịch bản ${index + 1}`)}</strong><p>{String(script.hook || script.voiceOver || '')}</p><small>{String(script.cta || '')}</small></div>)}</div></details>}
        </> : <EmptyState icon={<FileText size={25} />} title="Chưa có bài viết" description="Tạo bài từ một nhóm từ khóa đã nghiên cứu." action={clusters.length ? 'Tạo bài viết' : 'Nghiên cứu từ khóa'} onClick={() => clusters.length ? void createDraft() : navigate('keywords')} />}
      </div>
      {draftOpen && <Modal title="Tạo bản nháp" subtitle={`Chọn nhóm từ khóa trong dự án ${project.name}.`} onClose={() => setDraftOpen(false)}>
        <form className="modal-form" onSubmit={queueDraft}>
          <Field label="Nhóm từ khóa"><select required value={draftClusterId} onChange={(event) => setDraftClusterId(event.target.value)}>{clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.primaryKeyword}</option>)}</select></Field>
          <div className="provider-note"><Sparkles size={15} /><span>Nội dung sẽ được tạo thành tác vụ. Kết quả xuất hiện trong thư viện khi xử lý xong.</span></div>
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setDraftOpen(false)}>Hủy</button><button className="button button-primary" disabled={generating}>{generating ? <LoaderCircle className="spin" size={15} /> : <Wand2 size={15} />} Tạo nội dung</button></div>
        </form>
      </Modal>}
    </section>
  );
}

function EyeIcon() {
  return <Search size={14} />;
}

function PublishingPage({ project, contents, onStart, navigate }: { project?: Project; contents: ContentItem[]; onStart: (action: () => Promise<unknown>, done: string) => void; navigate: (screen: Screen) => void }) {
  const [contentId, setContentId] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [sendIndexing, setSendIndexing] = useState(true);
  const [running, setRunning] = useState(false);
  const ready = contents.filter((item) => item.status === 'ready' || item.status === 'published');
  const selectedContent = ready.find((item) => item.id === contentId);
  useEffect(() => {
    if (!ready.some((item) => item.id === contentId)) setContentId(ready[0]?.id || '');
  }, [contentId, ready]);
  useEffect(() => {
    if (!project) return;
    setChannels((current) => current.length ? current : (project.targetPlatforms || []).filter((item) => publishingChannels.includes(item)));
  }, [project]);

  const toggle = (channel: string) => setChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedContent || !channels.length) return;
    setRunning(true);
    void onStart(() => api.publish({ contentId: selectedContent.id, targetPlatforms: channels, publishOptions: { visibility: 'public', sendIndexing } }), 'Đã đưa nội dung vào hàng đợi xuất bản');
    window.setTimeout(() => setRunning(false), 700);
  };

  if (!project) return <EmptyState icon={<Upload size={25} />} title="Chọn dự án để xuất bản" description="Kết nối nền tảng xuất bản trong cấu hình dự án." action="Mở dự án" onClick={() => navigate('projects')} />;

  return (
    <form className="publishing-layout" onSubmit={submit}>
      <section className="panel publishing-main">
        <div className="panel-heading"><div><h3>Nội dung cần xuất bản</h3><p>Chọn bài viết và các kênh đích.</p></div><span className="panel-heading-icon"><Upload size={17} /></span></div>
        <Field label="Bài viết"><select required value={contentId} onChange={(event) => setContentId(event.target.value)}><option value="">Chọn bài viết</option>{ready.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>
        {selectedContent && <div className="publish-preview"><span className="content-list-icon"><FileText size={17} /></span><div><strong>{selectedContent.title}</strong><small>{(selectedContent.content_markdown || '').trim().split(/\s+/).filter(Boolean).length} từ · {selectedContent.status}</small></div><button type="button" className="text-button" onClick={() => navigate('content')}>Mở bài <ArrowRight size={13} /></button></div>}
        <div className="field"><span className="field-label">KÊNH XUẤT BẢN</span><div className="channel-select-grid">{publishingChannels.map((channel) => <label className={`channel-option ${channels.includes(channel) ? 'channel-option-active' : ''}`} key={channel}><input type="checkbox" checked={channels.includes(channel)} onChange={() => toggle(channel)} /><span className={`channel-mark mark-${channel}`}>{channel.slice(0, 1).toUpperCase()}</span><span><strong>{channelLabels[channel]}</strong><small>{(project.targetPlatforms || []).includes(channel) ? 'Đã bật trong dự án' : 'Chưa bật trong dự án'}</small></span><span className="check-indicator">{channels.includes(channel) && <Check size={13} />}</span></label>)}</div></div>
        <label className="toggle-row"><span className="toggle-copy"><strong>Gửi yêu cầu indexing sau khi đăng</strong><small>Gửi URL đến Google Indexing API và IndexNow nếu đã cấu hình.</small></span><input type="checkbox" checked={sendIndexing} onChange={(event) => setSendIndexing(event.target.checked)} /></label>
        <div className="provider-note"><ShieldCheck size={15} /><span>Thông tin kết nối được lưu mã hóa. Kết nối kênh trong mục Tích hợp trước khi xuất bản.</span></div>
        <div className="publishing-actions"><button type="button" className="button button-secondary" onClick={() => navigate('integrations')}><Settings2 size={15} /> Cấu hình kênh</button><button className="button button-primary" disabled={running || !selectedContent || !channels.length}>{running ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />} Đưa vào hàng đợi</button></div>
      </section>
      <aside className="publishing-aside">
        <div className="panel publish-checklist"><div className="panel-heading"><div><h3>Kiểm tra trước khi đăng</h3><p>{selectedContent ? 'Bài viết đã chọn' : 'Chưa chọn nội dung'}</p></div></div><ChecklistItem done={!!selectedContent} label="Có bài viết trong thư viện" /><ChecklistItem done={!!channels.length} label={`${channels.length} kênh được chọn`} /><ChecklistItem done={(project.targetPlatforms || []).some((item) => channels.includes(item))} label="Kênh đã bật trong dự án" /><ChecklistItem done={false} label="Thông tin xác thực nền tảng" /><button type="button" className="text-button" onClick={() => navigate('jobs')}>Theo dõi tác vụ <ArrowRight size={14} /></button></div>
        <div className="integration-tip"><div className="tip-icon"><Globe2 size={17} /></div><div><strong>Thiết lập kết nối</strong><p>Mỗi nền tảng cần thông tin xác thực riêng trước khi nhận nội dung.</p><button className="text-button" type="button" onClick={() => navigate('integrations')}>Mở tích hợp <ArrowRight size={13} /></button></div></div>
      </aside>
    </form>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return <div className="checklist-item"><span className={done ? 'check-done' : 'check-pending'}>{done ? <Check size={13} /> : <span />}</span>{label}</div>;
}

function JobsPage({ jobs, onRefresh }: { jobs: Job[]; onRefresh: () => Promise<void> }) {
  const [filter, setFilter] = useState('all');
  const visible = jobs.filter((job) => filter === 'all' || job.status === filter);
  return <section className="panel data-panel"><div className="panel-toolbar"><div className="toolbar-title"><Activity size={18} /><strong>{jobs.length} tác vụ</strong></div><div className="toolbar-actions"><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Lọc tác vụ"><option value="all">Tất cả trạng thái</option><option value="queued">Đang chờ</option><option value="processing">Đang xử lý</option><option value="completed">Hoàn tất</option><option value="failed">Thất bại</option></select><button className="button button-secondary" onClick={() => void onRefresh()}><RefreshCw size={15} /> Làm mới</button></div></div><JobTable jobs={visible} />{!visible.length && <EmptyInline icon={<Activity size={20} />} title="Chưa có tác vụ" action="Tác vụ mới sẽ xuất hiện tại đây" />}</section>;
}

function JobTable({ jobs, compact = false }: { jobs: Job[]; compact?: boolean }) {
  if (!jobs.length) return <EmptyInline icon={<Clock3 size={20} />} title="Chưa có tác vụ gần đây" action="Bắt đầu nghiên cứu từ khóa hoặc tạo bài viết" />;
  return <div className="table-scroll"><table className={`data-table job-table ${compact ? 'job-table-compact' : ''}`}><thead><tr><th>TÁC VỤ</th><th>TRẠNG THÁI</th><th>TIẾN ĐỘ</th><th>THỜI GIAN</th><th>ID</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.jobId}><td><div className="job-name"><span className={`job-type-icon type-${job.type}`}><JobIcon type={job.type} /></span><span><strong>{jobTypeName(job.type)}</strong><small>{job.error?.message || String(job.result?.platform || job.result?.title || 'NovaSEO worker')}</small></span></div></td><td><StatusPill status={job.status} /></td><td><div className="progress-cell"><div className="progress-track"><span style={{ width: `${job.progress || (job.status === 'completed' ? 100 : 0)}%` }} /></div><small>{job.progress || 0}%</small></div></td><td>{friendlyDate(job.createdAt)}</td><td><code className="job-id">{job.jobId.slice(0, 8)}</code></td></tr>)}</tbody></table></div>;
}

function JobIcon({ type }: { type: string }) {
  if (type === 'keyword_mining') return <Hash size={16} />;
  if (type === 'content_generation') return <Wand2 size={16} />;
  if (type === 'publishing') return <Upload size={16} />;
  return <Target size={16} />;
}

function jobTypeName(type: string) {
  return ({ keyword_mining: 'Nghiên cứu từ khóa', content_generation: 'Tạo nội dung', publishing: 'Xuất bản nội dung', indexing: 'Indexing' } as Record<string, string>)[type] || type;
}

function IntegrationsPage({ project, projects, onProjectChange, onSaved, notify }: {
  project?: Project; projects: Project[]; onProjectChange: (id: string) => void; onSaved: () => Promise<void>; notify: (message: string, kind?: 'success' | 'error') => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setChannels(project?.targetPlatforms || []);
    const settings = project?.platformSettings || {};
    setForm(Object.fromEntries(Object.entries(settings).flatMap(([platform, value]) =>
      Object.entries(value || {}).map(([key, field]) => [`${platform}.${key}`, String(field)]),
    )));
  }, [project]);

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const toggle = (channel: string) => setChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!project) return;
    setBusy(true);
    const settings: Record<string, Record<string, string>> = {};
    for (const [key, value] of Object.entries(form)) {
      const [platform, field] = key.split('.');
      if (value.trim()) settings[platform] = { ...settings[platform], [field]: value.trim() };
    }
    try {
      await api.updateProject(project.id, { targetPlatforms: channels, platformSettings: settings });
      await onSaved();
      notify('Đã lưu cấu hình tích hợp');
    } catch (error) {
      notify(errorText(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!projects.length) return <EmptyState icon={<Globe2 size={25} />} title="Tạo dự án để cấu hình tích hợp" description="Kênh xuất bản và credentials được lưu theo từng dự án." action="Tạo dự án" onClick={() => window.location.hash = '#projects'} />;

  return <form className="integrations-form" onSubmit={save}>
    <section className="panel integration-project-bar"><div><div className="eyebrow">CẤU HÌNH THEO DỰ ÁN</div><strong>Chọn website cần thiết lập</strong></div><select value={project?.id || ''} onChange={(event) => onProjectChange(event.target.value)}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></section>
    <section className="panel integration-channels"><div className="panel-heading"><div><h3>Kênh mục tiêu</h3><p>Bật các nền tảng sẽ dùng trong dự án này.</p></div><span className="panel-heading-icon"><Globe2 size={17} /></span></div><div className="channel-select-grid channel-select-grid-wide">{publishingChannels.map((channel) => <label className={`channel-option ${channels.includes(channel) ? 'channel-option-active' : ''}`} key={channel}><input type="checkbox" checked={channels.includes(channel)} onChange={() => toggle(channel)} /><span className={`channel-mark mark-${channel}`}>{channel.slice(0, 1).toUpperCase()}</span><span><strong>{channelLabels[channel]}</strong><small>{channels.includes(channel) ? 'Đã bật' : 'Chưa bật'}</small></span><span className="check-indicator">{channels.includes(channel) && <Check size={13} />}</span></label>)}</div></section>
    <section className="panel integration-details"><div className="panel-heading"><div><h3>Thông tin kết nối</h3><p>Secret được mã hóa khi lưu và không gửi lại cho trình duyệt.</p></div><ShieldCheck size={18} className="safe-icon" /></div>
      <div className="integration-provider"><div className="provider-title"><span className="channel-mark mark-webhook">W</span><span><strong>Custom Webhook</strong><small>Gửi tiêu đề và nội dung qua HTTP POST</small></span><StatusPill status={form['webhook.url'] ? 'connected' : 'pending'} /></div><div className="form-grid"><Field label="Webhook URL"><input type="url" value={form['webhook.url'] || ''} onChange={(event) => set('webhook.url', event.target.value)} placeholder="https://hooks.example.com/content" /></Field><Field label="Webhook secret"><input type="password" autoComplete="new-password" value={form['webhook.secret'] || ''} onChange={(event) => set('webhook.secret', event.target.value)} placeholder="Để trống nếu không thay đổi" /></Field></div></div>
      <div className="integration-provider"><div className="provider-title"><span className="channel-mark mark-wordpress">W</span><span><strong>WordPress</strong><small>Site URL và Application Password</small></span><StatusPill status={form['wordpress.siteUrl'] ? 'connected' : 'pending'} /></div><div className="form-grid"><Field label="Site URL"><input type="url" value={form['wordpress.siteUrl'] || ''} onChange={(event) => set('wordpress.siteUrl', event.target.value)} placeholder="https://example.com" /></Field><Field label="Application Password"><input type="password" autoComplete="new-password" value={form['wordpress.appPassword'] || ''} onChange={(event) => set('wordpress.appPassword', event.target.value)} placeholder="Để trống nếu không thay đổi" /></Field></div></div>
      <div className="integration-provider"><div className="provider-title"><span className="channel-mark mark-shopify">S</span><span><strong>Shopify</strong><small>Store URL và Admin API token</small></span><StatusPill status={form['shopify.storeUrl'] ? 'connected' : 'pending'} /></div><div className="form-grid"><Field label="Store URL"><input type="url" value={form['shopify.storeUrl'] || ''} onChange={(event) => set('shopify.storeUrl', event.target.value)} placeholder="https://store.myshopify.com" /></Field><Field label="Admin API token"><input type="password" autoComplete="new-password" value={form['shopify.token'] || ''} onChange={(event) => set('shopify.token', event.target.value)} placeholder="Để trống nếu không thay đổi" /></Field></div></div>
      <div className="integration-provider"><div className="provider-title"><span className="channel-mark mark-tiktok">T</span><span><strong>TikTok / YouTube</strong><small>OAuth token được cung cấp bởi nền tảng</small></span><StatusPill status={form['tiktok.oauthToken'] || form['youtube.oauthToken'] ? 'connected' : 'pending'} /></div><div className="form-grid"><Field label="TikTok OAuth token"><input type="password" autoComplete="new-password" value={form['tiktok.oauthToken'] || ''} onChange={(event) => set('tiktok.oauthToken', event.target.value)} placeholder="Để trống nếu không thay đổi" /></Field><Field label="YouTube OAuth token"><input type="password" autoComplete="new-password" value={form['youtube.oauthToken'] || ''} onChange={(event) => set('youtube.oauthToken', event.target.value)} placeholder="Để trống nếu không thay đổi" /></Field></div></div>
      <div className="integration-disclaimer"><Activity size={15} /> Adapter hiện tại hỗ trợ webhook HTTP tổng quát. Tích hợp xuất bản native cho WordPress, Shopify, TikTok và YouTube cần adapter/API credentials tương ứng.</div>
      <div className="integration-save"><span><ShieldCheck size={14} /> Không hiển thị secret đã lưu</span><button className="button button-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={15} />} Lưu cấu hình</button></div>
    </section>
  </form>;
}

function ChannelList({ channels }: { channels: string[] }) {
  if (!channels?.length) return <span className="muted-value">Chưa chọn</span>;
  return <div className="channel-list">{channels.slice(0, 3).map((channel) => <span className={`channel-dot mark-${channel}`} title={channelLabels[channel] || channel} key={channel}>{channel.slice(0, 1).toUpperCase()}</span>)}{channels.length > 3 && <span className="channel-more">+{channels.length - 3}</span>}</div>;
}

function IntentPill({ intent }: { intent: string }) {
  const label = ({ informational: 'Thông tin', commercial: 'Thương mại', transactional: 'Giao dịch', navigational: 'Điều hướng' } as Record<string, string>)[intent] || intent;
  return <span className={`intent-pill intent-${intent}`}>{label}</span>;
}

function StatusPill({ status, compact = false }: { status: string; compact?: boolean }) {
  const labels: Record<string, string> = { active: 'Hoạt động', ready: 'Sẵn sàng', published: 'Đã xuất bản', draft: 'Bản nháp', queued: 'Đang chờ', processing: 'Đang xử lý', completed: 'Hoàn tất', failed: 'Thất bại', connected: 'Đã kết nối', pending: 'Chưa kết nối' };
  return <span className={`status-pill status-${status} ${compact ? 'status-pill-compact' : ''}`}><i />{labels[status] || status}</span>;
}

function EmptyInline({ icon, title, action, onClick }: { icon: ReactNode; title: string; action?: string; onClick?: (() => void) | undefined }) {
  return <div className="empty-inline"><span className="empty-inline-icon">{icon}</span><strong>{title}</strong>{action && (onClick ? <button className="text-button" onClick={onClick}>{action}</button> : <small>{action}</small>)}</div>;
}

function EmptyState({ icon, title, description, action, onClick }: { icon: ReactNode; title: string; description: string; action: string; onClick: () => void }) {
  return <section className="empty-state"><span className="empty-state-icon">{icon}</span><h3>{title}</h3><p>{description}</p><button className="button button-primary" onClick={onClick}><Plus size={16} /> {action}</button></section>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div>{children}</section></div>;
}

export default App;
