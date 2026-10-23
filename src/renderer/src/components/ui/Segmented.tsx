import type { JSX, ReactNode } from 'react'

type Option<T extends string> = {
  value: T
  label: ReactNode
  title?: string
}

type Props<T extends string> = {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  ariaLabel?: string
}

/** 分段控件：槽 28 / 段 24，选中态用 --seg-active + 1px 阴影 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel
}: Props<T>): JSX.Element {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? 'on' : ''}
          aria-pressed={option.value === value}
          title={option.title}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
