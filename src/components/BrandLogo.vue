<script setup>
// The niben logo: N = a book (the letter is the cover, pages and back cover behind it), i = a plain i
// with a star for its dot, b = a guitar (neck = the tall stroke, body = the belly), e = the guitar
// cable writing it on its way to the amp, n = a piece of that cable in the amp.
// Flat "glass" style in the site's blues; colours follow the light/dark theme.
// mark: just the book-N (small places, e.g. a square icon).
defineProps({ mark: Boolean })
const uid = `nl${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <svg
    class="brand-logo"
    :viewBox="mark ? '0 0 128 140' : '0 0 381 140'"
    role="img"
    aria-label="niben"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient :id="`${uid}-cable`" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="var(--logo-cable-1)" />
        <stop offset="0.55" stop-color="var(--logo-cable-2)" />
        <stop offset="1" stop-color="var(--logo-cable-3)" />
      </linearGradient>
      <linearGradient :id="`${uid}-glass`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--logo-glass-hi)" />
        <stop offset="1" stop-color="var(--logo-glass)" />
      </linearGradient>
      <linearGradient :id="`${uid}-body`" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--logo-cable-1)" />
        <stop offset="1" stop-color="var(--logo-cable-3)" />
      </linearGradient>
    </defs>

    <!-- N: a book – the letter is the front cover, with the pages and the back cover behind it -->
    <defs>
      <path :id="`${uid}-n`" d="M14 112 L36 34 L58 34 L76 84 L90 34 L110 34 L88 112 L66 112 L48 62 L34 112 Z" />
      <linearGradient :id="`${uid}-cover`" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--logo-cover-1)" />
        <stop offset="1" stop-color="var(--logo-cover-2)" />
      </linearGradient>
    </defs>
    <g stroke="var(--logo-line)" stroke-linejoin="round">
      <use :href="`#${uid}-n`" transform="translate(10 9)" fill="var(--logo-cable-3)" stroke-width="3" />
      <!-- bookmark ribbon peeking out at the bottom -->
      <path fill="#e5533d" stroke-width="2.2" d="M74 110 L84 110 L84 132 L79 127 L74 132 Z" />
      <use :href="`#${uid}-n`" transform="translate(6 5.5)" fill="var(--logo-page)" stroke-width="2.2" />
    </g>
    <!-- page edges -->
    <g fill="none" stroke="var(--logo-page-line)" stroke-width="1.3" stroke-linejoin="round">
      <use :href="`#${uid}-n`" transform="translate(2.5 2.2)" />
      <use :href="`#${uid}-n`" transform="translate(4.5 4)" />
      <use :href="`#${uid}-n`" transform="translate(7.5 6.8)" />
    </g>
    <use :href="`#${uid}-n`" :fill="`url(#${uid}-cover)`" stroke="var(--logo-line)" stroke-width="3" stroke-linejoin="round" />
    <!-- a little shine along the cover's top edges -->
    <path fill="none" stroke="var(--logo-glass-hi)" stroke-width="2" stroke-linecap="round" opacity="0.55" d="M38.5 38 L55 38 M92.5 38 L106 38" />

    <template v-if="!mark">
    <!-- everything after the N, pulled in closer to it -->
    <g transform="translate(-11 0)">
      <!-- i: a plain i with the star as its dot -->
      <rect x="140" y="80" width="13" height="44" rx="6.5" :fill="`url(#${uid}-cover)`" stroke="var(--logo-line)" stroke-width="3" />
      <path fill="var(--logo-star)" stroke="var(--logo-line)" stroke-width="2.6" stroke-linejoin="round" d="M146.5 51 Q148.4 61.6 159 63.5 Q148.4 65.4 146.5 76 Q144.6 65.4 134 63.5 Q144.6 61.6 146.5 51 Z" />

      <!-- b: the guitar – the neck is the b's tall stroke, the body its round belly -->
      <g stroke="var(--logo-line)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path :fill="`url(#${uid}-cover)`" d="M166 22 Q165 12 173 11 L178 11 Q184 12 182 19 L180 34 L167 34 Z" />
        <rect x="166.5" y="32" width="11" height="62" rx="3" fill="var(--logo-page)" />
        <path :fill="`url(#${uid}-cover)`" d="M165 92 Q166 80 178 82 Q186 75 197 82 Q212 89 213 106 Q214 125 194 127 Q174 129 167 119 Q162 110 165 92 Z" />
      </g>
      <g fill="var(--logo-page)" stroke="none">
        <circle cx="172" cy="16" r="1.8" />
        <circle cx="177" cy="16" r="1.8" />
        <rect x="181" y="96" width="22" height="4.5" rx="2.2" />
        <rect x="181" y="104" width="22" height="4.5" rx="2.2" />
        <rect x="181" y="112" width="22" height="4.5" rx="2.2" />
      </g>

      <!-- e: the cable from the guitar's jack writes the e on its way to the amp -->
      <circle cx="209" cy="120" r="4.6" fill="var(--logo-page)" stroke="var(--logo-line)" stroke-width="2.5" />
      <path
        fill="none"
        :stroke="`url(#${uid}-cable)`"
        stroke-width="11"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M211 122 C221 125 226 111 232 99 C244 96 260 97 262 88 C264 77 245 74 236 88 C227 103 234 127 257 125 C277 123 286 100 299 95"
      />
      <path
        fill="none"
        stroke="var(--logo-cable-hi)"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.75"
        d="M236 86 C227 101 234 125 257 123 M279 116 C288 102 293 97 297 96"
      />

      <!-- (moved left to sit right after the e) -->
      <g transform="translate(-72 0)">
      <!-- n: in an amp -->
      <g stroke="var(--logo-line)" stroke-width="3.5" stroke-linejoin="round">
        <path fill="none" stroke-width="5" stroke-linecap="round" d="M392 54 L392 44 Q392 38 398 38 L428 38 Q434 38 434 44 L434 54" />
        <rect x="372" y="52" width="86" height="76" rx="15" :fill="`url(#${uid}-cover)`" />
        <rect x="383" y="78" width="64" height="40" rx="8" fill="var(--logo-page)" stroke-width="2.5" />
        <circle cx="430" cy="65" r="5" fill="var(--logo-page)" stroke-width="2.5" />
        <circle cx="444" cy="65" r="5" fill="var(--logo-page)" stroke-width="2.5" />
        <circle cx="371" cy="95" r="6" fill="var(--logo-page)" stroke-width="2.5" />
        <path fill="none" stroke="var(--logo-line)" stroke-width="3" d="M380 135 L380 130 M450 135 L450 130" stroke-linecap="round" />
      </g>
      <!-- n: a piece of the same cable – one soft arch with a hook in and a flick out, like the original -->
      <path fill="none" :stroke="`url(#${uid}-cable)`" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" d="M390 107 C392 114 397 115 400 107 C404 94 408 84 416 84 C424 84 427 94 430 104 C432 112 436 115 442 111" />
      <path fill="none" stroke="var(--logo-cable-hi)" stroke-width="2.5" stroke-linecap="round" opacity="0.7" d="M401 102 C405 92 409 86 415 86 C420 86 423 90 425 96" />
      </g>
    </g>
    </template>
  </svg>
</template>

<style scoped>
.brand-logo { display: block; height: 100%; width: auto; overflow: visible; }
</style>
