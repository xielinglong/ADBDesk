import { app, shell, BrowserWindow, protocol } from 'electron'
import { join, basename, extname } from 'path'
import { readFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpc } from './ipc'
import { defaultShotsDir } from './shots'
import { getSettings } from './store'

// 无 GPU 的沙箱 / CI 环境（截图回归脚本）下关闭硬件加速
if (process.env['ADB_DESK_DISABLE_GPU']) app.disableHardwareAcceleration()

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'shot',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

function registerShotProtocol(): void {
  protocol.handle('shot', async (request) => {
    try {
      const url = new URL(request.url)
      const raw = decodeURIComponent(url.pathname.replace(/^\//, ''))
      const name = basename(raw)
      if (!name || name !== raw) return new Response('forbidden', { status: 403 })

      const dir = getSettings().shotsDir || defaultShotsDir()
      const file = join(dir, name)
      const type = extname(name).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg'
      const data = await readFile(file)
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: {
          'content-type': type,
          'content-length': String(data.byteLength),
          'cache-control': 'no-store'
        }
      })
    } catch {
      return new Response('error', { status: 500 })
    }
  })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 960,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f2f4f7',
    title: 'ADB Desk',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (process.env['ADB_DESK_CAPTURE']) {
    mainWindow.webContents.once('did-finish-load', async () => {
      const { writeFile } = await import('fs/promises')
      const target = process.env['ADB_DESK_CAPTURE'] as string
      const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
      const js = (code: string): Promise<unknown> => mainWindow.webContents.executeJavaScript(code)
      mainWindow.webContents.on('console-message', (event) => {
        if (event.level === 'error' || event.level === 'warning') {
          console.log(`[renderer:${event.level}]`, event.message)
        }
      })
      const shot = async (suffix: string): Promise<void> => {
        // 等一帧，避免图片解码 / 布局尚未落盘就被截取
        await wait(260)
        const image = await mainWindow.webContents.capturePage()
        await writeFile(target.replace('.png', `${suffix}.png`), image.toPNG())
      }
      const clickNav = (label: string): Promise<unknown> =>
        js(
          `[...document.querySelectorAll('.nav-item')].find((b) => b.textContent.includes('${label}')).click()`
        )
      // 主题按钮走 UI 点击，确保 localStorage 与主进程设置同步
      const setTheme = async (name: 'light' | 'dark'): Promise<void> => {
        await js(
          `[...document.querySelectorAll('.theme-switch button')].find((b) => b.textContent.trim() === '${name === 'dark' ? '深色' : '浅色'}').click()`
        )
        await wait(500)
      }

      await wait(2600)
      await shot('-overview-light')

      await clickNav('截图')
      await wait(1200)
      const thumbInfo = await js(
        `(() => {
          const box = document.querySelector('.thumbs');
          const first = box && box.querySelector('.thumb');
          const img = first && first.querySelector('img');
          return {
            count: box ? box.querySelectorAll('.thumb').length : 0,
            boxW: box ? Math.round(box.getBoundingClientRect().width) : 0,
            boxH: box ? Math.round(box.getBoundingClientRect().height) : 0,
            scrollH: box ? box.scrollHeight : 0,
            scrollable: box ? box.scrollHeight > box.clientHeight + 4 : false,
            thumbW: first ? Math.round(first.getBoundingClientRect().width) : 0,
            thumbH: first ? Math.round(first.getBoundingClientRect().height) : 0,
            imgW: img ? Math.round(img.getBoundingClientRect().width) : 0,
            imgH: img ? Math.round(img.getBoundingClientRect().height) : 0
          };
        })()`
      )
      console.log('[capture] thumbs =', JSON.stringify(thumbInfo))
      await shot('-shots-light')

      await js(`document.querySelector('.thumbs').scrollTop = 99999`)
      await wait(400)
      await shot('-shots-scrolled')
      await js(`document.querySelector('.thumbs').scrollTop = 0`)
      await wait(300)

      // 右键第二张缩略图，检查菜单项
      await js(
        `(() => {
          const el = document.querySelectorAll('.thumb')[1];
          const r = el.getBoundingClientRect();
          el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: r.left + 40, clientY: r.top + 60 }));
        })()`
      )
      await wait(350)
      const menuInfo = await js(
        `[...document.querySelectorAll('.ctx-item')].map((b) => b.textContent.trim())`
      )
      console.log('[capture] menu =', JSON.stringify(menuInfo))
      await shot('-shots-menu')

      // 重命名
      const origName = (await js(`document.querySelectorAll('.thumb')[1]?.dataset.shot`)) as string
      await js(
        `[...document.querySelectorAll('.ctx-item')].find((b) => b.textContent.includes('重命名')).click()`
      )
      await wait(350)
      await shot('-shots-rename')
      const renameTarget = await js(
        `(() => {
          const input = document.querySelector('.rename-field input');
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(input, '回归测试_重命名');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return document.querySelector('.shot-name')?.textContent;
        })()`
      )
      console.log('[capture] rename active =', renameTarget)
      await js(
        `[...document.querySelectorAll('.confirm-foot .btn')].find((b) => b.textContent.trim() === '保存').click()`
      )
      await wait(900)
      await shot('-shots-renamed')
      const afterRename = await js(
        `({ name: document.querySelector('.shot-name')?.textContent,
           first: document.querySelectorAll('.thumb')[1]?.dataset.shot })`
      )
      console.log('[capture] after rename =', JSON.stringify(afterRename))

      // 复制到剪贴板
      await js(
        `(() => {
          const el = document.querySelectorAll('.thumb')[1];
          const r = el.getBoundingClientRect();
          el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: r.left + 40, clientY: r.top + 60 }));
        })()`
      )
      await wait(300)
      await js(
        `[...document.querySelectorAll('.ctx-item')].find((b) => b.textContent.includes('复制到剪贴板')).click()`
      )
      await wait(900)
      const { clipboard } = await import('electron')
      const items = await clipboard.read()
      console.log('[capture] clipboard types =', JSON.stringify(items.map((item) => item.types)))
      await shot('-shots-copied')

      // 还原文件名，避免污染截图目录
      const { readdirSync, renameSync } = await import('fs')
      const dir = getSettings().shotsDir || defaultShotsDir()
      const renamed = readdirSync(dir).find((name) => name.startsWith('回归测试_重命名'))
      if (renamed && origName) {
        renameSync(join(dir, renamed), join(dir, origName))
      }
      console.log('[capture] renamed file =', renamed, '->', origName)

      await clickNav('概览')
      await wait(600)
      await shot('-overview-quick')
      await setTheme('dark')
      await shot('-overview-dark')

      await setTheme('light')
      await clickNav('命令台')
      await wait(700)
      await shot('-commands-light')

      await clickNav('设置')
      await wait(400)
      await shot('-settings-light')

      await clickNav('截图')
      await wait(500)
      await setTheme('dark')
      await wait(300)
      await shot('-shots-dark')

      app.quit()
    })
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.adbdesk.app')
  registerShotProtocol()
  registerIpc()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
