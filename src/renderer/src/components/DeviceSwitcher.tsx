import { useEffect, useRef, useState, type JSX } from 'react'
import { Icon } from './Icon'
import { Dot } from './ui/Pill'
import { useApp } from '../store/appContext'

/** 侧栏设备切换器：一级位置的显式设备上下文 */
export function DeviceSwitcher(): JSX.Element {
  const { devices, serial, device, selectDevice, refreshDevices } = useApp()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const online = device?.state === 'device'
  const model = device?.model || (device ? device.serial : '未检测到设备')

  return (
    <div className={open ? 'device open' : 'device'} ref={rootRef}>
      <button
        type="button"
        className="device-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="device-ico">
          <Icon name="device" size={14} />
        </span>
        <span className="device-txt">
          <span className="device-model">
            {model}
            <Dot tone={device ? (online ? 'ok' : 'err') : 'idle'} />
          </span>
          <span className="device-serial">{serial || 'adb 未连接'}</span>
        </span>
        <Icon name="chev" size={14} className="chev" />
      </button>

      <div className="device-menu" role="listbox" aria-label="选择设备">
        {devices.map((item) => {
          const current = item.serial === serial
          return (
            <button
              key={item.serial}
              type="button"
              role="option"
              aria-selected={current}
              className={current ? 'device-item is-current' : 'device-item'}
              onClick={() => {
                selectDevice(item.serial)
                setOpen(false)
              }}
            >
              <Dot tone={item.state === 'device' ? 'ok' : 'err'} />
              <span className="m">
                <span className="n">{item.model || item.serial}</span>
                <span className="s">{item.serial}</span>
              </span>
              {current && <Icon name="check" size={12} />}
            </button>
          )
        })}

        {!devices.length && <div className="p-empty">未检测到设备</div>}

        <div className="device-sep" />
        <button
          type="button"
          className="device-refresh"
          onClick={() => {
            void refreshDevices()
            setOpen(false)
          }}
        >
          <Icon name="refresh" size={12} />
          刷新设备列表
        </button>
      </div>
    </div>
  )
}
