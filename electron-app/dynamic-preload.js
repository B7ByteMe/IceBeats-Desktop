const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    shrinkIsland: () => ipcRenderer.send('island-shrink'),
    expandIsland: (focus) => ipcRenderer.send('island-expand', focus),
    onDoExpand: (callback) => ipcRenderer.on('do-expand', () => callback()),
    onDoShrink: (callback) => ipcRenderer.on('do-shrink', () => callback()),
    sendAction: (action) => ipcRenderer.send('island-action', action),
    onTrackUpdated: (callback) => ipcRenderer.on('track-updated', (event, data) => callback(data))
});
