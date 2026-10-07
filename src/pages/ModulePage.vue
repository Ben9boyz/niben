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
/* the head card above already names the hobby: here only its line about itself and the Ny key */
.mod-page :deep(.top h2) { display: none; }
</style>
