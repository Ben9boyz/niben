<script setup>
import { room } from '../composables/useRoom'
import { spotify } from '../composables/useSpotify'
</script>

<template>
  <div class="switch glass" role="tablist" aria-label="Musikk">
    <span class="pill" :class="{ ipod: room.musicView.startsWith('ipod') }"></span>
    <button role="tab" :aria-selected="!room.musicView.startsWith('ipod')" :class="{ on: !room.musicView.startsWith('ipod') }" @click="room.musicView = 'vinyl'">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /></svg>
      Vinyler <small>{{ spotify.albums.length || '' }}</small>
    </button>
    <button role="tab" :aria-selected="room.musicView.startsWith('ipod')" :class="{ on: room.musicView.startsWith('ipod') }" @click="room.musicView = 'ipodDock'; room.sel.musikk = null">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><rect x="8.5" y="5" width="7" height="5.5" rx="0.8" /><circle cx="12" cy="16" r="2.6" /></svg>
      Spillelister <small>{{ spotify.playlists.length || '' }}</small>
    </button>
  </div>
</template>

<style scoped>
.switch {
  position: fixed;
  top: 84px;
  left: 20px;
  z-index: 35;
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 5px;
  border-radius: 999px;
  animation: drop 0.6s var(--spring) both;
}
@keyframes drop { from { opacity: 0; transform: translateY(-14px) scale(0.95); } }
.pill {
  position: absolute;
  top: 5px;
  bottom: 5px;
  left: 5px;
  width: calc(50% - 5px);
  border-radius: 999px;
  background: var(--glass-strong);
  box-shadow: inset 0 1px 0 var(--glass-hi), 0 4px 12px rgba(43, 140, 255, 0.18);
  transition: transform 0.5s var(--spring);
}
.pill.ipod { transform: translateX(100%); }
button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 18px;
  border: 0;
  background: transparent;
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.3s;
}
button.on { color: var(--accent); }
small { opacity: 0.55; font-weight: 600; }
@media (max-width: 720px) { .switch { top: 70px; left: 50%; transform: translateX(-50%); } button { padding: 8px 14px; font-size: 0.85rem; } }
</style>
