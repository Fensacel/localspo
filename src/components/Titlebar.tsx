import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { motion } from 'framer-motion';

export function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await window.electronAPI.window.isMaximized();
      setIsMaximized(maximized);
    };
    checkMaximized();

    const interval = setInterval(checkMaximized, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="drag-region h-9 flex items-center justify-between px-4 bg-transparent z-50 relative shrink-0">
      {/* App title */}
      <div className="flex items-center gap-2 no-drag">
        <div className="w-3 h-3 rounded-full bg-primary glow-blue" />
        <span className="text-xs font-semibold text-text/70 tracking-wider uppercase">
          BlueTune
        </span>
      </div>

      {/* Window controls */}
      <div className="flex items-center no-drag">
        <TitlebarButton
          onClick={() => window.electronAPI.window.minimize()}
          hoverColor="hover:bg-white/10"
        >
          <Minus size={14} strokeWidth={1.8} />
        </TitlebarButton>

        <TitlebarButton
          onClick={() => {
            window.electronAPI.window.maximize();
            setIsMaximized(!isMaximized);
          }}
          hoverColor="hover:bg-white/10"
        >
          {isMaximized ? (
            <Copy size={11} strokeWidth={1.8} />
          ) : (
            <Square size={11} strokeWidth={1.8} />
          )}
        </TitlebarButton>

        <TitlebarButton
          onClick={() => window.electronAPI.window.close()}
          hoverColor="hover:bg-red-500/80"
        >
          <X size={14} strokeWidth={1.8} />
        </TitlebarButton>
      </div>
    </div>
  );
}

interface TitlebarButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  hoverColor: string;
}

function TitlebarButton({ children, onClick, hoverColor }: TitlebarButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={`w-10 h-9 flex items-center justify-center text-text/60 transition-colors duration-150 ${hoverColor}`}
    >
      {children}
    </motion.button>
  );
}
