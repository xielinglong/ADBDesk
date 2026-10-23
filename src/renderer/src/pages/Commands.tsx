import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { CommandMode } from '../../../shared/types'
import { Icon } from '../components/Icon'
import { Button } from '../components/ui/Button'
import { Panel } from '../components/ui/Panel'
import { Dot, Pill } from '../components/ui/Pill'
import { Segmented } from '../components/ui/Segmented'
import { useToast } from '../components/ui/feedbackContext'
import { runLines, useApp } from '../store/appContext'

const MODE_HINT: Record<CommandMode, string> = {
  shell: 'shell 模式自动拼接 adb shell；支持管道与重定向',
  adb: 'adb 模式按原始参数执行，如 devices -l、install app.apk'
}

export function CommandsPage(): JSX.Element {
  const { commands, activeCommandId, draftToken, selectCommand, toggleFavorite } = useApp()
  const [search, setSearch] = useState('')

  const listRef = useRef<HTMLDivElement | null>(null)

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return commands
    return commands.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) || item.cmd.toLowerCase().includes(keyword)
    )
  }, [commands, search])

  const focusRow = (offset: number, index: number): void => {
    const next = filtered[index + offset]
    if (!next) return
    selectCommand(next.id)
    window.requestAnimationFrame(() => {
      const rows = listRef.current?.querySelectorAll<HTMLElement>('.cmd')
      rows?.[index + offset]?.focus()
    })
  }

  return (
    <div className="page is-active" data-page="commands">
      <Panel
        title="命令库"
        count={commands.length}
        actions={
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            title="新建命令"
            aria-label="新建命令"
            onClick={() => {
              selectCommand(null)
              window.requestAnimationFrame(() => document.getElementById('cmd-name')?.focus())
            }}
          >
            <Icon name="plus" size={14} />
          </Button>
        }
      >
        <div className="search">
          <Icon name="search" size={14} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索命令或指令…"
            autoComplete="off"
          />
        </div>

        <div className="cmd-list" ref={listRef} role="listbox" aria-label="命令列表">
          {filtered.map((item, index) => {
            const active = item.id === activeCommandId
            return (
              <div
                key={item.id}
                role="option"
                aria-selected={active}
                tabIndex={0}
                className={active ? 'cmd is-active' : 'cmd'}
                onClick={() => selectCommand(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    selectCommand(item.id)
                  } else if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    focusRow(1, index)
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    focusRow(-1, index)
                  }
                }}
              >
                <span className="cmd-top">
                  <span className="cmd-name">{item.name}</span>
                  <Pill tone="mono">{item.mode}</Pill>
                  <button
                    type="button"
                    className={item.favorite ? 'star-btn on' : 'star-btn'}
                    title={item.favorite ? '取消收藏' : '加入常用'}
                    aria-label={item.favorite ? '取消收藏' : '加入常用'}
                    onClick={(event) => {
                      event.stopPropagation()
                      void toggleFavorite(item.id)
                    }}
                  >
                    <Icon name="star" size={12} filled />
                  </button>
                </span>
                <span className="cmd-code">{item.cmd}</span>
              </div>
            )
          })}

          {!filtered.length && (
            <div className="empty" style={{ height: 'auto', padding: '36px 12px' }}>
              <Icon name="search" size={26} />
              <span>
                没有匹配的命令
                <br />
                试试其他关键词
              </span>
            </div>
          )}
        </div>

        <div className="panel-foot">
          <span>
            共 <b style={{ color: 'var(--text-2)' }}>{filtered.length}</b> 条
          </span>
          <span className="spacer" />
          <kbd>↑</kbd>
          <kbd>↓</kbd>
          <span>切换</span>
        </div>
      </Panel>

      <div className="stack">
        {/* key 变化即重挂载：把「选择命令」变成一次干净的状态初始化，无需 effect 同步 */}
        <CommandEditor key={`${activeCommandId ?? 'draft'}-${draftToken}`} />
        <ConsolePanel />
      </div>
    </div>
  )
}

function CommandEditor(): JSX.Element {
  const { commands, activeCommandId, saveCommand, removeCommand, serial, online, run, runCommand } =
    useApp()
  const { notify } = useToast()

  const target = commands.find((item) => item.id === activeCommandId) ?? null
  const [name, setName] = useState(target?.name ?? '')
  const [cmd, setCmd] = useState(target?.cmd ?? '')
  const [mode, setMode] = useState<CommandMode>(target?.mode ?? 'shell')

  const running = run.status === 'running'

  const runCurrent = useCallback(async (): Promise<void> => {
    await runCommand(cmd, mode)
  }, [cmd, mode, runCommand])

  // Ctrl/Cmd + ↵ 运行当前命令
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        void runCurrent()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runCurrent])

  const save = async (): Promise<void> => {
    const trimmed = cmd.trim()
    if (!trimmed) {
      notify('命令内容为空')
      return
    }
    await saveCommand({
      id: activeCommandId ?? undefined,
      name: name.trim() || trimmed.split(/\s+/).slice(0, 3).join(' '),
      cmd: trimmed,
      mode
    })
  }

  const remove = async (): Promise<void> => {
    if (!activeCommandId) {
      notify('请先选择一条命令')
      return
    }
    await removeCommand(activeCommandId)
  }

  return (
    <Panel
      title="命令详情"
      actions={
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          title="删除命令"
          aria-label="删除命令"
          disabled={!activeCommandId}
          onClick={() => void remove()}
        >
          <Icon name="trash" size={14} />
        </Button>
      }
    >
      <div className="editor-body">
        <div className="field">
          <label htmlFor="cmd-name">名称</label>
          <input
            id="cmd-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：查看电池状态"
            spellCheck={false}
          />
        </div>

        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field">
            <label>模式</label>
            <Segmented
              ariaLabel="执行模式"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'shell', label: 'shell' },
                { value: 'adb', label: 'adb' }
              ]}
            />
          </div>
          <div className="field grow">
            <label>目标设备</label>
            <div className="target" title={serial}>
              <Dot tone={online ? 'ok' : 'err'} />
              {serial || '未选择设备'}
            </div>
          </div>
        </div>

        <div className="field">
          <label htmlFor="cmd-text">命令</label>
          <textarea
            id="cmd-text"
            className="textarea"
            rows={3}
            value={cmd}
            onChange={(event) => setCmd(event.target.value)}
            spellCheck={false}
            placeholder="dumpsys battery"
          />
          <div className="hint">{MODE_HINT[mode]}</div>
        </div>
      </div>

      <div className="editor-foot">
        <span className="hint">
          <Icon name="keyboard" size={12} />
          <kbd>Ctrl</kbd>
          <kbd>↵</kbd> 运行
        </span>
        <span className="grow" />
        <Button onClick={() => void save()}>保存</Button>
        <Button variant="primary" disabled={!online || running} onClick={() => void runCurrent()}>
          <Icon name="play" size={12} filled />
          运行
        </Button>
      </div>
    </Panel>
  )
}

function ConsolePanel(): JSX.Element {
  const { run, serial, device, stopRun, clearRun } = useApp()
  const { notify } = useToast()
  const [elapsed, setElapsed] = useState(0)
  const consoleRef = useRef<HTMLDivElement | null>(null)

  const running = run.status === 'running'
  const lines = useMemo(() => runLines(run.segments), [run.segments])
  const duration = running ? elapsed : Math.max(0, run.endedAt - run.startedAt)

  useEffect(() => {
    const element = consoleRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [lines])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setElapsed(Date.now() - run.startedAt), 100)
    return () => window.clearInterval(timer)
  }, [running, run.startedAt])

  const stateMeta =
    run.status === 'running'
      ? { tone: 'run' as const, text: '运行中' }
      : run.status === 'done'
        ? { tone: 'ok' as const, text: '完成' }
        : run.status === 'aborted'
          ? { tone: 'err' as const, text: '已中止' }
          : run.status === 'failed'
            ? { tone: 'err' as const, text: '失败' }
            : { tone: 'idle' as const, text: '就绪' }

  const copyOutput = async (): Promise<void> => {
    const text = run.segments.map((segment) => segment.text).join('')
    if (!text.trim()) {
      notify('暂无输出可复制')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      notify('输出已复制')
    } catch {
      notify('复制失败')
    }
  }

  return (
    <Panel
      className="console-panel"
      title={
        <>
          输出
          <span className="run-state">
            <Dot tone={stateMeta.tone} />
            {stateMeta.text}
            {run.startedAt > 0 && (
              <span style={{ color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                {(duration / 1000).toFixed(1)}s
              </span>
            )}
          </span>
        </>
      }
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            title="清空输出"
            aria-label="清空输出"
            disabled={run.status === 'idle'}
            onClick={clearRun}
          >
            <Icon name="trash" size={14} />
          </Button>
          <Button
            size="sm"
            iconOnly
            title="停止运行"
            aria-label="停止运行"
            disabled={!running}
            onClick={() => void stopRun()}
          >
            <Icon name="stop" size={12} filled />
          </Button>
        </>
      }
    >
      <div className="console" ref={consoleRef} role="log" aria-live="polite">
        {lines.length ? (
          lines.map((line, index) => (
            <div
              key={`${index}-${line.kind}`}
              className={line.kind === 'out' ? 'ln' : `ln ${line.kind}`}
            >
              {line.text}
            </div>
          ))
        ) : (
          <div className="console-empty">
            执行命令后，标准输出与错误信息会显示在这里
            <br />
            提示：选中命令后按 Ctrl + ↵ 即可运行
          </div>
        )}
      </div>

      <div className="console-foot">
        <span>
          退出码 <b>{run.exitCode === null ? '—' : run.exitCode}</b>
        </span>
        <span>
          行数 <b>{lines.length}</b>
        </span>
        <span className="spacer" />
        <span title={device?.model}>{serial || '未选择设备'}</span>
        <Button variant="ghost" size="sm" onClick={() => void copyOutput()}>
          <Icon name="copy" size={12} />
          复制
        </Button>
      </div>
    </Panel>
  )
}
