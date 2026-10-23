import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react'
import type {
  AdbDevice,
  AppStatus,
  CommandItem,
  CommandMode,
  DeviceInfo,
  Settings,
  ShotItem,
  ThemeName
} from '../../../shared/types'
import { errorMessage } from '../utils'
import { useToast } from '../components/ui/feedbackContext'
import {
  AppContext,
  EMPTY_RUN,
  type AppApi,
  type LastRun,
  type Page,
  type RunSegment,
  type RunState,
  type SaveCommandInput
} from './appContext'

const THEME_KEY = 'adbdesk.theme'
/** runId 尚未返回时的占位，保证首个输出块不被丢弃 */
const PENDING = '__pending__'
const RUN_CHAR_LIMIT = 400_000
const NO_DEVICES: AdbDevice[] = []

function readTheme(): ThemeName {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function appendSegments(
  segments: RunSegment[],
  kind: RunSegment['kind'],
  text: string
): RunSegment[] {
  if (!text) return segments
  const last = segments[segments.length - 1]
  const next =
    last && last.kind === kind
      ? [...segments.slice(0, -1), { kind, text: last.text + text }]
      : [...segments, { kind, text }]

  let total = next.reduce((sum, segment) => sum + segment.text.length, 0)
  if (total <= RUN_CHAR_LIMIT) return next

  const trimmed = [...next]
  while (total > RUN_CHAR_LIMIT && trimmed.length > 1) {
    const first = trimmed[0]
    const over = total - RUN_CHAR_LIMIT
    if (first.text.length <= over) {
      total -= first.text.length
      trimmed.shift()
    } else {
      trimmed[0] = { kind: first.kind, text: first.text.slice(over) }
      total = RUN_CHAR_LIMIT
    }
  }
  return trimmed
}

function outputPreview(segments: RunSegment[]): string {
  const text = segments
    .filter((segment) => segment.kind === 'out' || segment.kind === 'err')
    .map((segment) => segment.text)
    .join('')
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .slice(0, 4)
    .join('\n')
}

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const { notify } = useToast()

  const [theme, setThemeState] = useState<ThemeName>(readTheme)
  const [page, setPage] = useState<Page>('overview')
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [rawDevices, setRawDevices] = useState<AdbDevice[]>([])
  const [preferredSerial, setPreferredSerial] = useState('')
  const [infoState, setInfoState] = useState<{ serial: string; value: DeviceInfo } | null>(null)
  const [commands, setCommands] = useState<CommandItem[]>([])
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null)
  const [draftToken, setDraftToken] = useState(0)
  const [shots, setShots] = useState<ShotItem[]>([])
  const [activeShot, setActiveShot] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [run, setRun] = useState<RunState>(EMPTY_RUN)
  const [lastRun, setLastRun] = useState<LastRun | null>(null)

  const themeTouched = useRef(Boolean(localStorage.getItem(THEME_KEY)))
  const runRef = useRef<RunState>(EMPTY_RUN)
  const flushScheduled = useRef(false)
  const runningRef = useRef(false)
  const runIdRef = useRef<string | null>(null)
  const capturingRef = useRef(false)

  /* ---------------- 主题 ---------------- */
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    if (themeTouched.current) {
      localStorage.setItem(THEME_KEY, theme)
      void window.api.settings.update({ theme })
    }
  }, [theme])

  const setTheme = useCallback((next: ThemeName): void => {
    themeTouched.current = true
    setThemeState(next)
  }, [])

  /* ---------------- 状态与设备 ---------------- */
  const applyStatus = useCallback((next: AppStatus): void => {
    setStatus(next)
    if (!themeTouched.current) setThemeState(next.settings.theme)
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const next = await window.api.status()
        if (alive) applyStatus(next)
      } catch (error) {
        if (alive) notify(errorMessage(error))
      }
    })()
    return () => {
      alive = false
    }
  }, [applyStatus, notify])

  const adbReady = status?.adb.found ?? false
  // adb 未就绪时直接不展示设备，避免额外的同步重置
  const devices = adbReady ? rawDevices : NO_DEVICES

  useEffect(() => {
    if (!adbReady) return
    let alive = true
    const tick = async (): Promise<void> => {
      try {
        const list = await window.api.adb.devices()
        if (alive) setRawDevices(list)
      } catch {
        if (alive) setRawDevices([])
      }
    }
    void tick()
    const timer = window.setInterval(() => void tick(), 5000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [adbReady])

  // 设备由状态派生：优先用户的显式选择，失效后回落到第一个在线设备
  const serial = useMemo(() => {
    if (preferredSerial && devices.some((item) => item.serial === preferredSerial)) {
      return preferredSerial
    }
    const first = devices.find((item) => item.state === 'device') ?? devices[0]
    return first?.serial ?? ''
  }, [preferredSerial, devices])

  const device = devices.find((item) => item.serial === serial) ?? null
  const online = device?.state === 'device'

  useEffect(() => {
    if (!online || !serial) return
    let alive = true
    void (async () => {
      try {
        const value = await window.api.adb.info(serial)
        if (alive) setInfoState({ serial, value })
      } catch {
        /* 设备可能刚断开，忽略并降级展示 */
      }
    })()
    return () => {
      alive = false
    }
  }, [online, serial])

  const deviceInfo = online && infoState?.serial === serial ? infoState.value : null

  const refreshDevices = useCallback(async (): Promise<void> => {
    try {
      setRawDevices(await window.api.adb.devices())
    } catch (error) {
      notify(errorMessage(error))
    }
  }, [notify])

  const reloadStatus = useCallback(async (): Promise<AppStatus | null> => {
    try {
      const next = await window.api.status()
      applyStatus(next)
      if (next.adb.found) setRawDevices(await window.api.adb.devices())
      return next
    } catch (error) {
      notify(errorMessage(error))
      return null
    }
  }, [applyStatus, notify])

  const updateSettings = useCallback(
    async (patch: Partial<Settings>): Promise<Settings | null> => {
      try {
        const next = await window.api.settings.update(patch)
        await reloadStatus()
        return next
      } catch (error) {
        notify(errorMessage(error))
        return null
      }
    },
    [notify, reloadStatus]
  )

  const selectDevice = useCallback(
    (next: string): void => {
      setPreferredSerial(next)
      const target = devices.find((item) => item.serial === next)
      notify(
        `已切换到 ${target?.model ?? next}${target && target.state !== 'device' ? '（离线）' : ''}`
      )
    },
    [devices, notify]
  )

  /* ---------------- 命令库 ---------------- */
  const selectCommand = useCallback((id: string | null): void => {
    setActiveCommandId(id)
    setDraftToken((token) => token + 1)
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const list = await window.api.commands.list()
        if (!alive) return
        setCommands(list)
        if (list[0]) {
          setActiveCommandId(list[0].id)
          setDraftToken((token) => token + 1)
        }
      } catch (error) {
        if (alive) notify(errorMessage(error))
      }
    })()
    return () => {
      alive = false
    }
  }, [notify])

  const refreshCommands = useCallback(async (): Promise<void> => {
    try {
      setCommands(await window.api.commands.list())
    } catch (error) {
      notify(errorMessage(error))
    }
  }, [notify])

  const toggleFavorite = useCallback(
    async (id: string): Promise<void> => {
      try {
        setCommands(await window.api.commands.toggleFavorite(id))
      } catch (error) {
        notify(errorMessage(error))
      }
    },
    [notify]
  )

  const saveCommand = useCallback(
    async (input: SaveCommandInput): Promise<CommandItem | null> => {
      try {
        const list = await window.api.commands.save(input)
        setCommands(list)
        const saved = input.id
          ? list.find((item) => item.id === input.id)
          : list.find(
              (item) =>
                item.name === input.name && item.cmd === input.cmd && item.mode === input.mode
            )
        if (saved) {
          setActiveCommandId(saved.id)
          // 新建后需要让编辑器指向新条目（编辑现有命令时不重挂载，避免打断输入）
          if (!input.id) setDraftToken((token) => token + 1)
        }
        notify(input.id ? '命令已更新' : '命令已保存')
        return saved ?? null
      } catch (error) {
        notify(errorMessage(error))
        return null
      }
    },
    [notify]
  )

  const removeCommand = useCallback(
    async (id: string): Promise<void> => {
      try {
        const list = await window.api.commands.remove(id)
        setCommands(list)
        if (activeCommandId === id) {
          setActiveCommandId(list[0]?.id ?? null)
          setDraftToken((token) => token + 1)
        }
        notify('命令已删除')
      } catch (error) {
        notify(errorMessage(error))
      }
    },
    [activeCommandId, notify]
  )

  /* ---------------- 截图 ---------------- */
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const list = await window.api.shots.list()
        if (!alive) return
        setShots(list)
        setActiveShot((current) =>
          current && list.some((item) => item.name === current) ? current : (list[0]?.name ?? null)
        )
      } catch (error) {
        if (alive) notify(errorMessage(error))
      }
    })()
    return () => {
      alive = false
    }
  }, [notify])

  const refreshShots = useCallback(async (): Promise<void> => {
    try {
      const list = await window.api.shots.list()
      setShots(list)
      setActiveShot((current) =>
        current && list.some((item) => item.name === current) ? current : (list[0]?.name ?? null)
      )
    } catch (error) {
      notify(errorMessage(error))
    }
  }, [notify])

  const capture = useCallback(async (): Promise<ShotItem | null> => {
    if (capturingRef.current) return null
    if (!online) {
      notify('设备离线，无法截图')
      return null
    }
    capturingRef.current = true
    setCapturing(true)
    try {
      const shot = await window.api.shots.capture(serial)
      setShots(await window.api.shots.list())
      setActiveShot(shot.name)
      notify(`已保存：${shot.name}`)
      return shot
    } catch (error) {
      notify(errorMessage(error))
      return null
    } finally {
      capturingRef.current = false
      setCapturing(false)
    }
  }, [notify, online, serial])

  const removeShot = useCallback(
    async (name: string): Promise<void> => {
      try {
        await window.api.shots.remove(name)
        const list = await window.api.shots.list()
        setShots(list)
        setActiveShot((current) => (current === name ? (list[0]?.name ?? null) : current))
        notify('已删除截图')
      } catch (error) {
        notify(errorMessage(error))
      }
    },
    [notify]
  )

  const renameShot = useCallback(
    async (name: string, next: string): Promise<string | null> => {
      try {
        const shot = await window.api.shots.rename(name, next)
        setShots(await window.api.shots.list())
        setActiveShot((current) => (current === name ? shot.name : current))
        notify(`已重命名为 ${shot.name}`)
        return shot.name
      } catch (error) {
        notify(errorMessage(error))
        return null
      }
    },
    [notify]
  )

  const copyShot = useCallback(
    async (name: string): Promise<void> => {
      try {
        await window.api.shots.copy(name)
        notify('已复制图片到剪贴板')
      } catch (error) {
        notify(errorMessage(error))
      }
    },
    [notify]
  )

  /* ---------------- 运行 ---------------- */
  const flush = useCallback((next: RunState, immediate = false): void => {
    runRef.current = next
    if (immediate) {
      flushScheduled.current = false
      setRun(next)
      return
    }
    if (flushScheduled.current) return
    flushScheduled.current = true
    window.requestAnimationFrame(() => {
      flushScheduled.current = false
      setRun(runRef.current)
    })
  }, [])

  // 运行上下文（最新值），供异步回调读取，避免闭包过期
  const latestRef = useRef({ serial, online: Boolean(online), label: serial || '未选择设备' })
  useEffect(() => {
    latestRef.current = {
      serial,
      online: Boolean(online),
      label: device?.model ? device.model : serial || '未选择设备'
    }
  }, [serial, online, device])

  const runCommand = useCallback(
    async (cmd: string, mode: CommandMode): Promise<void> => {
      const trimmed = cmd.trim()
      if (!trimmed) {
        notify('命令内容为空')
        return
      }
      if (!latestRef.current.online) {
        notify('设备离线，无法执行')
        return
      }
      if (runningRef.current) {
        notify('已有命令正在运行，请先停止')
        return
      }

      const target = latestRef.current.serial
      const label = `$ adb -s ${target} ${mode === 'shell' ? 'shell ' : ''}${trimmed}`
      const startedAt = Date.now()

      runningRef.current = true
      runIdRef.current = PENDING
      flush(
        {
          status: 'running',
          runId: null,
          segments: [
            { kind: 'cmd', text: `${label}\n` },
            { kind: 'dim', text: `# 目标设备 ${latestRef.current.label} · ${target}\n` }
          ],
          exitCode: null,
          error: null,
          startedAt,
          endedAt: 0,
          cmd: label,
          serial: target
        },
        true
      )

      try {
        const { runId } = await window.api.commands.run({ cmd: trimmed, mode, serial: target })
        if (!runningRef.current) {
          // 运行期间被停止：把已启动的进程一并回收
          void window.api.commands.kill(runId)
          return
        }
        runIdRef.current = runId
        flush({ ...runRef.current, runId }, true)
      } catch (error) {
        const message = errorMessage(error)
        runningRef.current = false
        runIdRef.current = null
        const endedAt = Date.now()
        flush(
          {
            ...runRef.current,
            status: 'failed',
            error: message,
            endedAt,
            segments: appendSegments(runRef.current.segments, 'err', `${message}\n`)
          },
          true
        )
        setLastRun({
          cmd: label,
          code: -1,
          duration: endedAt - startedAt,
          preview: message,
          at: endedAt
        })
        notify(message)
      }
    },
    [flush, notify]
  )

  useEffect(() => {
    const offOutput = window.api.commands.onOutput((payload) => {
      if (!runningRef.current) return
      const active = runIdRef.current
      if (active !== PENDING && active !== payload.runId) return
      const base = runRef.current
      flush({
        ...base,
        segments: appendSegments(
          base.segments,
          payload.stream === 'stderr' ? 'err' : 'out',
          payload.chunk
        )
      })
    })

    const offDone = window.api.commands.onDone((payload) => {
      if (!runningRef.current) return
      const active = runIdRef.current
      if (active !== PENDING && active !== payload.runId) return

      runningRef.current = false
      runIdRef.current = null

      const base = runRef.current
      const endedAt = Date.now()
      const duration = endedAt - base.startedAt
      const seconds = (duration / 1000).toFixed(1)
      let segments = base.segments
      if (payload.error) segments = appendSegments(segments, 'err', `${payload.error}\n`)
      segments =
        payload.code === 0
          ? appendSegments(segments, 'dim', `# 进程已退出，退出码 0 · 耗时 ${seconds}s\n`)
          : appendSegments(
              segments,
              'err',
              `# 进程退出码 ${payload.code ?? '—'} · 耗时 ${seconds}s\n`
            )

      const next: RunState = {
        ...base,
        status: payload.code === 0 ? 'done' : 'failed',
        segments,
        exitCode: payload.code,
        endedAt
      }
      flush(next, true)
      setLastRun({
        cmd: next.cmd,
        code: payload.code,
        duration,
        preview: outputPreview(segments),
        at: endedAt
      })
      if (payload.code !== 0 && payload.code !== null) notify(`命令退出码 ${payload.code}`)
    })

    return () => {
      offOutput()
      offDone()
    }
  }, [flush, notify])

  const stopRun = useCallback(async (): Promise<void> => {
    if (!runningRef.current) return
    const id = runIdRef.current
    runningRef.current = false
    runIdRef.current = null

    const base = runRef.current
    const endedAt = Date.now()
    const segments = appendSegments(
      appendSegments(base.segments, 'err', '^C\n'),
      'dim',
      '# 已手动停止，退出码 130\n'
    )
    const next: RunState = { ...base, status: 'aborted', segments, exitCode: 130, endedAt }
    flush(next, true)
    setLastRun({
      cmd: next.cmd,
      code: 130,
      duration: endedAt - base.startedAt,
      preview: outputPreview(segments),
      at: endedAt
    })

    if (id && id !== PENDING) {
      try {
        await window.api.commands.kill(id)
      } catch {
        /* 进程可能已经退出，忽略 */
      }
    }
    notify('已停止当前命令')
  }, [flush, notify])

  const clearRun = useCallback((): void => {
    flush(EMPTY_RUN, true)
  }, [flush])

  const openCommand = useCallback(
    (id: string): void => {
      selectCommand(id)
      setPage('commands')
    },
    [selectCommand]
  )

  const runSavedCommand = useCallback(
    (id: string): void => {
      const target = commands.find((item) => item.id === id)
      if (!target) {
        notify('命令不存在')
        return
      }
      openCommand(id)
      void runCommand(target.cmd, target.mode)
    },
    [commands, notify, openCommand, runCommand]
  )

  const go = useCallback((next: Page): void => {
    setPage(next)
  }, [])

  const value = useMemo<AppApi>(
    () => ({
      page,
      go,
      theme,
      setTheme,
      status,
      reloadStatus,
      updateSettings,
      devices,
      serial,
      device,
      online: Boolean(online),
      deviceInfo,
      selectDevice,
      refreshDevices,
      commands,
      activeCommandId,
      draftToken,
      selectCommand,
      openCommand,
      runSavedCommand,
      toggleFavorite,
      saveCommand,
      removeCommand,
      refreshCommands,
      shots,
      shotsDir: status?.shotsDir ?? '',
      activeShot,
      setActiveShot,
      capturing,
      refreshShots,
      capture,
      removeShot,
      renameShot,
      copyShot,
      run,
      lastRun,
      runCommand,
      stopRun,
      clearRun,
      paletteOpen,
      setPaletteOpen
    }),
    [
      page,
      go,
      theme,
      setTheme,
      status,
      reloadStatus,
      updateSettings,
      devices,
      serial,
      device,
      online,
      deviceInfo,
      selectDevice,
      refreshDevices,
      commands,
      activeCommandId,
      draftToken,
      selectCommand,
      openCommand,
      runSavedCommand,
      toggleFavorite,
      saveCommand,
      removeCommand,
      refreshCommands,
      shots,
      activeShot,
      capturing,
      refreshShots,
      capture,
      removeShot,
      renameShot,
      copyShot,
      run,
      lastRun,
      runCommand,
      stopRun,
      clearRun,
      paletteOpen
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
