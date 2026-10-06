<script setup lang="ts">
import NavBar from '@/components/layout/NavBar.vue'
import MusicToast from '@/components/music/MusicToast.vue'
import { useMediaSession } from '@/composables/music/useMediaSession'
import { defineAsyncComponent } from 'vue'
import SubTabs from '@/components/layout/SubTabs.vue'
import DropTray from '@/components/music/DropTray.vue'
import GlobalMini from '@/components/music/GlobalMini.vue'
import ShortcutsHelp from '@/components/layout/ShortcutsHelp.vue'
import GraphicsSettings from '@/components/layout/GraphicsSettings.vue'
import LangSuggest from '@/components/layout/LangSuggest.vue'
import SlowSuggest from '@/components/layout/SlowSuggest.vue'
import ContextMenu from '@/components/layout/ContextMenu.vue'
import NewPlaylistDialog from '@/components/music/NewPlaylistDialog.vue'
import WeatherFx from '@/components/layout/WeatherFx.vue'
import { useRoute } from 'vue-router'
// three.js and the whole room are only fetched when the 3D version is used
const RoomLayout = defineAsyncComponent(() => import('@/components/room/RoomLayout.vue'))
import { useData } from '@/composables/site/useData'
import { mode } from '@/composables/ui/useMode'
import { useAccent } from '@/composables/ui/useAccent'
import { shell } from '@/composables/ui/useShell'
import PlayerTop from '@/components/layout/PlayerTop.vue'

const data = useData()
useMediaSession()
useAccent() // the room's own accent colour (Admin → Profil)
const route = useRoute()
const toTop = () => window.scrollTo(0, 0)

</script>

<template>
  <RoomLayout v-if="mode === 'rom' && shell !== 'player'" />

  <template v-else>
    <div class="backdrop" aria-hidden="true">
      <div class="blob b1"></div>
      <div class="blob b2"></div>
      <div class="blob b3"></div>
    </div>
    <WeatherFx />
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
  <DropTray />
  <ShortcutsHelp />
  <GraphicsSettings />
  <LangSuggest />
  <SlowSuggest />
  <ContextMenu />
  <NewPlaylistDialog />
  <GlobalMini v-if="mode !== 'rom' || shell === 'player'" :show="route.name !== 'lytte' && route.name !== 'admin'" />
  <NavBar v-if="shell !== 'player'" />
  <template v-else>
    <PlayerTop />
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
.flat-tabs { position: sticky; top: 16px; z-index: 30; margin: 24px auto 0; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
@media (max-width: 720px) {
  /* under the top bar, and it stays there while the page scrolls */
  .flat-tabs { position: sticky; top: calc(68px + env(safe-area-inset-top)); z-index: 30; margin: calc(68px + env(safe-area-inset-top)) auto 0; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
}
</style>
