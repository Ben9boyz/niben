<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Box, Share2, PenLine, DoorOpen } from 'lucide-vue-next'
import { tx } from '@/composables/site/useTexts'
import NowContent from '@/components/content/NowContent.vue'
import MadeWith from '@/components/ui/MadeWith.vue'
import { useData } from '@/composables/site/useData'
import { admin } from '@/composables/site/useAdmin'
import { toggleMode } from '@/composables/ui/useMode'
import { rooms, hall, loadHall, enterRoom } from '@/composables/room/useRooms'

// The front page, laid out like the sketch: the page is one object with a band on top (where you are · share / edit),
// the greeting with the photo set into the surface, then "Akkurat nå", and at the bottom a window into the 3D room
// beside the hall's doors – the two ways on from here.
const data = useData()
const router = useRouter()
const roomName = computed(() => rooms.current || data.profile.username || '')
const shared = ref(false)
async function share() {
  try { await navigator.clipboard.writeText(location.href.split('#')[0] + '#/'); shared.value = true; setTimeout(() => (shared.value = false), 1600) } catch { /* no clipboard: nothing to do */ }
}
// a few doors from the hall (the other rooms), each in a colour of its own, picked from the name so it stays the same
onMounted(() => { if (!hall.loaded) void loadHall() })
const doors = computed(() => hall.items.filter((r) => r.username !== rooms.current).slice(0, 3))
const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
</script>

<template>
  <div class="cpage home">
    <section class="pagecard rise">
      <div class="band">
        <span class="here"><span class="pip" aria-hidden="true"></span>{{ roomName ? `Rommet til ${roomName}` : 'Rommet' }}</span>
        <div class="acts">
          <button type="button" class="btn small" @click="share"><Share2 :size="15" aria-hidden="true" />{{ shared ? 'Lenken er kopiert' : 'Del' }}</button>
          <router-link v-if="admin.mine" to="/admin" class="btn small"><PenLine :size="15" aria-hidden="true" />Rediger rommet</router-link>
        </div>
      </div>
      <div class="hero">
        <span v-if="data.om?.bilde" class="socket"><img :src="data.om.bilde" alt="" class="avatar" /></span>
        <div class="words">
          <div class="eyebrow">{{ tx('home.eyebrow', data.site?.undertittel) }}</div>
          <h1>{{ tx('home.hello') }} <span class="name">{{ tx('home.name', data.site?.navn) }}</span></h1>
          <p class="lead">{{ tx('home.intro', data.site?.intro) }}</p>
          <div class="cta">
            <button type="button" class="btn primary" @click="toggleMode"><Box :size="17" aria-hidden="true" />Gå inn i 3D</button>
            <router-link to="/gangen" class="btn"><DoorOpen :size="17" aria-hidden="true" />Gangen</router-link>
          </div>
        </div>
      </div>
    </section>

    <h2 class="now-title rise" style="--i: 2">{{ tx('home.now') }}</h2>
    <div class="rise" style="--i: 3"><NowContent /></div>

    <!-- the two ways on: into the room, or out to the hall -->
    <section class="onward rise" style="--i: 4">
      <button type="button" class="window" aria-label="Gå inn i 3D-rommet" @click="toggleMode">
        <span class="screen"><span class="floor" aria-hidden="true"></span><span class="chip"><span class="pip" aria-hidden="true"></span>Gå inn i rommet</span></span>
      </button>
      <div class="hall">
        <span class="cap">Gangen</span>
        <div class="doors">
          <button v-for="r in doors" :key="r.username" type="button" class="door" :style="{ '--door': `hsl(${hue(r.username)} 32% 52%)` }" :aria-label="`Gå inn til ${r.username}`" @click="enterRoom(r.username)">
            <span class="leaf"><span class="knob" aria-hidden="true"></span></span>
            <small translate="no">{{ r.username }}</small>
          </button>
          <button type="button" class="door more" aria-label="Se alle rommene i Gangen" @click="router.push('/gangen')">
            <span class="leaf"><span class="knob" aria-hidden="true"></span></span>
            <small>{{ doors.length ? 'Flere' : 'Finn et rom' }}</small>
          </button>
        </div>
        <p class="hint">Hold over en dør – den åpner seg litt.</p>
      </div>
    </section>
    <MadeWith />
  </div>
</template>

<style scoped>
.home { display: flex; flex-direction: column; gap: 0; }
/* the page as one object: a band on top, the greeting under it */
.pagecard { border-radius: 32px; overflow: hidden; margin: 8px 0 30px; background: var(--sk-surface, var(--glass-strong)); border: var(--sk-border, 1px solid var(--glass-border)); box-shadow: var(--sk-surface-sh, var(--shadow-2)); }
.band { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px 12px 24px; border-bottom: 1px solid var(--glass-border); font-weight: 700; font-size: 0.9rem; }
.here { display: inline-flex; align-items: center; gap: 9px; color: var(--text-2); }
.acts { display: flex; flex-wrap: wrap; gap: 8px; }
.acts .btn { min-height: 40px; padding: 0 14px; text-decoration: none; }
/* in the colourful styles the band is made of the room's colour */
:root[data-skin="clay"] .band, :root[data-skin="skeu"] .band, :root[data-skin="flat"] .band, :root[data-skin="glass"] .band { background: var(--sk-primary); color: var(--sk-on-primary); border-bottom: 0; }
:root[data-skin="clay"] .band .here, :root[data-skin="skeu"] .band .here, :root[data-skin="flat"] .band .here, :root[data-skin="glass"] .band .here { color: inherit; }
.pip { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: var(--sk-glow, 0 0 0 3px var(--accent-soft)); flex: none; }
.band .pip { background: #22a35a; box-shadow: 0 0 0 3px rgba(34, 163, 90, 0.2); }

.hero { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 34px; align-items: center; padding: 34px 40px 40px; }
.socket { display: grid; place-items: center; width: 156px; height: 156px; border-radius: 46px; background: var(--sk-sunk, var(--bg-2)); box-shadow: var(--sk-sunk-sh, inset 0 2px 6px rgba(0, 0, 0, 0.15)); }
.avatar { width: 128px; height: 128px; border-radius: 38px; object-fit: cover; box-shadow: 0 12px 22px -10px rgba(40, 25, 10, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
.words { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.words .eyebrow { margin: 0; }
h1 { font-size: clamp(2.2rem, 5vw, 3.6rem); font-weight: 800; line-height: 1.04; letter-spacing: -0.03em; text-wrap: balance; }
.name { color: var(--accent-ink); }
.lead { max-width: 58ch; margin: 0; }
.cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; }
.cta .btn { min-height: 48px; padding: 0 22px; text-decoration: none; }
.now-title { margin: 0 0 12px 4px; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-3); }

/* the window into the 3D room, and the hall's doors */
.onward { display: grid; grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr); gap: 20px; margin-top: 22px; }
.window { display: block; padding: 14px; border: 0; border-radius: 30px; cursor: pointer; background: var(--sk-surface, var(--glass-strong)); box-shadow: var(--sk-surface-sh, var(--shadow-2)); text-align: left; }
.screen { position: relative; display: block; height: 230px; overflow: hidden; border-radius: 20px; background: linear-gradient(180deg, var(--bg), var(--bg-2)); box-shadow: var(--sk-sunk-sh, inset 0 3px 10px rgba(0, 0, 0, 0.18)); }
.floor { position: absolute; left: 50%; bottom: -60px; width: 520px; height: 220px; margin-left: -260px; border-radius: 8px; background: repeating-linear-gradient(90deg, #c9a37a 0 46px, #bd966c 46px 48px); transform: perspective(500px) rotateX(58deg); transition: transform 0.6s var(--spring); }
.window:hover .floor { transform: perspective(500px) rotateX(52deg) scale(1.04); }
.chip { position: absolute; left: 16px; top: 16px; display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px; border-radius: 13px; font: 700 0.84rem var(--font); color: var(--text); background: var(--sk-key, var(--glass-strong)); box-shadow: var(--sk-key-sh, var(--shadow-1)); }
.hall { display: flex; flex-direction: column; gap: 12px; padding: 20px; border-radius: 28px; background: var(--sk-surface, var(--glass-strong)); box-shadow: var(--sk-surface-sh, var(--shadow-2)); }
.cap { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: var(--text-3); }
.doors { display: flex; gap: 12px; perspective: 600px; }
.door { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0; border: 0; background: none; color: var(--text); cursor: pointer; font: 700 0.8rem var(--font); }
.door small { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.78rem; }
.leaf { position: relative; display: block; width: 100%; height: 120px; border-radius: 50px 50px 8px 8px; transform-origin: left center; transition: transform 0.45s var(--spring); background: var(--door, #a07a55); box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.3), inset 0 -4px 0 rgba(0, 0, 0, 0.12), 5px 8px 16px rgba(60, 40, 20, 0.28); }
.door.more .leaf { background: var(--sk-sunk, var(--bg-2)); box-shadow: var(--sk-sunk-sh, inset 0 2px 6px rgba(0, 0, 0, 0.15)); }
.door:hover .leaf, .door:focus-visible .leaf { transform: rotateY(-24deg); }
.knob { position: absolute; right: 10px; top: 52%; width: 8px; height: 8px; border-radius: 50%; background: rgba(0, 0, 0, 0.28); }
.hint { margin: 0; font-size: 0.8rem; color: var(--text-3); }

@media (max-width: 900px) { .onward { grid-template-columns: 1fr; } }
/* phones: compact – the photo beside the greeting, "Akkurat nå" on the first screen */
@media (max-width: 720px) {
  .pagecard { margin: 0 0 22px; border-radius: 24px; }
  .band { padding: 10px 12px 10px 16px; font-size: 0.82rem; }
  .hero { grid-template-columns: auto minmax(0, 1fr); gap: 14px; padding: 18px 16px 20px; align-items: start; }
  .socket { width: 72px; height: 72px; border-radius: 24px; }
  .avatar { width: 60px; height: 60px; border-radius: 19px; }
  .words .eyebrow { display: none; }
  h1 { font-size: 1.8rem; }
  .lead { font-size: 0.95rem; }
  .cta .btn { min-height: 44px; padding: 0 16px; }
  .screen { height: 160px; }
}
@media (prefers-reduced-motion: reduce) { .leaf, .floor { transition: none; } }
</style>
