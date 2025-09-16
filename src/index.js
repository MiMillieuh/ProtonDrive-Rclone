const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage
} = require("electron");
const path = require('node:path');
const fs = require("fs");
const os = require('os');
const { spawn } = require("child_process");

// Configuration - Use Electron's userData directory
const CONFIG_DIR = app.getPath('userData');
const SYNC_PAIRS_PATH = path.join(CONFIG_DIR, 'syncpairs.json');
const SETTINGS_PATH = path.join(CONFIG_DIR, 'settings.json');
const RCLONE_FILTER_PATH = path.join(CONFIG_DIR, 'rclone-filter.txt');
const RCLONE_COMMAND = '/usr/bin/rclone';

// Application state
let appState = {
  syncPairs: [],
  settings: {
    syncInterval: 60, // Changed default to 1 hour (60 minutes)
    excludeFile: RCLONE_FILTER_PATH,
    useExcludeFile: true,
    transfers: 14,
    checkers: 14,
    startMinimized: false,
    closeToTray: true,
    rcloneFilter: `# Rclone filter rules (one per line)
# Examples:
- .DS_Store
- Thumbs.db
- desktop.ini
- *.tmp
- *.temp
- *~
- node_modules/**
- .git/**
- .vscode/**
- *.log
- *.cache`
  },
  syncProcesses: new Map(),
  autoSyncInterval: null,
  mainWindow: null,
  tray: null,
  isQuitting: false,
  activeSyncs: 0,
  hasProtonDriveRemote: false
};

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Check if ProtonDrive remote exists in rclone config
function checkProtonDriveRemote() {
  return new Promise((resolve) => {
    const checkProcess = spawn(RCLONE_COMMAND, ['listremotes']);
    let output = '';
    
    checkProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    checkProcess.on('close', (code) => {
      if (code === 0) {
        const remotes = output.split('\n').map(line => line.trim().replace(':', '')).filter(Boolean);
        const hasProtonDrive = remotes.includes('protondrive');
        console.log('Available remotes:', remotes);
        console.log('ProtonDrive remote exists:', hasProtonDrive);
        resolve(hasProtonDrive);
      } else {
        console.error('Failed to list rclone remotes');
        resolve(false);
      }
    });
    
    checkProcess.on('error', (error) => {
      console.error('Error running rclone listremotes:', error);
      resolve(false);
    });
  });
}

// Initialize application data
async function initializeData() {
  console.log('Config directory:', CONFIG_DIR);
  
  // Check if ProtonDrive remote exists
  const hasProtonDrive = await checkProtonDriveRemote();
  appState.hasProtonDriveRemote = hasProtonDrive;
  
  // Load sync pairs
  try {
    if (fs.existsSync(SYNC_PAIRS_PATH)) {
      const data = fs.readFileSync(SYNC_PAIRS_PATH, 'utf-8');
      appState.syncPairs = JSON.parse(data);
    } else {
      fs.writeFileSync(SYNC_PAIRS_PATH, JSON.stringify([]), 'utf-8');
    }
  } catch (error) {
    console.error('Error loading sync pairs:', error);
    appState.syncPairs = [];
  }

  // Load settings
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      appState.settings = { ...appState.settings, ...JSON.parse(data) };
    } else {
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(appState.settings), 'utf-8');
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }

  // Initialize rclone filter file
  try {
    if (!fs.existsSync(RCLONE_FILTER_PATH)) {
      fs.writeFileSync(RCLONE_FILTER_PATH, appState.settings.rcloneFilter, 'utf-8');
      console.log('Created default rclone filter file');
    }
    // Update settings to use the correct path
    appState.settings.excludeFile = RCLONE_FILTER_PATH;
  } catch (error) {
    console.error('Error initializing rclone filter:', error);
  }

  console.log('Initialized with sync pairs:', appState.syncPairs.length);
  console.log('Config directory:', CONFIG_DIR);
  console.log('Settings:', appState.settings);
  console.log('ProtonDrive remote available:', hasProtonDrive);
}

const createTray = () => {
  // Create tray icon
  const iconPath = path.join(__dirname, 'Assets', 'Img', 'protondrive.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  
  appState.tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  appState.tray.setToolTip('ProtonDrive Sync - Idle');
  
  updateTrayMenu();
  
  appState.tray.on('click', () => {
    if (appState.mainWindow) {
      if (appState.mainWindow.isVisible()) {
        appState.mainWindow.hide();
      } else {
        appState.mainWindow.show();
        appState.mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
};

const updateTrayMenu = () => {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: appState.activeSyncs > 0 ? `Syncing (${appState.activeSyncs} active)` : 'Idle',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Show App',
      click: () => {
        if (appState.mainWindow) {
          appState.mainWindow.show();
          appState.mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'Sync All',
      click: () => {
        const autoSyncPairs = appState.syncPairs.filter(pair => pair.autoSync);
        if (autoSyncPairs.length > 0) {
          syncAllPairs(autoSyncPairs);
        }
      },
      enabled: appState.syncPairs.some(pair => pair.autoSync)
    },
    { type: 'separator' },
    {
      label: `${appState.syncPairs.length} sync pairs configured`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        appState.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  appState.tray.setContextMenu(contextMenu);
};

const updateTrayStatus = (syncing = false) => {
  if (!appState.tray) return;
  
  const tooltip = syncing && appState.activeSyncs > 0 
    ? `ProtonDrive Sync - Syncing (${appState.activeSyncs} active)`
    : 'ProtonDrive Sync - Idle';
  
  appState.tray.setToolTip(tooltip);
  updateTrayMenu();
};

const createWindow = () => {
  // Don't create multiple windows
  if (appState.mainWindow && !appState.mainWindow.isDestroyed()) {
    appState.mainWindow.show();
    appState.mainWindow.focus();
    return;
  }

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'Assets', 'Img', 'folder.png'),
    show: !appState.settings.startMinimized
  });

  appState.mainWindow = mainWindow;

  // Handle close button
  mainWindow.on('close', (event) => {
    if (!appState.isQuitting && appState.settings.closeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    appState.mainWindow = null;
  });

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Initialize data after window is ready
  mainWindow.webContents.once('dom-ready', async () => {
    await initializeData();
    setupAutoSync();
    // Send current sync pairs to renderer
    mainWindow.webContents.send("syncPairsLoaded", appState.syncPairs);
    mainWindow.webContents.send("settingsLoaded", appState.settings);
    mainWindow.webContents.send("protonDriveRemoteStatus", appState.hasProtonDriveRemote);
    
    // Start automatic syncs if any pairs have autoSync enabled and remote exists
    if (appState.hasProtonDriveRemote) {
      startInitialAutoSyncs();
    }
  });

  setupIpcHandlers(mainWindow);
};

function setupIpcHandlers(mainWindow) {
  // Load sync pairs
  ipcMain.on("loadSyncPairs", (event) => {
    mainWindow.webContents.send("syncPairsLoaded", appState.syncPairs);
  });

  // Save sync pairs
  ipcMain.on("saveSyncPairs", (event, syncPairs) => {
    appState.syncPairs = syncPairs;
    saveSyncPairs();
    setupAutoSync(); // Restart auto-sync with new pairs
    updateTrayMenu(); // Update tray menu with new pair count
  });

  // Load settings
  ipcMain.on("loadSettings", (event) => {
    mainWindow.webContents.send("settingsLoaded", appState.settings);
  });

  // Save settings
  ipcMain.on("saveSettings", (event, settings) => {
    appState.settings = settings;
    saveSettings();
    setupAutoSync(); // Restart auto-sync with new settings
  });

  // Select local folder
  ipcMain.on("selectLocalFolder", async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Local Folder to Sync'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      mainWindow.webContents.send("localFolderSelected", result.filePaths[0]);
    }
  });





  // Save rclone filter content
  ipcMain.on("saveRcloneFilter", (event, content) => {
    try {
      fs.writeFileSync(RCLONE_FILTER_PATH, content, 'utf-8');
      appState.settings.rcloneFilter = content;
      saveSettings();
      console.log('Rclone filter saved successfully');
      mainWindow.webContents.send("rcloneFilterSaved", true);
    } catch (error) {
      console.error('Error saving rclone filter:', error);
      mainWindow.webContents.send("rcloneFilterSaved", false);
    }
  });

  // Load rclone filter content
  ipcMain.on("loadRcloneFilter", (event) => {
    try {
      if (fs.existsSync(RCLONE_FILTER_PATH)) {
        const content = fs.readFileSync(RCLONE_FILTER_PATH, 'utf-8');
        mainWindow.webContents.send("rcloneFilterLoaded", content);
      } else {
        mainWindow.webContents.send("rcloneFilterLoaded", appState.settings.rcloneFilter || '');
      }
    } catch (error) {
      console.error('Error loading rclone filter:', error);
      mainWindow.webContents.send("rcloneFilterLoaded", appState.settings.rcloneFilter || '');
    }
  });

  // Cancel specific sync
  ipcMain.on("cancelSyncPair", (event, data) => {
    const processId = `${data.localPath}->${data.remotePath}`;
    const process = appState.syncProcesses.get(processId);
    
    if (process) {
      console.log(`Cancelling sync: ${processId}`);
      process.kill('SIGTERM');
      appState.syncProcesses.delete(processId);
      appState.activeSyncs = Math.max(0, appState.activeSyncs - 1);
      updateTrayStatus(appState.activeSyncs > 0);
      
      // Update pair status
      const pairIndex = appState.syncPairs.findIndex(p => 
        p.localPath === data.localPath && p.remotePath === data.remotePath
      );
      if (pairIndex >= 0) {
        appState.syncPairs[pairIndex].status = 'idle';
        appState.syncPairs[pairIndex].currentProgress = 0;
        appState.syncPairs[pairIndex].currentFile = '';
        saveSyncPairs();
        
        // Send updated pair to renderer
        mainWindow.webContents.send("syncPairUpdated", {
          index: pairIndex,
          pair: appState.syncPairs[pairIndex]
        });
      }
    }
  });

  // Get remote directories
  ipcMain.on("getdirs", (event, remotePath) => {
    const rclonePath = remotePath ? `protondrive:${remotePath}` : 'protondrive:';
    const getdirsprocess = spawn(RCLONE_COMMAND, ['lsd', rclonePath]);
    
    let output = '';
    
    getdirsprocess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    getdirsprocess.on('close', (code) => {
      if (code === 0) {
        mainWindow.webContents.send("getdirs", output);
      } else {
        console.error(`rclone lsd failed with code ${code}`);
        mainWindow.webContents.send("getdirs", "");
      }
    });
    
    getdirsprocess.on('error', (error) => {
      console.error('Error running rclone:', error);
      mainWindow.webContents.send("getdirs", "");
    });
  });

  // Sync single pair
  ipcMain.on("syncPair", (event, data) => {
    syncSinglePair(data.pair, data.settings);
  });

  // Sync all pairs
  ipcMain.on("syncAll", (event, data) => {
    syncAllPairs(data.pairs, data.settings);
  });

  // Cancel sync
  ipcMain.on("cancelSync", (event) => {
    cancelAllSyncs();
  });

  // Get config path
  ipcMain.on("getConfigPath", (event) => {
    mainWindow.webContents.send("configPath", CONFIG_DIR);
  });

  // Setup ProtonDrive remote
  ipcMain.on("setupProtonDriveRemote", (event, config) => {
    setupProtonDriveRemote(config, mainWindow);
  });

  // Check ProtonDrive remote status
  ipcMain.on("checkProtonDriveRemote", async (event) => {
    const hasRemote = await checkProtonDriveRemote();
    appState.hasProtonDriveRemote = hasRemote;
    mainWindow.webContents.send("protonDriveRemoteStatus", hasRemote);
  });

  // Legacy handlers for backward compatibility
  ipcMain.on("syncdirs", (event, args) => {
    // Convert legacy format to new format
    const syncPair = {
      localPath: args.path1,
      remotePath: args.path2,
      autoSync: false,
      status: 'idle',
      lastSync: null
    };
    appState.syncPairs.push(syncPair);
    ipcMain.emit("saveSyncPairs", event, appState.syncPairs);
  });
}

// Sync operations
function syncSinglePair(pair, settings = appState.settings) {
  const processId = `${pair.localPath}->${pair.remotePath}`;
  
  if (appState.syncProcesses.has(processId)) {
    console.log('Sync already in progress for this pair');
    return;
  }

  console.log(`Starting ${pair.syncType || 'sync'}: ${pair.localPath} -> protondrive:${pair.remotePath}`);
  
  // Update sync pair status in memory and save
  const pairIndex = appState.syncPairs.findIndex(p => 
    p.localPath === pair.localPath && p.remotePath === pair.remotePath
  );
  if (pairIndex >= 0) {
    appState.syncPairs[pairIndex].status = 'syncing';
    appState.syncPairs[pairIndex].lastSyncStart = Date.now();
    appState.syncPairs[pairIndex].currentProgress = 0;
    appState.syncPairs[pairIndex].currentFile = '';
    appState.syncPairs[pairIndex].transferredFiles = 0;
    appState.syncPairs[pairIndex].totalFiles = 0;
    saveSyncPairs();
    
    // Notify renderer of status change
    appState.mainWindow?.webContents.send("syncPairUpdated", {
      index: pairIndex,
      pair: appState.syncPairs[pairIndex]
    });
  }
  
  appState.activeSyncs++;
  updateTrayStatus(true);
  
  const syncCommand = pair.syncType === 'bisync' ? 'bisync' : 'sync';
  const args = [
    syncCommand,
    pair.localPath,
    `protondrive:${pair.remotePath}`,
    '--verbose',
    '--progress',
    '--stats', '1s',
    '--stats-log-level', 'NOTICE',
    '--transfers', settings.transfers.toString(),
    '--checkers', settings.checkers.toString()
  ];

  // Add bisync-specific options
  if (pair.syncType === 'bisync') {
    args.push('--create-empty-src-dirs');
    args.push('--compare', 'size,modtime');
    args.push('--slow-hash-sync-only');
    args.push('--recover');
    
    // Check if this is the first bisync run or if resync is needed
    const bisyncCacheDir = path.join(os.homedir(), '.cache', 'rclone', 'bisync');
    const sanitizedLocalPath = pair.localPath.replace(/[\/\\:]/g, '_').replace(/^_+/, '');
    const sanitizedRemotePath = pair.remotePath.replace(/[\/\\:]/g, '_').replace(/^_+/, '');
    const sanitizedPath = `${sanitizedLocalPath}..protondrive_${sanitizedRemotePath}`;
    const path1ListFile = path.join(bisyncCacheDir, `${sanitizedPath}.path1.lst`);
    const path2ListFile = path.join(bisyncCacheDir, `${sanitizedPath}.path2.lst`);
    
    console.log(`Checking bisync listing files:`);
    console.log(`- Path1: ${path1ListFile}`);
    console.log(`- Path2: ${path2ListFile}`);
    
    // Check if listing files exist or if pair is marked for one-time resync
    const listingsMissing = !fs.existsSync(path1ListFile) || !fs.existsSync(path2ListFile);
    const needsResync = listingsMissing || pair.forceResync;
    
    if (needsResync) {
      if (listingsMissing) {
        console.log('Bisync listing files missing, adding --resync flag for initialization');
      } else if (pair.forceResync) {
        console.log('Force resync requested, adding --resync flag');
      }
      
      args.push('--resync');
      
      // Clear the one-time resync flag
      if (pairIndex >= 0 && pair.forceResync) {
        appState.syncPairs[pairIndex].forceResync = false;
        saveSyncPairs();
      }
    }
  }

  // Add exclude file filter if enabled and file exists
  if (settings.useExcludeFile && settings.excludeFile) {
    try {
      if (fs.existsSync(settings.excludeFile)) {
        args.splice(3, 0, '--filter-from', settings.excludeFile);
        console.log(`Using exclude file: ${settings.excludeFile}`);
      } else {
        console.warn(`Exclude file not found: ${settings.excludeFile}`);
      }
    } catch (error) {
      console.error(`Error checking exclude file: ${error.message}`);
    }
  }

  const syncProcess = spawn(RCLONE_COMMAND, args);
  appState.syncProcesses.set(processId, syncProcess);

  let totalFiles = 0;
  let transferredFiles = 0;
  let currentFile = '';

  // Track progress from both stdout and stderr (rclone outputs progress to stderr)
  const handleOutput = (data) => {
    const message = data.toString();
    console.log(`Sync output: ${message}`);
    
    // Parse rclone progress output
    const lines = message.split('\n');
    let percentage = 0;
    let progressMessage = '';
    
    for (const line of lines) {
      // Look for progress patterns in rclone output
      if (line.includes('Transferred:')) {
        const match = line.match(/Transferred:\s+(\d+)\s*\/\s*(\d+),\s*(\d+)%/);
        if (match) {
          transferredFiles = parseInt(match[1]);
          totalFiles = parseInt(match[2]);
          percentage = parseInt(match[3]);
          progressMessage = `Transferred: ${transferredFiles}/${totalFiles} files (${percentage}%)`;
        }
      } else if (line.includes('Checking:') || line.includes('Transferring:')) {
        currentFile = line.trim();
        progressMessage = currentFile;
      } else if (line.includes('Elapsed time:')) {
        progressMessage = line.trim();
      }
    }
    
    // Update pair progress in memory
    const pairIndex = appState.syncPairs.findIndex(p => 
      p.localPath === pair.localPath && p.remotePath === pair.remotePath
    );
    if (pairIndex >= 0) {
      appState.syncPairs[pairIndex].currentProgress = percentage;
      appState.syncPairs[pairIndex].currentFile = currentFile;
      appState.syncPairs[pairIndex].transferredFiles = transferredFiles;
      appState.syncPairs[pairIndex].totalFiles = totalFiles;
      
      // Send updated pair to renderer
      appState.mainWindow?.webContents.send("syncPairUpdated", {
        index: pairIndex,
        pair: appState.syncPairs[pairIndex]
      });
    }
    
    // Send progress to renderer for logging
    appState.mainWindow?.webContents.send("syncProgress", {
      localPath: pair.localPath,
      remotePath: pair.remotePath,
      message: progressMessage || message.trim(),
      percentage: percentage,
      transferredFiles,
      totalFiles,
      currentFile
    });
  };

  syncProcess.stdout.on('data', handleOutput);
  syncProcess.stderr.on('data', handleOutput);

  syncProcess.on('close', (code) => {
    appState.syncProcesses.delete(processId);
    appState.activeSyncs = Math.max(0, appState.activeSyncs - 1);
    updateTrayStatus(appState.activeSyncs > 0);
    
    // Update sync pair status in memory and save
    const pairIndex = appState.syncPairs.findIndex(p => 
      p.localPath === pair.localPath && p.remotePath === pair.remotePath
    );
    
    if (pairIndex >= 0) {
      if (code === 0) {
        appState.syncPairs[pairIndex].status = 'success';
        appState.syncPairs[pairIndex].lastSync = Date.now();
        appState.syncPairs[pairIndex].currentProgress = 100;
        console.log(`Sync completed successfully: ${processId}`);
      } else {
        appState.syncPairs[pairIndex].status = 'error';
        appState.syncPairs[pairIndex].lastError = `Process exited with code ${code}`;
        appState.syncPairs[pairIndex].currentProgress = 0;
        console.error(`Sync failed with code ${code}: ${processId}`);
      }
      
      // Clear progress data
      appState.syncPairs[pairIndex].currentFile = '';
      appState.syncPairs[pairIndex].transferredFiles = 0;
      appState.syncPairs[pairIndex].totalFiles = 0;
      
      saveSyncPairs();
      
      // Send updated pair to renderer
      appState.mainWindow?.webContents.send("syncPairUpdated", {
        index: pairIndex,
        pair: appState.syncPairs[pairIndex]
      });
    }
  });

  syncProcess.on('error', (error) => {
    console.error(`Sync process error: ${error.message}`);
    appState.syncProcesses.delete(processId);
    appState.activeSyncs = Math.max(0, appState.activeSyncs - 1);
    updateTrayStatus(appState.activeSyncs > 0);
    
    // Update sync pair status
    const pairIndex = appState.syncPairs.findIndex(p => 
      p.localPath === pair.localPath && p.remotePath === pair.remotePath
    );
    if (pairIndex >= 0) {
      appState.syncPairs[pairIndex].status = 'error';
      appState.syncPairs[pairIndex].lastError = error.message;
      appState.syncPairs[pairIndex].currentProgress = 0;
      appState.syncPairs[pairIndex].currentFile = '';
      saveSyncPairs();
      
      // Send updated pair to renderer
      appState.mainWindow?.webContents.send("syncPairUpdated", {
        index: pairIndex,
        pair: appState.syncPairs[pairIndex]
      });
    }
    
    appState.mainWindow?.webContents.send("syncError", {
      localPath: pair.localPath,
      remotePath: pair.remotePath,
      message: error.message
    });
  });
}

function syncAllPairs(pairs, settings = appState.settings) {
  pairs.forEach(pair => {
    syncSinglePair(pair, settings);
  });
}

function cancelAllSyncs() {
  console.log('Cancelling all sync processes...');
  
  appState.syncProcesses.forEach((process, processId) => {
    console.log(`Killing sync process: ${processId}`);
    process.kill('SIGTERM');
    
    // Update status of cancelled syncs
    const [localPath, remotePath] = processId.split('->');
    const pairIndex = appState.syncPairs.findIndex(p => 
      p.localPath === localPath && p.remotePath === remotePath
    );
    if (pairIndex >= 0) {
      appState.syncPairs[pairIndex].status = 'idle';
    }
  });
  
  appState.syncProcesses.clear();
  appState.activeSyncs = 0;
  updateTrayStatus(false);
  saveSyncPairs();
}

// Auto-sync functionality
function setupAutoSync() {
  // Clear existing interval
  if (appState.autoSyncInterval) {
    clearInterval(appState.autoSyncInterval);
    appState.autoSyncInterval = null;
  }

  // Get pairs that have auto-sync enabled
  const autoSyncPairs = appState.syncPairs.filter(pair => pair.autoSync);
  
  if (autoSyncPairs.length === 0) {
    console.log('No pairs with auto-sync enabled');
    return;
  }

  const intervalMs = appState.settings.syncInterval * 60 * 1000; // Convert minutes to milliseconds
  
  console.log(`Setting up auto-sync for ${autoSyncPairs.length} pairs every ${appState.settings.syncInterval} minutes`);
  
  appState.autoSyncInterval = setInterval(() => {
    console.log('Auto-sync timer triggered...');
    
    // Check if any sync is currently running
    if (appState.activeSyncs > 0) {
      console.log(`Skipping auto-sync: ${appState.activeSyncs} sync(s) still running`);
      return;
    }
    
    // Only sync pairs that are not currently syncing and are ready
    const readyPairs = autoSyncPairs.filter(pair => {
      const processId = `${pair.localPath}->${pair.remotePath}`;
      return !appState.syncProcesses.has(processId) && pair.status !== 'syncing';
    });
    
    if (readyPairs.length > 0) {
      console.log(`Starting auto-sync for ${readyPairs.length} pairs`);
      syncAllPairs(readyPairs);
    } else {
      console.log('No pairs ready for auto-sync');
    }
  }, intervalMs);
}

// Setup ProtonDrive remote
function setupProtonDriveRemote(config, mainWindow) {
  console.log('Setting up ProtonDrive remote...');
  
  const args = [
    'config', 'create', 'protondrive', 'protondrive',
    '--non-interactive',
    `username=${config.username}`,
    `password=${config.password}`
  ];

  // Add 2FA if provided
  if (config.twoFA) {
    args.push(`2fa=${config.twoFA}`);
  }

  const setupProcess = spawn(RCLONE_COMMAND, args);
  let output = '';
  let errorOutput = '';

  setupProcess.stdout.on('data', (data) => {
    output += data.toString();
    console.log(`Setup stdout: ${data}`);
  });

  setupProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
    console.log(`Setup stderr: ${data}`);
  });

  setupProcess.on('close', async (code) => {
    if (code === 0) {
      console.log('ProtonDrive remote setup successful');
      // Recheck remote status
      const hasRemote = await checkProtonDriveRemote();
      appState.hasProtonDriveRemote = hasRemote;
      mainWindow.webContents.send("protonDriveSetupComplete", {
        success: true,
        message: 'ProtonDrive remote configured successfully!'
      });
      mainWindow.webContents.send("protonDriveRemoteStatus", hasRemote);
    } else {
      console.error(`ProtonDrive remote setup failed with code ${code}`);
      console.error('Error output:', errorOutput);
      mainWindow.webContents.send("protonDriveSetupComplete", {
        success: false,
        message: `Setup failed: ${errorOutput || 'Unknown error'}`
      });
    }
  });

  setupProcess.on('error', (error) => {
    console.error(`Setup process error: ${error.message}`);
    mainWindow.webContents.send("protonDriveSetupComplete", {
      success: false,
      message: `Setup error: ${error.message}`
    });
  });
}

// Start initial sync for auto-sync enabled pairs when app starts
function startInitialAutoSyncs() {
  const autoSyncPairs = appState.syncPairs.filter(pair => pair.autoSync);
  
  if (autoSyncPairs.length === 0) {
    console.log('No auto-sync pairs to start on app launch');
    return;
  }
  
  console.log(`Starting initial auto-sync for ${autoSyncPairs.length} pairs on app launch`);
  
  // Start sync for all auto-sync pairs
  autoSyncPairs.forEach(pair => {
    syncSinglePair(pair, appState.settings);
  });
}

// Helper functions for saving data
function saveSyncPairs() {
  try {
    fs.writeFileSync(SYNC_PAIRS_PATH, JSON.stringify(appState.syncPairs, null, 2), 'utf-8');
    console.log('Sync pairs saved successfully');
  } catch (error) {
    console.error('Error saving sync pairs:', error);
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(appState.settings, null, 2), 'utf-8');
    console.log('Settings saved successfully');
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Electron app event handlers
app.whenReady().then(() => {
  createTray();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep the app running even when all windows are closed
  if (process.platform === 'darwin') {
    return;
  }
  
  // On other platforms, only quit if not using tray
  if (!appState.settings.closeToTray) {
    appState.isQuitting = true;
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (!appState.isQuitting && appState.settings.closeToTray) {
    event.preventDefault();
    if (appState.mainWindow && appState.mainWindow.isVisible()) {
      appState.mainWindow.hide();
    }
  } else {
    // Clean up before quitting
    cancelAllSyncs();
    if (appState.autoSyncInterval) {
      clearInterval(appState.autoSyncInterval);
    }
  }
});

app.on('quit', () => {
  // Final cleanup
  cancelAllSyncs();
  if (appState.autoSyncInterval) {
    clearInterval(appState.autoSyncInterval);
  }
});
