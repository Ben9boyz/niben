<script setup>
// The niben logo: N = an open book with < > and a star (books, code, travel), i = a guitar with a
// note for its dot, "be" = the guitar cable writing the letters, n = sitting in an amp.
// Flat "glass" style in the site's blues; colours follow the light/dark theme.
// mark: just the book-N (small places, e.g. a square icon).
defineProps({ mark: Boolean })
const uid = `nl${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <svg
    class="brand-logo"
    :viewBox="mark ? '0 0 128 140' : '0 0 462 140'"
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

    <!-- N: open book -->
    <g stroke="var(--logo-line)" stroke-width="3.5" stroke-linejoin="round">
      <path :fill="`url(#${uid}-glass)`" d="M10 36 Q10 25 20 29 L44 39 Q52 43 52 52 L52 112 Q52 123 42 119 L19 109 Q10 105 10 96 Z" />
      <path :fill="`url(#${uid}-glass)`" d="M118 36 Q118 25 108 29 L84 39 Q76 43 76 52 L76 112 Q76 123 86 119 L109 109 Q118 105 118 96 Z" />
      <!-- the N's diagonal: from the top of the left page to the foot of the right one -->
      <path d="M45 42 L83 116" stroke-width="22" stroke-linecap="round" />
      <path d="M45 42 L83 116" :stroke="`url(#${uid}-glass)`" stroke-width="15" stroke-linecap="round" />
    </g>
    <g fill="none" stroke="var(--logo-ink)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M36 64 L25 76 L36 88" />
      <path d="M92 64 L103 76 L92 88" />
    </g>
    <path fill="var(--logo-star)" stroke="var(--logo-line)" stroke-width="3" stroke-linejoin="round" d="M64 2 Q66.5 13.5 78 16 Q66.5 18.5 64 30 Q61.5 18.5 50 16 Q61.5 13.5 64 2 Z" />

    <template v-if="!mark">
      <!-- i: guitar, with a note as the dot -->
      <g transform="translate(152 127) scale(0.68) translate(-152 -127)">
      <g stroke="var(--logo-line)" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round">
        <path fill="var(--logo-glass)" d="M146 18 Q146 9 154 9 L157 9 Q162 9 161 15 L159 36 L148 36 Z" />
        <rect x="148.5" y="34" width="10" height="44" rx="3" fill="var(--logo-glass-hi)" />
        <path :fill="`url(#${uid}-body)`" d="M144 76 Q137 66 132 70 Q127 76 134 88 Q124 98 128 112 Q133 128 152 127 Q170 128 174 114 Q178 100 168 92 Q174 80 168 72 Q162 68 160 78 Z" />
      </g>
      <g fill="var(--logo-glass-hi)" stroke="none">
        <rect x="143" y="91" width="22" height="5" rx="2.5" />
        <rect x="143" y="100" width="22" height="5" rx="2.5" />
        <rect x="143" y="109" width="22" height="5" rx="2.5" />
      </g>
      </g>
      <!-- the note is the dot over the i -->
      <g fill="var(--logo-star)" stroke="var(--logo-line)" stroke-width="2.6" stroke-linejoin="round">
        <ellipse cx="149" cy="35" rx="6.5" ry="5" transform="rotate(-18 149 35)" />
        <path d="M154 34 L154 13 Q161 15 165 21 Q160 19 156 20 L156 34" />
      </g>

      <!-- "be": the cable from the guitar's jack, writing the letters on its way to the amp -->
      <circle cx="164" cy="122" r="5" fill="var(--logo-glass-hi)" stroke="var(--logo-line)" stroke-width="2.5" />
      <path
        id="cable"
        fill="none"
        :stroke="`url(#${uid}-cable)`"
        stroke-width="11"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M166 123 C186 128 198 116 207 100 C219 79 238 44 249 22 C255 9 246 4 238 13 C229 24 227 70 227 112 C227 126 243 131 256 125 C271 117 275 97 263 92 C254 89 248 96 255 99 C264 102 276 99 288 97 C300 96 316 97 318 88 C320 77 301 74 292 88 C283 103 290 127 313 125 C335 123 344 98 371 95"
      />
      <path
        fill="none"
        stroke="var(--logo-cable-hi)"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.75"
        d="M209 96 C220 76 236 44 246 24 M228 108 C228 121 241 127 253 123 M292 86 C283 101 290 125 313 123 M335 116 C344 102 352 97 365 95"
      />

      <!-- n: in an amp -->
      <g stroke="var(--logo-line)" stroke-width="3.5" stroke-linejoin="round">
        <path fill="none" stroke-width="5" stroke-linecap="round" d="M392 54 L392 44 Q392 38 398 38 L428 38 Q434 38 434 44 L434 54" />
        <rect x="372" y="52" width="86" height="76" rx="15" :fill="`url(#${uid}-glass)`" />
        <rect x="383" y="78" width="64" height="40" rx="8" fill="var(--logo-grille)" stroke-width="2.5" />
        <circle cx="430" cy="65" r="5" fill="var(--logo-knob)" stroke-width="2.5" />
        <circle cx="444" cy="65" r="5" fill="var(--logo-knob)" stroke-width="2.5" />
        <circle cx="371" cy="95" r="6" fill="var(--logo-glass-hi)" stroke-width="2.5" />
        <path fill="none" stroke="var(--logo-line)" stroke-width="3" d="M380 135 L380 130 M450 135 L450 130" stroke-linecap="round" />
      </g>
      <!-- n: a piece of the same cable – one soft arch with a hook in and a flick out, like the original -->
      <path fill="none" :stroke="`url(#${uid}-cable)`" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" d="M390 107 C392 114 397 115 400 107 C404 94 408 84 416 84 C424 84 427 94 430 104 C432 112 436 115 442 111" />
      <path fill="none" stroke="var(--logo-cable-hi)" stroke-width="2.5" stroke-linecap="round" opacity="0.7" d="M401 102 C405 92 409 86 415 86 C420 86 423 90 425 96" />
    </template>
  </svg>
</template>

<style scoped>
.brand-logo { display: block; height: 100%; width: auto; overflow: visible; }
</style>
