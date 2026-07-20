import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  Music,
  Disc3,
  Mic2,
  Heart,
  ListMusic,
  Clock,
  Settings,
  Search,
  FolderOpen,
  FileText,
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

const mainNavItems: NavItem[] = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/songs', label: 'Songs', icon: Music },
  { path: '/albums', label: 'Albums', icon: Disc3 },
  { path: '/artists', label: 'Artists', icon: Mic2 },
];

const libraryNavItems: NavItem[] = [
  { path: '/favorites', label: 'Favorites', icon: Heart },
  { path: '/playlists', label: 'Playlists', icon: ListMusic },
  { path: '/history', label: 'History', icon: Clock },
];

const bottomNavItems: NavItem[] = [
  { path: '/docs', label: 'Docs', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-[260px] h-full glass-heavy flex flex-col shrink-0 z-40"
    >
      {/* Search */}
      <div className="px-4 pt-2 pb-3">
        <NavLink
          to="/search"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text/50 glass transition-all duration-200 hover:text-text/80 hover:bg-white/5"
        >
          <Search size={16} strokeWidth={1.8} />
          <span>Search</span>
        </NavLink>
      </div>

      {/* Main Navigation */}
      <nav className="px-3 flex-1 overflow-y-auto">
        <div className="space-y-1">
          {mainNavItems.map((item) => (
            <SidebarLink key={item.path} item={item} isActive={location.pathname === item.path} />
          ))}
        </div>

        {/* Library section */}
        <div className="mt-6">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-text/30">
            Library
          </p>
          <div className="space-y-1">
            {libraryNavItems.map((item) => (
              <SidebarLink key={item.path} item={item} isActive={location.pathname === item.path} />
            ))}
          </div>
        </div>

        {/* Folder shortcut */}
        <div className="mt-6">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-text/30">
            Quick Access
          </p>
          <button
            onClick={async () => {
              const folder = await window.electronAPI.dialog.openFolder();
              if (folder) {
                // Will be handled by scanner service
                window.dispatchEvent(new CustomEvent('scan-folder', { detail: folder }));
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text/50 transition-all duration-200 hover:text-text/80 hover:bg-white/5"
          >
            <FolderOpen size={18} strokeWidth={1.8} />
            <span>Add Music Folder</span>
          </button>
        </div>
      </nav>

      {/* Bottom nav */}
      <div className="px-3 pb-4 border-t border-white/5 pt-3">
        {bottomNavItems.map((item) => (
          <SidebarLink key={item.path} item={item} isActive={location.pathname === item.path} />
        ))}
      </div>
    </motion.aside>
  );
}

interface SidebarLinkProps {
  item: NavItem;
  isActive: boolean;
}

function SidebarLink({ item, isActive }: SidebarLinkProps) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group"
    >
      {/* Active background */}
      {isActive && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute inset-0 bg-primary/15 rounded-xl border border-primary/20"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}

      {/* Active indicator bar */}
      {isActive && (
        <motion.div
          layoutId="sidebar-indicator"
          className="absolute left-0 top-2.5 bottom-2.5 w-[3px] bg-primary rounded-r-full glow-primary"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}

      <Icon
        size={18}
        strokeWidth={1.8}
        className={`relative z-10 transition-colors duration-200 ${
          isActive ? 'text-primary' : 'text-text/50 group-hover:text-text/80'
        }`}
      />
      <span
        className={`relative z-10 font-medium transition-colors duration-200 ${
          isActive ? 'text-text' : 'text-text/60 group-hover:text-text/80'
        }`}
      >
        {item.label}
      </span>
    </NavLink>
  );
}
