import { contextBridge } from 'electron';

// In dev mode, Vite's proxy handles /api so no injection needed.
// In prod, inject the embedded server's base URL before React code runs.
if (process.env.ELECTRON_DEV !== 'true') {
  const port = process.env.EXPRESS_PORT ?? '58342';
  contextBridge.exposeInMainWorld('__API_BASE__', `http://localhost:${port}/api`);
}
