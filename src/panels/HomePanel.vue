<script setup>
import { tx } from '../composables/useTexts'
import BrandLogo from '../components/BrandLogo.vue'
import NowContent from '../components/NowContent.vue'
import MadeWith from '../components/MadeWith.vue'
import { useData } from '../composables/useData'

const data = useData()
</script>

<template>
  <section class="hero glass">
    <BrandLogo class="home-logo rise" style="--i: 0" />
    <div class="eyebrow rise" style="--i: 0">{{ tx('home.eyebrow', data.site?.undertittel) }}</div>
    <h1 class="rise" style="--i: 1">{{ tx('home.hello') }} <span class="grad">{{ tx('home.name', data.site?.navn) }}</span></h1>
    <p class="lead rise" style="--i: 2">{{ tx('home.intro', data.site?.intro) }}</p>
    <div class="now-wrap rise" style="--i: 3"><NowContent /></div>
    <p class="tap rise" style="--i: 8">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V5a2 2 0 0 1 4 0v6m0-1a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3 15.5a1.8 1.8 0 0 1 2.9-2.1L9 16" /></svg>
      {{ tx('home.tap') }}
    </p>
    <MadeWith />
  </section>
</template>

<style scoped>
.hero { padding: 30px 32px 24px; border-radius: 32px; }
h1 { font-size: clamp(2rem, 4.4vw, 3.3rem); font-weight: 800; }
.lead { font-size: 1.02rem; margin-top: 12px; }
.now-wrap { margin-top: 18px; max-height: min(42vh, 380px); overflow-y: auto; overscroll-behavior: contain; padding-right: 2px; }
.tap { display: flex; align-items: center; gap: 8px; margin-top: 18px; font-size: 0.85rem; color: var(--text-3); }
.tap svg { color: var(--accent); animation: tap 1.8s ease-in-out infinite; }
@keyframes tap { 50% { transform: translateY(-3px) rotate(-8deg); } }
@media (max-width: 900px) {
  .hero { padding: 20px 20px 16px; }
  .lead { font-size: 0.92rem; }
  .now-wrap { margin-top: 12px; max-height: 32vh; }
  .tap { display: none; }
}
.home-logo { height: 54px; margin-bottom: 14px; }
</style>
