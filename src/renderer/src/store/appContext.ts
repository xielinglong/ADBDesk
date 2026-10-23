import { createContext, useContext } from 'react'
import type {
  AdbDevice,
  AppStatus,
  CommandItem,
  CommandMode,
  DeviceInfo,
  Settings,
  ShotItem,
  ThemeName
} from '../../../shared/types'

export type Page = 'overview' | 'commands' | 'shots' | 'settings'

export type RunStatus = 'idle' | 'running' | 'done' | 'failed' | 'aborted'

/** 控制台输出片段：同类型相邻片段自动合并，渲染时再按换行拆分 */
export type RunSegment = {
  kind: 'cmd' | 'out' | 'err' | 'dim'
  text: string
}

export type RunState = {
  status: RunStatus
  runId: string | null
  segments: RunSegment[]
  exitCode: number | null
  error: string | null
  startedAt: number
  endedAt: number
  /** 完整 adb 调用回显，用于概览页「最近运行」 */
  cmd: string
  serial: string
}

export type LastRun = {
  cmd: string
  code: number | null
  /** 毫秒 */
  duration: number
  preview: string
  at: number
}

export type SaveCommandInput = {
  id?: string
  name: string
  cmd: string
  mode: CommandMode
  favorite?: boolean
}

export type AppApi = {
  /* 页面与主题 */
  page: Page
  go: (page: Page) => void
  theme: ThemeName
  setTheme: (theme: ThemeName) => void

  /* 环境与设备 */
  status: AppStatus | null
  reloadStatus: () => Promise<AppStatus | null>
  updateSettings: (patch: Partial<Settings>) => Promise<Settings | null>
  devices: AdbDevice[]
  serial: string
  device: AdbDevice | null
  online: boolean
  deviceInfo: DeviceInfo | null
  selectDevice: (serial: string) => void
  refreshDevices: () => Promise<void>

  /* 命令库 */
  commands: CommandItem[]
  activeCommandId: string | null
  draftToken: number
  selectCommand: (id: string | null) => void
  openCommand: (id: string) => void
  runSavedCommand: (id: string) => void
  toggleFavorite: (id: string) => Promise<void>
  saveCommand: (input: SaveCommandInput) => Promise<CommandItem | null>
  removeCommand: (id: string) => Promise<void>
  refreshCommands: () => Promise<void>

  /* 截图 */
  shots: ShotItem[]
  shotsDir: string
  activeShot: string | null
  setActiveShot: (name: string | null) => void
  capturing: boolean
  refreshShots: () => Promise<void>
  capture: () => Promise<ShotItem | null>
  removeShot: (name: string) => Promise<void>
  /** 重命名成功返回新文件名，失败返回 null */
  renameShot: (name: string, next: string) => Promise<string | null>
  copyShot: (name: string) => Promise<void>

  /* 运行 */
  run: RunState
  lastRun: LastRun | null
  runCommand: (cmd: string, mode: CommandMode) => Promise<void>
  stopRun: () => Promise<void>
  clearRun: () => void

  /* 命令面板 */
  paletteOpen: boolean
  setPaletteOpen: (open: boolean) => void
}

export const AppContext = createContext<AppApi | null>(null)

export function useApp(): AppApi {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用')
  return ctx
}

export const EMPTY_RUN: RunState = {
  status: 'idle',
  runId: null,
  segments: [],
  exitCode: null,
  error: null,
  startedAt: 0,
  endedAt: 0,
  cmd: '',
  serial: ''
}

/** 把片段按换行拆成行（跳过尾随空行），供控制台渲染 */
export function runLines(segments: RunSegment[]): { kind: RunSegment['kind']; text: string }[] {
  const lines: { kind: RunSegment['kind']; text: string }[] = []
  for (const segment of segments) {
    const parts = segment.text.split('\n')
    const last = parts.length - 1
    parts.forEach((text, index) => {
      if (index === last && text === '') return
      lines.push({ kind: segment.kind, text })
    })
  }
  return lines
}
