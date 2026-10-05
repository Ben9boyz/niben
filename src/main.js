import { createApp, defineAsyncComponent } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import { registerServiceWorker } from './composables/usePwa'
import { shell, enterPlayer } from './composables/useShell'
import { rememberTab } from './lib/nav'
import { startDomTranslate } from './lib/domTranslate'
import './style.css'
// Every page loads on demand: a panel (3D room) and a page (plain version) per route
const lazy = (panel, page, title) => ({ component: panel, meta: { page: defineAsyncComponent(page), title } })
const routes = [
  { path: '/', name: 'hjem', ...lazy(() => import('./panels/HomePanel.vue'), () => import('./pages/HomePage.vue'), 'Hjem') },
  { path: '/lytte', name: 'lytte', ...lazy(() => import('./panels/MusicPanel.vue'), () => import('./pages/MusicPage.vue'), 'Musikk') },
  { path: '/oppdag', name: 'oppdag', ...lazy(() => import('./panels/DiscoverPanel.vue'), () => import('./pages/DiscoverPage.vue'), 'Oppdag') },
  { path: '/ovelse', name: 'ovelse', ...lazy(() => import('./panels/PracticePanel.vue'), () => import('./pages/PracticePage.vue'), 'Gitar-øving') },
  { path: '/gitar', name: 'gitar', ...lazy(() => import('./panels/GuitarPanel.vue'), () => import('./pages/GuitarPage.vue'), 'Gitarer') },
  { path: '/boker', name: 'boker', ...lazy(() => import('./panels/BooksPanel.vue'), () => import('./pages/BooksPage.vue'), 'Bøker') },
  { path: '/reiser', name: 'reiser', ...lazy(() => import('./panels/TravelPanel.vue'), () => import('./pages/TravelPage.vue'), 'Reiser') },
  { path: '/kode', name: 'kode', ...lazy(() => import('./panels/CodePanel.vue'), () => import('./pages/CodePage.vue'), 'Prosjekter') },
  { path: '/gaming', name: 'gaming', ...lazy(() => import('./panels/GamingPanel.vue'), () => import('./pages/GamingPage.vue'), 'Spill') },
  { path: '/japansk', name: 'japansk', ...lazy(() => import('./panels/JapanPanel.vue'), () => import('./pages/JapanPage.vue'), 'Japansk') },
  { path: '/aaret', name: 'aaret', ...lazy(() => import('./panels/YearPanel.vue'), () => import('./pages/YearPage.vue'), 'Året') },
  { path: '/om', name: 'om', ...lazy(() => import('./panels/AboutPanel.vue'), () => import('./pages/AboutPage.vue'), 'Om meg') },
  { path: '/admin', name: 'admin', ...lazy(() => import('./panels/AdminPanel.vue'), () => import('./pages/AdminPage.vue'), 'Admin') },
  { path: '/na', redirect: '/' }, // "Nå" now lives on the home page
  // the music player on its own (also what the "niben musikk" app opens)
  { path: '/musicplayer', redirect: () => { enterPlayer(); return '/lytte' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// in player mode only the listening corner (and admin, for logging in) exists
router.beforeEach((to) => {
  if (shell.value === 'player' && to.name !== 'lytte' && to.name !== 'admin' && to.path !== '/musicplayer') return '/lytte'
})
router.afterEach((to) => {
  rememberTab(to.name)
  document.title = shell.value === 'player' ? 'niben musikk' : to.name === 'hjem' ? 'niben' : `${to.meta.title} · niben`
})

createApp(App).use(router).mount('#app')
startDomTranslate() // the page in the visitor's language (English unless they chose another)
registerServiceWorker()

// iOS Safari ignores user-scalable=no: stop the pinch gesture itself
for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, (e) => e.preventDefault(), { passive: false })

// count the visit once per browser session (never when this browser has been logged in as admin = me)
try {
  if (!localStorage.getItem('niben-me') && !sessionStorage.getItem('niben-counted') && !window.nibenApp) {
    sessionStorage.setItem('niben-counted', '1')
    setTimeout(() => fetch('api.php?action=visit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Niben': '1' }, body: JSON.stringify({ path: (location.hash || '#/').slice(1) }), keepalive: true }).catch(() => {}), 1500)
  }
} catch {}
