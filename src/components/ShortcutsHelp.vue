<script setup>
import { X, Keyboard } from 'lucide-vue-next'
import { shortcuts, SHORTCUT_GROUPS } from '../composables/useShortcuts'
</script>

<template>
  <transition name="fade">
    <div v-if="shortcuts.open" class="sc-bg" @click.self="shortcuts.open = false">
      <section class="sc glass" role="dialog" aria-label="Hurtigtaster">
        <header>
          <Keyboard :size="18" aria-hidden="true" /><h2>Hurtigtaster</h2>
          <button class="x" aria-label="Lukk" @click="shortcuts.open = false"><X :size="16" /></button>
        </header>
        <div class="body">
          <div v-for="g in SHORTCUT_GROUPS" :key="g.title" class="grp">
            <h3>{{ g.title }}</h3>
            <dl>
              <template v-for="[k, d] in g.keys" :key="k + d">
                <dt><kbd v-for="(part, i) in k.split(/\s+\+\s+|\s+eller\s+/)" :key="i">{{ part }}</kbd></dt>
                <dd>{{ d }}</dd>
              </template>
            </dl>
          </div>
        </div>
        <p class="hint">Musikk-tastene virker når du er logget inn og noe spiller. Trykk <kbd>?</kbd> når som helst.</p>
      </section>
    </div>
  </transition>
</template>

<style scoped>
.sc-bg { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 16px; background: rgba(0, 0, 0, 0.35); }
.sc { width: min(560px, 100%); max-height: min(86dvh, 720px); display: flex; flex-direction: column; border-radius: 24px; background: var(--bg); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35); overflow: hidden; }
header { display: flex; align-items: center; gap: 10px; padding: 16px 18px 8px; color: var(--accent); }
header h2 { margin: 0; flex: 1; font-size: 1.1rem; color: var(--text); }
.x { display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 50%; background: var(--glass-strong); color: var(--text-2); cursor: pointer; }
.body { overflow-y: auto; padding: 4px 18px 8px; display: grid; gap: 14px; }
h3 { margin: 6px 0 6px; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-3); }
dl { display: grid; grid-template-columns: minmax(150px, auto) 1fr; gap: 6px 14px; margin: 0; align-items: center; }
dt { display: flex; gap: 4px; flex-wrap: wrap; }
dd { margin: 0; font-size: 0.88rem; color: var(--text-2); }
kbd { display: inline-block; min-width: 24px; padding: 3px 8px; border: 1px solid var(--glass-border); border-bottom-width: 2px; border-radius: 7px; background: var(--glass-strong); color: var(--text); font: 600 0.78rem ui-monospace, SFMono-Regular, Menlo, monospace; text-align: center; }
.hint { margin: 0; padding: 8px 18px 16px; font-size: 0.78rem; color: var(--text-3); }
@media (max-width: 520px) { dl { grid-template-columns: 1fr; } dt { margin-top: 6px; } }
</style>
