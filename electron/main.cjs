const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let server = null;
let serverPort = null;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.bin': 'application/octet-stream',
  '.cue': 'text/plain; charset=utf-8',
  '.smc': 'application/octet-stream',
  '.sfc': 'application/octet-stream',
  '.fig': 'application/octet-stream',
  '.chd': 'application/octet-stream',
  '.iso': 'application/octet-stream',
  '.pbp': 'application/octet-stream',
  '.zip': 'application/zip',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

/**
 * Starts a lightweight local HTTP server serving the production dist folder
 * with mandatory Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers.
 * This guarantees Nostalgist WebAssembly (SharedArrayBuffer) and ES modules work cleanly.
 */
function startLocalServer() {
  return new Promise((resolve, reject) => {
    // In packaged app, dist is in app resources or relative to main
    let distDir = path.join(__dirname, '../dist');
    if (!fs.existsSync(distDir)) {
      distDir = path.join(process.resourcesPath, 'dist');
    }

    server = http.createServer((req, res) => {
      // Set COOP and COEP headers on every response for WebAssembly SharedArrayBuffer support
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      res.setHeader('Access-Control-Allow-Origin', '*');

      let reqPath = decodeURI(req.url.split('?')[0]);
      if (reqPath === '/' || reqPath === '') {
        reqPath = '/index.html';
      }

      let filePath = path.join(distDir, reqPath);

      // Prevent path traversal
      if (!filePath.startsWith(distDir)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          // SPA fallback to index.html
          filePath = path.join(distDir, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        const stream = fs.createReadStream(filePath);
        stream.on('error', (readErr) => {
          res.statusCode = 500;
          res.end('Internal Server Error');
        });
        stream.pipe(res);
      });
    });

    // Listen on random available port on 127.0.0.1
    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      console.log(`Retro2K internal desktop server active at http://127.0.0.1:${serverPort}`);
      resolve(serverPort);
    });

    server.on('error', (err) => {
      console.error('Failed to start internal server:', err);
      reject(err);
    });
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    title: 'Retro2K — SNES & PS1 Retro Station',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const appUrl = process.env.ELECTRON_START_URL || `http://127.0.0.1:${port}`;
  mainWindow.loadURL(appUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Ensure single app instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      const port = await startLocalServer();
      createWindow(port);

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow(port);
        }
      });
    } catch (err) {
      console.error('Initialization error:', err);
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    if (server) {
      server.close();
    }
  });
}
