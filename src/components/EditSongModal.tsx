import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image, Save, Upload, Trash2, Loader2, FileText, Music } from 'lucide-react';
import { useLibraryStore, useToastStore } from '@/stores';
import { getImageUrl } from '@/utils';
import type { Song } from '@/types';

interface EditSongModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EditSongModal({ song, isOpen, onClose }: EditSongModalProps) {
  const { updateSongTags } = useLibraryStore();
  const { showToast } = useToastStore();

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [genre, setGenre] = useState('');
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (song && isOpen) {
      setTitle(song.title || '');
      setArtist(song.artist || '');
      setAlbum(song.album || '');
      setAlbumArtist(song.albumArtist || song.artist || '');
      setYear(song.year || '');
      setGenre(song.genre || '');
      setCoverPath(song.coverPath || null);
      setLyrics('');

      // Fetch existing lyrics
      if (window.electronAPI?.lyrics) {
        setIsLoadingLyrics(true);
        window.electronAPI.lyrics
          .read(song.id, song.path, song.lrcPath || null, song.hasEmbeddedLyrics, song.artist, song.title, song.album, song.duration)
          .then((res: any) => {
            if (res && res.content) {
              setLyrics(res.content);
            }
          })
          .catch(() => {})
          .finally(() => setIsLoadingLyrics(false));
      }
    }
  }, [song, isOpen]);

  if (!isOpen || !song) return null;

  const handleSelectCover = async () => {
    if (window.electronAPI?.dialog?.openImage) {
      const selected = await window.electronAPI.dialog.openImage();
      if (selected) {
        setCoverPath(selected);
      }
    }
  };

  const handleRemoveCover = () => {
    setCoverPath(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) {
      showToast('Title and Artist are required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const success = await updateSongTags(song.id, {
        path: song.path,
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim(),
        albumArtist: albumArtist.trim() || artist.trim(),
        year: typeof year === 'number' ? year : undefined,
        genre: genre.trim(),
        coverPath,
        lyrics: lyrics.trim() || null,
      });

      if (success) {
        showToast('Track info updated successfully!', 'success');
        onClose();
      } else {
        showToast('Failed to update track info', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating tags', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-2xl glass-panel rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                <Music size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-text">Edit Track Info & Tags</h2>
                <p className="text-xs text-text/50 truncate max-w-sm">{song.path}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="p-2 text-text/40 hover:text-text hover:bg-white/10 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Cover Image Selector */}
              <div className="flex flex-col items-center gap-3">
                <label className="text-text/70 font-semibold self-start">Cover Artwork</label>
                <div className="relative group w-44 h-44 rounded-2xl overflow-hidden glass border border-white/10 flex items-center justify-center bg-zinc-900 shadow-lg">
                  {coverPath ? (
                    <img
                      src={getImageUrl(coverPath)}
                      alt="Cover Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-text/30">
                      <Image size={36} />
                      <span className="text-[11px]">No Cover</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectCover}
                      className="p-2.5 bg-primary text-zinc-950 rounded-xl font-semibold shadow-glow hover:scale-105 transition-transform"
                      title="Choose New Image"
                    >
                      <Upload size={16} />
                    </button>
                    {coverPath && (
                      <button
                        type="button"
                        onClick={handleRemoveCover}
                        className="p-2.5 bg-danger/80 text-white rounded-xl font-semibold hover:scale-105 transition-transform"
                        title="Remove Image"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSelectCover}
                  className="w-full py-2 px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-text/80 font-medium flex items-center justify-center gap-2"
                >
                  <Upload size={14} />
                  <span>Choose Cover</span>
                </button>
              </div>

              {/* Right Column: Metadata Fields */}
              <div className="md:col-span-2 space-y-3">
                <div>
                  <label className="block text-text/60 mb-1 font-medium">Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-text focus:outline-none focus:border-primary/50 text-xs"
                    placeholder="Song Title"
                  />
                </div>

                <div>
                  <label className="block text-text/60 mb-1 font-medium">Artist *</label>
                  <input
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-text focus:outline-none focus:border-primary/50 text-xs"
                    placeholder="Artist Name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-text/60 mb-1 font-medium">Album</label>
                    <input
                      type="text"
                      value={album}
                      onChange={(e) => setAlbum(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-text focus:outline-none focus:border-primary/50 text-xs"
                      placeholder="Album Name"
                    />
                  </div>

                  <div>
                    <label className="block text-text/60 mb-1 font-medium">Album Artist</label>
                    <input
                      type="text"
                      value={albumArtist}
                      onChange={(e) => setAlbumArtist(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-text focus:outline-none focus:border-primary/50 text-xs"
                      placeholder="Album Artist"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-text/60 mb-1 font-medium">Year</label>
                    <input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(e.target.value ? parseInt(e.target.value, 10) : '')}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-text focus:outline-none focus:border-primary/50 text-xs"
                      placeholder="e.g. 2024"
                    />
                  </div>

                  <div>
                    <label className="block text-text/60 mb-1 font-medium">Genre</label>
                    <input
                      type="text"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-text focus:outline-none focus:border-primary/50 text-xs"
                      placeholder="Pop, Rock, Indietronica..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Embedded Lyrics Section */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <label className="text-text/70 font-semibold flex items-center gap-2">
                  <FileText size={14} className="text-primary" />
                  <span>Embedded Lyrics (Plain or Synced .LRC)</span>
                </label>
                {isLoadingLyrics && (
                  <span className="text-text/40 flex items-center gap-1.5 text-[11px]">
                    <Loader2 size={12} className="animate-spin" />
                    Loading lyrics...
                  </span>
                )}
              </div>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={6}
                placeholder="[00:12.34] Lyrics line 1&#10;[00:15.89] Lyrics line 2&#10;or plain lyrics text..."
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-text focus:outline-none focus:border-primary/50 font-mono text-xs leading-relaxed"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-text/70 hover:text-text font-semibold transition-colors text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-primary text-zinc-950 font-bold shadow-glow hover:bg-primary/90 transition-all flex items-center gap-2 text-xs"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving Tags...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
