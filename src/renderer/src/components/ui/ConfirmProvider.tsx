import { useCallback, useEffect, useMemo, useState, type JSX, type ReactNode } from 'react'
import { Icon } from '../Icon'
import { Button } from './Button'
import { ConfirmContext, type ConfirmOptions } from './feedbackContext'

/** 二次确认对话框：默认焦点在「取消」，Esc 关闭 */
export function ConfirmProvider({ children }: { children: ReactNode }): JSX.Element {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)

  const askConfirm = useCallback((next: ConfirmOptions): void => setOptions(next), [])
  const close = useCallback((): void => setOptions(null), [])

  useEffect(() => {
    if (!options) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [options, close])

  const api = useMemo(() => ({ askConfirm }), [askConfirm])

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {options && (
        <div
          className="overlay center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <div className="confirm">
            <div className="confirm-body">
              <div className="confirm-ico">
                <Icon name="alert" />
              </div>
              <div>
                <h3 id="confirm-title">{options.title}</h3>
                <p>{options.desc}</p>
              </div>
            </div>
            <div className="confirm-foot">
              <Button autoFocus onClick={close}>
                {options.cancelText ?? '取消'}
              </Button>
              <Button
                variant={options.danger ? 'danger-solid' : 'primary'}
                onClick={() => {
                  close()
                  options.onOk()
                }}
              >
                {options.okText ?? '确定'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
