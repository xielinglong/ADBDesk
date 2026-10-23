import { useCallback, useEffect, useRef, useState, type JSX, type MouseEvent } from 'react'
import { Icon } from '../components/Icon'
import { Button } from '../components/ui/Button'
import { ContextMenu, type MenuEntry } from '../components/ui/ContextMenu'
import { Panel } from '../components/ui/Panel'
import { useApp } from '../store/appContext'
import { formatBytes, formatClock, formatFullTime } from '../utils'

type MenuState = { x: number; y: number; name: string }

export function ShotsPage(): JSX.Element {
  const {
    shots,
    shotsDir,
    activeShot,
    setActiveShot,
    capture,
    capturing,
    removeShot,
    renameShot,
    copyShot,
    online,
    go
  } = useApp()
  const [measured, setMeasured] = useState<{
    name: string
    width: number
    height: number
  } | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const current = shots.find((item) => item.name === activeShot) ?? shots[0] ?? null
  // 分辨率随图片测量结果派生，切换截图时自然失效，无需在 effect 里重置
  const size = current && measured?.name === current.name ? measured : null

  const total = shots.reduce((sum, item) => sum + item.size, 0)
  const format = current ? current.name.split('.').pop()?.toUpperCase() || 'PNG' : ''

  // 截图变多后，切到新增/重命名的截图时把它滚进可视区
  useEffect(() => {
    const box = listRef.current
    if (!box || !current) return
    const el = box.querySelector<HTMLElement>(`[data-shot="${CSS.escape(current.name)}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [current])

  const openMenu = useCallback(
    (event: MouseEvent, name: string): void => {
      event.preventDefault()
      event.stopPropagation()
      setActiveShot(name)
      setMenu({ x: event.clientX, y: event.clientY, name })
    },
    [setActiveShot]
  )

  const menuItems = (name: string): MenuEntry[] => [
    { label: '重命名', icon: 'pencil', onSelect: () => setRenaming(name) },
    { label: '在文件夹中打开', icon: 'folder', onSelect: () => void window.api.shots.reveal(name) },
    { label: '复制到剪贴板', icon: 'copy', onSelect: () => void copyShot(name) },
    { separator: true },
    { label: '删除截图', icon: 'trash', danger: true, onSelect: () => void removeShot(name) }
  ]

  return (
    <div className="page is-active" data-page="shots">
      <Panel
        title="截图"
        count={shots.length}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              title="打开截图目录"
              aria-label="打开截图目录"
              onClick={() => void window.api.settings.openShotsFolder()}
            >
              <Icon name="folder" size={14} />
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!online || capturing}
              onClick={() => void capture()}
            >
              {capturing ? <span className="dot run" /> : <Icon name="image" size={12} />}
              {capturing ? '截图中…' : '截图'}
            </Button>
          </>
        }
        footer={
          <>
            <span>
              共 {shots.length} 张 · 合计 {formatBytes(total)}
            </span>
            <span className="spacer" />
            <span title={shotsDir}>{shots.length > 4 ? '滚轮查看更多' : shortPath(shotsDir)}</span>
          </>
        }
      >
        <div className="thumbs" ref={listRef}>
          {shots.map((shot) => (
            <div
              key={shot.name}
              data-shot={shot.name}
              role="button"
              tabIndex={0}
              aria-label={shot.name}
              title={`${shot.name}\n右键查看更多操作`}
              className={shot.name === current?.name ? 'thumb is-active' : 'thumb'}
              onClick={() => setActiveShot(shot.name)}
              onContextMenu={(event) => openMenu(event, shot.name)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setActiveShot(shot.name)
                } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                  event.preventDefault()
                  const rect = event.currentTarget.getBoundingClientRect()
                  setActiveShot(shot.name)
                  setMenu({ x: rect.left + 24, y: rect.top + 24, name: shot.name })
                }
              }}
            >
              <img src={shot.url} alt={shot.name} loading="lazy" draggable={false} />
              <span className="tm">
                {formatClock(shot.mtime)} · {formatBytes(shot.size)}
              </span>
              <button
                type="button"
                className="del"
                title="删除这张截图"
                aria-label="删除截图"
                onClick={(event) => {
                  event.stopPropagation()
                  void removeShot(shot.name)
                }}
              >
                <Icon name="close" size={11} />
              </button>
            </div>
          ))}

          {!shots.length && (
            <div className="empty" style={{ gridColumn: '1 / -1', height: 260 }}>
              <Icon name="image" size={26} />
              <span>
                还没有截图
                <br />
                点击右上角「截图」抓取当前屏幕
              </span>
              {!online && (
                <Button size="sm" onClick={() => go('settings')}>
                  先配置 adb 路径
                </Button>
              )}
            </div>
          )}
        </div>
      </Panel>

      <Panel
        title={
          <span
            className="shot-name"
            title={current?.name}
            style={{
              fontSize: 11.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {current?.name ?? '—'}
          </span>
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              title="重命名"
              aria-label="重命名"
              disabled={!current}
              onClick={() => current && setRenaming(current.name)}
            >
              <Icon name="pencil" size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              title="复制到剪贴板"
              aria-label="复制到剪贴板"
              disabled={!current}
              onClick={() => current && void copyShot(current.name)}
            >
              <Icon name="copy" size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              title="在文件夹中显示"
              aria-label="在文件夹中显示"
              disabled={!current}
              onClick={() => current && void window.api.shots.reveal(current.name)}
            >
              <Icon name="open" size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              title="删除截图"
              aria-label="删除截图"
              disabled={!current}
              onClick={() => current && void removeShot(current.name)}
            >
              <Icon name="trash" size={14} />
            </Button>
          </>
        }
      >
        <div className="preview">
          {current ? (
            <img
              src={current.url}
              alt={current.name}
              draggable={false}
              onContextMenu={(event) => openMenu(event, current.name)}
              onLoad={(event) =>
                setMeasured({
                  name: current.name,
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight
                })
              }
            />
          ) : (
            <div className="empty">
              <Icon name="image" size={26} />
              <span>左侧选择一张截图查看预览</span>
            </div>
          )}
        </div>

        <div className="preview-foot">
          {current ? (
            <>
              <span>{size ? `${size.width} × ${size.height}` : '— × —'}</span>
              <span>{formatBytes(current.size)}</span>
              <span>{formatFullTime(current.mtime)}</span>
              <span className="spacer" />
              <span>{format}</span>
            </>
          ) : (
            <span>截图默认保存在「图片 / ADB Desk」目录</span>
          )}
        </div>
      </Panel>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.name)}
          onClose={() => setMenu(null)}
        />
      )}

      {renaming && (
        <RenameDialog
          name={renaming}
          onCancel={() => setRenaming(null)}
          onSubmit={async (next) => {
            const saved = await renameShot(renaming, next)
            if (saved) setRenaming(null)
          }}
        />
      )}
    </div>
  )
}

function shortPath(path: string): string {
  if (!path) return '图片 / ADB Desk'
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : path
}

/** 重命名弹窗：输入框只填主文件名，扩展名保持原样 */
function RenameDialog({
  name,
  onCancel,
  onSubmit
}: {
  name: string
  onCancel: () => void
  onSubmit: (next: string) => Promise<void>
}): JSX.Element {
  const base = name.replace(/\.(png|jpe?g|webp)$/i, '')
  const ext = name.slice(base.length)
  const [value, setValue] = useState(base)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  const trimmed = value.trim()
  const dirty = trimmed.length > 0 && trimmed !== base

  const submit = async (): Promise<void> => {
    if (!dirty || busy) return
    setBusy(true)
    await onSubmit(trimmed)
    setBusy(false)
  }

  return (
    <div
      className="overlay center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <form
        className="confirm rename"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="confirm-body">
          <div className="confirm-ico is-accent">
            <Icon name="pencil" />
          </div>
          <div className="grow">
            <h3 id="rename-title">重命名截图</h3>
            <p>只改主文件名，扩展名会保留。</p>
            <div className="rename-field">
              <input
                ref={inputRef}
                className="input"
                value={value}
                spellCheck={false}
                aria-label="新的文件名称"
                onChange={(event) => setValue(event.target.value)}
              />
              <span className="rename-ext">{ext}</span>
            </div>
          </div>
        </div>
        <div className="confirm-foot">
          <Button type="button" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit" variant="primary" disabled={!dirty || busy}>
            {busy ? '保存中…' : '保存'}
          </Button>
        </div>
      </form>
    </div>
  )
}
