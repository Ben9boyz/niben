import worldTopo from 'world-atlas/countries-110m.json'

// Norwegian names for countries in the world-atlas data (keyed by the atlas' English name).
// Lets data.json use "land": "Italia" as well as "land": "Italy".
export const NO: Record<string, string> = {
  'Afghanistan': 'Afghanistan', 'Albania': 'Albania', 'Algeria': 'Algerie', 'Angola': 'Angola',
  'Argentina': 'Argentina', 'Armenia': 'Armenia', 'Australia': 'Australia', 'Austria': 'Østerrike',
  'Azerbaijan': 'Aserbajdsjan', 'Bahamas': 'Bahamas', 'Bangladesh': 'Bangladesh', 'Belarus': 'Belarus',
  'Belgium': 'Belgia', 'Belize': 'Belize', 'Bolivia': 'Bolivia', 'Bosnia and Herz.': 'Bosnia-Hercegovina',
  'Botswana': 'Botswana', 'Brazil': 'Brasil', 'Bulgaria': 'Bulgaria', 'Cambodia': 'Kambodsja',
  'Cameroon': 'Kamerun', 'Canada': 'Canada', 'Chile': 'Chile', 'China': 'Kina', 'Colombia': 'Colombia',
  'Costa Rica': 'Costa Rica', 'Croatia': 'Kroatia', 'Cuba': 'Cuba', 'Cyprus': 'Kypros', 'Czechia': 'Tsjekkia',
  'Denmark': 'Danmark', 'Dominican Rep.': 'Den dominikanske republikk', 'Ecuador': 'Ecuador', 'Egypt': 'Egypt',
  'Estonia': 'Estland', 'Ethiopia': 'Etiopia', 'Fiji': 'Fiji', 'Finland': 'Finland', 'France': 'Frankrike',
  'Georgia': 'Georgia', 'Germany': 'Tyskland', 'Ghana': 'Ghana', 'Greece': 'Hellas', 'Greenland': 'Grønland',
  'Guatemala': 'Guatemala', 'Hungary': 'Ungarn', 'Iceland': 'Island', 'India': 'India', 'Indonesia': 'Indonesia',
  'Iran': 'Iran', 'Iraq': 'Irak', 'Ireland': 'Irland', 'Israel': 'Israel', 'Italy': 'Italia', 'Jamaica': 'Jamaica',
  'Japan': 'Japan', 'Jordan': 'Jordan', 'Kazakhstan': 'Kasakhstan', 'Kenya': 'Kenya', 'Kosovo': 'Kosovo',
  'Laos': 'Laos', 'Latvia': 'Latvia', 'Lebanon': 'Libanon', 'Lithuania': 'Litauen', 'Luxembourg': 'Luxembourg',
  'Macedonia': 'Nord-Makedonia', 'Madagascar': 'Madagaskar', 'Malaysia': 'Malaysia', 'Mexico': 'Mexico',
  'Moldova': 'Moldova', 'Mongolia': 'Mongolia', 'Montenegro': 'Montenegro', 'Morocco': 'Marokko',
  'Mozambique': 'Mosambik', 'Myanmar': 'Myanmar', 'Namibia': 'Namibia', 'Nepal': 'Nepal',
  'Netherlands': 'Nederland', 'New Zealand': 'New Zealand', 'Nicaragua': 'Nicaragua', 'Nigeria': 'Nigeria',
  'North Korea': 'Nord-Korea', 'Norway': 'Norge', 'Oman': 'Oman', 'Pakistan': 'Pakistan', 'Panama': 'Panama',
  'Paraguay': 'Paraguay', 'Peru': 'Peru', 'Philippines': 'Filippinene', 'Poland': 'Polen', 'Portugal': 'Portugal',
  'Puerto Rico': 'Puerto Rico', 'Qatar': 'Qatar', 'Romania': 'Romania', 'Russia': 'Russland', 'Rwanda': 'Rwanda',
  'Saudi Arabia': 'Saudi-Arabia', 'Senegal': 'Senegal', 'Serbia': 'Serbia', 'Slovakia': 'Slovakia',
  'Slovenia': 'Slovenia', 'South Africa': 'Sør-Afrika', 'South Korea': 'Sør-Korea', 'Spain': 'Spania',
  'Sri Lanka': 'Sri Lanka', 'Sweden': 'Sverige', 'Switzerland': 'Sveits', 'Syria': 'Syria', 'Taiwan': 'Taiwan',
  'Tanzania': 'Tanzania', 'Thailand': 'Thailand', 'Tunisia': 'Tunisia', 'Turkey': 'Tyrkia', 'Uganda': 'Uganda',
  'Ukraine': 'Ukraina', 'United Arab Emirates': 'De forente arabiske emirater', 'United Kingdom': 'Storbritannia',
  'United States of America': 'USA', 'Uruguay': 'Uruguay', 'Uzbekistan': 'Usbekistan', 'Venezuela': 'Venezuela',
  'Vietnam': 'Vietnam', 'Zambia': 'Zambia', 'Zimbabwe': 'Zimbabwe', 'Antarctica': 'Antarktis',
}

const ALIASES: Record<string, string> = {
  'england': 'United Kingdom', 'skottland': 'United Kingdom', 'wales': 'United Kingdom', 'uk': 'United Kingdom',
  'storbritannia': 'United Kingdom', 'usa': 'United States of America', 'amerika': 'United States of America',
  'usa (amerika)': 'United States of America', 'tsjekkia': 'Czechia', 'nord-makedonia': 'Macedonia',
  'bosnia': 'Bosnia and Herz.', 'den dominikanske republikk': 'Dominican Rep.', 'holland': 'Netherlands',
  'emiratene': 'United Arab Emirates', 'dubai': 'United Arab Emirates', 'korea': 'South Korea',
}

const lookup = new Map<string, string>()
for (const [en, no] of Object.entries(NO)) {
  lookup.set(en.toLowerCase(), en)
  lookup.set(no.toLowerCase(), en)
}
for (const [k, v] of Object.entries(ALIASES)) lookup.set(k, v)

/** Map whatever the user wrote ("Italia", "Italy", "England") to the atlas name. */
export function atlasName(input: unknown): string | null {
  if (!input) return null
  return lookup.get(String(input).trim().toLowerCase()) ?? String(input).trim()
}

export function norskNavn(atlas: string): string {
  return NO[atlas] ?? atlas
}

/** Every country in the map data as { en, no }, sorted by Norwegian name. */
export interface Country { en: string; no: string }
export function allCountries(): Country[] {
  return worldTopo.objects.countries.geometries
    .map((g) => g.properties.name)
    .filter((n): n is string => !!n && n !== 'Antarctica')
    .map((en): Country => ({ en, no: norskNavn(en) }))
    .sort((a, b) => a.no.localeCompare(b.no, 'nb'))
}

/** Case/diacritic-insensitive match on Norwegian or English name. */
export function searchCountries(q: string, list: Country[] = allCountries()): Country[] {
  const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const n = norm(q.trim())
  if (!n) return list
  return list
    .filter((c) => norm(c.no).includes(n) || norm(c.en).includes(n))
    .sort((a, b) => (norm(a.no).startsWith(n) ? 0 : 1) - (norm(b.no).startsWith(n) ? 0 : 1))
}
