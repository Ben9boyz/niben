<script setup>
import { computed } from 'vue'
import { Lock } from 'lucide-vue-next'
import { useData } from '../composables/useData'
// The admin button: my own photo (the one on the about page) when there is one, else a lock. Only shown to me.
const data = useData()
const src = computed(() => data.om?.bilde || null)
</script>

<template>
  <router-link to="/admin" class="adm" title="Admin (innlogget)" aria-label="Admin" translate="no">
    <img v-if="src" :src="src" alt="" crossorigin="anonymous" />
    <Lock v-else :size="17" aria-hidden="true" />
    <i class="dot" aria-hidden="true"></i>
  </router-link>
</template>

<style scoped>
.adm { overflow: visible; place-self: stretch; position: relative; display: grid; place-items: center; width: 100%; height: 100%; aspect-ratio: 1 / 1; border-radius: 50%; color: var(--accent); }
.adm { }
.adm img { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 50%; object-fit: cover; box-shadow: 0 0 0 2px var(--accent); }
.dot { z-index: 1; }
.dot { position: absolute; right: 0; bottom: 0; width: 11px; height: 11px; border-radius: 50%; background: #1db954; border: 2px solid var(--bg); }
</style>
