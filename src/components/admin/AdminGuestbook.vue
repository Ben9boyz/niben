<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Check, Trash2, MessageCircle } from 'lucide-vue-next'
import { api, errorMessage } from '@/composables/site/useAdmin'

// Greetings written in this room's guestbook wait here until they are approved.
interface Entry { id: number; name: string; msg: string; t: number; status: string }
const items = ref<Entry[]>([])
const err = ref('')
const pending = computed(() => items.value.filter((g) => g.status === 'pending').length)
async function load() { try { items.value = (await api<{ items: Entry[] }>('admin_guestbook')).items } catch (e) { err.value = errorMessage(e) } }
async function act(id: number, what: 'approve' | 'delete') { try { await api('admin_guestbook_set', { id, do: what }); await load() } catch (e) { err.value = errorMessage(e) } }
onMounted(load)
</script>

<template>
  <div class="gb">
    <h3><MessageCircle :size="16" /> Gjestebok <span class="pill" :class="{ bad: pending }">{{ pending ? `${pending} venter` : 'Ingen venter' }}</span></h3>
    <p class="muted">Hilsener vises ikke i rommet ditt før du har godkjent dem.</p>
    <p v-if="err" class="notice error">{{ err }}</p>
    <ul v-if="items.length">
      <li v-for="g in items" :key="g.id" :class="g.status">
        <div class="m"><b translate="no">{{ g.name }}</b><small>{{ new Date(g.t * 1000).toLocaleString('nb-NO') }} · {{ g.status === 'pending' ? 'venter' : 'godkjent' }}</small><p translate="no">{{ g.msg }}</p></div>
        <div class="a"><button v-if="g.status === 'pending'" class="btn primary small" @click="act(g.id, 'approve')"><Check :size="14" />Godkjenn</button><button class="x" aria-label="Slett" @click="act(g.id, 'delete')"><Trash2 :size="14" /></button></div>
      </li>
    </ul>
    <p v-else class="muted">Ingen hilsener ennå.</p>
  </div>
</template>

<style scoped>
h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; font-size: 1.05rem; }
.muted { color: var(--text-3); font-size: 0.86rem; margin: 0 0 12px; }
.pill { padding: 2px 10px; border-radius: 999px; font-size: 0.78rem; background: var(--glass-border); color: var(--text-2); font-weight: 500; }
.pill.bad { background: color-mix(in srgb, #e0705f 25%, transparent); color: var(--text); }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
li { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; padding: 10px 12px; border-radius: 12px; background: var(--accent-soft); }
li.pending { outline: 1px solid var(--accent); }
.m { display: grid; gap: 2px; min-width: 0; }
.m small { color: var(--text-3); }
.m p { margin: 4px 0 0; overflow-wrap: anywhere; }
.a { display: flex; gap: 6px; align-items: center; flex: none; }
.x { border: 0; background: transparent; color: var(--text-3); cursor: pointer; padding: 6px; border-radius: 8px; }
.x:hover { color: #e0705f; }
</style>
