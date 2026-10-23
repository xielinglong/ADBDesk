import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react'
import { ToastContext } from './feedbackContext'

/** 底部居中轻提示，2.2s 自动消失，role="status" */
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const notify = useCallback((text: string): void => {
    setToast({ id: Date.now() + Math.random(), text })
  }, [])

  useEffect(() => {
    if (!toast) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(timer.current)
  }, [toast])

  const api = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={toast ? 'toast show' : 'toast'} role="status" aria-live="polite">
        {toast?.text ?? ''}
      </div>
    </ToastContext.Provider>
  )
}
