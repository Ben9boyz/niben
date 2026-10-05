/** A new Web Audio context (Safari still calls the constructor webkitAudioContext). */
export function newAudioContext(): AudioContext {
  const Ctor = window.AudioContext ?? window.webkitAudioContext
  if (!Ctor) throw new Error('Nettleseren har ikke Web Audio.')
  return new Ctor()
}
