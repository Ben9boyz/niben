import type * as THREE from 'three'
import type { meshAdder } from '../helpers'

/** What the pieces of the listening corner are built from and with: the group they go in, the helper that adds a mesh to it,
 *  the shared materials, the texture loader, and a way to say "something loaded – draw a frame". */
export interface Kit {
  group: THREE.Group
  add: ReturnType<typeof meshAdder>
  white: THREE.MeshStandardMaterial
  inner: THREE.MeshStandardMaterial
  wood: THREE.MeshStandardMaterial
  dark: THREE.MeshStandardMaterial
  alu: THREE.MeshStandardMaterial
  grill: THREE.MeshStandardMaterial
  loader: THREE.TextureLoader
  markDirty: () => void
}
