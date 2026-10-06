<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, RefreshCw, Trash2, ArrowUpRight, Play, KeyRound, Sparkles } from 'lucide-vue-next'
import { tx } from '@/composables/site/useTexts'
import { admin } from '@/composables/site/useAdmin'
import { discover, loadDiscover, addPick, delPick, saveKey, refreshRecs, hideRec, type Pick } from '@/composables/music/useDiscover'
import { openAlbumPage, openArtistPage, peek } from '@/composables/music/useBrowse'
import { play, notify } from '@/composables/music/useSpotify'
import { itemMenu, playItem } from '@/lib/menus'
import { showMenu, longPress, type MenuPoint } from '@/composables/ui/useContextMenu'
import CoverGrid from '@/components/music/CoverGrid.vue'
import PeekView from '@/components/vinyl/PeekView.vue'

// Oppdag: what I recommend (pasted Spotify links with a note) and good albums I don't have yet. Tap an album to look
// inside it, right-click for play / queue / "Lagre i biblioteket".
onMounted(loadDiscover)
const url = ref('')
const note = ref('')
const key = ref('')
const showKey = ref(false)
const albums = (list: Pick[]) => list.filter((p) => p.type !== 'track').map((p) => ({ ...p, sub: p.artist + (p.year ? ` · ${p.year}` : '') }))
const pickAlbums = computed(() => albums(discover.picks))
const pickTracks = computed(() => discover.picks.filter((p) => p.type === 'track'))
const recs = computed(() => albums(discover.recs).map((p) => ({ ...p, onHide: admin.mine ? () => hideRec(p.uri) : undefined })))
const noteOf = (it: { uri: string }) => discover.picks.find((p) => p.uri === it.uri)?.note || ''
const whyOf = (it: { uri: string }) => discover.recs.find((p) => p.uri === it.uri)?.why || ''
const open = (it: Pick) => openAlbumPage({ ...it, artist: it.artist ?? '', image_large: it.image_large || it.image })
async function add() {
  if (!url.value.trim()) return
  const r = await addPick(url.value.trim(), note.value)
  if (r) { url.value = ''; note.value = ''; notify(`«${r.name}» er lagt til.`) }
}
async function playTrack(t: Pick) { const r = await play(t.uri); if (!r.ok) notify(r.error ?? '', true) }
const trackMenu = (e: MenuPoint, t: Pick) => showMenu(e, t.name, [
  admin.mine && { label: 'Spill', run: () => playTrack(t) },
  t.album_uri ? { label: 'Gå til album', run: () => openAlbumPage({ uri: t.album_uri ?? '', name: t.album ?? '', artist: t.artist ?? '', image: t.image, image_large: t.image_large }) } : null,
  t.artist ? { label: 'Gå til artist', run: () => openArtistPage({ id: t.artist_id, name: String(t.artist).split(',')[0] ?? '' }) } : null,
  { label: 'Åpne i Spotify', run: () => { window.open(t.url ?? undefined, '_blank', 'noopener') } },
])
const when = computed(() => (discover.at ? new Date(discover.at * 1000).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' }) : ''))
</script>

<template>
  <div class="dc">
    <PeekView v-if="peek.stack.length" />
    <template v-else>
      <h3 class="dtitle">{{ tx('discover.title') }}</h3>
      <p class="lead">{{ tx('discover.intro') }}</p>

      <!-- me: add a suggestion -->
      <form v-if="admin.mine" class="add glass-in" @submit.prevent="add">
        <b class="label-caps"><Plus :size="13" aria-hidden="true" />{{ tx('discover.add') }}</b>
        <input v-model="url" type="text" placeholder="Lim inn en Spotify-lenke (album eller låt)" aria-label="Spotify-lenke" />
        <input v-model="note" type="text" maxlength="300" placeholder="Hvorfor? (valgfritt – f.eks. «Årets album 2025»)" aria-label="Notat" />
        <div class="btns">
          <button class="btn primary" :disabled="discover.busy === 'add' || !url.trim()">{{ discover.busy === 'add' ? 'Legger til …' : 'Legg til' }}</button>
        </div>
      </form>
      <p v-if="discover.error" class="notice error">{{ discover.error }}</p>

      <section v-if="pickAlbums.length || pickTracks.length">
        <h3 class="label-caps">{{ tx('discover.picks') }}</h3>
        <div v-if="pickAlbums.length" class="withnote">
          <div v-for="it in pickAlbums" :key="it.uri" class="pk">
            <CoverGrid :items="[it]" @pick="open" />
            <p v-if="noteOf(it)" class="nt">{{ noteOf(it) }}</p>
            <button v-if="admin.mine" class="del" title="Fjern" aria-label="Fjern" @click="delPick(it.uri)"><Trash2 :size="13" /></button>
          </div>
        </div>
        <ul v-if="pickTracks.length" class="tl">
          <li v-for="t in pickTracks" :key="t.uri" v-on="longPress((e) => trackMenu(e, t))" @contextmenu.prevent="trackMenu($event, t)">
            <img v-if="t.thumb || t.image" :src="t.thumb || t.image || undefined" alt="" crossorigin="anonymous" />
            <span class="x"><b>{{ t.name }}</b><small>{{ t.artist }}<template v-if="t.album"> · {{ t.album }}</template></small><em v-if="t.note">{{ t.note }}</em></span>
            <button v-if="admin.mine" class="ic" title="Spill" aria-label="Spill" @click="playTrack(t)"><Play :size="15" fill="currentColor" /></button>
            <a class="ic" :href="t.url || undefined" target="_blank" rel="noopener" title="Åpne i Spotify" aria-label="Åpne i Spotify"><ArrowUpRight :size="16" /></a>
            <button v-if="admin.mine" class="ic" title="Fjern" aria-label="Fjern" @click="delPick(t.uri)"><Trash2 :size="14" /></button>
          </li>
        </ul>
      </section>

      <section>
        <h3 class="label-caps"><Sparkles :size="13" aria-hidden="true" />{{ tx('discover.recs') }}<small v-if="when"> · funnet {{ when }}</small></h3>
        <p class="sub">{{ tx('discover.recs.hint') }}</p>
        <CoverGrid v-if="recs.length" :items="recs" @pick="open" />
        <p v-else-if="discover.loaded" class="muted">{{ tx('discover.none') }}</p>
        <p v-if="recs.length" class="why">Under hvert album i menyen (høyreklikk) kan du spille det, legge det i køen eller lagre det i biblioteket.</p>

        <div v-if="admin.mine" class="tools">
          <button class="btn" :disabled="discover.busy === 'refresh' || !discover.hasKey" @click="refreshRecs"><RefreshCw :size="14" aria-hidden="true" />{{ discover.busy === 'refresh' ? 'Leter … (kan ta et halvt minutt)' : 'Finn nye forslag' }}</button>
          <button class="btn" @click="showKey = !showKey"><KeyRound :size="14" aria-hidden="true" />{{ discover.hasKey ? 'Last.fm-nøkkel (satt)' : 'Legg inn Last.fm-nøkkel' }}</button>
        </div>
        <form v-if="admin.mine && showKey" class="key glass-in" @submit.prevent="saveKey(key).then(() => (key = ''))">
          <p>Forslagene hentes fra Last.fm (artister som ligner på dem du har mest av). Lag en gratis nøkkel på <a href="https://www.last.fm/api/account/create" target="_blank" rel="noopener">last.fm/api/account/create</a> (navn og beskrivelse kan være hva som helst), og lim den inn her.</p>
          <input v-model="key" type="text" placeholder="API-nøkkel (32 tegn)" aria-label="Last.fm-nøkkel" autocomplete="off" />
          <div class="btns"><button class="btn primary" :disabled="discover.busy === 'key'">Lagre nøkkel</button><button v-if="discover.hasKey" type="button" class="btn" @click="saveKey('')">Fjern nøkkel</button></div>
        </form>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dc { display: grid; gap: 22px; min-width: 0; }
.dtitle { margin: 0; font-size: 1.15rem; font-weight: 800; letter-spacing: 0; text-transform: none; }
.lead { margin: 0; color: var(--text-2); max-width: 62ch; line-height: 1.5; }
h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 10px; }
h3 small { font-weight: 500; letter-spacing: 0; text-transform: none; }
.sub, .muted, .why { margin: 0 0 10px; color: var(--text-3); font-size: 0.85rem; line-height: 1.45; }
.glass-in { display: grid; gap: 8px; padding: 14px; border-radius: 18px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
.add b { display: inline-flex; align-items: center; gap: 6px; }
input[type='text'] { width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1px solid var(--glass-border); border-radius: 11px; background: var(--bg); color: var(--text); font: 500 0.92rem var(--font); }
input[type='text']:focus { outline: none; border-color: var(--accent); }
.btns, .tools { display: flex; gap: 8px; flex-wrap: wrap; }
.tools { margin-top: 12px; }
.btn { display: inline-flex; align-items: center; gap: 6px; }
.withnote { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
.pk { position: relative; display: grid; gap: 6px; align-content: start; min-width: 0; }
.pk :deep(.grid) { grid-template-columns: 1fr; }
.nt { margin: 0; padding: 0 2px; font-size: 0.78rem; color: var(--text-2); line-height: 1.35; }
.del { position: absolute; top: 6px; left: 6px; z-index: 3; display: grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 50%; background: rgba(0, 0, 0, 0.55); color: #fff; cursor: pointer; opacity: 0; transition: opacity 0.15s; }
.pk:hover .del, .del:focus-visible { opacity: 1; }
@media (hover: none) { .del { opacity: 0.8; } }
.tl { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 6px; }
.tl li { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto auto auto; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 12px; background: var(--glass-strong); }
.tl img { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; }
.x { display: grid; min-width: 0; }
.x b { font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.x small { color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.x em { font-style: normal; font-size: 0.78rem; color: var(--accent); }
.ic { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--text-2); cursor: pointer; text-decoration: none; }
.ic:hover { background: var(--accent-soft); color: var(--accent); }
.key p { margin: 0; font-size: 0.82rem; color: var(--text-2); line-height: 1.45; }
</style>
