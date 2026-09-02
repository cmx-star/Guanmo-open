import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { getCurrentWindow } from '@tauri-apps/api/window'
import DesktopApp from './DesktopApp.vue'
import { i18n } from './i18n'
import { installPrimeVue } from './plugins/primevue'
import './styles/global.css'

async function bootstrap(): Promise<void> {
  try {
    await getCurrentWindow().show()
  } catch (error) {
    console.error('[Startup] Failed to show main window:', error)
  }

  const app = createApp(DesktopApp)
  app.use(createPinia())
  app.use(i18n)
  installPrimeVue(app)
  app.mount('#root')
}

void bootstrap()
