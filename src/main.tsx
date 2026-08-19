import React from 'react'
import ReactDOM from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import App from '@app-entry'
import './styles/global.css'
import { isTauri } from './hooks/useTauri'
import { markStartupPoint } from './services/startupPerformance'

// ESM 先求值静态依赖（含 @app-entry）再执行本模块体：
// 以下两个点位在当前静态导入结构下代表同一“依赖图完成”边界，间隔不可再细分。
markStartupPoint('app-module-ready')
markStartupPoint('main-module-evaluated')
markStartupPoint('frontend-bootstrap')

if (isTauri()) {
  void getCurrentWindow().show().catch((error) => {
    console.error('[Startup] Failed to show main window:', error)
  })
}

const STARTUP_SHELL_ID = 'guanmo-startup-shell'

/**
 * 共享 React 接管边界：第一次真实 DOM commit 后的同一布局阶段幂等移除
 * index.html 中的静态 Startup Shell。React 初始化失败时 Shell 保留。
 */
function StartupShellBoundary({ children }: { children: React.ReactNode }) {
  React.useLayoutEffect(() => {
    markStartupPoint('react-mounted')
    document.getElementById(STARTUP_SHELL_ID)?.remove()
    markStartupPoint('startup-shell-removed')
  }, [])

  return <>{children}</>
}

markStartupPoint('create-root-start')
const root = ReactDOM.createRoot(document.getElementById('root')!)
markStartupPoint('react-render-start')
root.render(
  <React.StrictMode>
    <StartupShellBoundary>
      <App />
    </StartupShellBoundary>
  </React.StrictMode>,
)
