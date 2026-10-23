import type { CSSProperties, JSX, ReactNode } from 'react'

type Props = {
  title?: ReactNode
  count?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

/** 面板容器：头部 44px（标题 + 计数 + 右侧操作），可选底部信息栏 */
export function Panel({
  title,
  count,
  actions,
  footer,
  children,
  className,
  style
}: Props): JSX.Element {
  const hasHead = title !== undefined || actions !== undefined

  return (
    <section className={['panel', className ?? ''].filter(Boolean).join(' ')} style={style}>
      {hasHead && (
        <header className="panel-head">
          {title !== undefined && (
            <span className="panel-title">
              {title}
              {count !== undefined && <em className="count">{count}</em>}
            </span>
          )}
          {actions && <div className="right">{actions}</div>}
        </header>
      )}
      {children}
      {footer && <div className="panel-foot">{footer}</div>}
    </section>
  )
}
