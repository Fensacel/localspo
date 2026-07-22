import { NavLink, useLocation } from 'react-router-dom';
import { Home, Library, Search, Settings, Download } from 'lucide-react';
import { motion } from 'framer-motion';

export function MobileBottomNav() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/library', label: 'Library', icon: Library },
    { path: '/search', label: 'Search', icon: Search },
    { path: '/downloads', label: 'Downloads', icon: Download },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="flex md:hidden fixed bottom-0 left-0 right-0 h-[66px] bg-black/80 backdrop-blur-2xl border-t border-white/10 z-40 px-2 pb-[env(safe-area-inset-bottom,0px)] items-center justify-around">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex-1 flex flex-col items-center justify-center py-1 relative min-h-[48px] touch-none"
          >
            {isActive && (
              <motion.div
                layoutId="activeTabMobile"
                className="absolute inset-0 bg-white/10 rounded-xl"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
            <Icon
              size={20}
              className={`transition-colors duration-200 z-10 ${
                isActive ? 'text-green-400 scale-110' : 'text-white/50'
              }`}
            />
            <span
              className={`text-[10px] font-medium mt-1 z-10 transition-colors duration-200 ${
                isActive ? 'text-white font-semibold' : 'text-white/50'
              }`}
            >
              {item.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
