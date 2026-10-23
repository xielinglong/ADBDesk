import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Api, RunDone, RunOutput } from '../shared/types'

const api: Api = {
  status: () => ipcRenderer.invoke('app:status'),
  settings: {
    update: (patch) => ipcRenderer.invoke('settings:update', patch),
    pickShotsDir: () => ipcRenderer.invoke('settings:pick-shots-dir'),
    pickAdbPath: () => ipcRenderer.invoke('settings:pick-adb-path'),
    openShotsFolder: () => ipcRenderer.invoke('shots:open-folder')
  },
  adb: {
    devices: () => ipcRenderer.invoke('adb:devices'),
    info: (serial) => ipcRenderer.invoke('adb:info', serial)
  },
  shots: {
    list: () => ipcRenderer.invoke('shots:list'),
    capture: (serial) => ipcRenderer.invoke('shots:capture', serial),
    remove: (name) => ipcRenderer.invoke('shots:delete', name),
    reveal: (name) => ipcRenderer.invoke('shots:reveal', name),
    rename: (name, next) => ipcRenderer.invoke('shots:rename', name, next),
    copy: (name) => ipcRenderer.invoke('shots:copy', name)
  },
  commands: {
    list: () => ipcRenderer.invoke('cmd:list'),
    save: (input) => ipcRenderer.invoke('cmd:save', input),
    remove: (id) => ipcRenderer.invoke('cmd:delete', id),
    toggleFavorite: (id) => ipcRenderer.invoke('cmd:toggle-favorite', id),
    run: (payload) => ipcRenderer.invoke('cmd:run', payload),
    kill: (runId) => ipcRenderer.invoke('cmd:kill', runId),
    onOutput: (callback) => {
      const handler = (_event: unknown, payload: RunOutput): void => callback(payload)
      ipcRenderer.on('cmd:output', handler)
      return () => ipcRenderer.removeListener('cmd:output', handler)
    },
    onDone: (callback) => {
      const handler = (_event: unknown, payload: RunDone): void => callback(payload)
      ipcRenderer.on('cmd:done', handler)
      return () => ipcRenderer.removeListener('cmd:done', handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
