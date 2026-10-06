<script setup lang="ts">
import { useRoute } from 'vue-router'
import ModuleView from '@/components/content/ModuleView.vue'
const route = useRoute()
</script>

<template>
  <section class="panel glass">
    <div class="panel-body"><ModuleView :id="String(route.params.id)" compact /></div>
  </section>
</template>
