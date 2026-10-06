<script setup lang="ts">
import { computed } from 'vue'
import { pitchMorae } from '@/composables/useJapanese'

// A reading in kana with its pitch accent drawn over it (a line over the high morae, a tick where it drops).
const props = withDefaults(defineProps<{ reading?: string | null; pitch?: string | null }>(), { reading: '', pitch: '' })
const morae = computed(() => pitchMorae(props.reading, props.pitch))
</script>

<template>
  <span class="pr" lang="ja"><template v-if="morae"><span v-for="(p, k) in morae" :key="k" class="mora" :class="{ high: p.high, drop: p.drop }">{{ p.m }}</span></template><template v-else>{{ reading }}</template></span>
</template>

<style scoped>
.pr { display: inline-flex; gap: 1px; }
.mora { position: relative; padding-top: 0.3em; border-top: 2px solid transparent; }
.mora.high { border-top-color: #2b6fd6; }
.mora.drop::after { content: ''; position: absolute; right: -1px; top: -2px; height: 0.65em; border-right: 2px solid #2b6fd6; }
</style>
