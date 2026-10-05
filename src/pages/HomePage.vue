<script setup>
import BrandLogo from '../components/BrandLogo.vue'
import NowContent from '../components/NowContent.vue'
import { useData } from '../composables/useData'

const data = useData()
</script>

<template>
  <div class="cpage">
    <section class="hero">
      <img v-if="data.om?.bilde" :src="data.om.bilde" alt="" class="avatar rise" />
      <div>
        <BrandLogo class="home-logo rise" style="--i: 0" />
        <div class="eyebrow rise" style="--i: 0">{{ data.site?.undertittel || 'Velkommen' }}</div>
        <h1 class="rise" style="--i: 1">Hei, jeg er <span class="grad">{{ data.site?.navn || 'niben' }}</span></h1>
        <p class="lead rise" style="--i: 2">{{ data.site?.intro }}</p>
      </div>
    </section>

    <h2 class="now-title rise" style="--i: 3">Akkurat nå</h2>
    <div class="glass card rise" style="--i: 4"><NowContent /></div>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: center; gap: 28px; margin: 20px 0 40px; }
.avatar { width: 128px; height: 128px; border-radius: 50%; object-fit: cover; box-shadow: 0 10px 30px var(--accent-glow); border: 4px solid var(--glass-strong); flex: none; }
h1 { font-size: clamp(2.4rem, 6vw, 4rem); font-weight: 800; }
.lead { margin-top: 10px; }
.now-title { margin: 0 0 12px 4px; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-3); }
/* phones: compact – the logo is in the top bar, the photo sits beside the greeting, "Akkurat nå" is on the first screen */
@media (max-width: 720px) {
  .hero { gap: 14px; margin: 4px 0 22px; align-items: flex-start; }
  .avatar { width: 64px; height: 64px; border-width: 3px; }
  .home-logo, .hero .eyebrow { display: none; }
  h1 { font-size: 1.9rem; line-height: 1.1; }
  .lead { font-size: 0.95rem; margin-top: 6px; }
}
.home-logo { height: 64px; margin-bottom: 16px; }
</style>
