import { computed, watch } from 'vue'
import { siteTexts } from '@/composables/site/useTexts'

// The room's material ("stil"): what its buttons, cards and tabs are made of. Like the accent colour, the owner picks it
// under Admin → Rommet → Utseende and it is kept with the room's texts (key theme.skin), so every visitor sees the owner's choice.
// A room that has not chosen gets Taster. 'alu' is the site's first look (style.css alone, no data-skin).
// Every skin takes its colour from the accent, so all of them work with any colour. The looks live in skins.css.
export const SKIN_KEY = 'theme.skin'
export type SkinId = 'keys' | 'clay' | 'material' | 'skeu' | 'flat' | 'glass' | 'alu'
export const DEFAULT_SKIN: SkinId = 'keys'
export const SKINS: { id: SkinId; label: string; hint: string }[] = [
  { id: 'keys', label: 'Taster', hint: 'Myk plast med lysende prikker (standard)' },
  { id: 'clay', label: 'Leire', hint: 'Matt og kornete, koselig' },
  { id: 'material', label: 'Material', hint: 'Toner av fargen din, runde knapper' },
  { id: 'skeu', label: 'Skeuomorf', hint: 'Lin, papir og blanke knapper' },
  { id: 'flat', label: 'Flat', hint: 'Ingen skygger, rene former' },
  { id: 'glass', label: 'Glass', hint: 'Frostet glass over farger' },
  { id: 'alu', label: 'Aluminium', hint: 'Børstet metall og glass' },
]

/** The skin a stored value means: a known id, else the standard (Taster). */
export function validSkin(v: string | null | undefined): SkinId {
  const s = (v ?? '').trim()
  return SKINS.some((k) => k.id === s) ? (s as SkinId) : DEFAULT_SKIN
}

export const skinId = computed(() => validSkin(siteTexts[SKIN_KEY]))

// Material is drawn in Roboto Flex – fetched the first time a room asks for it, never otherwise
let robotoAsked = false
function loadRoboto(): void {
  if (robotoAsked) return
  robotoAsked = true
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = 'https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,400;8..144,500;8..144,600;8..144,700;8..144,800&display=swap'
  document.head.appendChild(l)
}

/** Keeps <html data-skin> in step with the room's choice. Call once. */
export function useSkin(): void {
  watch(skinId, (id) => {
    const el = document.documentElement
    if (id === 'alu') { delete el.dataset.skin; return }
    if (id === 'material') loadRoboto()
    el.dataset.skin = id
  }, { immediate: true })
}
