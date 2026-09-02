import { createI18n } from 'vue-i18n'
import { messages } from './messages'

function resolveInitialLocale(): 'zh-CN' | 'en-US' {
  if (typeof localStorage === 'undefined') return 'zh-CN'
  return localStorage.getItem('guanmo-locale') === 'en-US' ? 'en-US' : 'zh-CN'
}

/** 桌面端完整消息。 */
export const i18n = createI18n({
  legacy: false,
  locale: resolveInitialLocale(),
  fallbackLocale: 'zh-CN',
  messages,
})
