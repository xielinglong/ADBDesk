import { app, BrowserWindow, dialog, ipcMain, type WebContents } from 'electron'
import { randomUUID } from 'crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import type { DeviceInfo, RunPayload } from '../shared/types'
import { adbVersion, clearAdbCache, deviceInfo, getAdbPath, listDevices } from './adb'
import {
  captureShot,
  copyShotToClipboard,
  defaultShotsDir,
  deleteShot,
  listShots,
  openShotsFolder,
  renameShot,
  revealShot
} from './shots'
import {
  deleteCommand,
  getSettings,
  listCommands,
  saveCommand,
  toggleFavorite,
  updateSettings
} from './store'

const runs = new Map<string, ChildProcessWithoutNullStreams>()

/** 设备详情在侧栏常驻展示，缓存 45s 足够，避免轮询时反复执行 getprop */
const infoCache = new Map<string, { at: number; value: DeviceInfo }>()
const INFO_TTL = 45_000

function shotsDir(): string {
  return getSettings().shotsDir || defaultShotsDir()
}

async function requireAdb(): Promise<string> {
  const adb = await getAdbPath(getSettings().adbPath)
  if (!adb) throw new Error('未找到 adb，请在设置里指定 adb 的可执行文件路径')
  return adb
}

function splitArgs(input: string): string[] {
  const args: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let touched = false

  for (const char of input) {
    if (quote) {
      if (char === quote) quote = null
      else current += char
    } else if (char === '"' || char === "'") {
      quote = char
      touched = true
    } else if (/\s/.test(char)) {
      if (current || touched) {
        args.push(current)
        current = ''
        touched = false
      }
    } else {
      current += char
      touched = true
    }
  }
  if (current || touched) args.push(current)
  return args
}

export function registerIpc(): void {
  ipcMain.handle('app:status', async () => {
    const settings = getSettings()
    const adbPath = await getAdbPath(settings.adbPath)
    let version = ''
    let error = ''
    if (adbPath) {
      try {
        version = await adbVersion(adbPath)
      } catch (err) {
        error = err instanceof Error ? err.message : String(err)
      }
    } else {
      error = '未找到 adb'
    }
    return {
      adb: { found: Boolean(adbPath), path: adbPath ?? '', version, error },
      settings,
      shotsDir: shotsDir(),
      version: app.getVersion()
    }
  })

  ipcMain.handle('settings:update', (_event, patch) => {
    if (typeof patch?.adbPath === 'string') {
      clearAdbCache()
      infoCache.clear()
    }
    return updateSettings(patch ?? {})
  })

  ipcMain.handle('settings:pick-shots-dir', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const result = window
      ? await dialog.showOpenDialog(window, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle('settings:pick-adb-path', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options = {
      properties: ['openFile' as const],
      filters: [{ name: 'adb', extensions: process.platform === 'win32' ? ['exe'] : ['*'] }]
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    clearAdbCache()
    return result.filePaths[0]
  })

  ipcMain.handle('shots:open-folder', async () => {
    openShotsFolder(shotsDir())
  })

  ipcMain.handle('adb:devices', async () => {
    const adb = await requireAdb()
    return listDevices(adb)
  })

  ipcMain.handle('adb:info', async (_event, serial: string) => {
    const cached = infoCache.get(serial)
    if (cached && Date.now() - cached.at < INFO_TTL) return cached.value
    const adb = await requireAdb()
    const value = await deviceInfo(adb, serial)
    infoCache.set(serial, { at: Date.now(), value })
    return value
  })

  ipcMain.handle('shots:list', async () => listShots(shotsDir()))

  ipcMain.handle('shots:capture', async (_event, serial?: string) => {
    const adb = await requireAdb()
    return captureShot(adb, serial ?? '', shotsDir())
  })

  ipcMain.handle('shots:delete', async (_event, name: string) => {
    deleteShot(shotsDir(), name)
  })

  ipcMain.handle('shots:reveal', async (_event, name: string) => {
    revealShot(shotsDir(), name)
  })

  ipcMain.handle('shots:rename', async (_event, name: string, next: string) =>
    renameShot(shotsDir(), name, next)
  )

  ipcMain.handle('shots:copy', async (_event, name: string) => {
    await copyShotToClipboard(shotsDir(), name)
  })

  ipcMain.handle('cmd:list', async () => listCommands())
  ipcMain.handle('cmd:save', async (_event, input) => saveCommand(input))
  ipcMain.handle('cmd:delete', async (_event, id: string) => deleteCommand(id))
  ipcMain.handle('cmd:toggle-favorite', async (_event, id: string) => toggleFavorite(id))

  ipcMain.handle('cmd:run', async (event, payload: RunPayload) => {
    const adb = await requireAdb()
    const command = (payload?.cmd ?? '').trim()
    if (!command) throw new Error('命令内容为空')

    const serialArgs = payload.serial ? ['-s', payload.serial] : []
    const args =
      payload.mode === 'shell'
        ? [...serialArgs, 'shell', command]
        : [...serialArgs, ...splitArgs(command)]

    const runId = randomUUID()
    const child = spawn(adb, args, { windowsHide: true })
    runs.set(runId, child)

    const send = (channel: string, body: unknown): void => {
      const sender: WebContents = event.sender
      if (!sender.isDestroyed()) sender.send(channel, body)
    }

    child.stdout.on('data', (chunk: Buffer) =>
      send('cmd:output', { runId, stream: 'stdout', chunk: chunk.toString() })
    )
    child.stderr.on('data', (chunk: Buffer) =>
      send('cmd:output', { runId, stream: 'stderr', chunk: chunk.toString() })
    )
    child.on('error', (error) => {
      runs.delete(runId)
      send('cmd:done', { runId, code: -1, error: error.message })
    })
    child.on('close', (code) => {
      runs.delete(runId)
      send('cmd:done', { runId, code })
    })

    return { runId }
  })

  ipcMain.handle('cmd:kill', async (_event, runId: string) => {
    const child = runs.get(runId)
    if (child) {
      child.kill()
      runs.delete(runId)
    }
  })
}
