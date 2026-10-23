import type { JSX } from 'react'
import { Icon } from '../Icon'
import { useApp, type Page } from '../../store/appContext'

const META: Record<Page, { title: string; sub: string }> = {
  overview: { title: '概览', sub: '' },
  commands: { title: '命令台', sub: '保存常用 adb 指令，运行并实时查看输出' },
  shots: { title: '截图', sub: '抓取设备屏幕，集中管理与预览' },
  settings: { title: '设置', sub: 'adb 路径、存储位置与外观' }
}

export function Topbar(): JSX.Element {
  const { page, device, deviceInfo, online, status, setPaletteOpen } = useApp()
  const meta = META[page]

  let sub = meta.sub
  if (page === 'overview') {
    if (status && !status.adb.found) sub = '未找到 adb，请先在设置中指定可执行文件'
    else if (!device) sub = '未检测到设备 · 请连接手机并开启 USB 调试'
    else {
      const parts = [device.model || device.serial, online ? '已连接' : '离线']
      if (deviceInfo?.android) parts.push(`Android ${deviceInfo.android}`)
      sub = parts.join(' · ')
    }
  }

  return (
    <header className="topbar">
      <div>
        <h1>{meta.title}</h1>
        <p>{sub}</p>
      </div>
      <div className="top-actions">
        <button
          type="button"
          className="palette-btn"
          aria-label="打开命令面板"
          onClick={() => setPaletteOpen(true)}
        >
          <Icon name="search" size={14} />
          搜索或跳转
          <kbd>Ctrl K</kbd>
        </button>
      </div>
    </header>
  )
}
