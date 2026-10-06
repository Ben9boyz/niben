<script setup lang="ts">
import DoorCards from '@/components/room/DoorCards.vue'
</script>

<template>
  <section class="panel glass">
    <header class="panel-head">
      <div class="eyebrow">Gangen</div>
      <h2>Rommene</h2>
      <p>Én dør per rom. Klikk på en dør i gangen, eller her.</p>
    </header>
    <div class="panel-body"><DoorCards compact /></div>
  </section>
</template>
