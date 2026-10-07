<script setup lang="ts">
import { computed } from 'vue'
import PlayerControls from './PlayerControls.vue'
import ProgressBar from './ProgressBar.vue'
import LockBadge from './LockBadge.vue'
import LikeButton from './LikeButton.vue'
import NowAddButton from './NowAddButton.vue'
import WebPlayerToggle from './WebPlayerToggle.vue'
import { spotify } from '@/composables/music/useSpotify'
import { queueDrop, queueOver } from '@/composables/music/useDrag'
import { mode } from '@/composables/ui/useMode'
import { shell } from '@/composables/ui/useShell'
import { admin } from '@/composables/site/useAdmin'
import { openNowAlbum, openNowArtist } from '@/composables/music/useBrowse'

// stacked: big cover on top (the plain music page's sidebar)
const props = defineProps({ stacked: Boolean })
const now = computed(() => spotify.now)
</script>

<template>
  <section class="now" :class="{ playing: now?.playing, admin: admin.mine, stacked: props.stacked, dropping: queueOver }" v-on="queueDrop">
    <div class="cover" :class="{ link: !!now?.name }" :role="now?.name ? 'button' : undefined" :tabindex="now?.name ? 0 : undefined" :title="now?.name ? 'Åpne albumet' : undefined" @click="openNowAlbum" @keydown.enter="openNowAlbum">
      <!-- stacked (the plain music page): a turntable – the record spins while it plays, the cover is its label -->
      <span v-if="props.stacked" class="disc" :class="{ spin: now?.playing }"><img crossorigin="anonymous" v-if="now?.image" :src="now.image_large || now.image" alt="" /></span>
      <img crossorigin="anonymous" v-else-if="now?.image" :src="now.image" alt="" />
      <div v-else class="vinyl-ph"></div>
      <span v-if="now?.playing" class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
    </div>

    <div class="meta">
      <div class="top">
        <small>{{ now?.playing ? 'Spilles nå' : now?.name ? 'Satt på pause' : 'Ingenting spilles' }}</small>
        <span class="tr"><NowAddButton /><LikeButton v-if="mode === 'rom' && shell !== 'player'" /><LockBadge /></span>
      </div>
      <b class="title" translate="no">{{ now?.name || '—' }}</b>
      <span class="sub" translate="no"><a v-if="now?.artist" class="lnk" href="#" title="Åpne artisten" @click.prevent="openNowArtist">{{ now.artist }}</a><template v-if="now?.album"> · <a class="lnk" href="#" title="Åpne albumet" @click.prevent="openNowAlbum">{{ now.album }}</a></template></span>
      <ProgressBar layout="below" />
    </div>

    <!-- the player's buttons (admin) -->
    <PlayerControls v-if="admin.mine && spotify.connected && now?.name" class="pctrl" :compact="!props.stacked" />

    <!-- niben.no as a Spotify speaker (admin) -->
    <WebPlayerToggle v-if="!now?.name" class="ctrl" />
  </section>
</template>

<style scoped>
.now { position: relative; display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 4px 12px; align-items: center; padding: 10px; border-radius: 18px; background: var(--glass-strong); border: 1px solid var(--glass-border); box-shadow: inset 0 1px 0 var(--glass-hi); min-width: 0; }
.cover { position: relative; width: 72px; height: 72px; border-radius: 10px; overflow: hidden; box-shadow: 0 6px 16px rgba(0,0,0,.22); }
.cover img { width: 100%; height: 100%; object-fit: cover; }
.cover.link { cursor: pointer; }
.lnk { color: inherit; text-decoration: none; }
.lnk:hover { color: var(--accent); text-decoration: underline; }
.vinyl-ph { width: 100%; height: 100%; background: radial-gradient(circle, #555 0 12%, #111 13% 100%); }
.eq { position: absolute; right: 5px; bottom: 5px; display: flex; gap: 2px; align-items: flex-end; height: 14px; }
.eq i { width: 3px; background: #fff; border-radius: 2px; animation: eq 0.9s ease-in-out infinite; }
.eq i:nth-child(2) { animation-delay: -0.3s; }
.eq i:nth-child(3) { animation-delay: -0.6s; }
@keyframes eq { 0%, 100% { height: 4px; } 50% { height: 14px; } }
.meta { display: flex; flex-direction: column; min-width: 0; }
.top { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 20px; }
.now.dropping { outline: 2px dashed #1db954; outline-offset: 2px; }
.tr { display: inline-flex; align-items: center; gap: 6px; }
.top small { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); white-space: nowrap; }
.now.playing .top small { color: #1db954; }
.title { font-size: 0.98rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub { color: var(--text-2); font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.pctrl { grid-column: 1 / -1; margin-top: 6px; }
.ctrl { grid-column: 1 / -1; margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--glass-border); }
.ctrl.ready .ctrl.error .pp { display: grid; place-items: center; flex: none; width: 30px; height: 30px; border: 0; border-radius: 50%; background: #1db954; color: #fff; font-size: 0.72rem; cursor: pointer; box-shadow: 0 4px 10px rgba(29, 185, 84, 0.35); }
.pp:hover { filter: brightness(1.08); }



@media (min-width: 821px) {
  .now.stacked { grid-template-columns: minmax(0, 1fr); gap: 10px; padding: 12px; }
  .now.stacked .cover { width: 100%; height: auto; aspect-ratio: 1; display: grid; place-items: center; border-radius: 26px; overflow: visible; background: var(--sk-sunk, var(--bg-2)); box-shadow: var(--sk-sunk-sh, inset 0 3px 10px rgba(0, 0, 0, 0.15)); }
  .now.stacked .disc { position: relative; display: grid; place-items: center; width: 86%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle, transparent 0 35%, rgba(255, 255, 255, 0.05) 35.5% 36%, transparent 36.5%), repeating-radial-gradient(circle, #24201b 0 2px, #2f2a24 2px 3px); box-shadow: 0 14px 26px -10px rgba(0, 0, 0, 0.55); }
  .now.stacked .disc img { width: 36%; height: auto; aspect-ratio: 1; border-radius: 50%; object-fit: cover; }
  .now.stacked .disc::after { content: ''; position: absolute; width: 3%; aspect-ratio: 1; border-radius: 50%; background: #1a1714; }
  .now.stacked .disc.spin { animation: spin 2.2s linear infinite; }
  .now.stacked { background: var(--sk-surface, var(--glass-strong)); border: var(--sk-border, 1px solid var(--glass-border)); box-shadow: var(--sk-surface-sh, inset 0 1px 0 var(--glass-hi)); border-radius: 26px; }
  .now.stacked .eq { right: 10px; bottom: 10px; }
  .now.stacked .title { font-size: 1.15rem; }
  .now.stacked .ctrl { margin-top: 2px; }
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .disc.spin { animation: none !important; } }
</style>
