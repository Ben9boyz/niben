<script setup>
defineProps({ value: { type: Number, default: 0 } })
</script>

<template>
  <span class="stars" :aria-label="`${value} av 5`">
    <svg v-for="i in 5" :key="i" viewBox="0 0 24 24" width="18" height="18" :class="{ on: i <= Math.round(value) }" :style="{ '--d': `${i * 60}ms` }">
      <path d="M12 2.8l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3L2.8 9.5l6.4-.9z" />
    </svg>
  </span>
</template>

<style scoped>
.stars { display: inline-flex; gap: 2px; }
svg { fill: var(--accent-soft); transition: fill 0.3s; }
svg.on { fill: var(--accent); animation: pop 0.5s var(--spring) both; animation-delay: var(--d); filter: drop-shadow(0 2px 6px var(--accent-glow)); }
@keyframes pop { from { transform: scale(0.2) rotate(-30deg); opacity: 0; } }
</style>
