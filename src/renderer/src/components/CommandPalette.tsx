import { useMemo, useState, type JSX, type KeyboardEvent } from 'react'
import { Icon, type IconName } from './Icon'
import { useApp, type Page } from '../store/appContext'

type Item = {
  kind: '页面' | '命令'
  label: string
  hint: string
  icon: IconName
  run: () => void
}

const PAGES: { page: Page; label: string; icon: IconName }[] = [
  { page: 'overview', label: '概览', icon: 'grid' },
  { page: 'commands', label: '命令台', icon: 'terminal' },
  { page: 'shots', label: '截图', icon: 'image' },
  { page: 'settings', label: '设置', icon: 'settings' }
]

/**
 * Ctrl/Cmd + K 命令面板。
 * 只在打开时挂载，因此「每次打开都从空查询、第一项开始」由挂载自然保证。
 */
export function CommandPalette(): JSX.Element {
  const { setPaletteOpen, commands, openCommand, go } = useApp()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  const items = useMemo<Item[]>(() => {
    const pages: Item[] = PAGES.map((item) => ({
      kind: '页面',
      label: item.label,
      hint: item.page,
      icon: item.icon,
      run: () => go(item.page)
    }))
    const cmds: Item[] = commands.map((item) => ({
      kind: '命令',
      label: item.name,
      hint: item.mode,
      icon: 'play',
      run: () => openCommand(item.id)
    }))
    const all = [...pages, ...cmds]
    const keyword = query.trim().toLowerCase()
    if (!keyword) return all
    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(keyword) || item.hint.toLowerCase().includes(keyword)
    )
  }, [commands, go, openCommand, query])

  const close = (): void => setPaletteOpen(false)

  const activate = (item: Item | undefined): void => {
    if (!item) return
    close()
    item.run()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!items.length) return
      const dir = event.key === 'ArrowDown' ? 1 : -1
      setIndex((prev) => (prev + dir + items.length) % items.length)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      activate(items[index])
    }
  }

  let lastKind = ''

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="palette">
        <div className="palette-input">
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setIndex(0)
            }}
            placeholder="搜索页面、命令…"
            autoComplete="off"
            spellCheck={false}
            aria-label="搜索页面与命令"
            autoFocus
          />
          <kbd>Esc</kbd>
        </div>

        <div className="palette-list">
          {items.map((item, itemIndex) => {
            const header = item.kind !== lastKind ? item.kind : null
            lastKind = item.kind
            return (
              <div key={`${item.kind}-${item.label}-${itemIndex}`}>
                {header && <div className="p-group">{header}</div>}
                <button
                  type="button"
                  className={itemIndex === index ? 'p-row on' : 'p-row'}
                  onMouseEnter={() => setIndex(itemIndex)}
                  onClick={() => activate(item)}
                >
                  <Icon name={item.icon} size={14} />
                  <span className="pt">{item.label}</span>
                  <span className="pk">{item.hint}</span>
                </button>
              </div>
            )
          })}
          {!items.length && <div className="p-empty">没有匹配结果</div>}
        </div>

        <div className="palette-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> 选择
          </span>
          <span>
            <kbd>↵</kbd> 打开
          </span>
          <span className="sp">ADB Desk</span>
        </div>
      </div>
    </div>
  )
}
