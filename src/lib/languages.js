// Languages the site can be shown in. The site is written in Norwegian (the source); everything else is
// translated – English comes with the site, the rest by the translation service on the server (cached).
// name = the language in itself (what the menu shows), en = in English (what the translator is told).
export const SOURCE = 'nb'
export const DEFAULT_LANG = 'en'

export const LANGS = [
  { code: 'en', name: 'English', en: 'English' },
  { code: 'nb', name: 'Norsk (original)', en: 'Norwegian' },
  { code: 'sv', name: 'Svenska', en: 'Swedish' },
  { code: 'da', name: 'Dansk', en: 'Danish' },
  { code: 'is', name: 'Íslenska', en: 'Icelandic' },
  { code: 'fi', name: 'Suomi', en: 'Finnish' },
  { code: 'de', name: 'Deutsch', en: 'German' },
  { code: 'nl', name: 'Nederlands', en: 'Dutch' },
  { code: 'fr', name: 'Français', en: 'French' },
  { code: 'es', name: 'Español', en: 'Spanish' },
  { code: 'pt', name: 'Português', en: 'Portuguese' },
  { code: 'it', name: 'Italiano', en: 'Italian' },
  { code: 'pl', name: 'Polski', en: 'Polish' },
  { code: 'cs', name: 'Čeština', en: 'Czech' },
  { code: 'sk', name: 'Slovenčina', en: 'Slovak' },
  { code: 'hu', name: 'Magyar', en: 'Hungarian' },
  { code: 'ro', name: 'Română', en: 'Romanian' },
  { code: 'bg', name: 'Български', en: 'Bulgarian' },
  { code: 'el', name: 'Ελληνικά', en: 'Greek' },
  { code: 'hr', name: 'Hrvatski', en: 'Croatian' },
  { code: 'sr', name: 'Српски', en: 'Serbian' },
  { code: 'sl', name: 'Slovenščina', en: 'Slovenian' },
  { code: 'et', name: 'Eesti', en: 'Estonian' },
  { code: 'lv', name: 'Latviešu', en: 'Latvian' },
  { code: 'lt', name: 'Lietuvių', en: 'Lithuanian' },
  { code: 'uk', name: 'Українська', en: 'Ukrainian' },
  { code: 'ru', name: 'Русский', en: 'Russian' },
  { code: 'tr', name: 'Türkçe', en: 'Turkish' },
  { code: 'ar', name: 'العربية', en: 'Arabic', rtl: true },
  { code: 'he', name: 'עברית', en: 'Hebrew', rtl: true },
  { code: 'fa', name: 'فارسی', en: 'Persian', rtl: true },
  { code: 'ur', name: 'اردو', en: 'Urdu', rtl: true },
  { code: 'hi', name: 'हिन्दी', en: 'Hindi' },
  { code: 'bn', name: 'বাংলা', en: 'Bengali' },
  { code: 'ta', name: 'தமிழ்', en: 'Tamil' },
  { code: 'th', name: 'ไทย', en: 'Thai' },
  { code: 'vi', name: 'Tiếng Việt', en: 'Vietnamese' },
  { code: 'id', name: 'Bahasa Indonesia', en: 'Indonesian' },
  { code: 'ms', name: 'Bahasa Melayu', en: 'Malay' },
  { code: 'fil', name: 'Filipino', en: 'Filipino' },
  { code: 'zh', name: '简体中文', en: 'Simplified Chinese' },
  { code: 'zh-TW', name: '繁體中文', en: 'Traditional Chinese' },
  { code: 'ja', name: '日本語', en: 'Japanese' },
  { code: 'ko', name: '한국어', en: 'Korean' },
  { code: 'sw', name: 'Kiswahili', en: 'Swahili' },
  { code: 'af', name: 'Afrikaans', en: 'Afrikaans' },
]
export const byCode = Object.fromEntries(LANGS.map((l) => [l.code, l]))

// where in the world: the time zone is the best hint we have without asking for the position
const TZ = {
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
export function guessLang() {
  let tz = ''
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch {}
  if (TZ[tz]) return TZ[tz]
  for (const l of navigator.languages || [navigator.language]) {
    if (!l) continue
    if (byCode[l]) return l
    const base = l.split('-')[0].toLowerCase()
    if (base === 'no' || base === 'nn') return 'nb'
    if (l.toLowerCase() === 'zh-tw' || l.toLowerCase() === 'zh-hk') return 'zh-TW'
    if (byCode[base]) return base
  }
  return null
}
