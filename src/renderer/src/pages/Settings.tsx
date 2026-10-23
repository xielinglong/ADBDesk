import type { JSX, ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { Button } from '../components/ui/Button'
import { Dot, Pill } from '../components/ui/Pill'
import { Segmented } from '../components/ui/Segmented'
import { useToast } from '../components/ui/feedbackContext'
import { useApp } from '../store/appContext'

function SetCard({
  title,
  desc,
  children
}: {
  title: string
  desc: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="set-card">
      <div className="set-head">
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>
      {children}
    </div>
  )
}

export function SettingsPage(): JSX.Element {
  const { status, theme, setTheme, reloadStatus, updateSettings, refreshShots } = useApp()
  const { notify } = useToast()

  const adb = status?.adb
  const configuredPath = status?.settings.adbPath ?? ''
  const adbPathText = configuredPath || adb?.path || '未配置（自动查找 PATH / ANDROID_HOME）'
  const shotsDir = status?.shotsDir ?? ''

  const pickAdb = async (): Promise<void> => {
    try {
      const file = await window.api.settings.pickAdbPath()
      if (!file) return
      await updateSettings({ adbPath: file })
      notify('adb 路径已更新')
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    }
  }

  const resetAdb = async (): Promise<void> => {
    await updateSettings({ adbPath: '' })
    notify('已恢复为自动查找')
  }

  const pickShotsDir = async (): Promise<void> => {
    const dir = await window.api.settings.pickShotsDir()
    if (!dir) return
    await updateSettings({ shotsDir: dir })
    await refreshShots()
    notify('截图目录已更新')
  }

  const recheck = async (): Promise<void> => {
    const next = await reloadStatus()
    notify(next?.adb.found ? `adb 已就绪 · ${next.adb.version || '版本未知'}` : '仍未找到 adb')
  }

  return (
    <div className="page is-active" data-page="settings">
      <div className="settings">
        <SetCard title="adb 环境" desc="未在 PATH 中找到时，可手动指定 adb 可执行文件">
          <div className="set-row">
            <div className="set-info">
              <div className="t">
                连接状态
                <Pill tone={adb?.found ? 'ok' : 'bad'}>
                  <Dot tone={adb?.found ? 'ok' : 'err'} />
                  {adb?.found ? '已就绪' : '未找到'}
                </Pill>
              </div>
              <div className="d">
                {adb?.found
                  ? `Android Debug Bridge · 平台 ${adb.version || '版本未知'}`
                  : adb?.error || '未检测到可用的 adb'}
              </div>
            </div>
            <div className="set-ctl">
              <Button size="sm" onClick={() => void recheck()}>
                <Icon name="refresh" size={12} />
                重新检测
              </Button>
            </div>
          </div>

          <div className="set-row">
            <div className="set-info">
              <div className="t">adb 路径</div>
              <div className="d">留空则自动从 PATH、ANDROID_HOME 中查找</div>
            </div>
            <div className="set-ctl">
              <span className="path" title={adbPathText}>
                {adbPathText}
              </span>
              <Button size="sm" onClick={() => void pickAdb()}>
                选择…
              </Button>
              {configuredPath && (
                <Button
                  variant="ghost"
                  size="sm"
                  title="恢复自动查找"
                  onClick={() => void resetAdb()}
                >
                  <Icon name="close" size={12} />
                </Button>
              )}
            </div>
          </div>
        </SetCard>

        <SetCard title="截图存储" desc="截图以「设备序列号_时间戳.png」命名，全部保存在本机">
          <div className="set-row">
            <div className="set-info">
              <div className="t">保存目录</div>
              <div className="d">默认保存在系统图片目录下的 ADB Desk 文件夹</div>
            </div>
            <div className="set-ctl">
              <span className="path" title={shotsDir}>
                {shotsDir || '图片 / ADB Desk'}
              </span>
              <Button size="sm" onClick={() => void pickShotsDir()}>
                更改…
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                title="打开目录"
                aria-label="打开目录"
                onClick={() => void window.api.settings.openShotsFolder()}
              >
                <Icon name="folder" size={12} />
              </Button>
            </div>
          </div>
        </SetCard>

        <SetCard title="外观" desc="跟随窗口独立保存，不影响系统主题">
          <div className="set-row">
            <div className="set-info">
              <div className="t">主题</div>
              <div className="d">深色模式适合夜间与长时间调试</div>
            </div>
            <div className="set-ctl">
              <Segmented
                ariaLabel="外观主题"
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'light', label: '浅色' },
                  { value: 'dark', label: '深色' }
                ]}
              />
            </div>
          </div>
        </SetCard>

        <SetCard title="快捷键" desc="键盘优先，减少鼠标往返">
          <div className="set-row">
            <div className="set-info">
              <div className="t">命令面板</div>
              <div className="d">搜索页面与命令，回车跳转</div>
            </div>
            <div className="set-ctl">
              <kbd>Ctrl</kbd>
              <kbd>K</kbd>
            </div>
          </div>
          <div className="set-row">
            <div className="set-info">
              <div className="t">运行当前命令</div>
              <div className="d">在命令台的任意输入框中生效</div>
            </div>
            <div className="set-ctl">
              <kbd>Ctrl</kbd>
              <kbd>↵</kbd>
            </div>
          </div>
          <div className="set-row">
            <div className="set-info">
              <div className="t">关闭浮层</div>
              <div className="d">命令面板与设备菜单</div>
            </div>
            <div className="set-ctl">
              <kbd>Esc</kbd>
            </div>
          </div>
        </SetCard>
      </div>
    </div>
  )
}
