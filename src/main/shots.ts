import { app, clipboard, ClipboardItem, shell } from 'electron'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { basename, extname, join } from 'path'
import type { ShotItem } from '../shared/types'
import { execAdb, execAdbBuffer } from './adb'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp'])
/** 文件名里不允许的字符（Windows 最严格，统一按它清洗） */
const BAD_NAME_CHARS = /[\\/:*?"<>|]/g
const IMAGE_SUFFIX = /\.(png|jpe?g|webp)$/i
const MAX_NAME = 80

/** 去掉控制字符（\u0000-\u001f），避免非法文件名的正则告警 */
function stripControl(input: string): string {
  return Array.from(input)
    .filter((char) => char.charCodeAt(0) >= 32)
    .join('')
}

export function defaultShotsDir(): string {
  return join(app.getPath('pictures'), 'ADB Desk')
}

export function ensureDir(dir: string): string {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function shotUrl(name: string): string {
  return `shot://local/${encodeURIComponent(name)}`
}

/** 截图目录内的绝对路径；只接受纯文件名，避免路径穿越 */
export function shotPath(dir: string, name: string): string {
  const safe = basename(String(name ?? '').trim())
  if (!safe || safe !== String(name ?? '').trim()) throw new Error('非法的截图文件名')
  return join(dir, safe)
}

function toItem(dir: string, name: string): ShotItem {
  const stat = statSync(join(dir, name))
  return { name, size: stat.size, mtime: stat.mtimeMs, url: shotUrl(name) }
}

export function listShots(dir: string): ShotItem[] {
  ensureDir(dir)
  return readdirSync(dir)
    .filter((name) => IMAGE_EXT.has(name.slice(name.lastIndexOf('.')).toLowerCase()))
    .map((name) => toItem(dir, name))
    .sort((a, b) => b.mtime - a.mtime)
}

export function deleteShot(dir: string, name: string): void {
  const target = shotPath(dir, name)
  if (existsSync(target)) unlinkSync(target)
}

/** 重命名截图：清洗非法字符、沿用原扩展名、拒绝重名 */
export function renameShot(dir: string, name: string, next: string): ShotItem {
  const from = shotPath(dir, name)
  if (!existsSync(from)) throw new Error('截图不存在，可能已被移动或删除')

  const ext = extname(name).toLowerCase() || '.png'
  const cleaned = stripControl(String(next ?? ''))
    .replace(IMAGE_SUFFIX, '')
    .replace(BAD_NAME_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, MAX_NAME)
    .trim()

  if (!cleaned) throw new Error('名称不能为空')
  const finalName = `${cleaned}${ext}`
  if (finalName === name) return toItem(dir, name)

  const to = shotPath(dir, finalName)
  if (existsSync(to)) throw new Error(`已存在同名截图「${finalName}」，请换一个名称`)
  renameSync(from, to)
  return toItem(dir, finalName)
}

/** 把截图作为位图写入系统剪贴板，可直接粘贴到聊天工具 / 文档 */
export async function copyShotToClipboard(dir: string, name: string): Promise<void> {
  const file = shotPath(dir, name)
  if (!existsSync(file)) throw new Error('截图不存在，可能已被移动或删除')

  const ext = extname(file).toLowerCase()
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  const data = readFileSync(file)
  if (!data.length) throw new Error('图片读取失败，无法复制到剪贴板')

  try {
    await clipboard.write([new ClipboardItem({ [mime]: new Blob([data], { type: mime }) })])
  } catch (error) {
    throw new Error(`复制到剪贴板失败：${error instanceof Error ? error.message : String(error)}`, {
      cause: error
    })
  }
}

export function revealShot(dir: string, name: string): void {
  const target = shotPath(dir, name)
  if (existsSync(target)) shell.showItemInFolder(target)
  else shell.openPath(dir)
}

export function openShotsFolder(dir: string): void {
  ensureDir(dir)
  shell.openPath(dir)
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

function stamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

function safeSerial(serial: string): string {
  return (serial || 'device').replace(/[^A-Za-z0-9_.-]/g, '_')
}

function isPng(buffer: Buffer): boolean {
  if (buffer.length < 32) return false
  const signature = buffer.subarray(0, 8).toString('base64')
  if (signature !== 'iVBORw0KGgo=') return false
  return buffer.subarray(buffer.length - 32).includes('IEND')
}

export async function captureShot(adb: string, serial: string, dir: string): Promise<ShotItem> {
  ensureDir(dir)
  const now = new Date()
  const name = `${safeSerial(serial)}_${stamp(now)}.png`
  const dest = join(dir, name)
  const deviceArgs = serial ? ['-s', serial] : []

  let buffer: Buffer | null = null
  try {
    const raw = await execAdbBuffer(adb, [...deviceArgs, 'exec-out', 'screencap', '-p'], 30000)
    if (isPng(raw)) buffer = raw
  } catch {
    buffer = null
  }

  if (buffer) {
    writeFileSync(dest, buffer)
  } else {
    const remote = `/sdcard/adbdesk_${now.getTime()}.png`
    const shot = await execAdb(adb, [...deviceArgs, 'shell', 'screencap', '-p', remote], 30000)
    if (shot.code !== 0) throw new Error(shot.stderr.trim() || '截图失败，请检查设备连接')

    const pulled = await execAdb(adb, [...deviceArgs, 'pull', remote, dest], 60000)
    await execAdb(adb, [...deviceArgs, 'shell', 'rm', '-f', remote], 10000)
    if (pulled.code !== 0 || !existsSync(dest)) {
      throw new Error(pulled.stderr.trim() || '拉取截图失败')
    }
  }

  const stat = statSync(dest)
  return { name, size: stat.size, mtime: stat.mtimeMs, url: shotUrl(name) }
}
