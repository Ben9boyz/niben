// Small helpers for DOM events. The handlers sit on the element itself, so `e.target` is always that
// element – these just say so to the type checker (and keep `as` casts out of the templates).

/** The <input> an input / change event came from. */
export const inputOf = (e: Event): HTMLInputElement => e.target as HTMLInputElement
/** The <select> a change event came from. */
export const selectOf = (e: Event): HTMLSelectElement => e.target as HTMLSelectElement
/** The element an event started on (for `closest()` / `tagName` checks on events bubbling from children). */
export const targetEl = (e: Event): HTMLElement => e.target as HTMLElement
/** The first file picked in a file input, and the input cleared so the same file can be picked again. */
export function pickedFile(e: Event): File | null {
  const input = inputOf(e)
  const f = input.files?.[0] ?? null
  input.value = ''
  return f
}
/** `@error` on an <img>: hide it instead of showing a broken-image icon. */
export const hideImg = (e: Event): void => { targetEl(e).style.display = 'none' }
