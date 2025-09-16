const {
    contextBridge,
    ipcRenderer
} = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    "api", {
        send: (channel, data) => {
            // whitelist channels
            let validChannels = [
                "toMain", 
                "syncdirs", 
                "getdirs", 
                "argstitle",
                "loadSyncPairs",
                "saveSyncPairs",
                "loadSettings",
                "saveSettings",
                "selectLocalFolder",

                "saveRcloneFilter",
                "loadRcloneFilter",
                "getConfigPath",
                "setupProtonDriveRemote",
                "checkProtonDriveRemote",
                "syncPair",
                "syncAll",
                "cancelSync",
                "cancelSyncPair"
            ];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel, func) => {
            let validChannels = [
                "fromMain", 
                "getdirs",
                "syncPairsLoaded",
                "settingsLoaded",
                "localFolderSelected",

                "rcloneFilterLoaded",
                "rcloneFilterSaved",
                "configPath",
                "protonDriveRemoteStatus",
                "protonDriveSetupComplete",
                "syncPairUpdated",
                "syncProgress",
                "syncComplete",
                "syncError"
            ];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender` 
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        }
    }
);