<script setup lang="ts">
import { tx } from '@/composables/useTexts'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Gamepad2, Clock, Trophy, Library, ArrowUpRight, ChevronDown, Radio, Users, Newspaper, Heart, Flame, Archive, Monitor } from 'lucide-vue-next'
import { steam, watchSteam, type SteamGame, headerImg, coverImg, storeUrl, ago, fmtHours, sessionLen, fmtDate, fmtYears } from '@/composables/useSteam'

// The gaming corner's content (3D panel and plain page): Steam profile, what's on right now,
// recently played (with achievements) and the most-played games.
let stop: (() => void) | undefined
onMounted(() => { stop = watchSteam() })
onBeforeUnmount(() => stop?.())

const p = computed(() => steam.profile)
const lib = computed(() => steam.library)
const playing = computed(() => p.value?.playing || null)
// the big card: the game being played now, otherwise the last one played
const hero = computed(() => {
  const now = playing.value
  if (now) {
    const g = lib.value?.recent?.find((x) => x.appid === now.appid) || lib.value?.top?.find((x) => x.appid === now.appid)
    return { ...now, ...g, live: true }
  }
  const g = lib.value?.recent?.[0]
  return g ? { ...g, live: false } : null
})
const recent = computed(() => (lib.value?.recent || []).filter((g) => !hero.value || g.appid !== hero.value.appid))
const live = computed(() => steam.live || null)
const fr = computed(() => steam.friends || null)
const maxGenre = computed(() => Math.max(1, ...(lib.value?.genres || []).map((g) => g.hours)))
const plat = computed(() => {
  const x = lib.value?.platform
  if (!x) return []
  const tot = (x.win + x.mac + x.linux) || 1
  const rows: [string, number][] = [['Windows', x.win], ['Mac', x.mac], ['Linux', x.linux]]
  return rows.filter((r) => r[1] > 0).map(([n, h]) => ({ n, h, pct: Math.round((h / tot) * 100) }))
})
const all = ref(false)
const top = computed(() => (lib.value?.top || []).slice(0, all.value ? 60 : 8))
const maxHours = computed(() => lib.value?.top?.[0]?.hours || 1)

// some older games have no tall cover – show the banner instead
const noCover = ref(new Set<number>())
const cover = (g: Pick<SteamGame, 'appid'>) => (noCover.value.has(g.appid) ? headerImg(g.appid) : coverImg(g.appid))
const coverFailed = (g: Pick<SteamGame, 'appid'>) => { noCover.value = new Set(noCover.value).add(g.appid) }
</script>

<template>
  <div class="gc">
    <div v-if="steam.loaded && !steam.configured" class="empty">Steam er ikke koblet til ennå.</div>
    <p v-else-if="steam.error" class="notice error">{{ steam.error }}</p>

    <template v-if="p">
      <div class="gl">
      <div class="gl-col">
      <!-- profile -->
      <a class="profile" :href="p.url || undefined" target="_blank" rel="noopener">
        <span class="av" :class="{ on: p.online, game: !!playing }"><img :src="p.avatar || undefined" alt="" /></span>
        <span class="who">
          <b>{{ p.name }}</b>
          <small :class="{ game: !!playing, on: p.online && !playing }">{{ playing ? `Spiller ${playing.name}` : p.state }}</small>
        </span>
        <span v-if="lib?.level != null" class="lvl" title="Steam-nivå">{{ lib.level }}</span>
        <ArrowUpRight :size="15" class="ext" />
      </a>

      <!-- now playing / last played -->
      <a v-if="hero" class="hero" :href="storeUrl(hero.appid)" target="_blank" rel="noopener" :style="{ '--art': `url(${headerImg(hero.appid)})` }">
        <span class="tag" :class="{ live: hero.live }"><Radio v-if="hero.live" :size="13" />{{ hero.live ? 'Spiller nå' : 'Sist spilt' }}</span>
        <div class="hero-meta">
          <b>{{ hero.name }}</b>
          <small>
            <template v-if="hero.hours">{{ fmtHours(hero.hours) }} totalt</template>
            <template v-if="hero.recent"> · {{ fmtHours(hero.recent) }} siste 2 uker</template>
            <template v-if="!hero.live && hero.last"> · {{ ago(hero.last) }}</template>
          </small>
          <div v-if="hero.ach" class="ach"><i :style="{ width: `${(hero.ach.done / hero.ach.total) * 100}%` }"></i></div>
          <small v-if="hero.ach" class="ach-t"><Trophy :size="12" /> {{ hero.ach.done }} / {{ hero.ach.total }} prestasjoner</small>
        </div>
      </a>

      <!-- right now: the game, who else plays it, the latest news and my newest unlocks -->
      <section v-if="live && hero" class="now">
        <div class="chips">
          <span v-if="playing?.since" class="chip live"><Radio :size="12" />{{ sessionLen(playing.since) }} i dag</span>
          <span v-if="live.players" class="chip"><Users :size="12" />{{ live.players.toLocaleString('nb-NO') }} spiller nå</span>
          <span v-for="g in live.info?.genres || []" :key="g" class="chip soft">{{ g }}</span>
          <span v-if="live.info?.score" class="chip soft">Metacritic {{ live.info.score }}</span>
        </div>
        <p v-if="live.info?.text" class="blurb">{{ live.info.text }}<small v-if="live.info.dev"> — {{ live.info.dev }}<template v-if="live.info.year">, {{ live.info.year }}</template></small></p>
        <ul v-if="live.ach?.length" class="unl">
          <li v-for="a in live.ach" :key="a.name + a.at">
            <img v-if="a.icon" :src="a.icon" alt="" loading="lazy" />
            <span><b>{{ a.name }}</b><small>{{ a.text }}</small></span>
            <em><Trophy :size="11" />{{ ago(a.at) }}<template v-if="a.rarity"> · {{ a.rarity }} % har den</template></em>
          </li>
        </ul>
        <a v-if="live.news" class="news" :href="live.news.url" target="_blank" rel="noopener">
          <Newspaper :size="15" /><span><b>{{ live.news.title }}</b><small>{{ live.news.text }}</small></span>
        </a>
      </section>

      <!-- numbers -->
      <div v-if="lib && !lib.hidden" class="stats">
        <div><Library :size="16" /><b>{{ lib.count }}</b><span>spill</span></div>
        <div><Clock :size="16" /><b>{{ lib.hours.toLocaleString('nb-NO') }}</b><span>timer</span></div>
        <div><Gamepad2 :size="16" /><b>{{ lib.count ? Math.round(((lib.played ?? 0) / lib.count) * 100) : 0 }} %</b><span>spilt</span></div>
        <div><Flame :size="16" /><b>{{ lib.two_weeks != null ? fmtHours(lib.two_weeks) : '–' }}</b><span>siste 2 uker</span></div>
        <div><Archive :size="16" /><b>{{ lib.backlog ?? '–' }}</b><span>ikke startet</span></div>
        <div><Clock :size="16" /><b>{{ fmtYears(p.since) || '–' }}</b><span>på Steam</span></div>
      </div>
      <!-- what I play: genres + where -->
      <section v-if="lib?.genres?.length || plat.length" class="sec">
        <b class="label-caps">{{ tx('gaming.how') }}</b>
        <ul v-if="lib?.genres?.length" class="genres">
          <li v-for="g in lib.genres" :key="g.name"><span>{{ g.name }}</span><span class="bar"><i :style="{ width: `${(g.hours / maxGenre) * 100}%` }"></i></span><small>{{ fmtHours(g.hours) }}</small></li>
        </ul>
        <p v-if="plat.length" class="platform"><Monitor :size="13" />{{ plat.map((x) => `${x.n} ${x.pct} %`).join(' · ') }}</p>
        <p v-if="lib?.longest" class="platform"><Trophy :size="13" />Mest spilt: <b>{{ lib.longest.name }}</b> – {{ fmtHours(lib.longest.hours) }}</p>
      </section>
      <p v-else-if="lib?.hidden" class="muted">{{ tx('gaming.private') }}</p>

      </div>
      <div class="gl-col">
      <!-- recently played -->
      <section v-if="recent.length" class="sec">
        <b class="label-caps">Nylig spilt</b>
        <div class="shelf">
          <a v-for="g in recent" :key="g.appid" class="cap" :href="storeUrl(g.appid)" target="_blank" rel="noopener" :title="g.name">
            <span class="art"><img :src="cover(g)" :alt="g.name" loading="lazy" @error="coverFailed(g)" /></span>
            <b>{{ g.name }}</b>
            <small>{{ ago(g.last) }}</small>
            <small v-if="g.ach" class="trophy"><Trophy :size="11" /> {{ Math.round((g.ach.done / g.ach.total) * 100) }} %</small>
          </a>
        </div>
      </section>

      <!-- most played -->
      <section v-if="top.length" class="sec">
        <b class="label-caps">Mest spilt</b>
        <ol class="top">
          <li v-for="(g, i) in top" :key="g.appid">
            <a :href="storeUrl(g.appid)" target="_blank" rel="noopener">
              <span class="n">{{ i + 1 }}</span>
              <img :src="headerImg(g.appid)" alt="" loading="lazy" />
              <span class="tm">
                <b>{{ g.name }}</b>
                <span class="bar"><i :style="{ width: `${(g.hours / maxHours) * 100}%` }"></i></span>
              </span>
              <span class="hrs">{{ fmtHours(g.hours) }}</span>
            </a>
          </li>
        </ol>
        <button v-if="(lib?.top || []).length > 8" class="more-btn" @click="all = !all">
          <ChevronDown :size="16" :class="{ up: all }" />{{ all ? 'Vis færre' : `Vis ${Math.min(60, lib?.top.length ?? 0)} mest spilte` }}
        </button>
      </section>

      <!-- friends -->
      <section v-if="fr && fr.best" class="sec">
        <b class="label-caps"><Heart :size="12" /> Bestevenn</b>
        <a class="best" :href="fr.best.url || undefined" target="_blank" rel="noopener">
          <span class="av" :class="{ on: fr.best.online, game: !!fr.best.playing }"><img :src="fr.best.avatar || undefined" alt="" /></span>
          <span class="who">
            <b>{{ fr.best.name }}</b>
            <small :class="{ game: !!fr.best.playing, on: fr.best.online && !fr.best.playing }">{{ fr.best.playing ? `Spiller ${fr.best.playing}` : fr.best.online ? fr.best.state : fr.best.last ? `Sist pålogget ${ago(fr.best.last)}` : 'Frakoblet' }}</small>
            <small v-if="fr.best.since">Venner siden {{ fmtDate(fr.best.since) }}</small>
          </span>
        </a>
        <ul v-if="fr.best.shared?.length" class="shared">
          <li v-for="g in fr.best.shared" :key="g.appid"><img :src="headerImg(g.appid)" alt="" loading="lazy" /><span>{{ g.name }}</span><small>{{ fmtHours(g.mine) }} · {{ fmtHours(g.theirs) }}</small></li>
        </ul>
        <p v-if="fr.best.shared_count" class="muted">Vi har {{ fr.best.shared_count }} spill vi begge har spilt. (jeg · vennen)</p>
      </section>
      </div>
      </div>
      <p class="src">Fra <a :href="p.url || undefined" target="_blank" rel="noopener">Steam</a> · oppdateres hvert minutt.</p>
    </template>
  </div>
</template>

<style scoped>
.gc { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; container-type: inline-size; }
/* wide: two columns – me, now playing and the numbers | recently played and most played */
.gl { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.gl-col { display: grid; gap: 14px; align-content: start; min-width: 0; }
@container (min-width: 860px) { .gl { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; } }
.muted, .src { color: var(--text-3); font-size: 0.78rem; margin: 0; }
.src a { color: inherit; }

.profile { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 18px; background: var(--glass-strong); border: 1px solid var(--glass-border); color: var(--text); text-decoration: none; transition: border-color 0.2s; }
.profile:hover { border-color: var(--accent); }
.av { position: relative; flex: none; width: 46px; height: 46px; border-radius: 14px; padding: 2px; background: #6b7380; }
.av.on { background: #57cbde; }
.av.game { background: #90ba3c; }
.av img { width: 100%; height: 100%; border-radius: 12px; display: block; object-fit: cover; }
.who { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.who b { font-size: 1rem; }
.who small { font-size: 0.78rem; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.who small.on { color: #3aa9c4; }
.who small.game { color: #7aa22c; font-weight: 600; }
.lvl { flex: none; display: grid; place-items: center; min-width: 32px; height: 32px; padding: 0 6px; border-radius: 50%; border: 2px solid #c02942; font-weight: 800; font-size: 0.85rem; }
.ext { flex: none; color: var(--text-3); }

.hero { position: relative; display: flex; flex-direction: column; justify-content: space-between; min-height: 180px; padding: 14px; border-radius: 20px; overflow: hidden; color: #fff; text-decoration: none; isolation: isolate; box-shadow: 0 14px 34px rgba(0, 0, 0, 0.25); }
.hero::before { content: ''; position: absolute; inset: 0; z-index: -2; background: var(--art) center / cover; transition: transform 0.8s var(--ease, ease); }
.hero::after { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, rgba(5, 10, 20, 0.1) 20%, rgba(5, 10, 20, 0.85)); }
.hero:hover::before { transform: scale(1.04); }
.tag { align-self: flex-start; display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.tag.live { background: #5c7e10; animation: live 2s ease-in-out infinite; }
@keyframes live { 50% { box-shadow: 0 0 0 6px rgba(144, 186, 60, 0.25); } }
.hero-meta { display: grid; gap: 4px; }
.hero-meta b { font-size: 1.35rem; line-height: 1.15; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5); }
.hero-meta small { font-size: 0.8rem; opacity: 0.9; }
.ach { height: 4px; border-radius: 4px; background: rgba(255, 255, 255, 0.2); overflow: hidden; margin-top: 4px; }
.ach i { display: block; height: 100%; background: linear-gradient(90deg, #f5c542, #ffdf7e); }
.ach-t { display: inline-flex; align-items: center; gap: 4px; }

.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.stats div { min-width: 0; }
.stats b { font-size: 1.1rem; }
.stats div { display: grid; justify-items: center; gap: 2px; padding: 10px 4px; border-radius: 14px; background: var(--glass-strong); border: 1px solid var(--glass-border); color: var(--text-3); }
.stats b { font-size: 1.25rem; color: var(--text); font-variant-numeric: tabular-nums; }
.stats span { font-size: 0.7rem; }

.sec { display: grid; gap: 8px; min-width: 0; }
.shelf { display: grid; grid-auto-flow: column; grid-auto-columns: 110px; gap: 10px; overflow-x: auto; padding-bottom: 6px; scroll-snap-type: x mandatory; }
.cap { display: grid; gap: 3px; color: var(--text); text-decoration: none; scroll-snap-align: start; min-width: 0; }
.art { display: block; aspect-ratio: 2 / 3; border-radius: 10px; overflow: hidden; background: var(--accent-soft); box-shadow: 0 8px 18px rgba(0, 0, 0, 0.2); }
.art img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.5s var(--ease, ease); }
.cap:hover .art img { transform: scale(1.05); }
.cap b { font-size: 0.78rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cap small { font-size: 0.7rem; color: var(--text-3); }
.trophy { display: inline-flex; align-items: center; gap: 3px; color: #c99a1e !important; font-weight: 600; }

.top { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.top a { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 12px; color: var(--text); text-decoration: none; }
.top a:hover { background: var(--accent-soft); }
.n { flex: none; width: 18px; text-align: right; font-size: 0.75rem; font-weight: 700; color: var(--text-3); font-variant-numeric: tabular-nums; }
.top img { flex: none; width: 76px; aspect-ratio: 460 / 215; border-radius: 6px; object-fit: cover; background: var(--accent-soft); }
.tm { flex: 1; min-width: 0; display: grid; gap: 5px; }
.tm b { font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bar { display: block; height: 4px; border-radius: 4px; background: var(--accent-soft); overflow: hidden; }
.bar i { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--accent-2), var(--accent)); }
.hrs { flex: none; font-size: 0.78rem; font-weight: 600; color: var(--text-2); font-variant-numeric: tabular-nums; }

.now { display: grid; gap: 10px; padding: 12px; border-radius: 16px; background: var(--glass-strong); border: 1px solid var(--glass-border); min-width: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; font-size: 0.74rem; font-weight: 700; background: var(--accent-soft); color: var(--accent); }
.chip.live { background: rgba(144, 186, 60, 0.2); color: #6f9622; }
.chip.soft { background: transparent; border: 1px solid var(--glass-border); color: var(--text-2); font-weight: 600; }
.blurb { margin: 0; font-size: 0.84rem; line-height: 1.45; color: var(--text-2); }
.blurb small { color: var(--text-3); }
.unl { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.unl li { display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 4px 10px; align-items: center; }
.unl img { grid-row: span 2; width: 38px; height: 38px; border-radius: 8px; background: var(--accent-soft); }
.unl span { display: grid; min-width: 0; }
.unl b { font-size: 0.82rem; }
.unl small { font-size: 0.72rem; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.unl em { font-style: normal; font-size: 0.7rem; color: #c99a1e; display: inline-flex; align-items: center; gap: 4px; }
.news { display: flex; gap: 10px; align-items: flex-start; padding: 10px; border-radius: 12px; background: var(--accent-soft); color: var(--text); text-decoration: none; }
.news svg { flex: none; margin-top: 2px; color: var(--accent); }
.news span { display: grid; gap: 2px; min-width: 0; }
.news b { font-size: 0.82rem; }
.news small { font-size: 0.74rem; color: var(--text-2); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.genres { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.genres li { display: grid; grid-template-columns: 90px 1fr 56px; gap: 8px; align-items: center; font-size: 0.8rem; }
.genres small { text-align: right; color: var(--text-3); font-variant-numeric: tabular-nums; }
.platform { margin: 0; display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--text-2); }
.best { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 18px; background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, transparent), var(--glass-strong)); border: 1px solid var(--glass-border); color: var(--text); text-decoration: none; }
.best .av { width: 56px; height: 56px; }
.av.sm { width: 34px; height: 34px; border-radius: 10px; padding: 2px; }
.av.sm img { border-radius: 8px; }
.shared { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
.shared li { display: grid; grid-template-columns: 62px minmax(0, 1fr) auto; gap: 8px; align-items: center; font-size: 0.8rem; }
.shared img { width: 62px; aspect-ratio: 460 / 215; border-radius: 5px; object-fit: cover; }
.shared span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.shared small { color: var(--text-3); font-variant-numeric: tabular-nums; }
.friends { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 6px; }
.friends a { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 12px; color: var(--text); text-decoration: none; }
.friends a:hover { background: var(--accent-soft); }
.friends .who b { font-size: 0.84rem; }
</style>
