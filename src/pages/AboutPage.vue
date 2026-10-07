<script setup lang="ts">
import AboutContent from '@/components/content/AboutContent.vue'
</script>

<template>
  <div class="cpage about-page">
    <AboutContent />
  </div>
</template>

<style scoped>
.about-page { width: min(var(--page-max, 1360px), 100%); }
</style>
