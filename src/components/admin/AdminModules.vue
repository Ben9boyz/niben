<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Trash2, Move, Plus, Eye, EyeOff } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { decor, loadDecor, changed, removeDecor } from '@/composables/room/useDecor'
import { placed, addModule, modState } from '@/composables/room/useModules'
import { CATALOG, CATEGORIES } from '@/lib/modules/catalog'
import { mode } from '@/composables/ui/useMode'

// Hobbies: pick the ones you want from the list – each becomes a piece of furniture in the room, a page, and a tab in the menu.
onMounted(loadDecor)
const router = useRouter()
const busy = ref('')
const groups = computed(() => CATEGORIES.map((c) => ({ cat: c, kinds: CATALOG.filter((k) => k.cat === c) })))
async function add(type: string) {
  busy.value = type
  const it = await addModule(type)
  busy.value = ''
  if (it) void router.push({ name: 'modul', params: { id: it.id } })
}
const askRemove = (id: string, name: string) => { if (confirm(`Slette «${name}» og alt som står i den?`)) void removeDecor(id) }
function edit() { decor.editing = true; if (mode.value !== 'rom') void router.push('/') }
</script>

<template>
  <div class="am">
    <p class="intro">Velg hobbyene du vil ha. Hver blir et møbel i 3D-rommet, en side og en fane i menyen. Du kan ha flere av samme sort, og flytte dem rundt med «Rediger rommet».</p>
    <p v-if="modState.error" class="notice error">{{ modState.error }}</p>

    <section v-if="placed.length">
      <h3>I rommet ditt</h3>
      <div class="bar"><button class="btn primary" @click="edit"><Move :size="15" aria-hidden="true" />Flytt rundt i rommet</button></div>
      <ul class="list">
        <li v-for="m in placed" :key="m.id" :class="{ off: m.item.visible === false }">
          <span class="ic">{{ m.kind.icon }}</span>
          <input v-model="m.item.name" type="text" maxlength="50" :placeholder="m.kind.name" :aria-label="`Navn på ${m.kind.name}`" @change="changed()" />
          <router-link class="btn soft small" :to="{ name: 'modul', params: { id: m.id } }">Åpne</router-link>
          <button class="ib" :title="m.item.visible === false ? 'Vis i rommet' : 'Skjul i rommet'" @click="m.item.visible = m.item.visible === false; changed()"><EyeOff v-if="m.item.visible !== false" :size="16" /><Eye v-else :size="16" /></button>
          <button class="ib danger" title="Slett" aria-label="Slett" @click="askRemove(m.id, m.name)"><Trash2 :size="16" /></button>
        </li>
      </ul>
    </section>

    <section v-for="g in groups" :key="g.cat">
      <h3>{{ g.cat }}</h3>
      <div class="grid">
        <button v-for="k in g.kinds" :key="k.id" class="kind" :style="{ '--mc': k.color }" :disabled="busy === k.id" @click="add(k.id)">
          <span class="e">{{ k.icon }}</span><b>{{ k.name }}</b><small>{{ k.blurb }}</small><Plus class="p" :size="15" aria-hidden="true" />
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.am { display: grid; gap: 18px; }
.intro { margin: 0; color: var(--text-3); font-size: 0.86rem; line-height: 1.45; }
h3 { margin: 0 0 8px; font-size: 0.95rem; }
.bar { margin-bottom: 8px; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.list li { display: flex; align-items: center; gap: 8px; } .off { opacity: 0.55; }
.list input { flex: 1; min-width: 0; padding: 8px 10px; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--bg); color: var(--text); font: inherit; }
.ic { font-size: 1.4rem; }
.ib { all: unset; cursor: pointer; padding: 6px; border-radius: 8px; } .ib:hover { background: var(--glass-border); } .danger { color: #e5484d; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.kind { all: unset; box-sizing: border-box; position: relative; display: flex; flex-direction: column; gap: 3px; padding: 12px; border-radius: 16px; border: 1px solid var(--glass-border); cursor: pointer; background: color-mix(in srgb, var(--mc) 8%, transparent); transition: transform 0.25s var(--spring, ease), border-color 0.2s; }
.kind:hover, .kind:focus-visible { transform: translateY(-3px); border-color: var(--mc); }
.kind .e { font-size: 1.7rem; } .kind small { color: var(--text-3); font-size: 0.76rem; line-height: 1.3; }
.kind .p { position: absolute; top: 10px; right: 10px; color: var(--mc); }
</style>
