<script setup lang="ts">
import { computed } from 'vue'
import { Lock } from 'lucide-vue-next'
import LockControl from './LockControl.vue'
import { lockLeft, fmtClock } from '@/composables/music/useSpotify'
import { admin } from '@/composables/site/useAdmin'

// The lock: the setting for me (admin), a countdown for everyone else while it's on.
const locked = computed(() => lockLeft.value > 0)
</script>

<template>
  <LockControl v-if="admin.mine" />
  <span v-else-if="locked" class="lockbtn" title="Ingen bytting – hør ferdig"><Lock :size="12" aria-hidden="true" />{{ fmtClock(lockLeft) }}</span>
</template>

<style scoped>
.lockbtn { display: flex; align-items: center; gap: 4px; padding: 2px 8px; border: 1px solid rgba(240, 160, 64, 0.5); border-radius: 999px; background: var(--glass); color: #b8711a; font: 600 0.68rem var(--font); }
</style>
