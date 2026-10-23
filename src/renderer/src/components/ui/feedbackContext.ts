import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

/* ---------------- 轻提示 ---------------- */

export type ToastApi = {
  notify: (text: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用')
  return ctx
}

/* ---------------- 二次确认 ---------------- */

export type ConfirmOptions = {
  title: string
  desc: ReactNode
  okText?: string
  cancelText?: string
  /** 危险操作使用实心红按钮 */
  danger?: boolean
  onOk: () => void
}

export type ConfirmApi = {
  askConfirm: (options: ConfirmOptions) => void
}

export const ConfirmContext = createContext<ConfirmApi | null>(null)

export function useConfirm(): ConfirmApi {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm 必须在 ConfirmProvider 内使用')
  return ctx
}
