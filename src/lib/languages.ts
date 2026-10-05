// Languages the site can be shown in. The site is written in Norwegian (the source); everything else is
// translated – English comes with the site, the rest by the translation service on the server (cached).
// name = the language in itself (what the menu shows), en = in English (what the translator is told).
export const SOURCE = 'nb'
export const DEFAULT_LANG = 'en'

export interface Lang { code: string; name: string; en: string; rtl: boolean }

// Every language the browser knows a name for: the codes below (ISO 639-1) + Chinese in two scripts, and the
// names – in the language itself and in English – come from the browser (Intl.DisplayNames), so nothing is typed
// by hand and the translator is simply told the code. A new language is one more code here.
const CODES = ('en nb sv da is fi de nl fr es pt it pl cs sk hu ro bg el hr sr sl et lv lt uk ru tr ar he fa ur hi bn ta th vi id ms fil zh zh-TW ja ko sw af '
  + 'sq am hy az eu be bs my ca ceb ny co cy eo fy gl ka gu ht ha haw hmn ig ga jv kn kk km rw ku ky lo la lb mk mg ml mt mi mr mn ne or ps pa sm gd st sn sd si so su tg tt te tk ug uz xh yi yo zu '
  + 'nn se kl fo br oc sc').split(' ')
const RTL = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'ku', 'dv'])
const dn = (loc: string): Intl.DisplayNames | null => { try { return new Intl.DisplayNames([loc], { type: 'language' }) } catch { return null } }
const enNames = dn('en')
const label = (code: string, inLoc: boolean): string => {
  try { return (inLoc ? dn(code === 'zh-TW' ? 'zh-Hant' : code) : enNames)?.of(code === 'zh-TW' ? 'zh-Hant' : code) || code } catch { return code }
}
const cap = (t: string): string => (t ? t.charAt(0).toLocaleUpperCase() + t.slice(1) : t)
export const LANGS: Lang[] = CODES.map((code): Lang => {
  const en = label(code, false)
  let name = cap(label(code, true))
  if (code === 'nb') name = 'Norsk (original)'
  if (code === 'zh-TW') name = '繁體中文'
  if (code === 'zh') name = '简体中文'
  return { code, name, en: code === 'zh' ? 'Simplified Chinese' : code === 'zh-TW' ? 'Traditional Chinese' : en, rtl: RTL.has(code) }
}).sort((a, b) => (a.code === 'en' ? -1 : b.code === 'en' ? 1 : a.code === 'nb' ? -1 : b.code === 'nb' ? 1 : a.en.localeCompare(b.en)))
export const byCode: Record<string, Lang | undefined> = Object.fromEntries(LANGS.map((l) => [l.code, l]))

// where in the world: the time zone is the best hint we have without asking for the position
const TZ: Record<string, string> = {
  'Europe/Oslo': 'nb', 'Arctic/Longyearbyen': 'nb', 'Europe/Stockholm': 'sv', 'Europe/Copenhagen': 'da', 'Atlantic/Reykjavik': 'is',
  'Europe/Helsinki': 'fi', 'Europe/Berlin': 'de', 'Europe/Vienna': 'de', 'Europe/Zurich': 'de', 'Europe/Amsterdam': 'nl', 'Europe/Brussels': 'nl',
  'Europe/Paris': 'fr', 'Europe/Madrid': 'es', 'America/Mexico_City': 'es', 'America/Bogota': 'es', 'America/Argentina/Buenos_Aires': 'es', 'America/Santiago': 'es', 'America/Lima': 'es',
  'Europe/Lisbon': 'pt', 'America/Sao_Paulo': 'pt', 'Europe/Rome': 'it', 'Europe/Warsaw': 'pl', 'Europe/Prague': 'cs', 'Europe/Bratislava': 'sk', 'Europe/Budapest': 'hu',
  'Europe/Bucharest': 'ro', 'Europe/Sofia': 'bg', 'Europe/Athens': 'el', 'Europe/Zagreb': 'hr', 'Europe/Belgrade': 'sr', 'Europe/Ljubljana': 'sl',
  'Europe/Tallinn': 'et', 'Europe/Riga': 'lv', 'Europe/Vilnius': 'lt', 'Europe/Kyiv': 'uk', 'Europe/Kiev': 'uk', 'Europe/Moscow': 'ru', 'Europe/Istanbul': 'tr', 'Asia/Istanbul': 'tr',
  'Asia/Dubai': 'ar', 'Asia/Riyadh': 'ar', 'Africa/Cairo': 'ar', 'Asia/Jerusalem': 'he', 'Asia/Tel_Aviv': 'he', 'Asia/Tehran': 'fa', 'Asia/Karachi': 'ur',
  'Asia/Kolkata': 'hi', 'Asia/Calcutta': 'hi', 'Asia/Dhaka': 'bn', 'Asia/Bangkok': 'th', 'Asia/Ho_Chi_Minh': 'vi', 'Asia/Saigon': 'vi', 'Asia/Jakarta': 'id', 'Asia/Kuala_Lumpur': 'ms',
  'Asia/Manila': 'fil', 'Asia/Shanghai': 'zh', 'Asia/Taipei': 'zh-TW', 'Asia/Hong_Kong': 'zh-TW', 'Asia/Tokyo': 'ja', 'Asia/Seoul': 'ko', 'Africa/Nairobi': 'sw', 'Africa/Johannesburg': 'af',
}

/** The language that fits where this person is (time zone first, then the browser's language), or null. */
export function guessLang(): string | null {
  let tz = ''
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch {}
  if (TZ[tz]) return TZ[tz]
  for (const l of navigator.languages ?? [navigator.language]) {
    if (!l) continue
    if (byCode[l]) return l
    const base = l.split('-')[0].toLowerCase()
    if (base === 'no' || base === 'nn') return 'nb'
    if (l.toLowerCase() === 'zh-tw' || l.toLowerCase() === 'zh-hk') return 'zh-TW'
    if (byCode[base]) return base
  }
  return null
}
