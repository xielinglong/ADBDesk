import type { JSX, ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** ok / warn / bad 语义色，mono 等宽小徽标 */
  tone?: 'ok' | 'warn' | 'bad' | 'mono'
  title?: string
}

export function Pill({ children, tone, title }: Props): JSX.Element {
  return (
    <span className={['pill', tone ?? ''].filter(Boolean).join(' ')} title={title}>
      {children}
    </span>
  )
}

/** 状态点：idle 灰 / ok 绿 / err 红 / run 呼吸蓝 */
export function Dot({ tone = 'idle' }: { tone?: 'idle' | 'ok' | 'err' | 'run' }): JSX.Element {
  return <span className={tone === 'idle' ? 'dot' : `dot ${tone}`} />
}
