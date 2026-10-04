<script setup>
import NowContent from '../components/NowContent.vue'
</script>

<template>
  <div class="cpage now-page">
    <header class="cpage-head">
      <div class="eyebrow">Nå</div>
      <h1>Det jeg gjør nå</h1>
      <p>Hva jeg hører på, leser, øver på og spiller – og hvor jeg har vært og skal.</p>
    </header>
    <div class="glass card"><NowContent /></div>
  </div>
</template>

<style scoped>
.now-page { width: min(760px, 100%); }
</style>
