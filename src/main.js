import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import { registerServiceWorker } from './composables/usePwa'
import { shell, enterPlayer } from './composables/useShell'
import './style.css'
import HomePanel from './panels/HomePanel.vue'
import GuitarPanel from './panels/GuitarPanel.vue'
import BooksPanel from './panels/BooksPanel.vue'
import TravelPanel from './panels/TravelPanel.vue'
import CodePanel from './panels/CodePanel.vue'
import AboutPanel from './panels/AboutPanel.vue'
import PracticePanel from './panels/PracticePanel.vue'
import AdminPanel from './panels/AdminPanel.vue'
import HomePage from './pages/HomePage.vue'
import PracticePage from './pages/PracticePage.vue'
import GuitarPage from './pages/GuitarPage.vue'
import BooksPage from './pages/BooksPage.vue'
import TravelPage from './pages/TravelPage.vue'
import CodePage from './pages/CodePage.vue'
import AboutPage from './pages/AboutPage.vue'
import AdminPage from './pages/AdminPage.vue'
import MusicPanel from './panels/MusicPanel.vue'
import MusicPage from './pages/MusicPage.vue'
import JapanPanel from './panels/JapanPanel.vue'
import JapanPage from './pages/JapanPage.vue'
import GamingPanel from './panels/GamingPanel.vue'
import GamingPage from './pages/GamingPage.vue'
import NowPanel from './panels/NowPanel.vue'
import NowPage from './pages/NowPage.vue'

const routes = [
  { path: '/', name: 'hjem', component: HomePanel, meta: { page: HomePage, title: 'Hjem' } },
  { path: '/na', name: 'na', component: NowPanel, meta: { page: NowPage, title: 'Nå' } },
  { path: '/lytte', name: 'lytte', component: MusicPanel, meta: { page: MusicPage, title: 'Musikk' } },
  { path: '/ovelse', name: 'ovelse', component: PracticePanel, meta: { page: PracticePage, title: 'Øving' } },
  { path: '/gitar', name: 'gitar', component: GuitarPanel, meta: { page: GuitarPage, title: 'Gitar' } },
  { path: '/boker', name: 'boker', component: BooksPanel, meta: { page: BooksPage, title: 'Bøker' } },
  { path: '/reiser', name: 'reiser', component: TravelPanel, meta: { page: TravelPage, title: 'Reiser' } },
  { path: '/kode', name: 'kode', component: CodePanel, meta: { page: CodePage, title: 'Kode' } },
  { path: '/gaming', name: 'gaming', component: GamingPanel, meta: { page: GamingPage, title: 'Gaming' } },
  { path: '/japansk', name: 'japansk', component: JapanPanel, meta: { page: JapanPage, title: 'Japansk' } },
  { path: '/om', name: 'om', component: AboutPanel, meta: { page: AboutPage, title: 'Om meg' } },
  { path: '/admin', name: 'admin', component: AdminPanel, meta: { page: AdminPage, title: 'Admin' } },
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
  document.title = shell.value === 'player' ? 'niben musikk' : to.name === 'hjem' ? 'niben' : `${to.meta.title} · niben`
})

createApp(App).use(router).mount('#app')
registerServiceWorker()
