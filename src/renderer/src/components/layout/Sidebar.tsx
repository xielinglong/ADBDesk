import type { JSX } from 'react'
import { Icon, type IconName } from '../Icon'
import { Dot } from '../ui/Pill'
import { DeviceSwitcher } from '../DeviceSwitcher'
import { useApp, type Page } from '../../store/appContext'

const NAV: { page: Page; label: string; icon: IconName }[] = [
  { page: 'overview', label: '概览', icon: 'grid' },
  { page: 'commands', label: '命令台', icon: 'terminal' },
  { page: 'shots', label: '截图', icon: 'image' },
  { page: 'settings', label: '设置', icon: 'settings' }
]

export function Sidebar(): JSX.Element {
  const { page, go, theme, setTheme, status, commands, shots } = useApp()

  const counts: Partial<Record<Page, number>> = {
    commands: commands.length,
    shots: shots.length
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Icon name="device" size={17} />
        </div>
        <div>
          <div className="brand-name">ADB Desk</div>
          <div className="brand-sub">v{status?.version ?? '1.0.0'}</div>
        </div>
      </div>

      <div>
        <div className="cap">设备</div>
        <DeviceSwitcher />
      </div>

      <nav className="nav" aria-label="主导航">
        {NAV.map((item) => {
          const active = item.page === page
          return (
            <button
              key={item.page}
              type="button"
              className={active ? 'nav-item is-active' : 'nav-item'}
              aria-current={active ? 'page' : undefined}
              onClick={() => go(item.page)}
            >
              <Icon name={item.icon} size={14} />
              {item.label}
              {counts[item.page] !== undefined && (
                <span className="nav-count">{counts[item.page]}</span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="side-foot">
        <div className="theme-switch" role="group" aria-label="外观主题">
          <button
            type="button"
            className={theme === 'light' ? 'on' : ''}
            aria-pressed={theme === 'light'}
            onClick={() => setTheme('light')}
          >
            <Icon name="sun" size={12} />
            浅色
          </button>
          <button
            type="button"
            className={theme === 'dark' ? 'on' : ''}
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme('dark')}
          >
            <Icon name="moon" size={12} />
            深色
          </button>
        </div>
        <div className="adb-line">
          <Dot tone={status?.adb.found ? 'ok' : 'err'} />
          <span title={status?.adb.error || status?.adb.path}>
            {status?.adb.found ? `adb 已就绪 · ${status.adb.version || '版本未知'}` : 'adb 未配置'}
          </span>
        </div>
      </div>
    </aside>
  )
}
