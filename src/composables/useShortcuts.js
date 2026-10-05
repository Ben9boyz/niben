import { reactive } from 'vue'
// "?" (or the keyboard button in the menu) opens the list of shortcuts. The keys themselves are handled in
// useMediaSession.js (music) and in the components that own them (the shelf in the 3D room, Q over a song …).
export const shortcuts = reactive({ open: false })

/** Everything that can be pressed, for the help sheet. */
export const SHORTCUT_GROUPS = [
  { title: 'Musikk – hvor som helst', keys: [
    ['Shift + Mellomrom', 'Pause / spill'],
    ['Shift + →', 'Neste låt'],
    ['Shift + ←', 'Forrige låt'],
  ] },
  { title: 'Musikk – i lyttehjørnet og spilleren', keys: [
    ['Mellomrom', 'Pause / spill'],
    ['S', 'Tilfeldig rekkefølge av / på'],
    ['R', 'Gjenta: av → lista/albumet → låta'],
    ['H', 'Hjerte – lagre låta i Likte sanger'],
    ['Q', 'Legg låta du peker på sist i køen'],
    ['/', 'Søk i musikken'],
  ] },
  { title: 'Plateplata i 3D-rommet', keys: [
    ['← / →', 'Bla i plate-hylla'],
    ['Enter  eller  ↑', 'Ta ut platen'],
    ['P  eller  Enter', 'Sett på platen du holder (fra første låt)'],
    ['F', 'Snu platen – se låtene'],
    ['Esc', 'Snu tilbake / legg platen tilbake / forlat hylla'],
    ['Klikk på platespilleren', 'Pause / spill'],
  ] },
  { title: 'Generelt', keys: [
    ['?', 'Vis og skjul denne lista'],
    ['Esc', 'Lukk det som er åpent'],
  ] },
]
