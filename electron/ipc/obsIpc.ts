import { ipcMain } from 'electron';
import { OBSServer, OBSOverlayConfig, OBSStatePayload } from '../obsServer';

let obsServerInstance: OBSServer | null = null;

export function registerOBSIpc(getDataPath: () => string): OBSServer {
  const server = new OBSServer(getDataPath);
  obsServerInstance = server;

  // Auto-start server on application launch if enabled in config
  const initialConfig = server.getConfig();
  if (initialConfig.enabled) {
    server.start();
  }

  ipcMain.handle('obs:getStatus', async () => {
    return server.getStatus();
  });

  ipcMain.handle('obs:start', async () => {
    const ok = server.start();
    return server.getStatus();
  });

  ipcMain.handle('obs:stop', async () => {
    server.stop();
    return server.getStatus();
  });

  ipcMain.handle('obs:updateConfig', async (_event, newConfig: Partial<OBSOverlayConfig>) => {
    server.updateConfig(newConfig);
    return server.getStatus();
  });

  ipcMain.on('obs:updateState', (_event, payload: Partial<OBSStatePayload>, localCoverPath?: string | null, remoteCoverUrl?: string | null) => {
    server.updateState(payload, localCoverPath, remoteCoverUrl);
  });

  return server;
}

export function getOBSServer(): OBSServer | null {
  return obsServerInstance;
}
