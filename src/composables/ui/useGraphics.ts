import { reactive } from 'vue'

// Graphics settings for the 3D room. "Auto" (the default) lets the room pick what fits the device and keep the frame
// rate up by itself; the rest are the user's own choices, remembered on this device. Every option is also a fixed
// value in the presets, so a preset is just a quick way to set them all.
const KEY = 'niben-gfx'

export type Ao = 'off' | 'low' | 'high'
export type Bloom = 'off' | 'half' | 'full'
/** Every option the room understands. */
export interface GfxValues {
  res: number
  fps: number
  msaa: number
  shadows: number
  soft: boolean
  lamp: boolean
  ao: Ao
  shafts: boolean
  bloom: Bloom
  bloomMul: number
  vignette: boolean
  reflections: number
  weather: boolean
  ambient: boolean
  exposure: number
}
export type GfxKey = keyof GfxValues
export type PresetName = 'low' | 'medium' | 'high' | 'ultra'
export type GfxMode = 'auto' | 'custom'

export const PRESETS: Record<PresetName, GfxValues> = {
  low:    { res: 0.85, fps: 30, msaa: 2, shadows: 1024, soft: false, lamp: false, ao: 'off', shafts: false, bloom: 'off',  bloomMul: 1, vignette: true, reflections: 128, weather: true, ambient: false, exposure: 1 },
  medium: { res: 1.25, fps: 60, msaa: 2, shadows: 2048, soft: false, lamp: false, ao: 'off', shafts: false, bloom: 'half', bloomMul: 1, vignette: true, reflections: 128, weather: true, ambient: true, exposure: 1 },
  high:   { res: 2,    fps: 60, msaa: 4, shadows: 4096, soft: true,  lamp: false, ao: 'low', shafts: true,  bloom: 'half', bloomMul: 1, vignette: true, reflections: 256, weather: true, ambient: true, exposure: 1 },
  ultra:  { res: 3,    fps: 0,  msaa: 8, shadows: 8192, soft: true,  lamp: true,  ao: 'high', shafts: true, bloom: 'full', bloomMul: 1, vignette: true, reflections: 512, weather: true, ambient: true, exposure: 1 },
}
export const PRESET_LABELS: [string, string][] = [['auto', 'Auto'], ['low', 'Lav'], ['medium', 'Middels'], ['high', 'Høy'], ['ultra', 'Ultra'], ['custom', 'Egen']]

/** One row in the settings window. */
export type GfxItem = { key: GfxKey; label: string; hint: string } & (
  | { type: 'select'; options: [string | number, string][] }
  | { type: 'toggle' }
  | { type: 'range'; min: number; max: number; step: number; fmt: (v: number) => string }
)
/** The options for the settings window: grouped, each with its choices. */
export const GROUPS: { title: string; items: GfxItem[] }[] = [
  { title: 'Bildet', items: [
    { key: 'res', label: 'Oppløsning', hint: 'Piksler per skjermpiksel. Over 1× på en vanlig skjerm skarper opp kantene (tungt).', type: 'select', options: [[0.5, '0,5×'], [0.75, '0,75×'], [1, '1×'], [1.25, '1,25×'], [1.5, '1,5×'], [2, '2×'], [2.5, '2,5×'], [3, '3×'], [4, '4× (svært tungt)']] },
    { key: 'msaa', label: 'Kantutjevning (MSAA)', hint: 'Glatter ut skrå kanter.', type: 'select', options: [[0, 'Av'], [2, '2×'], [4, '4×'], [8, '8×']] },
    { key: 'fps', label: 'Bildefrekvens', hint: 'Et tak. Lavere sparer batteri og varme.', type: 'select', options: [[30, '30'], [60, '60'], [120, '120'], [0, 'Ingen grense']] },
  ] },
  { title: 'Lys og skygger', items: [
    { key: 'shadows', label: 'Skygger', hint: 'Oppløsningen på skyggene fra solen.', type: 'select', options: [[0, 'Av'], [1024, 'Lav'], [2048, 'Middels'], [4096, 'Høy'], [8192, 'Ultra']] },
    { key: 'soft', label: 'Myke skygger', hint: 'Mykere kanter på skyggene.', type: 'toggle' },
    { key: 'lamp', label: 'Skygger fra lampen', hint: 'Lampen kaster egne skygger (krever skygger).', type: 'toggle' },
    { key: 'ao', label: 'Ambient occlusion', hint: 'Mørkere i hjørner og under ting. Tung.', type: 'select', options: [['off', 'Av'], ['low', 'Lav'], ['high', 'Høy']] },
    { key: 'shafts', label: 'Lysstråler fra vinduet', hint: 'Støvete solstråler inn gjennom vinduet.', type: 'toggle' },
    { key: 'reflections', label: 'Speilinger og romlys', hint: 'Rommet speiler seg selv (miljøkart).', type: 'select', options: [[0, 'Av'], [128, 'Lav'], [256, 'Middels'], [512, 'Høy'], [1024, 'Ultra']] },
  ] },
  { title: 'Effekter', items: [
    { key: 'bloom', label: 'Glød (bloom)', hint: 'Lysene gløder.', type: 'select', options: [['off', 'Av'], ['half', 'Halv oppløsning'], ['full', 'Full oppløsning']] },
    { key: 'bloomMul', label: 'Glødstyrke', hint: '', type: 'range', min: 0, max: 2, step: 0.1, fmt: (v: number) => `${Math.round(v * 100)} %` },
    { key: 'exposure', label: 'Lysstyrke', hint: 'Hele bildet lysere eller mørkere.', type: 'range', min: 0.6, max: 1.6, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)} %` },
    { key: 'vignette', label: 'Mørke hjørner (vignett)', hint: '', type: 'toggle' },
  ] },
  { title: 'Liv i rommet', items: [
    { key: 'weather', label: 'Vær utenfor vinduet', hint: 'Regn, snø og lyn.', type: 'toggle' },
    { key: 'ambient', label: 'Små bevegelser', hint: 'Katten, støv, damp og andre ting som beveger seg av seg selv.', type: 'toggle' },
  ] },
]

interface SavedGfx { mode?: string; preset?: string; showFps?: boolean; values?: Partial<GfxValues> }
const read = (): SavedGfx | null => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') as SavedGfx | null } catch { return null } }
const saved = read()
export const gfx: GfxValues & { mode: GfxMode; preset: string; showFps: boolean } = reactive({
  mode: (saved?.mode === 'custom' ? 'custom' : 'auto') as GfxMode,
  preset: saved?.preset || 'auto',
  showFps: !!saved?.showFps,
  ...PRESETS.high,
  ...(saved?.values ?? {}),
})
export const gfxUi = reactive({ open: false })

const VALUE_KEYS = Object.keys(PRESETS.high) as GfxKey[]
const values = (): Partial<GfxValues> => Object.fromEntries(VALUE_KEYS.map((k) => [k, gfx[k]])) as Partial<GfxValues>
const save = (): void => { try { localStorage.setItem(KEY, JSON.stringify({ mode: gfx.mode, preset: gfx.preset, showFps: gfx.showFps, values: values() })) } catch { /* private mode */ } }
/** `gfx[key] = value`, with the value's type following the key's. */
function setValue<K extends GfxKey>(key: K, value: GfxValues[K]): void { const target: GfxValues = gfx; target[key] = value }

/** The plain object the room wants. */
export const gfxPayload = (): Partial<GfxValues> & { mode: GfxMode; showFps: boolean } => ({ mode: gfx.mode, showFps: gfx.showFps, ...values() })

const isPreset = (n: string): n is PresetName => n in PRESETS
export function setPreset(name: string): void {
  if (name === 'auto') { gfx.mode = 'auto'; gfx.preset = 'auto' }
  else if (name === 'custom') { gfx.mode = 'custom'; gfx.preset = 'custom' }
  else if (isPreset(name)) { Object.assign(gfx, PRESETS[name]); gfx.mode = 'custom'; gfx.preset = name }
  save()
}
/** Change one option. From "Auto" the values start at what Auto currently uses, so only the one thing changes. */
export function setOption<K extends GfxKey>(key: K, value: GfxValues[K], autoValues: Partial<Record<GfxKey, unknown>> | null = null): void {
  if (gfx.mode === 'auto' && autoValues) Object.assign(gfx, Object.fromEntries(Object.entries(autoValues).filter(([, v]: [string, unknown]) => v !== undefined && v !== 'auto')))
  setValue(key, value)
  gfx.mode = 'custom'
  gfx.preset = 'custom'
  save()
}
/** Same as setOption, for a control that only knows the key and a raw value: a value of the wrong kind is ignored. */
export function setOptionLoose(key: GfxKey, value: unknown, autoValues: Partial<Record<GfxKey, unknown>> | null = null): void {
  if (typeof value !== typeof gfx[key]) return
  if (gfx.mode === 'auto' && autoValues) Object.assign(gfx, Object.fromEntries(Object.entries(autoValues).filter(([, v]: [string, unknown]) => v !== undefined && v !== 'auto')))
  Object.assign(gfx, { [key]: value })
  gfx.mode = 'custom'
  gfx.preset = 'custom'
  save()
}
export function setShowFps(v: boolean): void { gfx.showFps = v; save() }
