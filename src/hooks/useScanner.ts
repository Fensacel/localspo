import { useEffect, useCallback } from 'react';
import { useLibraryStore, useSettingsStore } from '@/stores';
import type { LibraryData, ScanProgress } from '@/types';
import { platformService } from '@/platform';

/**
 * Hook that manages the music scanner bridge between Electron main / Capacitor Android and renderer.
 * Listens for scan events, loads library on mount, and handles folder scanning.
 */
export function useScanner() {
  const { setLibraryData, setScanProgress, setLoading } = useLibraryStore();
  const { musicFolders, addMusicFolder } = useSettingsStore();

  // Load library on mount
  useEffect(() => {
    const loadLibrary = async () => {
      setLoading(true);
      try {
        const data = (await platformService.scanner.getLibrary()) as LibraryData | null;
        if (data) {
          setLibraryData(data);
        }
      } catch (err) {
        console.error('Failed to load library:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLibrary();
  }, [setLibraryData, setLoading]);

  // Listen for scan progress
  useEffect(() => {
    const unsubscribe = platformService.scanner.onProgress((data: unknown) => {
      const progress = data as ScanProgress;
      setScanProgress(progress);

      // When scan is done, reload library
      if (progress.status === 'done') {
        platformService.scanner.getLibrary().then((libData: unknown) => {
          if (libData) {
            setLibraryData(libData as LibraryData);
          }
        });
      }
    });

    return unsubscribe;
  }, [setScanProgress, setLibraryData]);

  // Listen for custom scan events
  useEffect(() => {
    const handleScanFolder = async (e: Event) => {
      const folder = (e as CustomEvent).detail as string;
      if (!folder) return;

      await addMusicFolder(folder);
      await platformService.scanner.scanFolder(folder);
    };

    const handleRescan = async () => {
      for (const folder of musicFolders) {
        await platformService.scanner.scanFolder(folder);
      }
    };

    window.addEventListener('scan-folder', handleScanFolder);
    window.addEventListener('rescan-library', handleRescan);

    return () => {
      window.removeEventListener('scan-folder', handleScanFolder);
      window.removeEventListener('rescan-library', handleRescan);
    };
  }, [musicFolders, addMusicFolder]);

  const scanFolder = useCallback(
    async (folder: string) => {
      await addMusicFolder(folder);
      return platformService.scanner.scanFolder(folder);
    },
    [addMusicFolder],
  );

  return { scanFolder };
}
