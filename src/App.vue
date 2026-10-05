<script setup>
import NavBar from './components/NavBar.vue'
import MusicToast from './components/MusicToast.vue'
import { defineAsyncComponent } from 'vue'
import SubTabs from './components/SubTabs.vue'
// three.js and the whole room are only fetched when the 3D version is used
const RoomLayout = defineAsyncComponent(() => import('./components/RoomLayout.vue'))
import { useData } from './composables/useData'
import { mode } from './composables/useMode'
import { shell } from './composables/useShell'
import PlayerTop from './components/PlayerTop.vue'
import PlayerBar from './components/PlayerBar.vue'

const data = useData()
const toTop = () => window.scrollTo(0, 0)

</script>

<template>
  <RoomLayout v-if="mode === 'rom'" />

  <template v-else>
    <div class="backdrop" aria-hidden="true">
      <div class="blob b1"></div>
      <div class="blob b2"></div>
      <div class="blob b3"></div>
    </div>
    <main>
      <SubTabs class="flat-tabs" />
      <router-view v-slot="{ route: r }">
        <transition name="page" mode="out-in" type="transition" @before-enter="toTop">
          <component :is="r.meta.page" :key="r.path" />
        </transition>
      </router-view>
    </main>
  </template>

  <MusicToast />
  <NavBar v-if="shell !== 'player'" />
  <template v-else>
    <PlayerTop />
    <PlayerBar />
  </template>
  <p v-if="data.error" class="data-error glass">Kunne ikke laste innholdet (data.json): {{ data.error }}</p>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; z-index: -1; overflow: hidden; background: radial-gradient(1200px 800px at 50% -10%, var(--bg-2), transparent 70%), var(--bg); }
.blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.7; }
.b1 { width: 55vmax; height: 55vmax; left: -12vmax; top: -18vmax; background: radial-gradient(circle at 30% 30%, var(--blob-1), transparent 65%); animation: drift1 26s ease-in-out infinite alternate; }
.b2 { width: 48vmax; height: 48vmax; right: -14vmax; top: 10vh; background: radial-gradient(circle at 60% 40%, var(--blob-2), transparent 65%); animation: drift2 32s ease-in-out infinite alternate; }
.b3 { width: 42vmax; height: 42vmax; left: 20vw; bottom: -22vmax; background: radial-gradient(circle at 50% 50%, var(--blob-3), transparent 65%); animation: drift3 28s ease-in-out infinite alternate; }
@keyframes drift1 { to { transform: translate(14vw, 10vh) scale(1.15); } }
@keyframes drift2 { to { transform: translate(-12vw, 16vh) scale(0.9); } }
@keyframes drift3 { to { transform: translate(-10vw, -12vh) scale(1.2); } }
.data-error { position: fixed; top: 24px; left: 50%; transform: translateX(-50%); padding: 12px 20px; border-radius: 999px; z-index: 50; color: #d33; font-size: 0.9rem; }
.flat-tabs { margin: 24px auto -14px; }
@media (max-width: 720px) { .flat-tabs { margin: 76px auto -60px; } }
</style>
