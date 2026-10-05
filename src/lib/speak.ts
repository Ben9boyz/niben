// Japanese pronunciation through the browser's own speech (Web Speech API, works offline on most devices).
let voice: SpeechSynthesisVoice | null = null
function pickVoice(): void {
  const vs = window.speechSynthesis?.getVoices?.() ?? []
  // prefer a natural/enhanced Japanese voice when there are several
  voice = vs.filter((v) => /^ja(-|_|$)/i.test(v.lang)).sort((a, b) => Number(/premium|enhanced|natural|kyoko|google/i.test(b.name)) - Number(/premium|enhanced|natural|kyoko|google/i.test(a.name)))[0] ?? null
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  pickVoice()
  window.speechSynthesis.addEventListener('voiceschanged', pickVoice)
}

/** Can this browser say Japanese? */
export const canSpeak = (): boolean => typeof window !== 'undefined' && !!window.speechSynthesis

/** Say a Japanese word (the reading in kana is the safest input). */
export function speak(text: string | undefined | null, { rate = 0.85 }: { rate?: number } = {}): void {
  if (!canSpeak() || !text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.rate = rate
  if (voice) u.voice = voice
  window.speechSynthesis.speak(u)
}
