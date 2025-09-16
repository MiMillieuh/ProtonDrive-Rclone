// Application state
let appState = {
    syncPairs: [],
    currentRemoteDir: "",
    isEditing: false,
    editingIndex: -1,
    settings: {
        syncInterval: 60,
        useExcludeFile: true,
        transfers: 14,
        checkers: 14,
        startMinimized: false,
        closeToTray: true
    }
};

// DOM Elements
let elements = {};

document.addEventListener("DOMContentLoaded", (event) => {
    initializeApp();
});

function initializeApp() {
    // Cache DOM elements
    elements = {
        // Buttons
        addSyncPairBtn: document.getElementById('addSyncPairBtn'),
        syncAllBtn: document.getElementById('syncAllBtn'),
        settingsBtn: document.getElementById('settingsBtn'),
        selectLocalBtn: document.getElementById('selectLocalBtn'),
        selectCurrentBtn: document.getElementById('selectCurrentBtn'),
        saveSyncPairBtn: document.getElementById('saveSyncPairBtn'),
        cancelBtn: document.getElementById('cancelBtn'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        closeSettingsBtn: document.getElementById('closeSettingsBtn'),
        saveSettingsBtn: document.getElementById('saveSettingsBtn'),
        cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
        cancelSyncBtn: document.getElementById('cancelSyncBtn'),
        
        // Modals
        syncPairModal: document.getElementById('syncPairModal'),
        settingsModal: document.getElementById('settingsModal'),
        progressModal: document.getElementById('progressModal'),
        
        // Lists and containers
        syncPairsList: document.getElementById('syncPairsList'),
        emptyState: document.getElementById('emptyState'),
        folderselect: document.getElementById('folderselect'),
        
        // Inputs
        localFolder: document.getElementById('localFolder'),
        remoteFolder: document.getElementById('remoteFolder'),
        autoSync: document.getElementById('autoSync'),
        currentPath: document.getElementById('currentPath'),
        modalTitle: document.getElementById('modalTitle'),
        
        // Sync pair inputs
        syncType: document.getElementById('syncType'),
        forceResync: document.getElementById('forceResync'),
        bisyncOptions: document.getElementById('bisyncOptions'),
        
        // Settings inputs
        syncInterval: document.getElementById('syncInterval'),
        intervalUnit: document.getElementById('intervalUnit'),
        useExcludeFile: document.getElementById('useExcludeFile'),
        transfers: document.getElementById('transfers'),
        checkers: document.getElementById('checkers'),
        startMinimized: document.getElementById('startMinimized'),
        closeToTray: document.getElementById('closeToTray'),
        rcloneFilterContent: document.getElementById('rcloneFilterContent'),
        configPath: document.getElementById('configPath'),
        
        // Sync log modal
        syncLogModal: document.getElementById('syncLogModal'),
        closeSyncLogBtn: document.getElementById('closeSyncLogBtn'),
        closeSyncLogFooterBtn: document.getElementById('closeSyncLogFooterBtn'),
        clearSyncLogBtn: document.getElementById('clearSyncLogBtn'),
        syncLogContent: document.getElementById('syncLogContent'),
        
        // ProtonDrive setup
        protonDriveSetupModal: document.getElementById('protonDriveSetupModal'),
        closeProtonDriveSetupBtn: document.getElementById('closeProtonDriveSetupBtn'),
        protonUsername: document.getElementById('protonUsername'),
        protonPassword: document.getElementById('protonPassword'),
        protonTwoFA: document.getElementById('protonTwoFA'),
        setupProtonBtn: document.getElementById('setupProtonBtn'),
        cancelProtonSetupBtn: document.getElementById('cancelProtonSetupBtn'),
        setupStatus: document.getElementById('setupStatus'),
        
        // Warning banner
        noRemoteWarning: document.getElementById('noRemoteWarning'),
        showSetupBtn: document.getElementById('showSetupBtn'),
        dismissWarningBtn: document.getElementById('dismissWarningBtn')
    };

    // Event listeners
    setupEventListeners();
    
    // Load initial data
    loadSyncPairs();
    loadSettings();
    
    // Initialize remote folder browser
    appState.currentRemoteDir = "";
    updateBreadcrumb();
}

function setupEventListeners() {
    // Main buttons
    elements.addSyncPairBtn.addEventListener('click', () => openSyncPairModal());
    elements.syncAllBtn.addEventListener('click', () => syncAllPairs());
    elements.settingsBtn.addEventListener('click', () => openSettingsModal());
    
    // Sync pair modal
    elements.selectLocalBtn.addEventListener('click', () => selectLocalFolder());
    elements.selectCurrentBtn.addEventListener('click', () => selectCurrentRemoteFolder());
    elements.saveSyncPairBtn.addEventListener('click', () => saveSyncPair());
    elements.cancelBtn.addEventListener('click', () => closeSyncPairModal());
    elements.closeModalBtn.addEventListener('click', () => closeSyncPairModal());
    
    // Settings modal
    elements.saveSettingsBtn.addEventListener('click', () => saveSettings());
    elements.cancelSettingsBtn.addEventListener('click', () => closeSettingsModal());
    elements.closeSettingsBtn.addEventListener('click', () => closeSettingsModal());
    
    // Sync log modal
    elements.closeSyncLogBtn.addEventListener('click', () => closeSyncLogModal());
    elements.closeSyncLogFooterBtn.addEventListener('click', () => closeSyncLogModal());
    elements.clearSyncLogBtn.addEventListener('click', () => clearSyncLog());
    
    // Sync type change handler
    elements.syncType.addEventListener('change', () => toggleBisyncOptions());
    
    // ProtonDrive setup handlers
    elements.showSetupBtn.addEventListener('click', () => openProtonDriveSetupModal());
    elements.dismissWarningBtn.addEventListener('click', () => dismissWarning());
    elements.closeProtonDriveSetupBtn.addEventListener('click', () => closeProtonDriveSetupModal());
    elements.cancelProtonSetupBtn.addEventListener('click', () => closeProtonDriveSetupModal());
    elements.setupProtonBtn.addEventListener('click', () => setupProtonDrive());
    

    
    // Close modals when clicking outside
    elements.syncPairModal.addEventListener('click', (e) => {
        if (e.target === elements.syncPairModal) closeSyncPairModal();
    });
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettingsModal();
    });
    elements.syncLogModal.addEventListener('click', (e) => {
        if (e.target === elements.syncLogModal) closeSyncLogModal();
    });
    elements.protonDriveSetupModal.addEventListener('click', (e) => {
        if (e.target === elements.protonDriveSetupModal) closeProtonDriveSetupModal();
    });

}

// IPC Communication handlers
window.api.receive("syncPairsLoaded", (data) => {
    appState.syncPairs = data;
    renderSyncPairs();
});

window.api.receive("settingsLoaded", (data) => {
    appState.settings = { ...appState.settings, ...data };
    populateSettingsForm();
});

window.api.receive("getdirs", (data) => {
    renderRemoteFolders(data);
});

window.api.receive("localFolderSelected", (path) => {
    elements.localFolder.value = path;
});



window.api.receive("syncPairUpdated", (data) => {
    // Update specific sync pair in the list
    const pairElement = document.querySelector(`[data-index="${data.index}"]`);
    if (pairElement) {
        updateSyncPairElement(pairElement, data.pair, data.index);
    }
});

window.api.receive("rcloneFilterLoaded", (content) => {
    elements.rcloneFilterContent.value = content;
});

window.api.receive("rcloneFilterSaved", (success) => {
    if (success) {
        console.log('Rclone filter saved successfully');
    } else {
        alert('Failed to save rclone filter. Please try again.');
    }
});

window.api.receive("syncProgress", (data) => {
    // Add to sync log
    syncLogData.push({
        localPath: data.localPath,
        remotePath: data.remotePath,
        message: data.message,
        timestamp: Date.now()
    });
    
    // Keep only last 1000 log entries to prevent memory issues
    if (syncLogData.length > 1000) {
        syncLogData = syncLogData.slice(-1000);
    }
});

window.api.receive("configPath", (path) => {
    elements.configPath.textContent = path;
});

window.api.receive("protonDriveRemoteStatus", (hasRemote) => {
    handleProtonDriveRemoteStatus(hasRemote);
});

window.api.receive("protonDriveSetupComplete", (result) => {
    handleProtonDriveSetupComplete(result);
});

window.api.receive("syncComplete", (data) => {
    handleSyncComplete(data);
});

window.api.receive("syncError", (error) => {
    handleSyncError(error);
});

// Sync Pairs Management
function loadSyncPairs() {
    window.api.send("loadSyncPairs", null);
}

function renderSyncPairs() {
    const container = elements.syncPairsList;
    
    if (appState.syncPairs.length === 0) {
        container.innerHTML = `
            <div class="empty-state" id="emptyState">
                <img src="Assets/Img/folder.png" alt="Folder icon" />
                <h3>No sync pairs configured</h3>
                <p>Click "Add Sync Pair" to get started</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = appState.syncPairs.map((pair, index) => 
        renderSyncPairCard(pair, index)
    ).join('');
}

function renderSyncPairCard(pair, index) {
    const syncTypeDisplay = pair.syncType === 'bisync' ? '↔' : '→';
    const syncTypeText = pair.syncType === 'bisync' ? 'Bisync (two-way)' : 'Sync (one-way)';
    
    // Show special indicators for bisync
    let specialIndicators = '';
    if (pair.syncType === 'bisync' && pair.forceResync) {
        specialIndicators += '<span class="text-warning">• Force resync on next run</span>';
    }
    
    return `
        <div class="sync-pair-card" data-index="${index}">
            <div class="sync-pair-info">
                <div class="sync-pair-header">
                    <div class="sync-pair-paths">
                        <div class="path">${pair.localPath}</div>
                        <div class="sync-arrow" title="${syncTypeText}">${syncTypeDisplay}</div>
                        <div class="path">ProtonDrive:${pair.remotePath}</div>
                    </div>
                    <div class="sync-pair-controls">
                        <button class="btn btn-secondary btn-small" onclick="syncSinglePair(${index})" ${pair.status === 'syncing' ? 'disabled' : ''}>
                            ${pair.status === 'syncing' ? 'Cancel' : 'Sync Now'}
                        </button>
                        <button class="btn btn-outline btn-small" onclick="editSyncPair(${index})" ${pair.status === 'syncing' ? 'disabled' : ''}>Edit</button>
                        <button class="btn btn-outline btn-small" onclick="showSyncLog(${index})">Log</button>
                        ${pair.syncType === 'bisync' ? `<button class="btn btn-warning btn-small" onclick="forceResyncPair(${index})" ${pair.status === 'syncing' ? 'disabled' : ''} title="Force resync">Resync</button>` : ''}
                        <button class="btn btn-danger btn-small" onclick="deleteSyncPair(${index})" ${pair.status === 'syncing' ? 'disabled' : ''}>Delete</button>
                    </div>
                </div>
                
                <div class="sync-pair-status">
                    <div class="status-line">
                        <div class="status-indicator ${getStatusClass(pair.status)}"></div>
                        <span class="status-text">${getStatusText(pair.status)}</span>
                        ${pair.autoSync ? '<span class="text-success">• Auto-sync enabled</span>' : ''}
                        <span class="sync-type-badge">${syncTypeText}</span>
                        ${specialIndicators}
                    </div>
                    
                    ${pair.status === 'syncing' && pair.currentProgress > 0 ? `
                        <div class="inline-progress">
                            <div class="progress-bar-small">
                                <div class="progress-fill-small" style="width: ${pair.currentProgress}%"></div>
                            </div>
                            <span class="progress-text">${pair.currentProgress}% ${pair.transferredFiles || 0}/${pair.totalFiles || 0} files</span>
                        </div>
                        ${pair.currentFile ? `<div class="current-file">Current: ${pair.currentFile}</div>` : ''}
                    ` : ''}
                    
                    <div class="status-details">
                        ${pair.lastSync ? `<span>• Last sync: ${formatDate(pair.lastSync)}</span>` : ''}
                        ${pair.status === 'error' && pair.lastError ? `<span class="text-error">• Error: ${pair.lastError}</span>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function updateSyncPairElement(element, pair, index) {
    element.outerHTML = renderSyncPairCard(pair, index);
}

function getStatusClass(status) {
    const statusMap = {
        idle: 'status-idle',
        syncing: 'status-syncing',
        success: 'status-success',
        error: 'status-error'
    };
    return statusMap[status] || 'status-idle';
}

function getStatusText(status) {
    const statusMap = {
        idle: 'Ready to sync',
        syncing: 'Syncing...',
        success: 'Last sync successful',
        error: 'Sync failed'
    };
    return statusMap[status] || 'Unknown status';
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
}

// Modal Management
function openSyncPairModal(editIndex = -1) {
    appState.isEditing = editIndex >= 0;
    appState.editingIndex = editIndex;
    
    elements.modalTitle.textContent = appState.isEditing ? 'Edit Sync Pair' : 'Add Sync Pair';
    
    if (appState.isEditing) {
        const pair = appState.syncPairs[editIndex];
        elements.localFolder.value = pair.localPath;
        elements.remoteFolder.value = pair.remotePath;
        elements.autoSync.checked = pair.autoSync;
        elements.syncType.value = pair.syncType || 'sync';
        elements.forceResync.checked = pair.forceResync || false;
        appState.currentRemoteDir = pair.remotePath.split('/').slice(0, -1).join('/');
    } else {
        elements.localFolder.value = '';
        elements.remoteFolder.value = '';
        elements.autoSync.checked = false;
        elements.syncType.value = 'sync';
        elements.forceResync.checked = false;
        appState.currentRemoteDir = '';
    }
    
    toggleBisyncOptions();
    updateBreadcrumb();
    getDirs(appState.currentRemoteDir);
    elements.syncPairModal.classList.remove('hidden');
}

function closeSyncPairModal() {
    elements.syncPairModal.classList.add('hidden');
    appState.isEditing = false;
    appState.editingIndex = -1;
}

function openSettingsModal() {
    populateSettingsForm();
    loadRcloneFilter();
    elements.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
    elements.settingsModal.classList.add('hidden');
}

function populateSettingsForm() {
    // Handle interval conversion
    const intervalMinutes = appState.settings.syncInterval || 60;
    if (intervalMinutes >= 60 && intervalMinutes % 60 === 0) {
        elements.syncInterval.value = intervalMinutes / 60;
        elements.intervalUnit.value = '60'; // hours
    } else {
        elements.syncInterval.value = intervalMinutes;
        elements.intervalUnit.value = '1'; // minutes
    }
    
    elements.useExcludeFile.checked = appState.settings.useExcludeFile !== false; // Default to true
    elements.transfers.value = appState.settings.transfers || 14;
    elements.checkers.value = appState.settings.checkers || 14;
    elements.startMinimized.checked = appState.settings.startMinimized || false;
    elements.closeToTray.checked = appState.settings.closeToTray !== false; // Default to true
    
    // Show config path
    window.api.send("getConfigPath", null);
}

// Sync Pair Operations
function selectLocalFolder() {
    window.api.send("selectLocalFolder", null);
}

function selectCurrentRemoteFolder() {
    elements.remoteFolder.value = appState.currentRemoteDir;
}

function saveSyncPair() {
    const localPath = elements.localFolder.value.trim();
    const remotePath = elements.remoteFolder.value.trim();
    const autoSync = elements.autoSync.checked;
    const syncType = elements.syncType.value;
    const forceResync = elements.forceResync.checked;
    
    if (!localPath || !remotePath) {
        alert('Please select both local and remote folders.');
        return;
    }
    
    const syncPair = {
        localPath,
        remotePath,
        autoSync,
        syncType,
        forceResync,
        status: 'idle',
        lastSync: null,
        currentProgress: 0,
        currentFile: '',
        transferredFiles: 0,
        totalFiles: 0
    };
    
    if (appState.isEditing) {
        // Preserve existing progress data if syncing
        const existingPair = appState.syncPairs[appState.editingIndex];
        if (existingPair.status === 'syncing') {
            syncPair.status = existingPair.status;
            syncPair.currentProgress = existingPair.currentProgress;
            syncPair.currentFile = existingPair.currentFile;
            syncPair.transferredFiles = existingPair.transferredFiles;
            syncPair.totalFiles = existingPair.totalFiles;
        }
        // Preserve existing sync history
        syncPair.lastSync = existingPair.lastSync;
        
        appState.syncPairs[appState.editingIndex] = syncPair;
    } else {
        appState.syncPairs.push(syncPair);
    }
    
    window.api.send("saveSyncPairs", appState.syncPairs);
    renderSyncPairs();
    closeSyncPairModal();
}

function editSyncPair(index) {
    openSyncPairModal(index);
}

function deleteSyncPair(index) {
    if (confirm('Are you sure you want to delete this sync pair?')) {
        appState.syncPairs.splice(index, 1);
        window.api.send("saveSyncPairs", appState.syncPairs);
        renderSyncPairs();
    }
}

function syncSinglePair(index) {
    const pair = appState.syncPairs[index];
    
    if (pair.status === 'syncing') {
        // Cancel the sync
        window.api.send("cancelSyncPair", {
            localPath: pair.localPath,
            remotePath: pair.remotePath
        });
    } else {
        // Start the sync
        window.api.send("syncPair", { pair, settings: appState.settings });
    }
}

function syncAllPairs() {
    const readyPairs = appState.syncPairs.filter(pair => pair.status !== 'syncing');
    if (readyPairs.length === 0) {
        alert('No sync pairs ready for syncing.');
        return;
    }
    
    readyPairs.forEach(pair => pair.status = 'syncing');
    renderSyncPairs();
    
    showProgressModal(readyPairs[0]); // Show progress for first pair
    window.api.send("syncAll", { pairs: readyPairs, settings: appState.settings });
}

// Settings Management
function loadSettings() {
    window.api.send("loadSettings", null);
}

function saveSettings() {
    // Convert interval to minutes
    const intervalValue = parseInt(elements.syncInterval.value);
    const intervalUnit = parseInt(elements.intervalUnit.value);
    const syncIntervalMinutes = intervalValue * intervalUnit;
    
    appState.settings = {
        syncInterval: syncIntervalMinutes,
        useExcludeFile: elements.useExcludeFile.checked,
        transfers: parseInt(elements.transfers.value),
        checkers: parseInt(elements.checkers.value),
        startMinimized: elements.startMinimized.checked,
        closeToTray: elements.closeToTray.checked,
        rcloneFilter: elements.rcloneFilterContent.value
    };
    
    // Save rclone filter content to file
    window.api.send("saveRcloneFilter", elements.rcloneFilterContent.value);
    
    window.api.send("saveSettings", appState.settings);
    closeSettingsModal();
}

// Remote Folder Browser
function getDirs(dir) {
    elements.folderselect.innerHTML = '<div class="folder"><img src="Assets/Img/loading.gif"> Loading...</div>';
    window.api.send("getdirs", dir);
    appState.currentRemoteDir = dir;
    updateBreadcrumb();
}

function renderRemoteFolders(data) {
    elements.folderselect.innerHTML = "";
    
    // Add back button if not at root
    if (appState.currentRemoteDir !== "") {
        const parentDir = appState.currentRemoteDir.split('/').slice(0, -1).join('/');
        elements.folderselect.innerHTML += `
            <div class="folder" onclick="getDirs('${parentDir}')">
                <img src="Assets/Img/folder.png"> ..
            </div>
        `;
    }
    
    const lines = data.trim().split('\n');
    const names = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        return parts[parts.length - 1];
    }).filter(name => name && name !== '');
    
    names.forEach(name => {
        const newPath = appState.currentRemoteDir ? `${appState.currentRemoteDir}/${name}` : name;
        elements.folderselect.innerHTML += `
            <div class="folder" onclick="getDirs('${newPath}')">
                <img src="Assets/Img/folder.png"> ${name}
            </div>
        `;
    });
}

function updateBreadcrumb() {
    const path = appState.currentRemoteDir || '/';
    elements.currentPath.textContent = `ProtonDrive:/${path}`;
}

// Progress Tracking
function showProgressModal(pair) {
    elements.currentSyncPair.textContent = `Syncing: ${pair.localPath} → ProtonDrive:${pair.remotePath}`;
    elements.progressFill.style.width = '0%';
    elements.progressLog.innerHTML = '';
    elements.progressModal.classList.remove('hidden');
}

function updateSyncProgress(data) {
    // Update progress bar if percentage is provided
    if (data.percentage !== undefined && data.percentage > 0) {
        elements.progressFill.style.width = `${data.percentage}%`;
        
        // Update progress text
        if (data.transferredFiles !== undefined && data.totalFiles !== undefined) {
            elements.currentSyncPair.textContent = 
                `Syncing: ${data.localPath} → ProtonDrive:${data.remotePath} (${data.transferredFiles}/${data.totalFiles} files, ${data.percentage}%)`;
        }
    }
    
    // Add log message
    if (data.message && data.message.trim()) {
        const timestamp = new Date().toLocaleTimeString();
        elements.progressLog.innerHTML += `<div>[${timestamp}] ${data.message}</div>`;
        elements.progressLog.scrollTop = elements.progressLog.scrollHeight;
    }
}

function handleSyncComplete(data) {
    // This is now handled by syncPairUpdated events
    console.log('Sync completed:', data);
}

function handleSyncError(error) {
    // This is now handled by syncPairUpdated events
    console.log('Sync error:', error);
}

function cancelSync() {
    window.api.send("cancelSync", null);
    elements.progressModal.classList.add('hidden');
    
    // Reset syncing pairs to idle
    appState.syncPairs.forEach(pair => {
        if (pair.status === 'syncing') {
            pair.status = 'idle';
        }
    });
    renderSyncPairs();
}



// Sync log management
let syncLogData = [];

function showSyncLog(index) {
    const pair = appState.syncPairs[index];
    elements.syncLogContent.innerHTML = `
        <h3>${pair.localPath} → ProtonDrive:${pair.remotePath}</h3>
        <div class="sync-log-messages">
            ${syncLogData.filter(log => 
                log.localPath === pair.localPath && log.remotePath === pair.remotePath
            ).map(log => `
                <div class="log-entry">
                    <span class="log-timestamp">[${new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span class="log-message">${log.message}</span>
                </div>
            `).join('') || '<div class="no-logs">No sync logs available</div>'}
        </div>
    `;
    elements.syncLogModal.classList.remove('hidden');
}

function closeSyncLogModal() {
    elements.syncLogModal.classList.add('hidden');
}

function clearSyncLog() {
    syncLogData = [];
    elements.syncLogContent.innerHTML = '<div class="no-logs">Log cleared</div>';
}

function loadRcloneFilter() {
    window.api.send("loadRcloneFilter", null);
}

function toggleBisyncOptions() {
    const isBisync = elements.syncType.value === 'bisync';
    elements.bisyncOptions.style.display = isBisync ? 'block' : 'none';
}

function forceResyncPair(index) {
    if (confirm('Are you sure you want to force resync? This will reset the bisync state and may take longer.')) {
        const pair = appState.syncPairs[index];
        pair.forceResync = true;
        window.api.send("saveSyncPairs", appState.syncPairs);
        renderSyncPairs();
    }
}

// ProtonDrive setup functions
function handleProtonDriveRemoteStatus(hasRemote) {
    if (hasRemote) {
        elements.noRemoteWarning.classList.add('hidden');
        // Enable UI elements that depend on ProtonDrive
        elements.addSyncPairBtn.disabled = false;
        elements.syncAllBtn.disabled = false;
    } else {
        elements.noRemoteWarning.classList.remove('hidden');
        // Disable UI elements that depend on ProtonDrive
        elements.addSyncPairBtn.disabled = true;
        elements.syncAllBtn.disabled = true;
        
        // Show setup modal if no sync pairs exist (first launch)
        if (appState.syncPairs.length === 0) {
            openProtonDriveSetupModal();
        }
    }
}

function openProtonDriveSetupModal() {
    elements.setupStatus.classList.add('hidden');
    elements.protonUsername.value = '';
    elements.protonPassword.value = '';
    elements.protonTwoFA.value = '';
    elements.setupProtonBtn.disabled = false;
    elements.setupProtonBtn.textContent = 'Setup ProtonDrive';
    elements.protonDriveSetupModal.classList.remove('hidden');
}

function closeProtonDriveSetupModal() {
    elements.protonDriveSetupModal.classList.add('hidden');
}

function dismissWarning() {
    elements.noRemoteWarning.classList.add('hidden');
}

function setupProtonDrive() {
    const username = elements.protonUsername.value.trim();
    const password = elements.protonPassword.value.trim();
    const twoFA = elements.protonTwoFA.value.trim();
    
    if (!username || !password) {
        showSetupStatus('Please enter both username and password.', 'error');
        return;
    }
    
    // Disable button and show progress
    elements.setupProtonBtn.disabled = true;
    elements.setupProtonBtn.textContent = 'Setting up...';
    showSetupStatus('Configuring ProtonDrive remote...', 'progress');
    
    const config = {
        username,
        password,
        twoFA: twoFA || undefined
    };
    
    window.api.send("setupProtonDriveRemote", config);
}

function handleProtonDriveSetupComplete(result) {
    elements.setupProtonBtn.disabled = false;
    elements.setupProtonBtn.textContent = 'Setup ProtonDrive';
    
    if (result.success) {
        showSetupStatus(result.message, 'success');
        setTimeout(() => {
            closeProtonDriveSetupModal();
            // Recheck status
            window.api.send("checkProtonDriveRemote");
        }, 2000);
    } else {
        showSetupStatus(result.message, 'error');
    }
}

function showSetupStatus(message, type) {
    const statusElement = elements.setupStatus.querySelector('.status-message');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    elements.setupStatus.classList.remove('hidden');
}
