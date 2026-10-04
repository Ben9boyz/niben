<script setup>
import GamingContent from '../components/GamingContent.vue'
</script>

<template>
  <div class="cpage gaming">
    <header class="cpage-head">
      <div class="eyebrow">Gaming</div>
      <h1>Spillhjørnet</h1>
      <p>Hva jeg spiller på Steam.</p>
    </header>
    <div class="glass card"><GamingContent /></div>
  </div>
</template>

<style scoped>
.gaming { width: min(760px, 100%); }
</style>
