<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { placed, dataOf, loadModules } from '@/composables/room/useModules'
import { safeUrl } from '@/lib/modules/safe'

// Everything you have given stars, from every module together: films beside restaurants beside coffee. Best first.
const mods = computed(() => placed.value.filter((m) => m.kind.fields.some((f) => f.kind === 'rating')))
watchEffect(() => { void loadModules(mods.value.map((m) => m.id)) }) // (all of them in one request)
const only = ref('')
interface Row { mod: string; icon: string; modName: string; title: string; sub: string; rating: number; img: string | null; note: string; date: string }
const rows = computed<Row[]>(() => mods.value.flatMap((m) => (dataOf(m.id)?.items ?? []).filter((e) => Number(e.rating) > 0).map((e) => ({
  mod: m.id, icon: m.icon, modName: m.name, title: String(e.t ?? e.date ?? '–'), sub: [e.kat, e.pris, e.adresse].filter(Boolean).join(' · '),
  rating: Number(e.rating), img: safeUrl(e.img), note: String(e.note ?? ''), date: String(e.date ?? ''),
}))))
const shown = computed(() => rows.value.filter((r) => !only.value || r.mod === only.value).sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date)))
const withRows = computed(() => mods.value.filter((m) => rows.value.some((r) => r.mod === m.id)))
const avg = computed(() => (shown.value.length ? (shown.value.reduce((s, r) => s + r.rating, 0) / shown.value.length).toFixed(1).replace('.', ',') : null))
const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(5 - n)
</script>

<template>
  <div class="rv">
    <header><h2>Vurderinger</h2><p>Alt du har gitt stjerner, fra alle hobbyene på ett sted.<template v-if="avg"> {{ shown.length }} stk, snitt {{ avg }}.</template></p></header>
    <div v-if="withRows.length > 1" class="chips" role="group" aria-label="Fra hobby">
      <button :class="{ on: !only }" @click="only = ''">Alle</button>
      <button v-for="m in withRows" :key="m.id" :class="{ on: only === m.id }" @click="only = m.id">{{ m.icon }} {{ m.name }}</button>
    </div>
    <p v-if="!shown.length" class="empty">Ingenting vurdert ennå. Gi stjerner i en film, restaurant eller noe annet, så dukker det opp her.</p>
    <ul class="grid">
      <li v-for="(r, i) in shown" :key="i">
        <router-link :to="{ name: 'modul', params: { id: r.mod } }">
          <span class="im" :style="r.img ? { backgroundImage: `url(${r.img})` } : undefined"><template v-if="!r.img">{{ r.icon }}</template></span>
          <b>{{ r.title }}</b>
          <small>{{ r.icon }} {{ r.modName }}<template v-if="r.sub"> · {{ r.sub }}</template></small>
          <span class="st">{{ stars(r.rating) }}</span>
          <p v-if="r.note">{{ r.note }}</p>
        </router-link>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.rv { display: flex; flex-direction: column; gap: 14px; } h2 { margin: 0; } header p { margin: 2px 0 0; color: var(--text-3); font-size: 0.9rem; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; } .chips button { all: unset; cursor: pointer; padding: 5px 11px; border-radius: 999px; font-size: 0.82rem; border: 1px solid var(--glass-border); } .chips .on { background: var(--accent); color: #fff; border-color: transparent; }
.empty { color: var(--text-3); margin: 0; }
.grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
.grid a { display: flex; flex-direction: column; gap: 3px; color: inherit; text-decoration: none; }
.im { aspect-ratio: 2 / 3; border-radius: 12px; background: color-mix(in srgb, var(--accent) 16%, var(--bg)) center / cover; display: grid; place-items: center; font-size: 2rem; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18); transition: transform 0.3s var(--spring, ease); }
.grid a:hover .im { transform: translateY(-4px) rotate(-1deg); }
b { overflow-wrap: anywhere; } small { color: var(--text-3); } .st { color: #f5a524; letter-spacing: 1px; } p { margin: 2px 0; font-size: 0.82rem; color: var(--text-3); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
