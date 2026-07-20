import { ipcMain } from 'electron';
import { DownloaderService, DownloaderSettings } from '../downloader/downloaderService';

let downloaderServiceInstance: DownloaderService | null = null;

export function registerDownloaderIpc(getDataPath: () => string): DownloaderService {
  if (!downloaderServiceInstance) {
    downloaderServiceInstance = new DownloaderService(getDataPath);
  }

  const service = downloaderServiceInstance;

  ipcMain.handle('downloader:downloadSpotify', async (_event, urlStr: string) => {
    return await service.addUrl(urlStr);
  });

  ipcMain.handle('downloader:cancelDownload', async (_event, id: string) => {
    service.cancelDownload(id);
    return true;
  });

  ipcMain.handle('downloader:cancelAll', async () => {
    service.cancelAllDownloads();
    return true;
  });

  ipcMain.handle('downloader:getQueue', async () => {
    return service.getQueue();
  });

  ipcMain.handle('downloader:retryDownload', async (_event, id: string) => {
    service.retryDownload(id);
    return true;
  });

  ipcMain.handle('downloader:removeDownload', async (_event, id: string) => {
    service.removeDownload(id);
    return true;
  });

  ipcMain.handle('downloader:clearFinished', async () => {
    service.clearFinished();
    return true;
  });

  ipcMain.handle('downloader:openDownloadFolder', async () => {
    service.openDownloadFolder();
    return true;
  });

  ipcMain.handle('downloader:getSettings', async () => {
    return service.getSettings();
  });

  ipcMain.handle('downloader:updateSettings', async (_event, partial: Partial<DownloaderSettings>) => {
    return service.updateSettings(partial);
  });

  return service;
}
