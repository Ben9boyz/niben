<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { Music, BookOpen, Languages, Guitar, Gamepad2, Plane, ArrowRight, Radio, PartyPopper, Mic, Tv, Trophy, Disc3 } from 'lucide-vue-next'
import { milestones, loadMilestones } from '../composables/useMilestones'
import { useRouter } from 'vue-router'
import { useData } from '../composables/useData'
import { useSpotify } from '../composables/useSpotify'
import { steam, watchSteam, headerImg, fmtHours } from '../composables/useSteam'
import { jp, loadJapanese } from '../composables/useJapanese'
import { parseProgression } from '../lib/chords'
import { room } from '../composables/useRoom'

// "Nå": what I'm doing right now – listening, reading, Japanese, a song on the guitar, games and
// travel. Everything comes from the places that already hold it, so there is nothing extra to keep up.
const router = useRouter()
const data = useData()
const spotify = useSpotify()
let stopSteam
onMounted(() => { stopSteam = watchSteam(); loadJapanese(); loadMilestones() })
onBeforeUnmount(() => stopSteam?.())

// ── milestones: what I just managed (new recording, finished book, anime, song) – kept for 30 days ──
const MS_ICON = { recording: Mic, book: BookOpen, anime: Tv, song: Guitar, trip: Plane, album: Disc3, other: Trophy }
const MS_LABEL = { recording: 'Nytt opptak', book: 'Ferdig lest', anime: 'Klarer anime', song: 'Sang lært', trip: 'På reise', album: 'Nytt album', other: 'Klart' }
const MS_TO = { recording: '/gitar', book: '/boker', anime: '/japansk', song: '/ovelse', trip: '/reiser', album: '/lytte', other: '/' }
// the timeline: milestones (30 days) + albums I saved in the last week
const recent = computed(() => {
  const now = Date.now() / 1000
  const albums = (spotify.albums || []).filter((a) => a.added && now - a.added < 7 * 86400).slice(0, 4).map((a) => ({ key: 'alb:' + a.uri, type: 'album', title: a.name, sub: a.artist, image: a.thumb || a.image, t: a.added }))
  return [...(milestones.items || []).filter((m) => now - m.t < 30 * 86400), ...albums].sort((a, b) => b.t - a.t).slice(0, 7)
})
const fresh = computed(() => recent.value.length && Date.now() / 1000 - recent.value[0].t < 4 * 86400)
const msAgo = (t) => {
  const d = Math.floor((Date.now() / 1000 - t) / 86400)
  return d <= 0 ? 'i dag' : d === 1 ? 'i går' : d < 7 ? `for ${d} dager siden` : `for ${Math.round(d / 7)} uker siden`
}

// ── music ──
const track = computed(() => (spotify.now?.name ? spotify.now : null))

// ── book ──
const reading = computed(() => (data.boker || []).filter((b) => b.leser))

// ── Japanese: the show I'm furthest into, today's word and what's due ──
const anime = computed(() => jp.anime?.[0] || null)
const word = computed(() => jp.word)

// ── guitar ──
const songs = computed(() => (data.sanger || []).filter((s) => s.ovrer))
function practise(s) {
  room.chordMode = 'sanger'
  router.push('/ovelse')
}

// ── games ──
const playing = computed(() => steam.profile?.playing || null)
const lastGame = computed(() => steam.library?.recent?.[0] || null)
const topGames = computed(() => (steam.library?.top || []).slice(0, 3))

// ── travel: the latest past trip and the next one coming up ──
const today = new Date().toISOString().slice(0, 10)
const startOf = (t) => t.dato || (t.aar ? `${t.aar}-01-01` : '')
const lastTrip = computed(() => [...(data.reiser || [])].filter((t) => startOf(t) && startOf(t) <= today).sort((a, b) => startOf(b).localeCompare(startOf(a)))[0] || null)
const nextTrip = computed(() => [...(data.reiser || [])].filter((t) => startOf(t) > today).sort((a, b) => startOf(a).localeCompare(startOf(b)))[0] || null)
const fmt = (d) => (d ? new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
const inDays = (t) => {
  const d = Math.ceil((new Date(startOf(t)) - new Date(today)) / 86400000)
  return d <= 1 ? 'i morgen' : d < 60 ? `om ${d} dager` : `om ${Math.round(d / 30)} mnd.`
}
</script>

<template>
  <div class="now">
    <!-- just happened -->
    <section v-if="recent.length" class="card wide ms" :class="{ fresh }">
      <h3><PartyPopper :size="15" />{{ fresh ? 'Nytt!' : 'Nylig' }}</h3>
      <ul>
        <li v-for="m in recent" :key="m.key">
          <router-link :to="m.url || MS_TO[m.type] || '/'" class="msrow">
            <img v-if="m.image" :src="m.image" alt="" class="msart" />
            <span v-else class="msart ic"><component :is="MS_ICON[m.type] || Trophy" :size="18" /></span>
            <span class="txt"><b translate="no">{{ m.title }}</b><small>{{ MS_LABEL[m.type] || 'Klart' }}<template v-if="m.sub && m.type !== 'recording'"> · <span translate="no">{{ m.sub }}</span></template> · {{ msAgo(m.t) }}</small></span>
          </router-link>
        </li>
      </ul>
    </section>

    <!-- listening -->
    <section class="card">
      <h3><Music :size="15" />Hører på</h3>
      <router-link v-if="track" to="/lytte" class="row">
        <img v-if="track.image" :src="track.image" alt="" class="art" />
        <span class="txt"><b>{{ track.name }}</b><small>{{ track.artist }}<template v-if="track.album"> · {{ track.album }}</template></small></span>
        <span v-if="track.playing" class="live"><Radio :size="12" />spiller</span>
      </router-link>
      <p v-else class="none">Ingenting akkurat nå.</p>
    </section>

    <!-- book -->
    <section class="card">
      <h3><BookOpen :size="15" />Leser</h3>
      <router-link v-for="b in reading" :key="b.id" to="/boker" class="row">
        <img v-if="b.omslag" :src="b.omslag" alt="" class="art book" />
        <span class="txt"><b>{{ b.tittel }}</b><small>{{ b.forfatter }}</small></span>
      </router-link>
      <p v-if="!reading.length" class="none">Ingen bok i gang.</p>
    </section>

    <!-- Japanese -->
    <section class="card">
      <h3><Languages :size="15" />Japansk</h3>
      <router-link v-if="anime" to="/japansk" class="row">
        <img v-if="anime.cover" :src="anime.cover" alt="" class="art book" />
        <span class="txt"><b translate="no">{{ anime.title }}</b><small>Anime · {{ Math.round(anime.known) }} % av ordene kan jeg</small></span>
      </router-link>
      <router-link v-if="word" to="/japansk" class="word">
        <span lang="ja" class="jp">{{ word.spelling }}</span>
        <span class="mean" translate="no"><small v-if="word.reading !== word.spelling" lang="ja">{{ word.reading }}</small>{{ (word.meanings?.[0] || []).slice(0, 2).join('; ') }}</span>
      </router-link>
      <p v-if="jp.loaded && jp.count?.due" class="due"><b>{{ jp.count.due }}</b> kort venter på repetisjon</p>
      <p v-if="jp.loaded && !jp.configured" class="none">jpdb er ikke koblet til.</p>
    </section>

    <!-- guitar -->
    <section class="card">
      <h3><Guitar :size="15" />Øver på gitar</h3>
      <div v-for="s in songs" :key="s.id" class="song">
        <span class="txt"><b>{{ s.tittel }}</b><small>{{ s.artist }}<template v-if="s.capo"> · capo {{ s.capo }}</template></small></span>
        <span class="chips"><i v-for="(c, i) in [...new Set(parseProgression(s.akkorder))]" :key="i">{{ c }}</i></span>
        <button class="go" @click="practise(s)">Øv <ArrowRight :size="13" /></button>
      </div>
      <p v-if="!songs.length" class="none">Ingen låt valgt.</p>
    </section>

    <!-- games -->
    <section class="card wide">
      <h3><Gamepad2 :size="15" />Spill</h3>
      <router-link v-if="playing || lastGame" to="/gaming" class="row">
        <img :src="headerImg((playing || lastGame).appid)" alt="" class="art wideimg" />
        <span class="txt"><b>{{ playing ? playing.name : lastGame.name }}</b><small>{{ playing ? 'Spiller nå' : 'Sist spilt' }}</small></span>
        <span v-if="playing" class="live"><Radio :size="12" />live</span>
      </router-link>
      <div v-if="topGames.length" class="top">
        <small>Mest spilt</small>
        <router-link v-for="(g, i) in topGames" :key="g.appid" to="/gaming"><b>{{ i + 1 }}</b>{{ g.name }}<em>{{ fmtHours(g.hours) }}</em></router-link>
      </div>
      <p v-if="steam.loaded && !steam.configured" class="none">Steam er ikke koblet til ennå.</p>
    </section>

    <!-- travel -->
    <section class="card wide">
      <h3><Plane :size="15" />Reiser</h3>
      <div class="trips">
        <router-link to="/reiser" class="trip">
          <small>Sist</small>
          <b v-if="lastTrip">{{ lastTrip.sted || lastTrip.land }}</b><b v-else class="none">–</b>
          <span v-if="lastTrip">{{ lastTrip.dato ? fmt(lastTrip.dato) : lastTrip.aar }}</span>
        </router-link>
        <router-link to="/reiser" class="trip next">
          <small>Neste</small>
          <b v-if="nextTrip">{{ nextTrip.sted || nextTrip.land }}</b><b v-else class="none">Ikke planlagt</b>
          <span v-if="nextTrip">{{ fmt(nextTrip.dato) }} · {{ inDays(nextTrip) }}</span>
        </router-link>
      </div>
    </section>
  </div>
</template>

<style scoped>
.now { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; container-type: inline-size; }
/* wide (the plain home page): three columns, the cards sit side by side instead of in two tall stacks */
.card:has(> .none:last-child:nth-child(2)) { opacity: 0.7; }
.card { display: grid; gap: 8px; align-content: start; padding: 16px; border-radius: 16px; background: var(--glass-strong); border: 1px solid var(--glass-border); min-width: 0; }
.card.wide { grid-column: span 2; }
.ms ul { margin: 0; padding: 0 0 0 14px; list-style: none; display: grid; gap: 6px; border-left: 2px solid var(--glass-border); }
.ms li { position: relative; }
.ms li::before { content: ''; position: absolute; left: -20px; top: 20px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px var(--glass-strong); }
.msrow { display: flex; align-items: center; gap: 12px; padding: 4px; border-radius: 12px; color: inherit; text-decoration: none; }
.msrow:hover { background: var(--accent-soft); }
.msart { width: 44px; height: 44px; border-radius: 10px; object-fit: cover; flex: none; }
.msart.ic { display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); }
.ms.fresh { background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, var(--glass-strong)), var(--glass-strong)); border-color: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 10%, transparent); }
.ms.fresh h3 { color: var(--accent); }
h3 { margin: 0; display: flex; align-items: center; gap: 6px; font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-3); }
.row, .word { display: flex; align-items: center; gap: 10px; color: inherit; text-decoration: none; min-width: 0; }
.art { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; flex: none; }
.art.book { width: 40px; height: 56px; border-radius: 4px; }
.art.wideimg { width: 96px; height: 45px; border-radius: 6px; }
.txt { display: grid; min-width: 0; flex: 1; }
.txt b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.txt small { color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.live { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font: 700 0.7rem var(--font); flex: none; }
.none { margin: 0; color: var(--text-3); font-size: 0.85rem; }
.word { gap: 12px; padding-top: 6px; border-top: 1px solid var(--glass-border); }
.jp { font-size: 1.6rem; font-weight: 700; }
.mean { display: grid; font-size: 0.82rem; color: var(--text-2); }
.mean small { color: var(--text-3); }
.due { margin: 0; font-size: 0.82rem; color: var(--text-2); }
.due b { color: var(--accent); }
.song { display: grid; gap: 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chips i { font-style: normal; font-weight: 700; font-size: 0.75rem; padding: 2px 8px; border-radius: 8px; background: var(--accent-soft); color: var(--accent); }
.go { justify-self: start; display: inline-flex; align-items: center; gap: 4px; border: 0; padding: 5px 12px; border-radius: 999px; background: var(--accent); color: #fff; font: 700 0.78rem var(--font); cursor: pointer; }
.top { display: grid; gap: 2px; }
.top small { font-size: 0.7rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; }
.top a { display: flex; align-items: center; gap: 8px; color: inherit; text-decoration: none; font-size: 0.9rem; padding: 2px 0; }
.top a b { width: 1.2em; color: var(--text-3); font-variant-numeric: tabular-nums; }
.top a em { margin-left: auto; font-style: normal; color: var(--text-3); font-variant-numeric: tabular-nums; }
.trips { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.trip { display: grid; gap: 2px; padding: 10px 12px; border-radius: 12px; background: var(--accent-soft); color: inherit; text-decoration: none; }
.trip.next { background: linear-gradient(135deg, var(--accent-2), var(--accent)); color: #fff; }
.trip small { font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.7; }
.trip b { font-size: 1.05rem; }
.trip span { font-size: 0.8rem; opacity: 0.85; }
@media (max-width: 560px) { .now { grid-template-columns: 1fr; } .card.wide { grid-column: auto; } }
/* wide (the plain home page): three columns */
@container (min-width: 880px) { .now { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; } .card.wide:last-child, .card.wide.ms { grid-column: span 3; } }
</style>
