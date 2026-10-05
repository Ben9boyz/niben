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
    ['H', 'Hjerte – lagrer albumet du hører på (eller låta, hvis den spilles alene)'],
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
  { title: 'Japansk – kort og kanji', keys: [
    ['Mellomrom  eller  Enter', 'Vis svaret'],
    ['1 – 5', 'Velg hvor godt du husket det (kanji: 1 – 4)'],
    ['S', 'Si ordet høyt'],
    ['Esc', 'Avslutt øvingen'],
  ] },
  { title: 'Gitar-øving', keys: [
    ['Mellomrom', 'Timer: start / pause · Akkorder: tell et bytte, start / stopp · Metronom: start / stopp'],
    ['R', 'Timer: nullstill'],
    ['↑ / →', 'Metronom: ett slag raskere'],
    ['↓ / ←', 'Metronom: ett slag saktere'],
  ] },
  { title: 'Generelt', keys: [
    ['?', 'Vis og skjul denne lista'],
    ['Esc', 'Lukk det som er åpent'],
  ] },
]
