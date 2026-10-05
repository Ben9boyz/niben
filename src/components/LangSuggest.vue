<script setup>
import { computed } from 'vue'
import { Globe } from 'lucide-vue-next'
import { byCode } from '../lib/languages'
import { i18n, setLang, dismissSuggestion } from '../composables/useLang'

// First visit: offer the language that fits where the visitor is. Never switches on its own.
const lang = computed(() => (i18n.suggest ? byCode[i18n.suggest] : null))
</script>

<template>
  <transition name="fade">
    <div v-if="lang" class="sug glass" role="dialog" aria-label="Language" translate="no">
      <Globe :size="20" aria-hidden="true" />
      <div class="txt">
        <b :lang="lang.code">{{ lang.name.replace(' (original)', '') }}?</b>
        <span>Show this site in {{ lang.en }}? · {{ lang.en === 'Norwegian' ? 'Vis siden på norsk?' : '' }}</span>
      </div>
      <button class="yes" @click="setLang(lang.code)">{{ lang.en === 'Norwegian' ? 'Ja · Yes' : 'Yes' }}</button>
      <button class="no" @click="dismissSuggestion()">No thanks</button>
    </div>
  </transition>
</template>

<style scoped>
.sug { position: fixed; z-index: 85; left: 50%; bottom: 20px; translate: -50% 0; display: flex; align-items: center; gap: 12px; width: min(560px, calc(100vw - 24px)); padding: 12px 14px; border-radius: 18px; background: var(--bg); box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28); color: var(--text); }
.sug svg { flex: none; color: var(--accent); }
.txt { flex: 1; min-width: 0; display: grid; line-height: 1.25; }
.txt b { font-size: 1rem; }
.txt span { font-size: 0.78rem; color: var(--text-3); }
button { flex: none; padding: 8px 14px; border: 0; border-radius: 999px; font: 700 0.84rem var(--font); cursor: pointer; }
.yes { background: var(--accent); color: #fff; }
.no { background: transparent; color: var(--text-2); }
.no:hover { color: var(--text); }
@media (max-width: 720px) { .sug { bottom: calc(86px + env(safe-area-inset-bottom)); flex-wrap: wrap; } .txt { flex-basis: 70%; } }
</style>
