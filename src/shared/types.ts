export type AdbDevice = {
  serial: string
  state: string
  model?: string
}

/** 设备详情（概览页设备卡使用），字段缺失时为空字符串 */
export type DeviceInfo = {
  model: string
  brand: string
  android: string
  sdk: string
  abi: string
}

export type CommandMode = 'shell' | 'adb'

export type CommandItem = {
  id: string
  name: string
  cmd: string
  mode: CommandMode
  favorite: boolean
  createdAt: number
  updatedAt: number
}

export type ShotItem = {
  name: string
  size: number
  mtime: number
  url: string
}

export type ThemeName = 'light' | 'dark'

export type Settings = {
  adbPath: string
  shotsDir: string
  theme: ThemeName
}

export type AdbStatus = {
  found: boolean
  path: string
  version?: string
  error?: string
}

export type AppStatus = {
  adb: AdbStatus
  settings: Settings
  shotsDir: string
  version: string
}

export type RunOutput = { runId: string; stream: 'stdout' | 'stderr'; chunk: string }
export type RunDone = { runId: string; code: number | null; error?: string }

export type RunPayload = { cmd: string; mode: CommandMode; serial?: string }

export type Api = {
  status: () => Promise<AppStatus>
  settings: {
    update: (patch: Partial<Settings>) => Promise<Settings>
    pickShotsDir: () => Promise<string | null>
    pickAdbPath: () => Promise<string | null>
    openShotsFolder: () => Promise<void>
  }
  adb: {
    devices: () => Promise<AdbDevice[]>
    info: (serial: string) => Promise<DeviceInfo>
  }
  shots: {
    list: () => Promise<ShotItem[]>
    capture: (serial?: string) => Promise<ShotItem>
    remove: (name: string) => Promise<void>
    reveal: (name: string) => Promise<void>
    rename: (name: string, next: string) => Promise<ShotItem>
    copy: (name: string) => Promise<void>
  }
  commands: {
    list: () => Promise<CommandItem[]>
    save: (input: {
      id?: string
      name: string
      cmd: string
      mode: CommandMode
      favorite?: boolean
    }) => Promise<CommandItem[]>
    remove: (id: string) => Promise<CommandItem[]>
    toggleFavorite: (id: string) => Promise<CommandItem[]>
    run: (payload: RunPayload) => Promise<{ runId: string }>
    kill: (runId: string) => Promise<void>
    onOutput: (cb: (payload: RunOutput) => void) => () => void
    onDone: (cb: (payload: RunDone) => void) => () => void
  }
}
