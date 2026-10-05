<script setup>
import PracticeCalendar from './PracticeCalendar.vue'
import VocabChart from './VocabChart.vue'
import PitchReading from './PitchReading.vue'
import { ref, computed, watch, nextTick } from 'vue'
import { GraduationCap, ArrowUpRight, Tv, Check, LayoutDashboard, ScanText, BookA } from 'lucide-vue-next'
import { jp, loadJapanese, jpdbUrl, ANIME_READY } from '../composables/useJapanese'
import { admin, checkLogin } from '../composables/useAdmin'
import { room } from '../composables/useRoom'
import JapanPractice from './JapanPractice.vue'
import JapanReader from './JapanReader.vue'
import SegSwitch from './SegSwitch.vue'
import JapanWords from './JapanWords.vue'
import KanjiPractice from './KanjiPractice.vue'

// The Japanese corner's content (3D panel and plain page): progress from jpdb, the word of the day,
// and – for the admin – flashcard practice.
loadJapanese()
checkLogin()

const view = ref('home') // 'home' | 'les' | 'ord' | 'kanji'
const TABS = [
  { id: 'home', label: 'Oversikt', icon: LayoutDashboard },
  { id: 'les', label: 'Les tekst', icon: ScanText },
  { id: 'ord', label: 'Ordliste', icon: BookA },
  { id: 'kanji', label: 'Kanji', icon: 'M5 4h14M12 4v16M7 9h10l-2 5H9zM4 20h16' },
]
const practicing = computed({ get: () => room.jpPractice, set: (v) => (room.jpPractice = v) })
const total = computed(() => jp.count.due + jp.count.learning + jp.count.known + jp.count.new)
const word = computed(() => jp.word)
watch(() => admin.loggedIn, (on) => { if (!on) practicing.value = false })

// anime: the shows in the decks; enough coverage = ready to watch. A DVD clicked in the room is
// highlighted here (and the other way round).
const ready = computed(() => jp.anime.filter((a) => a.known >= ANIME_READY))
const animeEl = ref(null)
const pickAnime = (i) => { room.jpAnime = room.jpAnime === i ? -1 : i }
watch(() => room.jpAnime, async (i) => {
  if (i < 0) return
  await nextTick()
  animeEl.value?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})
</script>

<template>
  <div class="jpc">
    <JapanPractice v-if="practicing && admin.loggedIn" @close="practicing = false" />

    <template v-else>
      <div v-if="jp.loaded && !jp.configured" class="empty">jpdb er ikke koblet til ennå.</div>
      <p v-else-if="jp.error" class="notice error">{{ jp.error }}</p>

      <template v-if="jp.configured && !jp.error">
        <!-- what to do here: overview, read a text, browse my words -->
        <SegSwitch v-model="view" :items="TABS" stretch small label="Japansk" />
        <KanjiPractice v-if="view === 'kanji'" />
        <JapanReader v-else-if="view === 'les'" />
        <JapanWords v-else-if="view === 'ord'" />
        <template v-else>
        <div class="ov">
        <div class="ov-col">
        <!-- word of the day -->
        <article v-if="word" class="wotd">
          <small>今日の言葉 · dagens ord</small>
          <div class="w" lang="ja">{{ word.spelling }}</div>
          <div class="r" lang="ja">
            <PitchReading v-if="word.reading !== word.spelling" :reading="word.reading" :pitch="word.pitch" />
          </div>
          <p class="m" translate="no">{{ (word.meanings?.[0] || []).join('; ') }}</p>
          <a :href="jpdbUrl(word)" target="_blank" rel="noopener" class="jl">Se på jpdb <ArrowUpRight :size="13" /></a>
        </article>

        <!-- practice -->
        <button v-if="admin.loggedIn" class="start" @click="practicing = true">
          <GraduationCap :size="20" />
          <span><b>Øv nå</b><small>{{ jp.count.due }} til repetisjon · nye ord etter det</small></span>
        </button>

        <!-- progress -->
        <div class="stats">
          <div class="st due"><b>{{ jp.count.due }}</b><span>til repetisjon</span></div>
          <div class="st learning"><b>{{ jp.count.learning }}</b><span>lærer nå</span></div>
          <div class="st known"><b>{{ jp.count.known }}</b><span>kan</span></div>
          <div class="st new"><b>{{ jp.count.new }}</b><span>nye</span></div>
        </div>
        <div v-if="total" class="bar" :title="`${jp.count.known} kjent av ${total}`">
          <i class="known" :style="{ width: `${(jp.count.known / total) * 100}%` }"></i>
          <i class="learning" :style="{ width: `${((jp.count.learning + jp.count.due) / total) * 100}%` }"></i>
        </div>

        <VocabChart />

        <PracticeCalendar />

        </div>
        <div class="ov-col">
        <section v-if="jp.anime.length" ref="animeEl" class="anime">
          <b class="label-caps"><Tv :size="14" /> Anime <small>{{ ready.length ? `${ready.length} klar til å se` : `klar ved ${ANIME_READY} % kjent` }}</small></b>
          <div v-for="(a, i) in jp.anime" :key="a.anilist" :data-i="i" class="show" :class="{ on: room.jpAnime === i, ready: a.known >= ANIME_READY }" @click="pickAnime(i)">
            <img v-if="a.cover" :src="`${a.cover}?cors`" alt="" loading="lazy" crossorigin="anonymous" :style="{ background: a.color || undefined }" />
            <div class="si">
              <span class="st-t" translate="no">{{ a.en || a.title }}</span>
              <small lang="ja">{{ a.native }}<template v-if="a.year"> · {{ a.year }}</template><template v-if="a.parts > 1"> · {{ a.parts }} deler</template></small>
              <div class="dbar"><i class="known" :style="{ width: `${a.known}%` }"></i><i class="learning" :style="{ width: `${Math.max(0, a.learning - a.known)}%` }"></i><b class="goal" :style="{ left: `${ANIME_READY}%` }"></b></div>
              <small class="sp">
                <span v-if="a.known >= ANIME_READY" class="ok"><Check :size="12" /> Klar til å se</span>
                <span v-else>{{ String(a.known).replace('.', ',') }} % kjent · {{ String(Math.max(0, ANIME_READY - a.known).toFixed(1)).replace('.', ',') }} % igjen</span>
                <a :href="a.url" target="_blank" rel="noopener" @click.stop>AniList <ArrowUpRight :size="11" /></a>
              </small>
            </div>
          </div>
        </section>

        <section v-if="jp.decks.length" class="decks">
          <b class="label-caps">Kortstokker</b>
          <div v-for="d in jp.decks" :key="d.id" class="deck">
            <div class="dn"><span translate="no">{{ d.name }}</span><small>{{ d.words }} ord</small></div>
            <div class="dbar"><i class="known" :style="{ width: `${d.known}%` }"></i><i class="learning" :style="{ width: `${Math.max(0, d.learning - d.known)}%` }"></i></div>
            <small class="dp">{{ d.known }} % kjent · {{ d.learning }} % påbegynt</small>
          </div>
        </section>
        </div>
        </div>
        </template>
        <p class="src">Ordene og fremgangen kommer fra <a href="https://jpdb.io" target="_blank" rel="noopener">jpdb.io</a>.</p>
      </template>
    </template>
  </div>
</template>

<style scoped>
/* wide: two columns – today's word, practice and numbers | anime and decks */
.ov { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.ov-col { display: grid; gap: 14px; align-content: start; min-width: 0; }
@container (min-width: 860px) { .ov { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; } }
.jpc { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.wotd {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 22px 18px 18px;
  border-radius: 18px;
  background: color-mix(in srgb, #fbf7ee 90%, var(--accent) 10%);
  color: #1a1a1a;
  border: 1px solid rgba(155, 44, 34, 0.2);
  box-shadow: inset 0 0 0 5px rgba(255, 255, 255, 0.4);
  text-align: center;
}
:root[data-theme="dark"] .wotd { background: #f4efe3; }
.wotd small { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; color: #9b2c22; }
.wotd .w { font-family: "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif; font-size: 2.6rem; font-weight: 700; line-height: 1.2; }
.wotd .r { display: flex; gap: 1px; font-family: "Hiragino Sans", "Noto Sans JP", sans-serif; font-size: 1.05rem; color: #444; min-height: 1.2em; }
.wotd .m { margin: 2px 0 4px; font-size: 0.9rem; color: #333; max-width: 40ch; }
.jl { display: inline-flex; align-items: center; gap: 2px; font-size: 0.75rem; font-weight: 600; color: #9b2c22; text-decoration: none; }

.start { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border: 0; border-radius: 16px; background: linear-gradient(135deg, #c0392b, #9b2c22); color: #fff; text-align: left; cursor: pointer; box-shadow: 0 10px 24px rgba(155, 44, 34, 0.3); transition: transform 0.2s; }
.start:hover { transform: translateY(-2px); }
.start span { display: flex; flex-direction: column; }
.start b { font-size: 1rem; }
.start small { font-size: 0.78rem; opacity: 0.85; }

.stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.st { display: flex; flex-direction: column; align-items: center; padding: 10px 4px; border-radius: 14px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
.st b { font-size: 1.35rem; font-variant-numeric: tabular-nums; }
.st span { font-size: 0.7rem; color: var(--text-3); }
.st.due b { color: #c0392b; }
.st.learning b { color: #c9a227; }
.st.known b { color: #3aa76d; }
.st.new b { color: var(--accent); }
.bar, .dbar { display: flex; height: 6px; border-radius: 6px; background: var(--accent-soft); overflow: hidden; }
.bar .known, .dbar .known { background: #3aa76d; }
.bar .learning, .dbar .learning { background: #c9a227; }
.decks { display: grid; gap: 10px; }
.deck { display: grid; gap: 5px; padding: 12px 14px; border-radius: 14px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
.dn { display: flex; justify-content: space-between; gap: 10px; font-size: 0.88rem; font-weight: 600; }
.dn span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dn small { flex: none; color: var(--text-3); font-weight: 500; }
.dp { font-size: 0.72rem; color: var(--text-3); }
.anime { display: grid; gap: 8px; }
.anime > .label-caps { display: flex; align-items: center; gap: 6px; }
.anime > .label-caps small { margin-left: auto; font-size: 0.7rem; font-weight: 600; letter-spacing: 0; text-transform: none; }
.show { display: flex; gap: 12px; padding: 10px; border-radius: 14px; background: var(--glass-strong); border: 1px solid var(--glass-border); cursor: pointer; transition: border-color 0.2s, transform 0.2s; }
.show:hover { transform: translateY(-1px); }
.show.on { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
.show img { flex: none; width: 52px; aspect-ratio: 135 / 190; object-fit: cover; border-radius: 4px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25); }
.si { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; justify-content: center; }
.st-t { font-weight: 700; font-size: 0.92rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.si > small { font-size: 0.74rem; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.si .dbar { position: relative; overflow: visible; }
.si .dbar i:first-child { border-radius: 6px 0 0 6px; }
.goal { position: absolute; top: -3px; bottom: -3px; width: 2px; border-radius: 2px; background: var(--text-3); }
.sp { display: flex; justify-content: space-between; gap: 8px; }
.sp .ok { display: inline-flex; align-items: center; gap: 3px; color: #3aa76d; font-weight: 700; }
.sp a { display: inline-flex; align-items: center; gap: 2px; color: var(--accent); text-decoration: none; font-weight: 600; }
.src { font-size: 0.72rem; color: var(--text-3); margin: 0; }
.src a { color: inherit; }
</style>
