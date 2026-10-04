<script setup>
import { ref, computed, watch } from 'vue'
import { GraduationCap, ArrowUpRight } from 'lucide-vue-next'
import { jp, loadJapanese, jpdbUrl, pitchMorae } from '../composables/useJapanese'
import { admin, checkLogin } from '../composables/useAdmin'
import { room } from '../composables/useRoom'
import JapanPractice from './JapanPractice.vue'

// The Japanese corner's content (3D panel and plain page): progress from jpdb, the word of the day,
// and – for the admin – flashcard practice.
loadJapanese()
checkLogin()

const practicing = computed({ get: () => room.jpPractice, set: (v) => (room.jpPractice = v) })
const total = computed(() => jp.count.due + jp.count.learning + jp.count.known + jp.count.new)
const word = computed(() => jp.word)
const morae = computed(() => (word.value ? pitchMorae(word.value.reading, word.value.pitch) : null))
watch(() => admin.loggedIn, (on) => { if (!on) practicing.value = false })
</script>

<template>
  <div class="jpc">
    <JapanPractice v-if="practicing && admin.loggedIn" @close="practicing = false" />

    <template v-else>
      <div v-if="jp.loaded && !jp.configured" class="empty">jpdb er ikke koblet til ennå.</div>
      <p v-else-if="jp.error" class="notice error">{{ jp.error }}</p>

      <template v-if="jp.configured && !jp.error">
        <!-- word of the day -->
        <article v-if="word" class="wotd">
          <small>今日の言葉 · dagens ord</small>
          <div class="w" lang="ja">{{ word.spelling }}</div>
          <div class="r" lang="ja">
            <template v-if="morae && word.reading !== word.spelling"><span v-for="(p, k) in morae" :key="k" class="mora" :class="{ high: p.high, drop: p.drop }">{{ p.m }}</span></template>
            <template v-else-if="word.reading !== word.spelling">{{ word.reading }}</template>
          </div>
          <p class="m">{{ (word.meanings?.[0] || []).join('; ') }}</p>
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

        <section v-if="jp.decks.length" class="decks">
          <b class="h">Kortstokker</b>
          <div v-for="d in jp.decks" :key="d.id" class="deck">
            <div class="dn"><span>{{ d.name }}</span><small>{{ d.words }} ord</small></div>
            <div class="dbar"><i class="known" :style="{ width: `${d.known}%` }"></i><i class="learning" :style="{ width: `${Math.max(0, d.learning - d.known)}%` }"></i></div>
            <small class="dp">{{ d.known }} % kjent · {{ d.learning }} % påbegynt</small>
          </div>
        </section>
        <p class="src">Ordene og fremgangen kommer fra <a href="https://jpdb.io" target="_blank" rel="noopener">jpdb.io</a>.</p>
      </template>
    </template>
  </div>
</template>

<style scoped>
.jpc { display: grid; gap: 14px; }
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
.mora { position: relative; padding-top: 4px; border-top: 2px solid transparent; }
.mora.high { border-top-color: #2b6fd6; }
.mora.drop::after { content: ''; position: absolute; right: -1px; top: -2px; height: 10px; border-right: 2px solid #2b6fd6; }
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
.h { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }
.deck { display: grid; gap: 5px; padding: 12px 14px; border-radius: 14px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
.dn { display: flex; justify-content: space-between; gap: 10px; font-size: 0.88rem; font-weight: 600; }
.dn span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dn small { flex: none; color: var(--text-3); font-weight: 500; }
.dp { font-size: 0.72rem; color: var(--text-3); }
.src { font-size: 0.72rem; color: var(--text-3); margin: 0; }
.src a { color: inherit; }
</style>
