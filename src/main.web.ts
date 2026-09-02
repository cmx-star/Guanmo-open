import { createApp } from 'vue'
import { createPinia } from 'pinia'
import WebApp from './WebApp.vue'
import { webI18n } from './i18n/web'
import { applyDocumentTheme, resolvePersistedTheme } from './theme/theme'
import './styles/vue-app.css'

applyDocumentTheme(resolvePersistedTheme())
document.getElementById('guanmo-startup-shell')?.remove()

const app = createApp(WebApp)

app.use(createPinia())
app.use(webI18n)
app.mount('#root')
