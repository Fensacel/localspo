import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore, useHistoryStore } from '@/stores';
import { getAudioUrl } from '@/utils';

/**
 * AudioEngine is a headless component that manages the HTML5 Audio element
 * and Web Audio API integration. It listens to player store changes and
 * dispatched custom events to control playback.
 */
export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const lastSeekTimestampRef = useRef<number>(0);

  const {
    currentSong,
    isPlaying,
    volume,
    isMuted,
    playbackSpeed,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    playNext,
  } = usePlayerStore();

  // Initialize audio elements
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
      audioRef.current.crossOrigin = 'anonymous';
      console.log('[AudioEngine] HTMLAudioElement (audioRef) created successfully.');
    }
    if (!nextAudioRef.current) {
      nextAudioRef.current = new Audio();
      nextAudioRef.current.preload = 'auto';
      nextAudioRef.current.crossOrigin = 'anonymous';
      console.log('[AudioEngine] HTMLAudioElement (nextAudioRef) created successfully.');
    }

    return () => {
      console.log('[AudioEngine] Cleaning up audio elements. Pausing audio...');
      audioRef.current?.pause();
      nextAudioRef.current?.pause();
      audioContextRef.current?.close();
    };
  }, []);

  // Sync MediaSession for Android & Desktop media notification / lockscreen controls
  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: currentSong.album || '',
        artwork: currentSong.coverPath
          ? [{ src: getAudioUrl(currentSong.coverPath), sizes: '512x512', type: 'image/png' }]
          : [],
      });

      navigator.mediaSession.setActionHandler('play', () => {
        setIsPlaying(true);
        window.dispatchEvent(new CustomEvent('player:toggle'));
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        setIsPlaying(false);
        window.dispatchEvent(new CustomEvent('player:toggle'));
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        usePlayerStore.getState().playPrevious();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        usePlayerStore.getState().playNext();
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          usePlayerStore.getState().setCurrentTime(details.seekTime);
          window.dispatchEvent(new CustomEvent('player:seek', { detail: details.seekTime }));
        }
      });
    }
  }, [currentSong, setIsPlaying]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // Initialize Web Audio API
  const initAudioContext = useCallback(() => {
    if (audioContextRef.current || !audioRef.current) {
      if (audioContextRef.current) {
        console.log('[AudioEngine WebAudio] AudioContext already exists. State:', audioContextRef.current.state);
      }
      return;
    }

    try {
      console.log('[AudioEngine WebAudio] Initializing Web Audio API...');
      const ctx = new AudioContext();
      console.log('[AudioEngine WebAudio] AudioContext created successfully. State:', ctx.state);

      const source = ctx.createMediaElementSource(audioRef.current);
      console.log('[AudioEngine WebAudio] MediaElementAudioSourceNode created.');

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;
      console.log('[AudioEngine WebAudio] AnalyserNode created.');

      const gain = ctx.createGain();
      console.log('[AudioEngine WebAudio] GainNode created.');

      source.connect(analyser);
      analyser.connect(gain);
      gain.connect(ctx.destination);
      console.log('[AudioEngine WebAudio] Connected: AudioElement -> Analyser -> Gain -> Destination.');

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      gainRef.current = gain;

      // Expose globally for visualizers
      (window as unknown as Record<string, unknown>).__bluetune_analyser = analyser;
      (window as unknown as Record<string, unknown>).__bluetune_audioContext = ctx;
      console.log('[AudioEngine WebAudio] Nodes exposed on window.__bluetune_analyser.');
    } catch (e) {
      console.error('[AudioEngine WebAudio] Fatal error initializing Web Audio API:', e);
    }
  }, []);

  const teardownWebAudio = useCallback(() => {
    try {
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
      if (gainRef.current) {
        gainRef.current.disconnect();
      }
    } catch (error) {
      console.error('[AudioEngine WebAudio] Failed disconnecting audio nodes:', error);
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch((error) => {
        console.error('[AudioEngine WebAudio] Failed closing AudioContext:', error);
      });
    }

    sourceRef.current = null;
    analyserRef.current = null;
    gainRef.current = null;
    audioContextRef.current = null;
    (window as unknown as Record<string, unknown>).__bluetune_analyser = null;
    (window as unknown as Record<string, unknown>).__bluetune_audioContext = null;
  }, []);

  const lastSongIdRef = useRef<string | null>(null);
  const lastLoggedHistorySongIdRef = useRef<string | null>(null);

  // Synchronize player store (currentSong, isPlaying) with HTMLAudioElement
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    console.log('AudioEngine currentSong', currentSong);
    console.log('audio src', audio.src);

    if (!currentSong) {
      console.log('[AudioEngine Sync] No song active. Resetting src.');
      audio.src = '';
      lastSongIdRef.current = null;
      lastLoggedHistorySongIdRef.current = null;
      if (isPlaying) {
        setIsPlaying(false);
      }
      return;
    }

    const isNewSong = lastSongIdRef.current !== currentSong.id;

    if (isNewSong) {
      const src = getAudioUrl(currentSong.path);
      console.log(`[AudioEngine Sync] New song detected: "${currentSong.title}" by "${currentSong.artist}"`);
      console.log(`[AudioEngine Sync] Local path: "${currentSong.path}"`);
      console.log(`[AudioEngine Sync] Formatted source URL: "${src}"`);

      lastSongIdRef.current = currentSong.id;
      lastLoggedHistorySongIdRef.current = null;

      // Verify path on local filesystem
      if (window.electronAPI?.fs?.exists) {
        window.electronAPI.fs.exists(currentSong.path).then((exists: boolean) => {
          console.log(`[AudioEngine PathCheck] File exists on disk: ${exists} for path: "${currentSong.path}"`);
          if (!exists) {
            console.error(`[AudioEngine PathCheck] File path is INVALID or file is missing on local disk! path: "${currentSong.path}"`);
          }
        }).catch((err: Error) => {
          console.error('[AudioEngine PathCheck] Error running existence check:', err);
        });
      }

      // Stop current playback before setting new source
      audio.pause();
      audio.src = src;
      audio.load();
      console.log('[AudioEngine Sync] audio.load() called.');
    }

    if (isPlaying) {
      console.log(`[AudioEngine Sync] Playback requested for: "${currentSong.title}"`);

      const startPlayback = async () => {
        try {
          const isLocalProtocolSource = audio.src.startsWith('local-audio://');
          if (isLocalProtocolSource) {
            // local-audio:// can be blocked by Chromium CORS when routed via MediaElementAudioSource.
            // Keep native HTMLAudioElement output path so playback audio remains audible.
            teardownWebAudio();
            console.log('[AudioEngine WebAudio] Skipped graph for local-audio:// source to preserve audible playback.');
          } else {
            initAudioContext();
            if (audioContextRef.current?.state === 'suspended') {
              console.log('[AudioEngine Sync] AudioContext suspended. Resuming context...');
              await audioContextRef.current.resume();
            }
          }

          console.log('Trying play', audio.src);
          console.log('[AudioEngine Sync] Invoking audio.play()...');
          await audio.play();
          console.log('PLAY SUCCESS');
          console.log(`[AudioEngine Sync] audio.play() promise resolved. Currently playing: "${currentSong.title}"`);

          if (lastLoggedHistorySongIdRef.current !== currentSong.id) {
            lastLoggedHistorySongIdRef.current = currentSong.id;
            useHistoryStore.getState().addHistoryEntry(currentSong.id, currentSong.duration);
          }

          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: currentSong.title,
              artist: currentSong.artist,
              album: currentSong.album,
            });
            navigator.mediaSession.playbackState = 'playing';
          }
        } catch (error) {
          console.error(error);
          console.error(`[AudioEngine Sync] audio.play() call failed:`, error);
          // Revert store state so play button doesn't get stuck in loading/playing state
          console.log('[AudioEngine Sync] Syncing store to match play failure (setting isPlaying = false).');
          setIsPlaying(false);
        }
      };

      startPlayback();
    } else {
      // Pause requested
      if (!audio.paused) {
        console.log('[AudioEngine Sync] Pause requested. Calling audio.pause().');
        audio.pause();
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
      }
    }
  }, [currentSong, isPlaying, initAudioContext, setIsPlaying, teardownWebAudio]);

  // Verbose Event Logging and Store Synchronization
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const logEvent = (eventName: string, details?: any) => {
      console.log(`[AudioEngine Event] "${eventName}" | src: "${audio.src}" | readyState: ${audio.readyState} | paused: ${audio.paused} | currentTime: ${audio.currentTime.toFixed(2)}/${audio.duration || 0}`, details || '');
    };

    const handleLoadedMetadata = () => {
      logEvent('loadedmetadata');
      console.log("Audio Current:", audio.currentTime);
      if (audio.duration && isFinite(audio.duration)) {
        console.log(`[AudioEngine Event] Setting duration in store: ${audio.duration}`);
        setDuration(audio.duration);
      }
    };

    const handleCanPlay = () => {
      logEvent('canplay');
    };

    const handlePlay = () => {
      logEvent('play');
      if (!isPlaying) {
        console.log('[AudioEngine Event] play event fired by audio element. Syncing store: isPlaying = true');
        setIsPlaying(true);
      }
    };

    const handlePlaying = () => {
      logEvent('playing');
      if (!isPlaying) {
        console.log('[AudioEngine Event] playing event fired by audio element. Syncing store: isPlaying = true');
        setIsPlaying(true);
      }
    };

    const handlePause = () => {
      logEvent('pause');
      if (isPlaying) {
        console.log('[AudioEngine Event] pause event fired by audio element. Syncing store: isPlaying = false');
        setIsPlaying(false);
      }
    };

    const handleTimeUpdate = () => {
      console.log("Audio Current:", audio.currentTime);
      const isStoreSeeking = usePlayerStore.getState().isSeeking;
      if (isStoreSeeking || audio.seeking) {
        return;
      }
      setCurrentTime(audio.currentTime);
    };

    const handleSeeking = () => {
      console.log("Seek Start");
      console.log("Seek To:", audio.currentTime);
    };

    const handleSeeked = () => {
      console.log("Audio Current:", audio.currentTime);
      console.log("Seek End");
      setCurrentTime(audio.currentTime);
      usePlayerStore.getState().setIsSeeking(false);
    };

    const handleEnded = () => {
      logEvent('ended');
      console.log("Audio Current:", audio.currentTime);
      
      // Prevent premature ended events from skipping the song (e.g. during seek or loading glitches)
      if (audio.seeking) {
        console.log('[AudioEngine Event] ended event ignored because audio is seeking.');
        return;
      }
      if (audio.duration > 0 && audio.currentTime < audio.duration - 1.5) {
        console.log('[AudioEngine Event] ended event ignored because current time is far from duration.');
        return;
      }

      console.log('[AudioEngine Event] Song ended. Triggering playNext...');
      playNext();
    };

    const handleError = () => {
      const err = audio.error;
      console.error('[AudioEngine Event] "error" event fired by HTMLAudioElement!', {
        code: err?.code,
        message: err?.message,
        src: audio.src,
      });
      setIsPlaying(false);
    };

    const handleWaiting = () => {
      logEvent('waiting');
    };

    const handleStalled = () => {
      logEvent('stalled');
    };

    const handleLoadStart = () => {
      logEvent('loadstart');
    };

    const handleEmptied = () => {
      logEvent('emptied');
    };

    // Attach listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('seeking', handleSeeking);
    audio.addEventListener('seeked', handleSeeked);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('stalled', handleStalled);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('emptied', handleEmptied);

    return () => {
      // Detach listeners
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('seeking', handleSeeking);
      audio.removeEventListener('seeked', handleSeeked);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('stalled', handleStalled);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('emptied', handleEmptied);
    };
  }, [isPlaying, setIsPlaying, setCurrentTime, setDuration, playNext]);

  // Volume control
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const targetVol = isMuted ? 0 : volume;
    audio.volume = targetVol;
    if (gainRef.current && audioContextRef.current) {
      gainRef.current.gain.setValueAtTime(targetVol, audioContextRef.current.currentTime);
    }
    console.log(`[AudioEngine Sync] Volume updated to: ${targetVol} (Muted: ${isMuted}, Volume: ${volume})`);
  }, [volume, isMuted]);

  // Playback speed
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackSpeed;
    console.log(`[AudioEngine Sync] Playback speed updated to: ${playbackSpeed}`);
  }, [playbackSpeed]);

  // Custom event listeners
  useEffect(() => {
    const handleToggle = () => {
      console.log('[AudioEngine CustomEvent] player:toggle event received.');
      const audio = audioRef.current;
      if (!audio) return;

      if (audio.paused) {
        audio.play().catch((err) => {
          console.error('[AudioEngine CustomEvent] Play failed after toggle:', err);
        });
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    };

    const handleSeek = (e: Event) => {
      const audio = audioRef.current;
      if (!audio) return;
      const time = (e as CustomEvent).detail;
      if (typeof time !== 'number' || !isFinite(time) || time < 0) return;

      const playerStateBefore = usePlayerStore.getState();
      console.log('[Lyric Seek] Before click -> Song ID:', playerStateBefore.currentSong?.id, '| Queue Index:', playerStateBefore.queueIndex);
      console.log('[Lyric Seek] Target Lyric Time:', time.toFixed(2), '| Audio Current:', audio.currentTime.toFixed(2));

      lastSeekTimestampRef.current = Date.now();
      const wasPlaying = !audio.paused;

      try {
        audio.currentTime = time;
        if (wasPlaying && audio.paused) {
          audio.play().catch(() => {});
        }
      } catch (err) {
        console.error('[Lyric Seek] Error setting currentTime:', err);
      }

      usePlayerStore.getState().setCurrentTime(time);

      const playerStateAfter = usePlayerStore.getState();
      console.log('[Lyric Seek] After click -> Song ID:', playerStateAfter.currentSong?.id, '| Queue Index:', playerStateAfter.queueIndex);
      console.log('[Lyric Seek] Audio Current After:', audio.currentTime.toFixed(2));
    };

    const handleVolume = (e: Event) => {
      const audio = audioRef.current;
      if (!audio) return;
      const vol = (e as CustomEvent).detail;
      console.log(`[AudioEngine CustomEvent] player:volume event received. Setting volume: ${vol}`);
      audio.volume = vol;
    };

    window.addEventListener('player:toggle', handleToggle);
    window.addEventListener('player:seek', handleSeek);
    window.addEventListener('player:volume', handleVolume);

    return () => {
      window.removeEventListener('player:toggle', handleToggle);
      window.removeEventListener('player:seek', handleSeek);
      window.removeEventListener('player:volume', handleVolume);
    };
  }, [setIsPlaying]);

  // Media Session handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current?.play().catch(() => {});
      setIsPlaying(true);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause();
      setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      usePlayerStore.getState().playPrevious();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      usePlayerStore.getState().playNext();
    });
  }, [setIsPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('player:toggle'));
          break;
        case 'ArrowRight':
          if (e.ctrlKey) {
            usePlayerStore.getState().playNext();
          } else if (audioRef.current && audioRef.current.duration > 0 && audioRef.current.readyState >= 1) {
            audioRef.current.currentTime = Math.min(
              audioRef.current.currentTime + 5,
              audioRef.current.duration,
            );
          }
          break;
        case 'ArrowLeft':
          if (e.ctrlKey) {
            usePlayerStore.getState().playPrevious();
          } else if (audioRef.current && audioRef.current.duration > 0 && audioRef.current.readyState >= 1) {
            audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 5, 0);
          }
          break;
        case 'ArrowUp':
          if (e.ctrlKey) {
            const newVol = Math.min(1, usePlayerStore.getState().volume + 0.05);
            usePlayerStore.getState().setVolume(newVol);
            if (audioRef.current) audioRef.current.volume = newVol;
          }
          break;
        case 'ArrowDown':
          if (e.ctrlKey) {
            const newVol = Math.max(0, usePlayerStore.getState().volume - 0.05);
            usePlayerStore.getState().setVolume(newVol);
            if (audioRef.current) audioRef.current.volume = newVol;
          }
          break;
        case 'KeyM':
          if (e.ctrlKey) {
            usePlayerStore.getState().toggleMute();
            if (audioRef.current) {
              audioRef.current.volume = usePlayerStore.getState().isMuted
                ? 0
                : usePlayerStore.getState().volume;
            }
          }
          break;
        case 'KeyS':
          if (e.ctrlKey) {
            e.preventDefault();
            usePlayerStore.getState().toggleShuffle();
          }
          break;
        case 'KeyR':
          if (e.ctrlKey) {
            e.preventDefault();
            usePlayerStore.getState().toggleRepeat();
          }
          break;
        case 'KeyQ':
          if (e.ctrlKey) {
            e.preventDefault();
            usePlayerStore.getState().toggleQueue();
          }
          break;
        case 'KeyL':
          if (e.ctrlKey) {
            e.preventDefault();
            usePlayerStore.getState().toggleLyrics();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return null;
}
