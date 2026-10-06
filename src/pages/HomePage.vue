<script setup lang="ts">
import { tx } from '../composables/useTexts'
import NowContent from '../components/NowContent.vue'
import MadeWith from '@/components/ui/MadeWith.vue'
import { useData } from '../composables/useData'

const data = useData()
</script>

<template>
  <div class="cpage">
    <section class="hero">
      <img v-if="data.om?.bilde" :src="data.om.bilde" alt="" class="avatar rise" />
      <div>
        <div class="eyebrow rise" style="--i: 0">{{ tx('home.eyebrow', data.site?.undertittel) }}</div>
        <h1 class="rise" style="--i: 1">{{ tx('home.hello') }} <span class="grad">{{ tx('home.name', data.site?.navn) }}</span></h1>
        <p class="lead rise" style="--i: 2">{{ tx('home.intro', data.site?.intro) }}</p>
      </div>
    </section>

    <h2 class="now-title rise" style="--i: 3">{{ tx('home.now') }}</h2>
    <div class="rise" style="--i: 4"><NowContent /></div>
    <MadeWith />
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: center; gap: 32px; margin: 28px 0 36px; }
.avatar { width: 140px; height: 140px; border-radius: 50%; object-fit: cover; box-shadow: 0 10px 30px var(--accent-glow); border: 4px solid var(--glass-strong); flex: none; }
h1 { font-size: clamp(2.2rem, 5vw, 3.3rem); font-weight: 800; line-height: 1.08; }
.lead { max-width: 56ch; }
.lead { margin-top: 10px; }
.now-title { margin: 0 0 12px 4px; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-3); }
/* phones: compact – the logo is in the top bar, the photo sits beside the greeting, "Akkurat nå" is on the first screen */
@media (max-width: 720px) {
  .hero { gap: 14px; margin: 4px 0 22px; align-items: flex-start; }
  .avatar { width: 64px; height: 64px; border-width: 3px; }
  .hero .eyebrow { display: none; }
  h1 { font-size: 1.9rem; line-height: 1.1; }
  .lead { font-size: 0.95rem; margin-top: 6px; }
}
</style>
