import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useThemeStore } from './stores/theme'
import './styles/global.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// data-theme must be set before anything renders: the `dark:` variant keys on it alone.
useThemeStore(pinia).initializeTheme()
// The router guard waits for this first refresh before deciding on protected routes.
void useAuthStore(pinia).tryInitialLogin()

app.use(router)
app.mount('#app')
