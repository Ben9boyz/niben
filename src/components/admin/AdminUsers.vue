<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Check, Ban, Trash2, RotateCcw, Users } from 'lucide-vue-next'
import { api, errorMessage } from '../../composables/useAdmin'

// The owner's list of accounts: approve the ones that ask, switch one off, or remove it (with everything it made).
interface AccountRow {
  id: number; username: string; email: string; status: 'pending' | 'approved' | 'disabled'
  created: number; last_login: number
  counts: { trips: number; books: number; recordings: number; songs: number }
}
const users = ref<AccountRow[]>([])
const err = ref('')
const busy = ref(0)
const emit = defineEmits<{ pending: [n: number] }>()
const pending = computed(() => users.value.filter((u) => u.status === 'pending').length)

async function load() {
  try { users.value = (await api<{ users: AccountRow[] }>('admin_users')).users; err.value = ''; emit('pending', pending.value) } catch (e) { err.value = errorMessage(e) }
}
onMounted(load)
async function act(u: AccountRow, what: 'approve' | 'disable' | 'enable' | 'delete') {
  if (what === 'delete' && !confirm(`Slette ${u.username} for godt, med alle reiser, bøker, opptak og bilder? Det kan ikke angres.`)) return
  busy.value = u.id
  try { await api('admin_user_set', { id: u.id, do: what }); await load() } catch (e) { err.value = errorMessage(e) }
  busy.value = 0
}
const when = (t: number) => (t ? new Date(t * 1000).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : '–')
const LABEL = { pending: 'Venter', approved: 'Aktiv', disabled: 'Avslått' }
</script>

<template>
  <div>
    <p class="muted"><Users :size="14" /> {{ users.length - 1 }} kontoer<template v-if="pending"> · <b>{{ pending }} venter på godkjenning</b></template>. Nye kontoer kan ikke logge inn før du har godkjent dem.</p>
    <p class="muted">Skal en bruker kunne koble til Spotify? Legg da til navnet og Spotify-e-posten hennes i <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">Spotify-dashboardet</a> (appen din → User Management). Uten det slipper Spotify henne inn, men hylla hennes blir tom.</p>
    <p v-if="err" class="notice error">{{ err }}</p>
    <ul class="list">
      <li v-for="u in users" :key="u.id" :class="u.status">
        <div class="who">
          <b>{{ u.username }}</b><span v-if="u.id === 1" class="tag">deg</span><span v-else class="tag" :class="u.status">{{ LABEL[u.status] }}</span>
          <small>{{ u.email || 'hovedrommet' }} · opprettet {{ when(u.created) }}<template v-if="u.last_login"> · sist inne {{ when(u.last_login) }}</template></small>
          <small>{{ u.counts.trips }} reiser · {{ u.counts.books }} bøker · {{ u.counts.recordings }} opptak · {{ u.counts.songs }} sanger</small>
        </div>
        <div v-if="u.id !== 1" class="acts">
          <button v-if="u.status === 'pending'" class="btn primary small" :disabled="busy === u.id" @click="act(u, 'approve')"><Check :size="14" />Godkjenn</button>
          <button v-if="u.status === 'pending'" class="btn soft small" :disabled="busy === u.id" @click="act(u, 'disable')"><Ban :size="14" />Avslå</button>
          <button v-if="u.status === 'approved'" class="btn soft small" :disabled="busy === u.id" @click="act(u, 'disable')"><Ban :size="14" />Slå av</button>
          <button v-if="u.status === 'disabled'" class="btn soft small" :disabled="busy === u.id" @click="act(u, 'enable')"><RotateCcw :size="14" />Slå på</button>
          <button class="btn danger small" :disabled="busy === u.id" aria-label="Slett kontoen" @click="act(u, 'delete')"><Trash2 :size="14" /></button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.muted { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; color: var(--text-3); font-size: 0.88rem; margin: 0 0 12px; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 14px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
li.pending { border-color: var(--accent); }
.who { display: grid; gap: 2px; min-width: 0; }
.who small { color: var(--text-3); font-size: 0.78rem; overflow-wrap: anywhere; }
.tag { margin-left: 8px; padding: 2px 8px; border-radius: 999px; background: var(--glass-border); color: var(--text-2); font-size: 0.7rem; font-weight: 700; }
.tag.pending { background: var(--accent-soft); color: var(--accent); }
.tag.approved { background: rgba(58, 167, 109, 0.18); color: #3aa76d; }
.acts { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
.acts .btn { display: inline-flex; align-items: center; gap: 4px; }
@media (max-width: 640px) { li { flex-direction: column; align-items: stretch; } .acts { justify-content: flex-start; } }
</style>
