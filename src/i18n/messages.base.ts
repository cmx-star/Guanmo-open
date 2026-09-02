// 仅 Web 展示页使用的基础消息子集。完整消息见 messages.ts（桌面端）。
// 保持此文件精简以控制 Web 入口体积（预算 180 KB）。
export const baseMessages = {
  'zh-CN': {
    app: {
      name: '观墨',
      tagline: 'AI Markdown 知识管理',
    },
    common: {
      closeNotification: '关闭提示',
      close: '关闭',
      open: '打开',
      save: '保存',
      export: '导出',
      search: '搜索',
      settings: '设置',
      retry: '重试',
      loading: '正在读取…',
      unavailableInBrowser: '浏览器模式下不可用，请下载桌面版',
      localFilesUnavailable: '浏览器模式下本地文件列表不可用',
      downloadDesktop: '请下载桌面版体验完整功能',
    },
    menu: {
      product: '产品',
      learn: '了解观墨',
      download: '下载桌面版',
    },
    web: {
      title: '桌面端，才是完整的观墨。',
      description: '本地文件管理、知识库与 AI 工作流需要桌面端权限，Web 页面只保留产品信息与主题、语言偏好。',
      desktopOnly: '完整能力仅在桌面端提供',
      switchTheme: '切换主题',
      switchLanguage: '切换语言',
    },
  },
  'en-US': {
    app: {
      name: 'Guanmo',
      tagline: 'AI Markdown knowledge workspace',
    },
    common: {
      closeNotification: 'Dismiss notification',
      close: 'Close',
      open: 'Open',
      save: 'Save',
      export: 'Export',
      search: 'Search',
      settings: 'Settings',
      retry: 'Retry',
      loading: 'Loading…',
      unavailableInBrowser: 'Unavailable in browser mode. Download the desktop app.',
      localFilesUnavailable: 'Local file lists are unavailable in browser mode.',
      downloadDesktop: 'Download the desktop app for the full experience.',
    },
    menu: {
      product: 'Product',
      learn: 'About Guanmo',
      download: 'Download desktop app',
    },
    web: {
      title: 'The full Guanmo experience lives on desktop.',
      description: 'Local files, knowledge bases, and AI workflows require desktop permissions. This page keeps only product information and display preferences.',
      desktopOnly: 'Full features are available on desktop',
      switchTheme: 'Switch theme',
      switchLanguage: 'Switch language',
    },
  },
} as const
