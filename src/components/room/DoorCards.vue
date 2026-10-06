<script setup lang="ts">
import { computed } from 'vue'
import { rooms, enterRoom } from '@/composables/room/useRooms'

defineProps<{ compact?: boolean }>()
const hue = (s: string): number => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360 }
const list = computed(() => rooms.list)
</script>

<template>
  <ul class="doors" :class="{ compact }">
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
</template>

<style scoped>
.doors { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 22px 16px; }
.compact { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 16px 10px; }
.door { all: unset; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; cursor: pointer; text-align: center; }
.frame { position: relative; width: 100%; aspect-ratio: 1 / 1.9; max-height: 220px; border-radius: 16px 16px 4px 4px; background: hsl(var(--h) 45% 38%); border: 6px solid color-mix(in srgb, var(--bg) 70%, #fff); box-shadow: 0 10px 26px rgba(0, 0, 0, 0.22), inset 0 -40px 60px rgba(0, 0, 0, 0.18); display: grid; place-items: start center; padding-top: 18%; transition: transform 0.35s var(--spring, ease), box-shadow 0.3s; transform-origin: 0 100%; }
.frame.art { background-size: cover; background-position: center; }
.frame.art::after { display: none; }
.frame::after { content: ''; position: absolute; inset: 46% 14% 8%; border-radius: 6px; background: hsl(var(--h) 45% 31%); }
.pic { width: 46%; aspect-ratio: 1; border-radius: 50%; overflow: hidden; background: hsl(var(--h) 70% 58%); display: grid; place-items: center; box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.85); z-index: 1; }
.pic img { width: 100%; height: 100%; object-fit: cover; }
.pic b { color: #fff; font-size: 1.6rem; }
.knob { position: absolute; right: 12%; top: 54%; width: 9px; height: 9px; border-radius: 50%; background: #d7b56d; z-index: 1; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4); }
.door:hover .frame, .door:focus-visible .frame { transform: perspective(500px) rotateY(-24deg) scale(1.03); box-shadow: 14px 12px 30px rgba(0, 0, 0, 0.3), inset 0 -40px 60px rgba(0, 0, 0, 0.1); }
.door:focus-visible .frame { outline: 3px solid var(--accent, #2b8cff); outline-offset: 3px; }
.name { font-weight: 800; color: var(--text); overflow-wrap: anywhere; }
.tag { font-size: 0.8rem; color: var(--text-3); overflow-wrap: anywhere; }
.here .tag { color: #1db954; font-weight: 700; }
@media (prefers-reduced-motion: reduce) { .frame { transition: none; } }
</style>
