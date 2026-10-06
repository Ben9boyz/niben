import { room } from '@/composables/room/useRoom'
import { createApp, defineAsyncComponent, type AsyncComponentLoader, type Component } from 'vue'
import { createRouter, createWebHashHistory, type RouteMeta, type RouteRecordRaw } from 'vue-router'
import App from './App.vue'
import { registerServiceWorker } from '@/composables/ui/usePwa'
import { shell, enterPlayer } from '@/composables/ui/useShell'
import { rememberTab } from './lib/nav'
import { routeAllowed } from './lib/sections'
import { routeKey } from './lib/nav'
import { loadDecor } from './composables/room/useDecor'
import { useData } from '@/composables/site/useData'
import { watch } from 'vue'
import { startDomTranslate } from './lib/domTranslate'
import './style.css'
// Every page loads on demand: a panel (3D room) and a page (plain version) per route
const preloads: (() => Promise<unknown>)[] = []
const lazy = (panel: () => Promise<Component>, page: AsyncComponentLoader, title: string): { component: () => Promise<Component>; meta: RouteMeta } => { preloads.push(panel, page as () => Promise<unknown>); return { component: panel, meta: { page: defineAsyncComponent(page), title } } }
const routes: RouteRecordRaw[] = [
  { path: '/', name: 'hjem', ...lazy(() => import('./panels/HomePanel.vue'), () => import('./pages/HomePage.vue'), 'Hjem') },
  { path: '/lytte', name: 'lytte', ...lazy(() => import('./panels/MusicPanel.vue'), () => import('./pages/MusicPage.vue'), 'Musikk') },
  { path: '/oppdag', redirect: () => { room.discover = true; return '/lytte' } }, // (old link: Oppdag is a view inside the listening corner now)
  { path: '/ovelse', name: 'ovelse', ...lazy(() => import('./panels/PracticePanel.vue'), () => import('./pages/PracticePage.vue'), 'Gitar-øving') },
  { path: '/gitar', name: 'gitar', ...lazy(() => import('./panels/GuitarPanel.vue'), () => import('./pages/GuitarPage.vue'), 'Gitarer') },
  { path: '/figurer', name: 'figurer', ...lazy(() => import('./panels/FigurePanel.vue'), () => import('./pages/FigurePage.vue'), 'Figurer') },
  { path: '/boker', name: 'boker', ...lazy(() => import('./panels/BooksPanel.vue'), () => import('./pages/BooksPage.vue'), 'Bøker') },
  { path: '/reiser', name: 'reiser', ...lazy(() => import('./panels/TravelPanel.vue'), () => import('./pages/TravelPage.vue'), 'Reiser') },
  { path: '/kode', name: 'kode', ...lazy(() => import('./panels/CodePanel.vue'), () => import('./pages/CodePage.vue'), 'Prosjekter') },
  { path: '/gaming', name: 'gaming', ...lazy(() => import('./panels/GamingPanel.vue'), () => import('./pages/GamingPage.vue'), 'Spill') },
  { path: '/japansk', name: 'japansk', ...lazy(() => import('./panels/JapanPanel.vue'), () => import('./pages/JapanPage.vue'), 'Japansk') },
  { path: '/aaret', name: 'aaret', ...lazy(() => import('./panels/YearPanel.vue'), () => import('./pages/YearPage.vue'), 'Året') },
  { path: '/vurderinger', name: 'vurderinger', ...lazy(() => import('./panels/RatingsPanel.vue'), () => import('./pages/RatingsPage.vue'), 'Vurderinger') },
  { path: '/h/:id', name: 'modul', ...lazy(() => import('./panels/ModulePanel.vue'), () => import('./pages/ModulePage.vue'), 'Hobby') },
  { path: '/gangen', name: 'gangen', ...lazy(() => import('./panels/GangenPanel.vue'), () => import('./pages/GangenPage.vue'), 'Gangen') },
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
  rememberTab(routeKey(to))
  document.title = shell.value === 'player' ? 'niben musikk' : to.name === 'hjem' ? 'niben' : `${to.meta.title} · niben`
})

createApp(App).use(router).mount('#app')
void loadDecor() // (the hobby modules live in this list: the menu and the module pages need it in the plain version too)
// a corner that is switched off in this room: its page is not there (also when the address was typed in)
const roomData = useData()
watch([() => roomData.profile, () => router.currentRoute.value.name], () => { if (!routeAllowed(router.currentRoute.value.name, roomData.profile)) void router.replace('/') }, { deep: true })
// when the page has settled: fetch the other pages' code quietly, one by one – so a click on a tab never waits for it
{
  let k = 0
  const next = (): void => { if (k < preloads.length && !document.hidden) void preloads[k++]().catch(() => undefined).finally(() => setTimeout(next, 120)) }
  window.addEventListener('load', () => setTimeout(next, 2500), { once: true })
}
startDomTranslate() // the page in the visitor's language (English unless they chose another)
registerServiceWorker()

// iOS Safari ignores user-scalable=no: stop the pinch gesture itself
for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, (e) => { e.preventDefault() }, { passive: false })

// count the visit once per browser session (never when this browser has been logged in as admin = me)
try {
  if (!localStorage.getItem('niben-me') && !sessionStorage.getItem('niben-counted') && !window.nibenApp) {
    sessionStorage.setItem('niben-counted', '1')
    setTimeout(() => void fetch('api.php?action=visit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Niben': '1' }, body: JSON.stringify({ path: (location.hash || '#/').slice(1) }), keepalive: true }).catch(() => {}), 1500)
  }
} catch { /* private mode: not counted */ }
