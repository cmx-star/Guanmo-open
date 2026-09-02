import { createI18n } from 'vue-i18n'
import { baseMessages } from './messages.base'

function resolveInitialLocale(): 'zh-CN' | 'en-US' {
  if (typeof localStorage === 'undefined') return 'zh-CN'
  return localStorage.getItem('guanmo-locale') === 'en-US' ? 'en-US' : 'zh-CN'
}

/** Web 展示页仅加载基础消息子集，控制入口体积（预算 180 KB）。 */
export const webI18n = createI18n({
  legacy: false,
  locale: resolveInitialLocale(),
  fallbackLocale: 'zh-CN',
  messages: baseMessages,
})
