<script setup>
import JapanContent from '../components/JapanContent.vue'
</script>

<template>
  <div class="cpage japan">
    <header class="cpage-head">
      <div class="eyebrow">日本語</div>
      <h1>Japansk</h1>
      <p>Det jeg lærer på jpdb.</p>
    </header>
    <div class="glass card jp-card"><JapanContent /></div>
  </div>
</template>

<style scoped>
.japan { width: min(720px, 100%); }
.jp-card { container-type: inline-size; }
</style>
