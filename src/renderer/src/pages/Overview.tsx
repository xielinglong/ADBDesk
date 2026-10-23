import type { JSX } from 'react'
import type { CommandItem } from '../../../shared/types'
import { Icon, type IconName } from '../components/Icon'
import { Button } from '../components/ui/Button'
import { Panel } from '../components/ui/Panel'
import { Dot, Pill } from '../components/ui/Pill'
import { useConfirm } from '../components/ui/feedbackContext'
import { useApp } from '../store/appContext'
import { formatBytes, formatClock } from '../utils'

/** 按命令内容推断图标，未知命令用终端图标兜底 */
function quickIcon(cmd: string): IconName {
  if (/\breboot\b/.test(cmd)) return 'restart'
  if (/keyevent\s+26\b/.test(cmd)) return 'power'
  if (/keyevent\s+(3)\b/.test(cmd)) return 'home'
  if (/keyevent\s+4\b/.test(cmd)) return 'back'
  if (/keyevent\s+187\b/.test(cmd)) return 'recent'
  if (/screencap|screenshot/i.test(cmd)) return 'image'
  return 'terminal'
}

/** 破坏性命令给二次确认：重启 / 清除数据 / 卸载 / 删除 */
function isDangerous(cmd: string): boolean {
  return /\breboot\b|\bpm\s+clear\b|\bpm\s+uninstall\b|\brm\s+-rf?\b|\bfactory_reset\b|\bwipe\b/i.test(
    cmd
  )
}

function connLabel(serial: string): string {
  if (serial.startsWith('emulator-')) return '模拟器'
  if (serial.includes(':')) return '无线调试'
  return 'USB'
}

export function OverviewPage(): JSX.Element {
  const {
    status,
    device,
    deviceInfo,
    serial,
    online,
    refreshDevices,
    commands,
    shots,
    setActiveShot,
    go,
    capture,
    capturing,
    openCommand,
    runSavedCommand,
    lastRun
  } = useApp()
  const { askConfirm } = useConfirm()

  // 快捷操作 = 命令库里收藏的命令，收藏变化即时反映
  const quick = commands.filter((item) => item.favorite)

  const onQuick = (item: CommandItem): void => {
    if (isDangerous(item.cmd) && device) {
      askConfirm({
        title: `执行「${item.name}」？`,
        desc: (
          <>
            这条命令可能让设备重启或丢失数据，目标设备 <code>{device.model || device.serial}</code>
            ，确认后立即执行。
          </>
        ),
        okText: '执行',
        danger: true,
        onOk: () => runSavedCommand(item.id)
      })
      return
    }
    runSavedCommand(item.id)
  }

  const recent = shots.slice(0, 3)
  // 命令库面板：收藏优先、其次最近改动，避免与上方快捷操作完全是同一批
  const library = [...commands]
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt)
    .slice(0, 5)
  const meta = [deviceInfo?.android ? `Android ${deviceInfo.android}` : '', deviceInfo?.abi ?? '']
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="page is-active" data-page="overview">
      <div className="overview">
        {status && !status.adb.found && (
          <div className="notice">
            <Icon name="alert" size={15} />
            <span className="grow">
              没有找到 adb（Android Platform Tools），截图与命令执行暂不可用。
            </span>
            <Button size="sm" onClick={() => go('settings')}>
              去设置
            </Button>
          </div>
        )}

        <div className="hero">
          <div className="hero-ico">
            <Icon name="device" size={24} />
          </div>
          <div className="hero-main">
            <div className="hero-eyebrow">当前设备</div>
            <h2 title={device?.model || serial}>
              {device?.model || (device ? device.serial : '未连接设备')}
            </h2>
            <div className="hero-meta">
              <code>{serial || '—'}</code>
              {meta && (
                <>
                  <span>·</span>
                  <span>{meta}</span>
                </>
              )}
            </div>
            <div className="hero-pills">
              <Pill tone={device ? (online ? 'ok' : 'bad') : undefined}>
                <Dot tone={device ? (online ? 'ok' : 'err') : 'idle'} />
                {device ? (online ? '已连接' : '离线') : '无设备'}
              </Pill>
              {serial && <Pill>{connLabel(serial)}</Pill>}
              {deviceInfo?.sdk && <Pill tone="mono">sdk {deviceInfo.sdk}</Pill>}
            </div>
          </div>
          <div className="hero-actions">
            <Button variant="ghost" onClick={() => void refreshDevices()}>
              <Icon name="refresh" size={14} />
              刷新
            </Button>
            <Button
              variant="primary"
              disabled={!online || capturing}
              onClick={() => void capture().then((shot) => shot && go('shots'))}
            >
              <Icon name="image" size={14} />
              {capturing ? '截图中…' : '截图'}
            </Button>
          </div>
        </div>

        <div className="sec">
          <h3>快捷操作</h3>
          <span>命令库中已收藏的命令会显示在这里，点击直接执行</span>
        </div>
        {quick.length > 0 ? (
          <div className="quick">
            {quick.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!online}
                title={`${item.name}\n$ ${item.mode === 'shell' ? 'shell ' : ''}${item.cmd}`}
                onClick={() => onQuick(item)}
              >
                <span className="qi">
                  <Icon name={quickIcon(item.cmd)} size={14} />
                </span>
                <span className="qt">
                  <span className="ql">{item.name}</span>
                  <span className="qc">{item.cmd}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="quick-empty">
            <Icon name="star" size={14} />
            <span className="grow">
              还没有收藏的命令。在命令库选中一条命令，点击星标收藏后即可出现在这里。
            </span>
            <Button size="sm" onClick={() => go('commands')}>
              去命令库
            </Button>
          </div>
        )}

        <div className="cols">
          <Panel
            title="最近截图"
            count={recent.length}
            actions={
              <Button variant="ghost" size="sm" onClick={() => go('shots')}>
                全部
                <Icon name="arrow" size={12} />
              </Button>
            }
          >
            {recent.length > 0 ? (
              <div className="recent">
                {recent.map((shot) => (
                  <button
                    key={shot.name}
                    type="button"
                    title={shot.name}
                    onClick={() => {
                      setActiveShot(shot.name)
                      go('shots')
                    }}
                  >
                    <img src={shot.url} alt={shot.name} loading="lazy" draggable={false} />
                    <span className="rm">
                      {formatClock(shot.mtime)} · {formatBytes(shot.size)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty" style={{ height: 128 }}>
                <Icon name="image" size={26} />
                <span>还没有截图，点上方「截图」抓取当前屏幕</span>
              </div>
            )}
          </Panel>

          <Panel
            title="命令库"
            count={commands.length}
            actions={
              <Button variant="ghost" size="sm" onClick={() => go('commands')}>
                管理
                <Icon name="arrow" size={12} />
              </Button>
            }
          >
            {library.length > 0 ? (
              <div className="favs">
                {library.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="fav-row"
                    title={`打开「${item.name}」`}
                    onClick={() => openCommand(item.id)}
                  >
                    <Icon
                      name="star"
                      size={12}
                      filled={item.favorite}
                      className={item.favorite ? 'star' : 'star is-idle'}
                    />
                    <span className="fn">{item.name}</span>
                    <span className="fc">{item.cmd}</span>
                    <Icon name="play" size={12} className="go" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty" style={{ height: 128 }}>
                <Icon name="terminal" size={26} />
                <span>命令库还是空的，去命令台新建一条命令</span>
              </div>
            )}
          </Panel>
        </div>

        <Panel
          className="last-run"
          title={
            <>
              最近运行
              <em className="count">
                {lastRun ? <Dot tone={lastRun.code === 0 ? 'ok' : 'err'} /> : null}
                {lastRun ? `退出码 ${lastRun.code ?? '—'}` : '暂无记录'}
              </em>
            </>
          }
          actions={
            <>
              {lastRun && (
                <span
                  style={{
                    fontSize: 10.5,
                    color: 'var(--text-3)',
                    fontVariantNumeric: 'tabular-nums',
                    marginRight: 2
                  }}
                >
                  {(lastRun.duration / 1000).toFixed(1)}s
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={() => go('commands')}>
                查看完整输出
                <Icon name="arrow" size={12} />
              </Button>
            </>
          }
        >
          <div className="last-run-body">
            {lastRun ? (
              <>
                <div className="last-cmd" title={lastRun.cmd}>
                  {lastRun.cmd}
                </div>
                <div className={lastRun.preview ? 'last-out' : 'last-out dim'}>
                  {lastRun.preview || '(无输出)'}
                </div>
              </>
            ) : (
              <div className="last-out dim">
                还没有运行记录
                {'\n'}在命令台选择一条命令，按 Ctrl + ↵ 运行
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
