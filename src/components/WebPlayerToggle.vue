<script setup lang="ts">
import { computed } from 'vue'
import { spotify } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'
import { web, setEnabled, setVolume } from '../composables/useWebPlayer'
import { inputOf } from '../lib/dom'

// niben.no as a Spotify speaker (admin): the switch, where it plays, "connect again", and the volume.
// `compact` leaves out the text (the player bar).
defineProps<{ compact?: boolean }>()
const label = computed(() => ({
  off: 'Annen enhet',
  loading: 'Kobler til …',
  ready: 'Her på siden',
  reconnect: 'Koble til på nytt',
  elsewhere: 'Spiller i en annen fane',
  error: web.error || 'Noe gikk galt',
}[web.status]))
</script>

<template>
  <div v-if="admin.mine && spotify.connected" class="wpt" :class="[web.status, { compact }]">
    <label v-if="!web.unavailable" class="switch" :title="`La niben.no være en Spotify-høyttaler – ${label}`">
      <input type="checkbox" :checked="web.enabled && web.status !== 'reconnect'" @change="setEnabled(inputOf($event).checked)" />
      <span class="track"><span class="knob"></span></span>
    </label>
    <span v-if="!compact" class="wl">{{ label }}</span>
    <a v-if="web.status === 'reconnect'" class="btn small primary" href="api.php?action=spotify_login">Koble til</a>
    <input v-if="web.status === 'ready'" class="vol" type="range" min="0" max="1" step="0.05" :value="web.volume" aria-label="Volum" @input="setVolume(+inputOf($event).value)" />
  </div>
</template>

<style scoped>
.wpt { display: flex; align-items: center; gap: 10px; min-width: 0; }
.wpt:not(.compact) { flex: 1; }
.wl { flex: 1; min-width: 0; font-size: 0.78rem; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ready .wl { color: #1db954; font-weight: 600; }
.error .wl { color: #d24b4b; }
.switch { position: relative; flex: none; cursor: pointer; }
.switch input { position: absolute; opacity: 0; pointer-events: none; }
.switch .track { display: block; width: 34px; height: 20px; border-radius: 999px; background: rgba(120, 130, 145, 0.35); transition: background 0.2s; }
.switch .knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); transition: transform 0.2s; }
.switch input:checked + .track { background: #1db954; }
.switch input:checked + .track .knob { transform: translateX(14px); }
.vol { flex: 0 1 100px; min-width: 50px; accent-color: #1db954; }
</style>
