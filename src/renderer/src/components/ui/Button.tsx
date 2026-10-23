import type { ButtonHTMLAttributes, JSX } from 'react'

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger' | 'danger-solid'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  /** 正方形图标按钮 */
  iconOnly?: boolean
}

export function Button({
  variant = 'default',
  size = 'md',
  iconOnly = false,
  className,
  type = 'button',
  ...rest
}: Props): JSX.Element {
  const classes = [
    'btn',
    variant !== 'default' ? variant : '',
    size === 'sm' ? 'sm' : '',
    iconOnly ? 'icon' : '',
    className ?? ''
  ]
    .filter(Boolean)
    .join(' ')

  return <button type={type} className={classes} {...rest} />
}
