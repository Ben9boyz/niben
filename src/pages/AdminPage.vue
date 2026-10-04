<script setup>
import AdminPanel from '../panels/AdminPanel.vue'
</script>

<template>
  <div class="cpage wide"><AdminPanel /></div>
</template>

<style scoped>
.wide { width: min(900px, 100%); }
.wide :deep(.admin) { max-height: none; }
.wide :deep(.body) { overflow: visible; }
</style>
