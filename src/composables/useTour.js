import { reactive, computed } from 'vue'

// The tour: the first time somebody opens the 3D room they get a short, quiet walk round it (the camera visits the
// stations, a small card says what's there). It can be skipped at any time and is never shown again; the settings menu
// has "Vis omvisningen". On phones it is three short cards without moving the camera (the panels would cover the room).
const KEY = 'niben-tour'
const DESK = [
  { route: '/', n: '1' }, { route: '/lytte', n: '2' }, { route: '/gitar', n: '3' }, { route: '/boker', n: '4' },
  { route: '/reiser', n: '5' }, { route: '/kode', n: '6' }, { route: '/japansk', n: '7' }, { route: '/om', n: '8' }, { route: '/', n: '9' },
]
const PHONE = [{ n: 'p1' }, { n: 'p2' }, { n: 'p3' }]

export const tour = reactive({ active: false, step: 0, phone: false })
export const steps = computed(() => (tour.phone ? PHONE : DESK))
export const current = computed(() => steps.value[tour.step] || null)

export const tourDone = () => { try { return localStorage.getItem(KEY) === 'done' } catch { return true } }
const markDone = () => { try { localStorage.setItem(KEY, 'done') } catch {} }

export function startTour(phone) {
  tour.phone = !!phone
  tour.step = 0
  tour.active = true
}
export function nextStep() {
  if (tour.step < steps.value.length - 1) tour.step++
  else endTour()
}
export function endTour() {
  tour.active = false
  markDone()
}
