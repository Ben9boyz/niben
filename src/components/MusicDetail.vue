<script setup>
import { ChevronLeft, Music, Lock, Play, ArrowUpRight } from 'lucide-vue-next'
import { ref, computed, watch } from 'vue'
import { spotify, lockLeft, fmtClock, play, fetchTracks, lockNote } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'

// Spotify-style page for one album or playlist: big cover, colour from the cover, tracks.
const props = defineProps({
  item: { type: Object, required: true },
  kind: { type: String, default: 'album' }, // 'album' | 'playlist'
  backLabel: { type: String, default: 'Tilbake' },
  // 3D room: the record itself is held up in the room (with its own play button and name),
  // so the panel shows just the way back, the Spotify link and the tracks
  compact: Boolean,
})
const emit = defineEmits(['back'])

const tracks = ref(null)
const msg = ref(null)
const busy = ref(null)
const tint = ref(null)
const locked = computed(() => lockLeft.value > 0)
const isPlayingHere = computed(() => spotify.now?.context === props.item.uri)

// "19 låter · 1 t 4 min"
const stats = computed(() => {
  const it = props.item
  const n = tracks.value?.tracks?.length || it.tracks || it.count
  const total = tracks.value?.tracks?.reduce((s, t) => s + (t.ms || 0), 0) || 0
  return [
    n ? `${n} låter` : null,
    total ? (total >= 3600000 ? `${Math.floor(total / 3600000)} t ${Math.round((total % 3600000) / 60000)} min` : `${Math.round(total / 60000)} min`) : null,
  ].filter(Boolean)
})
const meta = computed(() => [props.kind === 'album' ? props.item.artist : props.item.owner, props.item.year, ...stats.value].filter(Boolean))

// average colour of the cover, for the header
function coverColor(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = c.height = 12
        const x = c.getContext('2d')
        x.drawImage(img, 0, 0, 12, 12)
        const d = x.getImageData(0, 0, 12, 12).data
        let r = 0, g = 0, b = 0
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
        const n = d.length / 4
        resolve(`rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`)
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

watch(() => props.item?.uri, async () => {
  tracks.value = null
  msg.value = null
  tint.value = null
  const it = props.item
  if (!it) return
  if (it.thumb || it.image) coverColor(it.thumb || it.image).then((c) => { if (props.item === it) tint.value = c })
  const t = await fetchTracks(it.uri)
  if (props.item === it) tracks.value = t
}, { immediate: true })

async function onPlay(track = null) {
  if (locked.value || busy.value) return
  busy.value = track?.uri || props.item.uri
  const r = await play(props.item.uri, track?.uri)
  busy.value = null
  msg.value = r.ok ? { ok: `Spiller «${track ? track.name : props.item.name}»${lockNote()}` } : { error: r.error }
}
</script>

<template>
  <article class="detail" :style="tint ? { '--tint': tint } : null">
    <header v-if="compact" class="bar">
      <button class="back" @click="emit('back')"><ChevronLeft :size="16" />{{ backLabel }}</button>
      <span class="bar-meta">{{ stats.join(' · ') }}</span>
      <a v-if="item.url" class="open" :href="item.url" target="_blank" rel="noopener">Åpne i Spotify <ArrowUpRight :size="15" /></a>
    </header>
    <template v-if="compact">
      <p v-if="msg?.ok" class="notice ok">{{ msg.ok }}</p>
      <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>
    </template>
    <header v-else class="hero">
      <button class="back" @click="emit('back')"><ChevronLeft :size="16" />{{ backLabel }}</button>
      <div class="hero-row">
        <img crossorigin="anonymous" v-if="item.image_large || item.image" :src="item.image_large || item.image" alt="" class="cover" />
        <div v-else class="cover ph"><Music :size="40" /></div>
        <div class="info">
          <small>{{ kind === 'album' ? 'Album' : 'Spilleliste' }}</small>
          <h2>{{ item.name }}</h2>
          <p>{{ meta.join(' · ') }}</p>
        </div>
      </div>
      <div class="actions">
        <button v-if="admin.loggedIn" class="playbtn" :disabled="locked || !!busy" :title="locked ? `Låst ${fmtClock(lockLeft)}` : 'Spill av'" @click="onPlay()">
          <template v-if="busy === item.uri">…</template>
          <Lock v-else-if="locked" :size="20" />
          <Play v-else :size="20" fill="currentColor" />
        </button>
        <span v-if="admin.loggedIn && locked" class="lockt">Låst {{ fmtClock(lockLeft) }}</span>
        <span v-if="isPlayingHere" class="now-tag">Spilles nå</span>
        <span class="spacer"></span>
        <a v-if="item.url" class="open" :href="item.url" target="_blank" rel="noopener">Åpne i Spotify <ArrowUpRight :size="15" /></a>
      </div>
      <p v-if="msg?.ok" class="notice ok">{{ msg.ok }}</p>
      <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>
    </header>

    <ol class="tracks">
      <li v-if="!tracks" class="note">Henter låter …</li>
      <li v-else-if="tracks.hidden" class="note">Spotify viser bare låtene i spillelister du har laget selv. Du kan fortsatt spille av hele lista.</li>
      <li v-else-if="!tracks.tracks.length" class="note">Fant ingen låter.</li>
      <li
        v-for="(t, i) in tracks?.tracks || []"
        :key="t.uri + i"
        :class="{ current: spotify.now?.uri === t.uri, clickable: admin.loggedIn && !locked }"
        @click="admin.loggedIn && !locked && onPlay(t)"
      >
        <span class="n">
          <span v-if="spotify.now?.uri === t.uri && spotify.now?.playing" class="eq"><i></i><i></i><i></i></span>
          <template v-else><span class="num">{{ t.n || i + 1 }}</span><span class="hov"><Play :size="13" fill="currentColor" /></span></template>
        </span>
        <span class="t"><b>{{ t.name }}</b><small v-if="kind === 'playlist' || t.artist !== item.artist">{{ t.artist }}</small></span>
        <span class="d">{{ busy === t.uri ? '…' : fmtClock(t.ms / 1000) }}</span>
      </li>
    </ol>
  </article>
</template>

<style scoped>
.detail { --tint: var(--accent); display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; min-width: 0; }
.bar { display: flex; align-items: center; gap: 10px; min-width: 0; }
.bar .back { background: var(--accent-soft); color: var(--accent); }
.bar .back:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); }
.bar-meta { flex: 1; min-width: 0; font-size: 0.78rem; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hero {
  display: grid;
  gap: 12px;
  margin: -6px -6px 0;
  padding: 10px 14px 14px;
  border-radius: 16px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--tint) 55%, transparent), color-mix(in srgb, var(--tint) 8%, transparent));
  transition: background 0.5s;
}
.back { display: inline-flex; align-items: center; gap: 2px; justify-self: start; border: 0; padding: 6px 12px; border-radius: 999px; background: rgba(0, 0, 0, 0.18); color: #fff; font-weight: 600; font-size: 0.82rem; cursor: pointer; }
.back:hover { background: rgba(0, 0, 0, 0.3); }
.hero-row { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 14px; align-items: end; }
.cover { width: 120px; height: 120px; border-radius: 8px; object-fit: cover; box-shadow: 0 14px 34px rgba(0, 0, 0, 0.4); }
.cover.ph { display: grid; place-items: center; background: var(--glass-strong); font-size: 2rem; color: var(--text-3); }
.info { min-width: 0; }
.info small { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-2); }
.info h2 { margin: 2px 0 4px; font-size: 1.35rem; line-height: 1.15; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.info p { margin: 0; font-size: 0.82rem; color: var(--text-2); }
.actions { display: flex; align-items: center; gap: 10px; min-width: 0; }
.playbtn { display: grid; place-items: center; width: 48px; height: 48px; flex: none; border: 0; border-radius: 50%; background: #1db954; color: #fff; font-size: 1.05rem; cursor: pointer; box-shadow: 0 8px 20px rgba(29, 185, 84, 0.4); transition: transform 0.15s, filter 0.15s; }
.playbtn:hover:not(:disabled) { transform: scale(1.06); filter: brightness(1.08); }
.playbtn:disabled { background: #9aa3ad; box-shadow: none; cursor: not-allowed; }
.lockt { font-size: 0.8rem; color: #b8711a; font-weight: 600; font-variant-numeric: tabular-nums; }
.now-tag { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #1db954; }
.spacer { flex: 1; }
.open { display: inline-flex; align-items: center; gap: 3px; font-size: 0.8rem; font-weight: 600; color: var(--text-2); text-decoration: none; white-space: nowrap; }
.open:hover { color: var(--accent); }

.tracks { list-style: none; margin: 0; padding: 0; }
.tracks li { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 7px 8px; border-radius: 8px; font-size: 0.86rem; }
.tracks li.note { display: block; padding: 10px 8px; color: var(--text-3); line-height: 1.4; }
.tracks li.clickable { cursor: pointer; }
.tracks li:hover { background: var(--accent-soft); }
.tracks li.current .t b { color: #1db954; }
.n { display: grid; place-items: center; color: var(--text-3); font-variant-numeric: tabular-nums; font-size: 0.8rem; }
.n .hov { display: none; line-height: 0; color: var(--text); }
.tracks li.clickable:hover .num { display: none; }
.tracks li.clickable:hover .hov { display: inline; }
.t { display: flex; flex-direction: column; min-width: 0; }
.t b { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t small { color: var(--text-3); font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.d { color: var(--text-3); font-variant-numeric: tabular-nums; font-size: 0.78rem; }
.eq { display: flex; gap: 2px; align-items: flex-end; height: 12px; }
.eq i { width: 3px; background: #1db954; border-radius: 2px; animation: eq 0.9s ease-in-out infinite; }
.eq i:nth-child(2) { animation-delay: -0.3s; }
.eq i:nth-child(3) { animation-delay: -0.6s; }
@keyframes eq { 0%, 100% { height: 3px; } 50% { height: 12px; } }

@container (min-width: 560px) {
  .hero { padding: 14px 20px 18px; }
  .hero-row { grid-template-columns: 190px minmax(0, 1fr); gap: 22px; }
  .cover { width: 190px; height: 190px; }
  .info h2 { font-size: 2rem; }
  .info p { font-size: 0.92rem; }
  .tracks li { font-size: 0.93rem; padding: 8px 10px; }
}
</style>
