declare module 'lucide-react' {
  import type { FC, SVGProps } from 'react';

  export type LucideProps = SVGProps<SVGSVGElement> & {
    size?: number | string;
    strokeWidth?: number;
    absoluteStrokeWidth?: boolean;
  };

  type LucideIcon = FC<LucideProps>;

  export const Activity: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const ArrowUpRight: LucideIcon;
  export const BookOpen: LucideIcon;
  export const Check: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const CircleHelp: LucideIcon;
  export const Clock3: LucideIcon;
  export const Command: LucideIcon;
  export const FileText: LucideIcon;
  export const FolderKanban: LucideIcon;
  export const Globe2: LucideIcon;
  export const Hash: LucideIcon;
  export const LayoutDashboard: LucideIcon;
  export const LoaderCircle: LucideIcon;
  export const LogOut: LucideIcon;
  export const Menu: LucideIcon;
  export const MoreHorizontal: LucideIcon;
  export const Pencil: LucideIcon;
  export const Plus: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const Search: LucideIcon;
  export const Send: LucideIcon;
  export const Settings2: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Target: LucideIcon;
  export const Trash2: LucideIcon;
  export const Upload: LucideIcon;
  export const Wand2: LucideIcon;
  export const X: LucideIcon;
}
