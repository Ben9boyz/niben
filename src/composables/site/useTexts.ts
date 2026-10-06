import { reactive } from 'vue'
import { TEXT_DEFAULTS } from '@/lib/textDefs'

// The site's own wording (headings, hints, empty-state lines …). The standard texts are in lib/textDefs.ts; whatever
// I have written in Admin → Tekster overrides them (and reaches every visitor with the page's content).
export const siteTexts = reactive<Record<string, string>>({})
export function setTexts(obj: Record<string, unknown> | null | undefined): void {
  for (const k of Object.keys(siteTexts)) delete siteTexts[k]
  for (const [k, v] of Object.entries(obj ?? {})) if (typeof v === 'string' && v.trim()) siteTexts[k] = v
}
/** tx('home.intro') – my text if I wrote one, else `fallback` (older content from data.json), else the standard text. */
export function tx(key: string, fallback?: string): string {
  const v = siteTexts[key]
  if (typeof v === 'string' && v) return v
  return fallback || TEXT_DEFAULTS[key] || ''
}
