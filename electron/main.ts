import { app, BrowserWindow } from 'electron';
import path from 'path';

const IS_DEV = process.env.ELECTRON_DEV === 'true';
const PORT = 58342;

// Set ALL env vars BEFORE requiring any server code so db/index.ts picks them up
if (!IS_DEV) {
  const userData = app.getPath('userData');
  process.env.DB_PATH = path.join(userData, 'budget.db');
  process.env.ELECTRON_PROD = 'true';
  // __dirname in packaged app = .../resources/app/electron/dist/
  // better-sqlite3 package is at .../resources/app/node_modules/better-sqlite3/
  process.env.DB_NATIVE_BINDING = path.join(
    __dirname,
    '../../node_modules/better-sqlite3/build/Release/better_sqlite3.node',
  );
  process.env.MIGRATIONS_PATH = path.join(process.resourcesPath, 'migrations');
}
process.env.EXPRESS_PORT = String(PORT);

async function waitForServer(port: number, ms = 15000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error(`Server failed to start on port ${port}`);
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (IS_DEV) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // client/dist/ is two levels up from electron/dist/
    win.loadFile(path.join(__dirname, '../../client/dist/index.html'));
  }
}

app.whenReady().then(async () => {
  if (!IS_DEV) {
    // server.js is in the same directory as main.js (electron/dist/)
    const { startServer } = require(path.join(__dirname, 'server.js')) as {
      startServer: (port: number) => Promise<void>;
    };
    await startServer(PORT);
    await waitForServer(PORT);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
