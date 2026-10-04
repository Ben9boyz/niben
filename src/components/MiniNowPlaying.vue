<script setup>
import { computed } from 'vue'
import { Play, Pause } from 'lucide-vue-next'
import { spotify, progressMs, control } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'
import LockControl from './LockControl.vue'

// Tiny "now playing" in the top-right corner while the side panel is slid away. Click it to bring
// the panel back.
const emit = defineEmits(['open'])
const now = computed(() => spotify.now)
const pct = computed(() => (now.value?.duration_ms ? (progressMs.value / now.value.duration_ms) * 100 : 0))
const toggle = () => control(now.value?.playing ? 'pause' : 'resume')
</script>

<template>
  <transition name="fade">
    <div v-if="now?.name || admin.loggedIn" class="mini glass" :class="{ playing: now?.playing }" role="button" tabindex="0" title="Åpne musikken" @click="emit('open')" @keydown.enter="emit('open')">
      <img crossorigin="anonymous" v-if="now?.image" :src="now.image" alt="" />
      <div class="txt">
        <b>{{ now?.name || 'Ingenting spilles' }}</b>
        <span>{{ now?.artist }}</span>
      </div>
      <!-- the lock lives here (not on the iPod / the held record) -->
      <span v-if="admin.loggedIn" class="lk" @click.stop><LockControl tiny /></span>
      <button v-if="admin.loggedIn && now?.name" class="pp" :aria-label="now.playing ? 'Pause' : 'Spill'" @click.stop="toggle">
        <Pause v-if="now.playing" :size="12" fill="currentColor" />
        <Play v-else :size="12" fill="currentColor" />
      </button>
      <i class="prog" :style="{ width: `${pct}%` }"></i>
    </div>
  </transition>
</template>

<style scoped>
.mini {
  position: fixed;
  top: 20px; /* RoomLayout moves it a row down when the nav row reaches this far */
  right: 20px;
  z-index: 22;
  display: flex;
  align-items: center;
  gap: 9px;
  width: 250px;
  padding: 6px 8px 8px 6px;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s var(--spring, ease);
}
.mini:hover { transform: translateY(-1px); }
img { width: 36px; height: 36px; flex: none; border-radius: 7px; object-fit: cover; }
.txt { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.2; }
.txt b { font-size: 0.78rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.txt span { font-size: 0.7rem; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mini.playing .txt b { color: var(--text); }
.lk { flex: none; display: grid; }
.pp { flex: none; display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 50%; background: #1db954; color: #fff; cursor: pointer; }
.pp:hover { filter: brightness(1.08); }
.prog { position: absolute; left: 0; bottom: 0; height: 2px; background: #1db954; transition: width 1s linear; }
</style>
