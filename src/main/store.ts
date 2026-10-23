import { app } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { CommandItem, CommandMode, Settings } from '../shared/types'

type StoreData = {
  commands: CommandItem[]
  settings: Partial<Settings>
  seedVersion?: number
}

type SeedCommand = {
  name: string
  cmd: string
  mode: CommandMode
  favorite?: boolean
}

/** 种子版本：大于 1 的增量会在老用户存档上做一次性补齐 */
const SEED_VERSION = 2

const SEEDS: SeedCommand[] = [
  { name: '设备型号', cmd: 'getprop ro.product.model', mode: 'shell', favorite: true },
  { name: '系统版本', cmd: 'getprop ro.build.version.release', mode: 'shell', favorite: true },
  { name: '电源键（锁屏/唤醒）', cmd: 'input keyevent 26', mode: 'shell', favorite: true },
  { name: '电池信息', cmd: 'dumpsys battery', mode: 'shell' },
  { name: '屏幕分辨率', cmd: 'wm size', mode: 'shell', favorite: true },
  {
    name: '当前前台 Activity',
    cmd: 'dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity"',
    mode: 'shell'
  },
  { name: '已安装第三方应用', cmd: 'pm list packages -3', mode: 'shell' },
  { name: '内存占用', cmd: 'cat /proc/meminfo | head -n 5', mode: 'shell' },
  { name: '返回键', cmd: 'input keyevent 4', mode: 'shell' },
  { name: 'Home 键', cmd: 'input keyevent 3', mode: 'shell' },
  { name: '最近任务', cmd: 'input keyevent 187', mode: 'shell' },
  { name: '列出设备', cmd: 'devices -l', mode: 'adb' },
  { name: '重启设备', cmd: 'reboot', mode: 'adb' }
]

/** v2 新增的种子，只在老存档升级时补一次，避免用户删掉后被反复加回 */
const SEEDS_V2: SeedCommand[] = [
  { name: '最近任务', cmd: 'input keyevent 187', mode: 'shell' },
  { name: '重启设备', cmd: 'reboot', mode: 'adb' }
]

let data: StoreData | null = null

function storeFile(): string {
  return join(app.getPath('userData'), 'store.json')
}

function seed(): CommandItem[] {
  const now = Date.now()
  return SEEDS.map((item, index) => ({
    id: randomUUID(),
    name: item.name,
    cmd: item.cmd,
    mode: item.mode,
    favorite: Boolean(item.favorite),
    createdAt: now + index,
    updatedAt: now + index
  }))
}

function load(): StoreData {
  if (data) return data
  const file = storeFile()
  try {
    if (existsSync(file)) {
      const raw = JSON.parse(readFileSync(file, 'utf-8')) as StoreData
      const store: StoreData = {
        commands: Array.isArray(raw.commands) ? raw.commands : seed(),
        settings: raw.settings ?? {},
        seedVersion: raw.seedVersion ?? 1
      }
      data = store
      if ((store.seedVersion ?? 1) < SEED_VERSION) {
        // 老存档补一次新版种子命令（按名称去重，不覆盖用户改动）
        const now = Date.now()
        SEEDS_V2.forEach((item, index) => {
          if (store.commands.some((cmd) => cmd.name === item.name)) return
          store.commands.push({
            id: randomUUID(),
            name: item.name,
            cmd: item.cmd,
            mode: item.mode,
            favorite: Boolean(item.favorite),
            createdAt: now + index,
            updatedAt: now + index
          })
        })
        store.seedVersion = SEED_VERSION
        save()
      }
      return store
    }
  } catch {
    // 损坏的存档直接重建
  }
  data = { commands: seed(), settings: {}, seedVersion: SEED_VERSION }
  save()
  return data
}

function save(): void {
  if (!data) return
  const file = storeFile()
  try {
    mkdirSync(dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
    renameSync(tmp, file)
  } catch (error) {
    console.error('保存配置失败', error)
  }
}

export function getSettings(): Settings {
  const { settings } = load()
  return {
    adbPath: settings.adbPath ?? '',
    shotsDir: settings.shotsDir ?? '',
    theme: settings.theme === 'dark' ? 'dark' : 'light'
  }
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const store = load()
  store.settings = { ...store.settings, ...patch }
  save()
  return getSettings()
}

export function listCommands(): CommandItem[] {
  const store = load()
  return [...store.commands].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
    return b.updatedAt - a.updatedAt
  })
}

export function saveCommand(input: {
  id?: string
  name: string
  cmd: string
  mode: CommandMode
  favorite?: boolean
}): CommandItem[] {
  const store = load()
  const now = Date.now()
  if (input.id) {
    const target = store.commands.find((item) => item.id === input.id)
    if (target) {
      target.name = input.name
      target.cmd = input.cmd
      target.mode = input.mode
      if (typeof input.favorite === 'boolean') target.favorite = input.favorite
      target.updatedAt = now
    }
  } else {
    store.commands.push({
      id: randomUUID(),
      name: input.name,
      cmd: input.cmd,
      mode: input.mode,
      favorite: Boolean(input.favorite),
      createdAt: now,
      updatedAt: now
    })
  }
  save()
  return listCommands()
}

export function deleteCommand(id: string): CommandItem[] {
  const store = load()
  store.commands = store.commands.filter((item) => item.id !== id)
  save()
  return listCommands()
}

export function toggleFavorite(id: string): CommandItem[] {
  const store = load()
  const target = store.commands.find((item) => item.id === id)
  if (target) {
    target.favorite = !target.favorite
    target.updatedAt = Date.now()
  }
  save()
  return listCommands()
}
