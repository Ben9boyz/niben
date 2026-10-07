<script setup lang="ts">
import DoorCards from '@/components/room/DoorCards.vue'
</script>

<template>
  <!-- the title and the line about it are in the page's head card (PageHead); here: the wall of doors -->
  <div class="cpage gangen-page">
    <section class="wall"><DoorCards /></section>
  </div>
</template>

<style scoped>
.wall { padding: 28px; border-radius: 30px; background: var(--sk-surface, var(--glass-strong)); border: var(--sk-border, 1px solid var(--glass-border)); box-shadow: var(--sk-surface-sh, var(--shadow-2)); }
@media (max-width: 720px) { .wall { padding: 18px; border-radius: 24px; } }
</style>
