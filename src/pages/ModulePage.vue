<script setup lang="ts">
import { useRoute } from 'vue-router'
import ModuleView from '@/components/content/ModuleView.vue'
const route = useRoute()
</script>

<template>
  <div class="cpage mod-page"><ModuleView :id="String(route.params.id)" /></div>
</template>

<style scoped>
.mod-page { width: min(1000px, 100%); }
</style>
