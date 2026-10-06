<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { Check, ShieldCheck, LogIn, LogOut, UserPlus, DoorOpen } from 'lucide-vue-next'
import { rooms, loadRooms, setRoom } from '@/composables/room/useRooms'
import { admin, account, signedIn, login, userLogin, logout, errorMessage } from '@/composables/site/useAdmin'
import { useData } from '@/composables/site/useData'
import { thumb } from '@/lib/photos'
import { targetEl } from '@/lib/dom'

// Who is here, and where: the button always shows the picture of the room I am standing in (also without an account). The menu has
// the rooms to change between, Admin for my own room, and logging in / out. The green dot is only there when I am logged in AND
// standing in my own room – that is where I can change things.
const data = useData()
const route = useRoute()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const pos = ref<Record<string, string>>({})
onMounted(loadRooms)

const here = computed(() => rooms.list.find((r) => r.username === rooms.current) ?? null)
const roomName = computed(() => here.value?.username ?? data.profile.username)
const photo = computed(() => here.value?.photo || data.om?.bilde || null)
const mine = computed(() => signedIn.value && admin.mine)
const myRoomName = computed(() => account.user?.username || null)

const loginOpen = ref(false)
const lgUser = ref('')
const lgPass = ref('')
const lgErr = ref('')
const lgBusy = ref(false)
async function doLogin() {
  lgErr.value = ''
  lgBusy.value = true
  try {
    if (lgUser.value.trim()) await userLogin(lgUser.value, lgPass.value)
    else { await login(lgPass.value); location.reload() }
  } catch (e) { lgErr.value = errorMessage(e) } finally { lgBusy.value = false }
}

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  const r = root.value?.getBoundingClientRect()
  if (!r) return
  const phone = innerWidth <= 720
  pos.value = { visibility: 'hidden', left: '0px', top: '0px' }
  await nextTick()
  const h = menuEl.value?.offsetHeight || 260, w = menuEl.value?.offsetWidth || 280
  const left = phone ? Math.max(8, Math.min(innerWidth - w - 10, r.right - w)) : Math.min(r.right + 10, innerWidth - w - 8)
  const top = phone ? Math.min(r.bottom + 8, innerHeight - h - 24) : Math.min(r.top, innerHeight - h - 24)
  pos.value = { left: `${left}px`, top: `${Math.max(8, top)}px` }
}
const close = () => { open.value = false }
const onDoc = (e: Event) => { if (open.value && !root.value?.contains(targetEl(e)) && !menuEl.value?.contains(targetEl(e))) close() }
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
onMounted(() => { document.addEventListener('pointerdown', onDoc); window.addEventListener('keydown', onKey); window.addEventListener('resize', close) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', onDoc); window.removeEventListener('keydown', onKey); window.removeEventListener('resize', close) })
watch(() => route.fullPath, close)
</script>

<template>
  <button ref="root" class="sm profile glass" :class="{ on: open }" :title="`Rommet: ${roomName}`" :aria-label="`Rom og konto – du står i ${roomName}`" aria-haspopup="menu" :aria-expanded="open" @click="toggle">
    <img v-if="photo" :src="thumb(photo, 400)" alt="" crossorigin="anonymous" />
    <span v-else class="ini" aria-hidden="true">{{ roomName.slice(0, 1).toUpperCase() }}</span>
    <i v-if="mine" class="dot" aria-hidden="true"></i>
  </button>
  <teleport to="body">
    <transition name="fade">
      <div v-if="open" ref="menuEl" class="smenu glass" role="menu" translate="no" :style="pos" @click.stop>
        <div v-if="rooms.list.length > 1" class="grp first"><span class="cap">Rom</span></div>
        <button v-for="r in rooms.list.length > 1 ? rooms.list : []" :key="r.username" class="row" role="menuitem" @click="close(); if (r.username !== rooms.current) void setRoom(r.username)">
          <img v-if="r.photo" class="av" :src="thumb(r.photo, 400)" alt="" crossorigin="anonymous" /><span v-else class="av ph">{{ r.username.slice(0, 1).toUpperCase() }}</span>
          <span class="l"><b>{{ r.username }}<small v-if="r.owner"> · hovedrommet</small></b><small v-if="r.tagline">{{ r.tagline }}</small></span>
          <Check v-if="r.username === rooms.current" :size="16" aria-hidden="true" />
        </button>
        <div v-if="rooms.list.length <= 1" class="grp first"><span class="cap">Du står i</span><div class="row cur"><span class="l"><b>{{ roomName }}</b></span></div></div>

        <template v-if="signedIn">
          <div class="grp">
            <router-link v-if="mine" to="/admin" class="row" role="menuitem" @click="close"><ShieldCheck :size="16" aria-hidden="true" /><span class="l"><b>Admin</b><small>Styr rommet ditt</small></span></router-link>
            <button v-else-if="myRoomName" class="row" role="menuitem" @click="close(); void setRoom(myRoomName)"><DoorOpen :size="16" aria-hidden="true" /><span class="l"><b>Til rommet mitt</b><small>For å styre det</small></span></button>
            <button class="row" role="menuitem" @click="close(); void logout()"><LogOut :size="16" aria-hidden="true" /><span class="l"><b>Logg ut</b></span></button>
          </div>
        </template>
        <div v-else class="grp">
          <button class="row" role="menuitem" :aria-expanded="loginOpen" @click="loginOpen = !loginOpen"><LogIn :size="16" aria-hidden="true" /><span class="l"><b>Logg inn</b><small>Styr rommet ditt</small></span></button>
          <form v-if="loginOpen" class="lgf" @submit.prevent="doLogin">
            <input v-model="lgUser" placeholder="Brukernavn eller e-post (tomt = admin)" autocomplete="username" autocapitalize="none" spellcheck="false" />
            <input v-model="lgPass" type="password" placeholder="Passord" autocomplete="current-password" required />
            <p v-if="lgErr" class="lge" role="alert">{{ lgErr }}</p>
            <button class="go" :disabled="lgBusy || !lgPass">{{ lgBusy ? 'Logger inn …' : 'Logg inn' }}</button>
            <router-link to="/admin" class="reg" @click="close"><UserPlus :size="13" aria-hidden="true" />Ingen konto? Opprett en</router-link>
            <router-link :to="{ path: '/admin', query: { forgot: '1' } }" class="reg" @click="close">Glemt passord?</router-link>
          </form>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style>
.sm.profile { position: relative; display: grid; place-items: center; width: 50px; height: 50px; padding: 0; border: 0; border-radius: 50%; color: var(--text-2); cursor: pointer; transition: transform 0.4s var(--spring), color 0.2s; }
.sm.profile:hover, .sm.profile.on { color: var(--accent); transform: scale(1.06); }
.sm.profile img { position: absolute; inset: 3px; width: calc(100% - 6px); height: calc(100% - 6px); border-radius: 50%; object-fit: cover; box-shadow: 0 0 0 2px var(--glass-border); }
.sm.profile .ini { font-weight: 800; font-size: 1.05rem; color: var(--accent); }
.sm.profile .dot { position: absolute; right: 1px; bottom: 1px; width: 11px; height: 11px; border-radius: 50%; background: #1db954; border: 2px solid var(--bg); }
.smenu .av { flex: none; width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
.smenu .av.ph { display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-weight: 800; }
.smenu .grp.first { border-top: 0; padding-top: 2px; }
.smenu .row.cur { cursor: default; }
.smenu .row.cur:hover { background: transparent; }
@media (max-width: 720px) { html body .sm.profile { width: 40px; height: 40px; } html body .sm.sm.profile { right: 62px; } }
</style>
