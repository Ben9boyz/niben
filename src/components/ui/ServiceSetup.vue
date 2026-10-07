<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Check, KeyRound, ExternalLink, Settings2 } from 'lucide-vue-next'
import { api, errorMessage, canManage } from '@/composables/site/useAdmin'
import { reloadData } from '@/composables/site/useData'
import { loadJapanese } from '@/composables/japan/useJapanese'
import { loadSteam } from '@/composables/site/useSteam'

// A service a hobby fetches from, set up right where the hobby is: jpdb in Japansk, Steam in Spill, GitHub in Prosjekter.
// Not connected: a small card that says what it gives and takes the key. Connected: one quiet line (change / remove).
// Only the room's own account sees any of it; visitors just see the hobby.
const props = defineProps<{ service: 'jpdb' | 'steam' | 'github' }>()
interface Keys { jpdb: boolean; steam_id: string | null; steam_key: boolean; github_user: string | null }
const keys = ref<Keys | null>(null)
const open = ref(false)
const busy = ref(false)
const err = ref('')
const ok = ref('')
const a = ref('') // the key / the id / the user name
const b = ref('') // Steam: an own API key (optional)

const INFO = {
  jpdb: { name: 'jpdb', gives: 'Ordene du lærer, repetisjon og anime – rett fra jpdb.', label: 'API-nøkkel', ph: 'Lim inn nøkkelen', how: 'jpdb.io → Settings → API → «API key».', link: 'https://jpdb.io/settings', secret: true },
  steam: { name: 'Steam', gives: 'Profilen din, spillene og hva du spiller nå.', label: 'Steam-ID', ph: '76561198… eller lenken til profilen din', how: 'Profilen og spillene dine må være offentlige i Steam.', link: 'https://steamcommunity.com/my/edit/settings', secret: false },
  github: { name: 'GitHub', gives: 'Dine åpne prosjekter, med koden lesbar her.', label: 'Brukernavn', ph: 'navn eller lenken til profilen din', how: 'Bare åpne (public) prosjekter vises.', link: 'https://github.com', secret: false },
} as const
const info = computed(() => INFO[props.service])
const connected = computed(() => !!keys.value && (props.service === 'jpdb' ? keys.value.jpdb : props.service === 'steam' ? !!keys.value.steam_id : !!keys.value.github_user))
const who = computed(() => (props.service === 'steam' ? keys.value?.steam_id : props.service === 'github' ? keys.value?.github_user : null))

async function load(): Promise<void> {
  if (!canManage.value) return
  try { keys.value = (await api<{ keys: Keys }>('me_settings')).keys } catch { /* not mine after all */ }
}
onMounted(load)

async function after(): Promise<void> {
  await reloadData()
  if (props.service === 'jpdb') await loadJapanese(true)
  if (props.service === 'steam') await loadSteam(true)
}
async function save(clear = false): Promise<void> {
  busy.value = true
  err.value = ''
  ok.value = ''
  try {
    const body: Record<string, string> = props.service === 'jpdb' ? { jpdb_key: clear ? '' : a.value.trim() } : props.service === 'steam' ? { steam_id: clear ? '' : a.value.trim(), ...(b.value.trim() ? { steam_key: b.value.trim() } : {}) } : { github_user: clear ? '' : a.value.trim() }
    keys.value = (await api<{ keys: Keys }>('me_settings', body)).keys
    a.value = ''; b.value = ''; open.value = false
    ok.value = clear ? `${info.value.name} er koblet fra.` : `${info.value.name} er koblet til.`
    await after()
  } catch (e) { err.value = errorMessage(e) } finally { busy.value = false }
}
</script>

<template>
  <section v-if="canManage && keys" class="svc" :class="{ on: connected }">
    <template v-if="connected && !open">
      <p class="line"><Check :size="14" /> {{ info.name }} er koblet til<template v-if="who"> som <b>{{ who }}</b></template>.
        <button type="button" class="lk" @click="open = true; a = who ?? ''"><Settings2 :size="13" />Endre</button>
        <button type="button" class="lk" :disabled="busy" @click="save(true)">Koble fra</button>
      </p>
      <p v-if="ok" class="ok">{{ ok }}</p>
    </template>
    <form v-else class="card" @submit.prevent="save()">
      <header><KeyRound :size="16" /><b>Koble til {{ info.name }}</b></header>
      <p class="gives">{{ info.gives }} Bare du ser denne boksen.</p>
      <label class="field">
        <span>{{ info.label }}</span>
        <input v-model="a" :type="info.secret ? 'password' : 'text'" autocomplete="off" :placeholder="info.ph" />
        <small>{{ info.how }} <a :href="info.link" target="_blank" rel="noopener">Åpne {{ info.name }} <ExternalLink :size="11" /></a></small>
      </label>
      <label v-if="service === 'steam'" class="field"><span>Egen Steam API-nøkkel <small>(valgfritt – ellers brukes sidens)</small></span><input v-model="b" type="password" autocomplete="off" :placeholder="keys.steam_key ? '•••••••• (lagret)' : ''" /></label>
      <div class="btns">
        <button class="btn primary small" :disabled="busy || !a.trim()"><Check :size="14" />{{ busy ? 'Kobler til …' : 'Koble til' }}</button>
        <button v-if="connected" type="button" class="btn soft small" @click="open = false">Avbryt</button>
      </div>
      <p v-if="err" class="err">{{ err }}</p>
    </form>
  </section>
</template>

<style scoped>
.svc { margin: 0 0 14px; }
.line { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 0; font-size: 0.84rem; color: var(--text-3); }
.line b { color: var(--text-2); }
.lk { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; color: var(--accent); font-weight: 600; margin-left: 6px; }
.card { display: grid; gap: 10px; padding: 14px; border-radius: 16px; border: 1px dashed color-mix(in srgb, var(--accent) 45%, transparent); background: color-mix(in srgb, var(--accent) 6%, transparent); }
.card header { display: flex; align-items: center; gap: 8px; color: var(--accent); }
.gives { margin: 0; color: var(--text-3); font-size: 0.86rem; }
.field { display: grid; gap: 4px; font-size: 0.82rem; color: var(--text-3); }
.field input { padding: 9px 12px; border: 1px solid var(--glass-border); border-radius: 11px; background: var(--bg); color: var(--text); font: inherit; }
.field a { color: var(--accent); display: inline-flex; align-items: center; gap: 2px; }
.btns { display: flex; gap: 8px; } .btns .btn { display: inline-flex; align-items: center; gap: 6px; }
.err { color: #e5484d; margin: 0; font-size: 0.85rem; } .ok { color: #2fa84f; margin: 4px 0 0; font-size: 0.85rem; }
</style>
