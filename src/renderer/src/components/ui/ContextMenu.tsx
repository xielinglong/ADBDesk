import { useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from '../Icon'

export type MenuEntry =
  | {
      label: string
      icon?: IconName
      danger?: boolean
      disabled?: boolean
      onSelect: () => void
    }
  | { separator: true }

type Props = {
  x: number
  y: number
  items: MenuEntry[]
  onClose: () => void
}

const PAD = 8

/**
 * 右键菜单：fixed 定位 + 视口内收边，Esc / 点击外部 / 滚动 / 失焦均关闭，
 * 支持 ↑↓ 移动焦点、↵ 触发。
 */
export function ContextMenu({ x, y, items, onClose }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // 先渲染到左上角不可见处测量真实尺寸，再做收边定位，避免闪烁
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      left: Math.max(PAD, Math.min(x, window.innerWidth - rect.width - PAD)),
      top: Math.max(PAD, Math.min(y, window.innerHeight - rect.height - PAD))
    })
  }, [x, y])

  useEffect(() => {
    const el = ref.current
    const buttons = (): HTMLButtonElement[] =>
      Array.from(el?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])

    const onPointerDown = (event: MouseEvent): void => {
      if (!el?.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      event.preventDefault()
      const list = buttons()
      if (!list.length) return
      const index = list.indexOf(document.activeElement as HTMLButtonElement)
      const next =
        event.key === 'ArrowDown'
          ? index < 0 || index === list.length - 1
            ? 0
            : index + 1
          : index <= 0
            ? list.length - 1
            : index - 1
      list[next]?.focus()
    }
    const onDismiss = (): void => onClose()

    window.addEventListener('mousedown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', onDismiss)
    window.addEventListener('blur', onDismiss)
    document.addEventListener('scroll', onDismiss, true)

    const timer = window.setTimeout(() => buttons()[0]?.focus(), 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('mousedown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', onDismiss)
      window.removeEventListener('blur', onDismiss)
      document.removeEventListener('scroll', onDismiss, true)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="ctx"
      role="menu"
      style={{
        left: pos?.left ?? x,
        top: pos?.top ?? y,
        visibility: pos ? 'visible' : 'hidden'
      }}
    >
      {items.map((item, index) =>
        'separator' in item ? (
          <div key={`sep-${index}`} className="ctx-sep" role="separator" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={item.danger ? 'ctx-item is-danger' : 'ctx-item'}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            {item.icon && <Icon name={item.icon} size={13} />}
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>,
    document.body
  )
}
