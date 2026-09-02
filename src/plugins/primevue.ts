import type { App } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'

const GuanmoPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: 'var(--gm-primary-subtle)',
      100: 'var(--gm-primary-subtle)',
      200: 'var(--gm-primary-subtle)',
      300: 'var(--gm-primary-hover)',
      400: 'var(--gm-primary-hover)',
      500: 'var(--gm-primary)',
      600: 'var(--gm-primary)',
      700: 'var(--gm-primary-hover)',
      800: 'var(--gm-primary-active)',
      900: 'var(--gm-primary-active)',
      950: 'var(--gm-primary-active)',
    },
    focusRing: {
      color: 'var(--gm-focus)',
      width: '2px',
      style: 'solid',
      offset: '2px',
    },
    formField: {
      borderRadius: 'var(--gm-radius-md)',
      background: 'var(--gm-surface)',
      borderColor: 'var(--gm-border)',
      hoverBorderColor: 'var(--gm-border-strong)',
      focusBorderColor: 'var(--gm-focus)',
      color: 'var(--gm-text)',
      placeholderColor: 'var(--gm-text-muted)',
    },
    content: {
      borderRadius: 'var(--gm-radius-md)',
      background: 'var(--gm-surface)',
      hoverBackground: 'var(--gm-surface-muted)',
      borderColor: 'var(--gm-border)',
      color: 'var(--gm-text)',
      hoverColor: 'var(--gm-text)',
    },
    text: {
      color: 'var(--gm-text)',
      hoverColor: 'var(--gm-text)',
      mutedColor: 'var(--gm-text-muted)',
      hoverMutedColor: 'var(--gm-text-secondary)',
    },
    overlay: {
      select: {
        background: 'var(--gm-surface-overlay)',
        borderColor: 'var(--gm-border)',
        color: 'var(--gm-text)',
      },
      popover: {
        background: 'var(--gm-surface-overlay)',
        borderColor: 'var(--gm-border)',
        color: 'var(--gm-text)',
      },
      modal: {
        background: 'var(--gm-surface-overlay)',
        borderColor: 'var(--gm-border)',
        color: 'var(--gm-text)',
      },
    },
  },
})

export function installPrimeVue(app: App): void {
  app.use(PrimeVue, {
    theme: {
      preset: GuanmoPreset,
      options: {
        darkModeSelector: '[data-theme-id="ink-dark"]',
      },
    },
  })
}
