import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import type { AdbDevice, DeviceInfo } from '../shared/types'

export const ADB_BIN = process.platform === 'win32' ? 'adb.exe' : 'adb'

export type ExecResult = { code: number; stdout: string; stderr: string }

const resolved = new Map<string, string | null>()

function viaPathLookup(): Promise<string | null> {
  return new Promise((resolve) => {
    const finder = process.platform === 'win32' ? 'where' : 'which'
    const child = spawn(finder, ['adb'], { windowsHide: true })
    let out = ''
    child.stdout.on('data', (chunk) => (out += chunk.toString()))
    child.on('error', () => resolve(null))
    child.on('close', (code) => {
      if (code !== 0) return resolve(null)
      const first = out
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)[0]
      resolve(first && existsSync(first) ? first : null)
    })
  })
}

function commonCandidates(): string[] {
  if (process.platform !== 'win32') {
    return ['/usr/local/bin/adb', '/opt/homebrew/bin/adb', '/usr/bin/adb']
  }
  const list = [
    'C:\\platform-tools\\adb.exe',
    'C:\\tools\\platform-tools\\adb.exe',
    'C:\\tools\\platform-tools-latest-windows\\platform-tools\\adb.exe'
  ]
  const local = process.env.LOCALAPPDATA
  const home = process.env.USERPROFILE
  if (local) list.push(join(local, 'Android', 'Sdk', 'platform-tools', ADB_BIN))
  if (home) list.push(join(home, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', ADB_BIN))
  return list
}

async function bareAdbWorks(): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn('adb', ['version'], { windowsHide: true })
    let out = ''
    child.stdout.on('data', (chunk) => (out += chunk.toString()))
    child.on('error', () => resolve(null))
    child.on('close', (code) =>
      resolve(code === 0 && /Android Debug Bridge/i.test(out) ? 'adb' : null)
    )
  })
}

export async function getAdbPath(configured?: string): Promise<string | null> {
  const key = configured || '__auto__'
  if (resolved.has(key)) return resolved.get(key) ?? null

  const candidates: string[] = []
  if (configured) candidates.push(configured)
  if (process.env.ADB_PATH) candidates.push(process.env.ADB_PATH)
  for (const root of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]) {
    if (root) candidates.push(join(root, 'platform-tools', ADB_BIN))
  }
  candidates.push(...commonCandidates())

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      resolved.set(key, candidate)
      return candidate
    }
  }

  const fromPath = await viaPathLookup()
  if (fromPath) {
    resolved.set(key, fromPath)
    return fromPath
  }

  const bare = await bareAdbWorks()
  resolved.set(key, bare)
  return bare
}

export function clearAdbCache(): void {
  resolved.clear()
}

export function execAdb(adb: string, args: string[], timeout = 20000): Promise<ExecResult> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    const child = spawn(adb, args, { windowsHide: true })
    const timer = setTimeout(() => {
      if (!settled) child.kill()
    }, timeout)

    child.stdout.on('data', (chunk) => (stdout += chunk.toString()))
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()))
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code: -1, stdout, stderr: stderr + error.message })
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })
}

export function execAdbBuffer(adb: string, args: string[], timeout = 30000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let stderr = ''
    let settled = false
    const child = spawn(adb, args, { windowsHide: true })
    const timer = setTimeout(() => {
      if (!settled) child.kill()
    }, timeout)

    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()))
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(error.message))
    })
    child.on('close', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (!chunks.length && stderr) return reject(new Error(stderr.trim()))
      resolve(Buffer.concat(chunks))
    })
  })
}

export async function listDevices(adb: string): Promise<AdbDevice[]> {
  const { stdout, stderr, code } = await execAdb(adb, ['devices', '-l'], 8000)
  if (code !== 0) throw new Error(stderr.trim() || 'adb devices 执行失败')

  return stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('*'))
    .map((line) => {
      const parts = line.split(/\s+/)
      const serial = parts[0]
      const state = parts[1] ?? 'unknown'
      const modelPart = parts.find((part) => part.startsWith('model:'))
      return {
        serial,
        state,
        model: modelPart ? modelPart.slice('model:'.length).replace(/_/g, ' ') : undefined
      }
    })
}

export async function adbVersion(adb: string): Promise<string> {
  const { stdout, stderr } = await execAdb(adb, ['version'], 8000)
  const text = `${stdout}\n${stderr}`.trim()
  // adb version 输出形如：
  //   Android Debug Bridge version 1.0.41
  //   Version 35.0.1-11528375
  // 侧栏只需要平台版本号，取第二行的数字部分，取不到再退回整行
  const platform = /^Version\s+([\d.]+)/im.exec(text)
  if (platform) return platform[1]
  const line = text.split(/\r?\n/).find((item) => item.startsWith('Android Debug Bridge'))
  return line ?? text.split(/\r?\n/)[0] ?? ''
}

/**
 * 一次 getprop 拿全设备信息，避免多条 shell 命令带来的延迟。
 * 命令失败（设备离线 / 未授权）时返回全空字符串，由渲染层降级展示。
 */
export async function deviceInfo(adb: string, serial: string): Promise<DeviceInfo> {
  const empty: DeviceInfo = { model: '', brand: '', android: '', sdk: '', abi: '' }
  if (!serial) return empty

  const { code, stdout } = await execAdb(adb, ['-s', serial, 'shell', 'getprop'], 8000)
  if (code !== 0 || !stdout) return empty

  const props = new Map<string, string>()
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^\[([^\]]+)\]:\s*\[(.*)\]$/.exec(line.trim())
    if (match) props.set(match[1], match[2])
  }

  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const value = props.get(key)
      if (value) return value
    }
    return ''
  }

  return {
    model: pick('ro.product.model', 'ro.product.vendor.model').replace(/_/g, ' '),
    brand: pick('ro.product.brand', 'ro.product.vendor.brand'),
    android: pick('ro.build.version.release'),
    sdk: pick('ro.build.version.sdk'),
    abi: pick('ro.product.cpu.abi')
  }
}
