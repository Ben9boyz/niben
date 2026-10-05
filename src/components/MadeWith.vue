<script setup>
import { Sparkles } from 'lucide-vue-next'
</script>

<template>
  <p class="made" translate="no"><Sparkles :size="13" aria-hidden="true" />Laget med <a href="https://claude.com/claude-code" target="_blank" rel="noopener">Claude Code</a></p>
</template>

<style scoped>
.made { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 10px 0 0; color: var(--text-3); font-size: 0.78rem; opacity: 0.8; }
.made a { color: var(--text-2); text-decoration: underline; text-decoration-color: var(--glass-border); text-underline-offset: 3px; }
.made a:hover { color: var(--accent); }
</style>
