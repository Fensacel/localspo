import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Minus,
  Square,
  X,
  Copy,
  ChevronLeft,
  ChevronRight,
  Home,
  Search,
  FolderSearch,
  Clock,
  Music,
  User,
  Disc,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { platformService } from '@/platform';
import { useSpotifyStore } from '@/modules/downloader/stores/useSpotifyStore';
import { usePlayerStore, useLibraryStore } from '@/stores';
import type { Song } from '@/types';

interface RecentSearchItem {
  id: string;
  title: string;
  subtitle: string;
  coverUrl?: string;
  type: 'song' | 'artist' | 'query' | 'album';
  ytVideoId?: string;
}

export function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { searchQuery, setSearchQuery, search, searchResults } = useSpotifyStore();
  const { setQueue } = usePlayerStore();
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Load recent search history from localStorage
  const loadRecentSearches = () => {
    try {
      const raw = localStorage.getItem('localspo_recent_search_items');
      if (raw) {
        setRecentSearches(JSON.parse(raw));
      } else {
        // Fallback default items if none exist yet
        setRecentSearches([
          { id: '1', title: 'Hearts2Hearts', subtitle: 'Artist', type: 'artist' },
          { id: '2', title: 'TWICE', subtitle: 'Artist', type: 'artist' },
          { id: '3', title: 'Nadin Amizah', subtitle: 'Artist', type: 'artist' },
          { id: '4', title: 'STYLE', subtitle: 'Song • Hearts2Hearts', type: 'song' },
        ]);
      }
    } catch {}
  };

  useEffect(() => {
    loadRecentSearches();
  }, []);

  // Save a recent search item
  const addRecentSearch = (item: RecentSearchItem) => {
    try {
      const existing = recentSearches.filter((i) => i.id !== item.id && i.title.toLowerCase() !== item.title.toLowerCase());
      const updated = [item, ...existing].slice(0, 10);
      setRecentSearches(updated);
      localStorage.setItem('localspo_recent_search_items', JSON.stringify(updated));
    } catch {}
  };

  // Remove a recent search item
  const removeRecentSearch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = recentSearches.filter((i) => i.id !== id);
      setRecentSearches(updated);
      localStorage.setItem('localspo_recent_search_items', JSON.stringify(updated));
    } catch {}
  };

  // Clear all recent search items
  const clearAllRecent = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    localStorage.removeItem('localspo_recent_search_items');
  };

  // Keyboard shortcut (Ctrl+L or Cmd+L) and Escape handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsDropdownOpen(true);
        if (location.pathname !== '/search') navigate('/search');
      }
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [location.pathname, navigate]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!platformService.isElectron || !window.electronAPI?.window) return;

    const checkMaximized = async () => {
      const maximized = await window.electronAPI.window.isMaximized();
      setIsMaximized(maximized);
    };
    checkMaximized();

    const interval = setInterval(checkMaximized, 500);
    return () => clearInterval(interval);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setIsDropdownOpen(true);
    if (val.trim()) {
      search(val.trim());
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      addRecentSearch({
        id: `query_${Date.now()}`,
        title: searchQuery.trim(),
        subtitle: 'Search Query',
        type: 'query',
      });
      search(searchQuery.trim());
      setIsDropdownOpen(false);
      usePlayerStore.setState({ showLyrics: false, showNowPlaying: false });
      navigate('/search');
    }
  };

  const handleGoBack = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate(-1);
    }
  };

  const handleGoForward = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.history.forward();
  };

  if (!platformService.isElectron || !window.electronAPI?.window) {
    return null;
  }

  const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  return (
    <div className="drag-region h-14 hidden md:flex items-center justify-between px-4 bg-[#09090b]/90 backdrop-blur-md border-b border-white/5 z-50 relative shrink-0 select-none">
      {/* Left: Logo & Navigation */}
      <div className="flex items-center gap-3 no-drag" style={noDragStyle}>
        <div
          onClick={() => {
            usePlayerStore.setState({ showLyrics: false, showNowPlaying: false });
            navigate('/');
          }}
          className="flex items-center gap-2 cursor-pointer select-none group mr-2 no-drag"
          style={noDragStyle}
        >
          <img src="logo.png" className="w-5 h-5 object-contain" alt="LocalSpo" />
          <span className="text-xs font-bold text-text tracking-wider uppercase group-hover:text-primary transition-colors">
            LocalSpo
          </span>
        </div>

        {/* Back / Forward History Navigation */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/5 no-drag" style={noDragStyle}>
          <button
            type="button"
            onClick={handleGoBack}
            title="Go back"
            style={noDragStyle}
            className="w-7 h-7 rounded-full flex items-center justify-center text-text/60 hover:text-white hover:bg-white/15 active:scale-95 transition-all no-drag cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={handleGoForward}
            title="Go forward"
            style={noDragStyle}
            className="w-7 h-7 rounded-full flex items-center justify-center text-text/60 hover:text-white hover:bg-white/15 active:scale-95 transition-all no-drag cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Center: Spotify Desktop Header (Home + Search Input + Dropdown Popover) */}
      <div className="flex items-center gap-2 no-drag flex-1 max-w-lg mx-4 relative" style={noDragStyle} ref={searchContainerRef}>
        {/* Home Button */}
        <button
          type="button"
          onClick={() => {
            usePlayerStore.setState({ showLyrics: false, showNowPlaying: false });
            navigate('/');
          }}
          title="Home"
          style={noDragStyle}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all no-drag cursor-pointer ${
            location.pathname === '/'
              ? 'bg-white/15 text-white'
              : 'bg-white/5 text-text/60 hover:text-white hover:bg-white/10'
          }`}
        >
          <Home size={18} />
        </button>

        {/* Search Input Container */}
        <form onSubmit={handleSearchSubmit} className="flex-1 relative flex items-center no-drag" style={noDragStyle}>
          <Search size={16} className="absolute left-3.5 text-text/40 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onClick={() => {
              setIsDropdownOpen(true);
            }}
            onFocus={() => {
              setIsDropdownOpen(true);
            }}
            placeholder="What do you want to play?"
            style={noDragStyle}
            className="w-full h-10 pl-10 pr-16 bg-[#1f1f22] border border-white/10 rounded-full text-xs font-medium text-white placeholder:text-text/35 focus:outline-none focus:border-primary/50 focus:bg-[#28282d] transition-all no-drag cursor-text"
          />

          {/* Shortcut Badge (Ctrl L) & Browse icon */}
          <div className="absolute right-3 flex items-center gap-1.5 pointer-events-none">
            <span className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-text/40 border border-white/5">
              Ctrl L
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                usePlayerStore.setState({ showLyrics: false, showNowPlaying: false });
                navigate('/search');
                searchInputRef.current?.focus();
                setIsDropdownOpen(true);
              }}
              title="Browse all"
              style={noDragStyle}
              className="text-text/35 hover:text-white transition-colors no-drag cursor-pointer pointer-events-auto"
            >
              <FolderSearch size={15} />
            </button>
          </div>
        </form>

        {/* ── Spotify Desktop Dropdown Popover ──────────────────────────────── */}
        <AnimatePresence>
          {isDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={noDragStyle}
              className="absolute top-12 left-12 right-0 bg-[#18181c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 p-2.5 max-h-[420px] flex flex-col no-drag"
            >
              {/* If search query is empty -> Show Recent Searches */}
              {!searchQuery.trim() ? (
                <div>
                  <div className="flex items-center justify-between px-3 py-1.5 mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white tracking-wide">
                      <Clock size={13} className="text-text/50" />
                      <span>Recent searches</span>
                    </div>
                    {recentSearches.length > 0 && (
                      <button
                        onClick={clearAllRecent}
                        className="text-[11px] font-medium text-text/40 hover:text-text hover:underline transition-colors cursor-pointer"
                      >
                        Clear recent
                      </button>
                    )}
                  </div>

                  {recentSearches.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-text/40">
                      No recent searches yet
                    </div>
                  ) : (
                    <div className="space-y-0.5 overflow-y-auto max-h-[340px] scrollbar-thin scrollbar-thumb-white/10">
                      {recentSearches.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            usePlayerStore.setState({ showLyrics: false, showNowPlaying: false });
                            setIsDropdownOpen(false);
                            (document.activeElement as HTMLElement)?.blur();

                            if (item.type === 'song') {
                              const artistName = item.subtitle?.replace(/^Song • /, '') || 'Unknown';
                              const songObj: Song = {
                                id: item.id.startsWith('stream_') ? item.id : `stream_${item.id}`,
                                title: item.title,
                                artist: artistName,
                                album: '',
                                duration: 180,
                                coverPath: item.coverUrl || null,
                                remoteCoverUrl: item.coverUrl || undefined,
                                path: '',
                                albumArtist: artistName,
                                disc: 1,
                                track: 1,
                                year: 0,
                                genre: '',
                                codec: 'MP3',
                                fileSize: 0,
                                bitrate: 320,
                                sampleRate: 44100,
                                channels: 2,
                                bitDepth: 16,
                                addedAt: Date.now(),
                                playCount: 0,
                                hash: item.id,
                                hasEmbeddedCover: false,
                                hasEmbeddedLyrics: false,
                                lrcPath: null,
                                sourceType: 'streaming',
                                ytVideoId: item.ytVideoId || undefined,
                              };
                              useLibraryStore.getState().addStreamSong(songObj);
                              setQueue([songObj], 0, 'Recent Search');
                              usePlayerStore.setState({ currentSong: songObj, isPlaying: true });
                              window.dispatchEvent(new CustomEvent('player:play'));
                            } else {
                              setSearchQuery(item.title);
                              search(item.title);
                              navigate('/search');
                            }
                          }}
                          className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {item.coverUrl ? (
                              <img
                                src={item.coverUrl}
                                className={`w-9 h-9 object-cover ${item.type === 'artist' ? 'rounded-full' : 'rounded-md'}`}
                                alt={item.title}
                              />
                            ) : (
                              <div
                                className={`w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 ${
                                  item.type === 'artist' ? 'rounded-full' : 'rounded-md'
                                }`}
                              >
                                {item.type === 'artist' ? (
                                  <User size={16} className="text-text/50" />
                                ) : item.type === 'album' ? (
                                  <Disc size={16} className="text-text/50" />
                                ) : (
                                  <Music size={16} className="text-text/50" />
                                )}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate group-hover:text-primary transition-colors">
                                {item.title}
                              </p>
                              <p className="text-[11px] text-text/50 truncate capitalize">
                                {item.subtitle}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={(e) => removeRecentSearch(item.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full text-text/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                            title="Remove"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* If user is typing -> Show Live Search Results Preview */
                <div className="overflow-y-auto max-h-[360px] space-y-2 scrollbar-thin scrollbar-thumb-white/10">
                  <div className="px-3 pt-1 text-[11px] font-bold text-text/50 uppercase tracking-wider">
                    Search results for &quot;{searchQuery}&quot;
                  </div>

                  {searchResults?.tracks && searchResults.tracks.length > 0 ? (
                    <div className="space-y-0.5">
                      {searchResults.tracks.slice(0, 5).map((track: any) => (
                        <div
                          key={track.id || track.spotifyId}
                          onClick={() => {
                            const trackId = track.id || track.spotifyId || '';
                            const cover = track.album?.images?.[0]?.url || track.coverUrl || null;
                            const artistStr = track.artists?.map((a: any) => a.name).join(', ') || track.artist || 'Unknown';
                            
                            addRecentSearch({
                              id: trackId,
                              title: track.name || track.title,
                              subtitle: `Song • ${artistStr}`,
                              coverUrl: cover || undefined,
                              type: 'song',
                              ytVideoId: track.ytVideoId || undefined,
                            });

                            const songObj: Song = {
                              id: trackId.startsWith('stream_') ? trackId : `stream_${trackId}`,
                              title: track.name || track.title,
                              artist: artistStr,
                              album: track.album?.name || track.album || '',
                              duration: Math.round((track.duration_ms || 180000) / 1000),
                              coverPath: cover,
                              remoteCoverUrl: cover || undefined,
                              path: '',
                              albumArtist: track.artists?.[0]?.name || track.artist || '',
                              disc: 1,
                              track: 1,
                              year: 0,
                              genre: '',
                              codec: 'MP3',
                              fileSize: 0,
                              bitrate: 320,
                              sampleRate: 44100,
                              channels: 2,
                              bitDepth: 16,
                              addedAt: Date.now(),
                              playCount: 0,
                              hash: trackId,
                              hasEmbeddedCover: false,
                              hasEmbeddedLyrics: false,
                              lrcPath: null,
                              sourceType: 'streaming',
                              ytVideoId: track.ytVideoId || undefined,
                            };

                            useLibraryStore.getState().addStreamSong(songObj);
                            setQueue([songObj], 0, 'Search Preview');
                            usePlayerStore.setState({ currentSong: songObj, isPlaying: true, showLyrics: false, showNowPlaying: false });
                            window.dispatchEvent(new CustomEvent('player:play'));

                            setIsDropdownOpen(false);
                            (document.activeElement as HTMLElement)?.blur();
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 cursor-pointer transition-colors group"
                        >
                          <img
                            src={track.album?.images?.[0]?.url || track.coverUrl || 'logo.png'}
                            className="w-9 h-9 object-cover rounded-md"
                            alt=""
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white truncate group-hover:text-primary transition-colors">
                              {track.name || track.title}
                            </p>
                            <p className="text-[11px] text-text/50 truncate">
                              Song • {track.artists?.map((a: any) => a.name).join(', ') || track.artist || 'Artist'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-4 text-center text-xs text-text/40">
                      Searching for &quot;{searchQuery}&quot;...
                    </div>
                  )}

                  <div
                    onClick={() => {
                      setIsDropdownOpen(false);
                      usePlayerStore.setState({ showLyrics: false, showNowPlaying: false });
                      navigate('/search');
                    }}
                    className="mt-2 pt-2 px-3 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-primary hover:text-white cursor-pointer transition-colors"
                  >
                    <span>See all results for &quot;{searchQuery}&quot;</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-text/40">
                      Enter ↵
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center no-drag" style={noDragStyle}>
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
          hoverColor="hover:bg-red-500/80 hover:text-white"
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
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      style={noDragStyle}
      className={`w-10 h-10 flex items-center justify-center text-text/60 transition-colors duration-150 rounded-lg no-drag cursor-pointer ${hoverColor}`}
    >
      {children}
    </motion.button>
  );
}
