<script setup lang="ts">
import DoorCards from '@/components/room/DoorCards.vue'
</script>

<template>
  <div class="cpage gangen-page">
    <h2>Gangen</h2>
    <p class="lead">Én dør per rom. Gå inn hos en kompis – rommet bytter, og du står i oversikten deres.</p>
    <DoorCards />
  </div>
</template>

<style scoped>
.gangen-page { width: min(1000px, 100%); }
.lead { color: var(--text-2, var(--text-3)); margin: 0 0 24px; }
</style>
