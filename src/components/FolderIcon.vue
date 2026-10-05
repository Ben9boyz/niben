<script setup>
// A folder with a picture lying on it (the cover of something in it) – or a plain folder when there is none.
defineProps({
  image: { type: String, default: null },
  size: { type: Number, default: 18 }, // height in px
  open: Boolean,
})
</script>

<template>
  <span class="fi" :class="{ open, plain: !image }" :style="{ '--s': `${size}px` }" aria-hidden="true">
    <i class="tab"></i>
    <span class="body"><img v-if="image" crossorigin="anonymous" :src="image" alt="" loading="lazy" /></span>
  </span>
</template>

<style scoped>
.fi { --back: color-mix(in srgb, var(--accent) 70%, #fff); position: relative; display: inline-block; flex: none; width: calc(var(--s) * 1.08); height: var(--s); vertical-align: middle; }
.tab { position: absolute; left: 0; top: 0; width: 46%; height: 24%; border-radius: 3px 4px 0 0; background: var(--back); }
.body { position: absolute; left: 0; right: 0; top: 14%; bottom: 0; overflow: hidden; border-radius: 2px 5px 5px 5px; background: var(--back); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); }
.fi:not(.plain) .body { border: 1.5px solid var(--back); }
.fi.plain .body { background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 55%, #fff), var(--accent)); }
.body img { display: block; width: 100%; height: 100%; object-fit: cover; }
.fi.open .body { transform: skewX(-6deg) scaleY(0.94); transform-origin: bottom left; }
</style>
