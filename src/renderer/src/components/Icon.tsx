import type { JSX, ReactNode } from 'react'

export type IconName =
  | 'grid'
  | 'terminal'
  | 'image'
  | 'settings'
  | 'device'
  | 'search'
  | 'star'
  | 'plus'
  | 'trash'
  | 'play'
  | 'stop'
  | 'folder'
  | 'refresh'
  | 'sun'
  | 'moon'
  | 'chev'
  | 'copy'
  | 'close'
  | 'power'
  | 'back'
  | 'home'
  | 'recent'
  | 'restart'
  | 'check'
  | 'alert'
  | 'keyboard'
  | 'arrow'
  | 'open'
  | 'pencil'

/** 线性图标集：统一 24×24 viewBox，描边 1.8，与设计稿 sprite 一致 */
const NODES: Record<IconName, ReactNode> = {
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </>
  ),
  terminal: (
    <>
      <path d="M4.5 7.5l5 4.5-5 4.5" />
      <path d="M12.5 17h7" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3.5" width="18" height="17" rx="2.6" />
      <circle cx="8.5" cy="9" r="1.6" />
      <path d="M21 15.5l-4.6-4.3L5.2 20.4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.1 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1.1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>
  ),
  device: (
    <>
      <rect x="6.5" y="2" width="11" height="20" rx="2.6" />
      <path d="M10.8 18.2h2.4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </>
  ),
  star: <path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.8l5.9-.9z" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  trash: (
    <>
      <path d="M3.5 6h17M9 6V3.8h6V6M6 6l1 14h10l1-14" />
      <path d="M10.2 10.5v5.5M13.8 10.5v5.5" />
    </>
  ),
  play: <path d="M7 4.6l12.4 7.4L7 19.4z" />,
  stop: <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="2" />,
  folder: (
    <path d="M3 7.4A2.4 2.4 0 0 1 5.4 5H9l2 2h7.6A2.4 2.4 0 0 1 21 9.4v7.2A2.4 2.4 0 0 1 18.6 19H5.4A2.4 2.4 0 0 1 3 16.6z" />
  ),
  refresh: (
    <>
      <path d="M20 11.2a8 8 0 1 0-.7 4.3" />
      <path d="M20 4.5v6.7h-6.7" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.6A8.6 8.6 0 1 1 9.4 4a7 7 0 0 0 10.6 10.6z" />,
  chev: <path d="M6.5 9.5l5.5 5.5 5.5-5.5" />,
  copy: (
    <>
      <rect x="9" y="9" width="11.5" height="11.5" rx="2.2" />
      <path d="M5 15.5V6a2 2 0 0 1 2-2h9.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  power: (
    <>
      <path d="M12 3v9" />
      <path d="M6.6 6.9a8 8 0 1 0 10.8 0" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  home: <path d="M4 11l8-7.2 8 7.2v8.2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />,
  recent: <rect x="4" y="4" width="16" height="16" rx="2.6" />,
  restart: (
    <>
      <path d="M3.2 12a8.8 8.8 0 1 0 3-6.6" />
      <path d="M3 4.5v6.2h6.2" />
    </>
  ),
  check: <path d="M4.5 12.5l5 5 10-10.5" />,
  alert: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4.2M12 17.2h.01" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.4" />
      <path d="M6.8 10h.01M10.8 10h.01M14.8 10h.01M17.2 14h-10.4" />
    </>
  ),
  arrow: <path d="M4.5 12h14.5M13.5 6l6 6-6 6" />,
  open: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8.5 8.5" />
      <path d="M18 14.5v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4l11.2-11.2a2.3 2.3 0 0 0 0-3.3l-1.7-1.7a2.3 2.3 0 0 0-3.3 0L3 15v5z" />
      <path d="M14.5 5.5l4 4" />
    </>
  )
}

export function Icon({
  name,
  size = 16,
  filled = false,
  className
}: {
  name: IconName
  size?: number
  filled?: boolean
  className?: string
}): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none' }}
    >
      {NODES[name]}
    </svg>
  )
}
