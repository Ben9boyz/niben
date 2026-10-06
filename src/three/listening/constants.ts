import * as THREE from 'three'
import type { Album } from '../../types'

// Sizes and places in the listening corner (metres, in the corner's own coordinates), and the shapes of what the room keeps.
export const SLEEVE = 0.31
export const THICK = 0.0095
export const SLEEVE_T = 0.0045 // a record sleeve that has left the shelf: thin, like the real thing (the shelf slots are wider)
export const DISC_R = 0.147 // the vinyl: a 12-inch disc in a 12.4-inch sleeve
export const BOARD_W = 1.295 // the record cabinet (3 × 2 compartments)
export const TOP_Y = 0.85 // top of the cabinet
export const FRONT_Z = 0.45
// The table, left to right (x; z: the back panel is at 0.06, the edge at 0.45): the turntable (to −0.13) · the playing record's sleeve
// leaning right beside it (x 0.06) · the next album's sleeve leaning at x 0.40 · the iPod in front at x 0.64 · the stack of records
// lying (x 0.90) · a plant and a candle at the end. The cabinet's top goes on to the right (EXT) to give all of them room.
export const EXT = 0.55 // how far the table top reaches past the cabinet's right side (x 0.65 → 1.20)
// the playing record's sleeve leans against the wall: tilted back LEAN rad, turned a bit towards the room
export const LEAN = 0.26
export const LEAN_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-LEAN, -Math.PI / 2 - 0.25, 0, 'XYZ'))
export const LEAN_UP = (SLEEVE / 2) * Math.cos(LEAN) + 0.002 // centre height above the top
export const LEAN_Z = 0.165 - (SLEEVE / 2) * Math.sin(LEAN) // bottom edge ~10 cm in front of the cabinet's back (z 0.06)
// the six compartments of the cabinet: 3 columns × 2 rows, top row first (inner x range + the height of the floor)
export const COLS: [number, number][] = [[-0.625, -0.2225], [-0.2075, 0.2025], [0.2175, 0.626]]
export const FLOORS = [0.433, 0.015]
// the turntable (the model public/models/turntable.glb: a Pioneer, split into base / platter / tonearm): where the platter
// turns and where the tonearm pivots, in the model's own coordinates
export const TT_C = { x: -0.0618, z: -0.0055 }
export const TT_ARM = { x: 0.141, z: -0.1 }
export const COMPARTMENT = FLOORS.flatMap((y) => COLS.map(([a, b]) => ({ x0: a, x1: b, y })))

/** An album as the room draws it: the shelf's colour can be known in advance. */
export type ShelfAlbum = Album & { color?: string | null }
/** One entry in the stack of records on the table (the queue first, then what I listened to last). */
export interface StackEntry { uri: string; name?: string; artist?: string; image?: string | null; image_large?: string | null; queued?: boolean }
/** A record on the shelf (or a guest from the search): where it rests and how it sticks out. */
export interface ShelfRecord {
  album: ShelfAlbum
  index: number
  color: string
  out: number
  hidden: boolean
  home: THREE.Vector3
  guest?: boolean
  comp?: number
  end?: number
  dz?: number
  yaw?: number
  lean?: number
}
/** A record that has left the shelf: its own mesh, the disc inside and the spring that moves it. */
export interface LooseRecord {
  mesh: THREE.Object3D
  rec: ShelfRecord
  disc: THREE.Group
  tint: (col: string) => void
  free: () => void
  vel: THREE.Vector3
  returning: boolean
}
/** A pixel rectangle on the screen. */
export interface ScreenRect { x: number; y: number; w: number; h: number }
export interface CoverJob { (img: HTMLImageElement): void; src?: string }
export type SpriteData = { phase: number; side: number; sway: number }
