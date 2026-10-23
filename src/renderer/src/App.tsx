import { useEffect, type JSX } from 'react'
import { CommandPalette } from './components/CommandPalette'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { CommandsPage } from './pages/Commands'
import { OverviewPage } from './pages/Overview'
import { SettingsPage } from './pages/Settings'
import { ShotsPage } from './pages/Shots'
import { useApp } from './store/appContext'

export default function App(): JSX.Element {
  const { page, status, paletteOpen, setPaletteOpen } = useApp()

  // 全局快捷键：Ctrl/Cmd + K 打开面板，Esc 关闭面板
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(!paletteOpen)
        return
      }
      if (event.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen, setPaletteOpen])

  return (
    <div className="app">
      <Sidebar />

      <main className="main">
        <Topbar />
        <div className="content">
          {!status ? (
            <div className="empty">正在初始化…</div>
          ) : (
            <>
              {page === 'overview' && <OverviewPage />}
              {page === 'commands' && <CommandsPage />}
              {page === 'shots' && <ShotsPage />}
              {page === 'settings' && <SettingsPage />}
            </>
          )}
        </div>
      </main>

      {paletteOpen && <CommandPalette />}
    </div>
  )
}
