<script setup lang="ts">
import { computed } from 'vue'
import { onMounted } from 'vue'
import { rooms, hall, loadHall, searchHall, pageHall, enterRoom } from '@/composables/room/useRooms'

defineProps<{ compact?: boolean }>()
const hue = (s: string): number => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360 }
const list = computed(() => hall.items)
onMounted(() => { if (!hall.loaded) void loadHall() })
const from = computed(() => (hall.total ? hall.offset + 1 : 0))
const to = computed(() => hall.offset + hall.items.length)
</script>

<template>
  <div class="hall">
  <label v-if="hall.total > 6 || hall.q" class="find"><span class="sr">Søk etter et rom</span><input type="search" :value="hall.q" placeholder="Søk etter et rom …" autocomplete="off" @input="searchHall(($event.target as HTMLInputElement).value)" /></label>
  <p v-if="hall.loaded && !list.length" class="none">Ingen rom med det navnet.</p>
  <ul class="doors" :class="{ compact, busy: hall.busy }">
    <li v-for="r in list" :key="r.username">
      <button class="door" :class="{ here: r.username === rooms.current }" :style="{ '--h': hue(r.username) }" :data-room="r.username" @click="enterRoom(r.username)">
        <span class="frame" :class="{ art: r.door }" :style="r.door ? { backgroundImage: `url(${r.door})` } : undefined">
          <span v-if="!r.door" class="pic">
            <img v-if="r.photo" :src="r.photo" alt="" loading="lazy" />
            <b v-else>{{ r.username[0]?.toUpperCase() }}</b>
          </span>
          <span class="knob"></span>
        </span>
        <span class="name">{{ r.owner ? 'Mitt rom' : r.username }}</span>
        <span class="tag">{{ r.username === rooms.current ? 'Du er her' : r.tagline || 'Gå inn' }}</span>
      </button>
    </li>
  </ul>
  <nav v-if="hall.total > hall.limit" class="pager" aria-label="Sider med dører">
    <button type="button" :disabled="hall.offset === 0 || hall.busy" @click="pageHall(-1)">‹ Forrige</button>
    <span>{{ from }}–{{ to }} av {{ hall.total }}</span>
    <button type="button" :disabled="to >= hall.total || hall.busy" @click="pageHall(1)">Neste ›</button>
  </nav>
  </div>
</template>

<style scoped>
.hall { display: flex; flex-direction: column; gap: 14px; }
.find input { width: 100%; box-sizing: border-box; height: 48px; padding: 0 16px; border: 0; border-radius: 14px; background: var(--sk-sunk, var(--bg)); box-shadow: var(--sk-sunk-sh, inset 0 0 0 1px var(--glass-border)); color: var(--text); font: inherit; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.none { margin: 0; color: var(--text-3); }
.busy { opacity: 0.6; transition: opacity 0.2s; }
.pager { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.85rem; color: var(--text-3); }
.pager button { all: unset; cursor: pointer; min-height: 40px; display: inline-flex; align-items: center; padding: 0 16px; border-radius: 13px; background: var(--sk-key, var(--glass-strong)); box-shadow: var(--sk-key-sh, inset 0 0 0 1px var(--glass-border)); color: var(--text); font-weight: 700; } .pager button:disabled { opacity: 0.4; cursor: default; }
.doors { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 22px 16px; }
.compact { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 16px 10px; }
.door { all: unset; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; cursor: pointer; text-align: center; }
/* an arched door in the owner's colour, lit from the top left like everything else */
.frame { position: relative; width: 100%; aspect-ratio: 1 / 1.6; max-height: 230px; border-radius: 999px 999px 10px 10px; background: hsl(var(--h) 32% 52%); box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.3), inset 0 -5px 0 rgba(0, 0, 0, 0.12), 6px 10px 20px rgba(60, 40, 20, 0.3); display: grid; place-items: start center; padding-top: 22%; transition: transform 0.45s var(--spring, ease), box-shadow 0.3s; transform-origin: 0 50%; }
.frame.art { background-size: cover; background-position: center; }
.frame.art::after { display: none; }
.frame::after { content: ''; position: absolute; inset: 56% 18% 10%; border-radius: 8px; background: rgba(0, 0, 0, 0.08); box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.12); }
.pic { width: 42%; aspect-ratio: 1; border-radius: 50%; overflow: hidden; background: hsl(var(--h) 45% 66%); display: grid; place-items: center; box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.7), 0 4px 8px rgba(0, 0, 0, 0.2); z-index: 1; }
.pic img { width: 100%; height: 100%; object-fit: cover; }
.pic b { color: #fff; font-size: 1.6rem; }
.knob { position: absolute; right: 11%; top: 52%; width: 10px; height: 10px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #fff3c4, #c99a2e); z-index: 1; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4); }
.door:hover .frame, .door:focus-visible .frame { transform: perspective(600px) rotateY(-24deg); box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.3), 14px 12px 28px rgba(60, 40, 20, 0.35); }
.here .frame::before { content: ''; position: absolute; top: 10px; left: 50%; width: 8px; height: 8px; margin-left: -4px; border-radius: 50%; background: #22a35a; box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.6), 0 0 10px #22c55e; z-index: 2; }
.door:focus-visible .frame { outline: 3px solid var(--accent, #2b8cff); outline-offset: 3px; }
.name { font-weight: 800; color: var(--text); overflow-wrap: anywhere; }
.tag { font-size: 0.8rem; color: var(--text-3); overflow-wrap: anywhere; }
.here .tag { color: #1db954; font-weight: 700; }
@media (prefers-reduced-motion: reduce) { .frame { transition: none; } }
</style>
