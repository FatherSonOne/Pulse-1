'use strict';

const { app, BrowserWindow, shell, Menu, Tray, session, protocol, net, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const isDev = process.env.ELECTRON_IS_DEV === '1';
const DEV_URL = 'http://localhost:5173';

// Register app:// as a privileged scheme BEFORE app is ready (production only)
if (!isDev) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        allowServiceWorkers: true,
        corsEnabled: true,
      },
    },
  ]);
}

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow() {
  const iconPath = path.join(__dirname, '../public/icons/icon-512x512.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: iconPath,
    title: 'Pulse',
    backgroundColor: '#09090b', // matches app dark background, avoids white flash
    show: false,                // reveal after ready-to-show
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev,       // relax CSP in dev so Vite HMR works
      sandbox: true,
    },
  });

  // Show gracefully once renderer is painted
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL('app://pulse/');
  }

  // Route external http(s) links to system browser instead of opening a new Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Intercept navigation away from the app (e.g. OAuth redirects) — open externally
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isDev && url.startsWith(DEV_URL)) return; // allow HMR
    if (!isDev && url.startsWith('app://')) return; // allow SPA routing
    event.preventDefault();
    shell.openExternal(url);
  });

  // Minimise to tray on window close (keep running in background)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── System Tray ─────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, '../public/icons/icon-192x192.png');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Pulse',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Pulse',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Pulse — Team Communication');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    } else {
      createWindow();
    }
  });
}

// ─── App menu (Windows/Linux) ─────────────────────────────────────────────────

function buildAppMenu() {
  const template = [
    {
      label: 'Pulse',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:platform', () => process.platform);

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {

  // Serve dist/ folder via app:// protocol in production
  if (!isDev) {
    protocol.handle('app', (request) => {
      const distRoot = path.join(__dirname, '../dist');

      // Strip protocol + host → relative path
      let urlPath = request.url.replace(/^app:\/\/pulse\/?/, '');
      // Remove query string and hash for file resolution
      urlPath = urlPath.split('?')[0].split('#')[0];

      const filePath = path.join(distRoot, urlPath);

      // Serve the asset if it exists, otherwise serve index.html (SPA catch-all)
      if (urlPath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return net.fetch(pathToFileURL(filePath).toString());
      }
      return net.fetch(pathToFileURL(path.join(distRoot, 'index.html')).toString());
    });
  }

  // Allow microphone + camera for Voxer voice features
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['microphone', 'camera', 'notifications', 'media', 'mediaKeySystem'];
    callback(allowed.includes(permission));
  });

  buildAppMenu();
  createWindow();
  createTray();

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on('window-all-closed', () => {
  // On macOS keep the process alive (standard behaviour)
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
