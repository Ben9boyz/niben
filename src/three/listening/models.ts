import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export function glbLoader(): GLTFLoader {
  const l = new GLTFLoader()
  l.register((parser) => ({ name: 'niben_img', beforeRoot() { parser.textureLoader = new THREE.TextureLoader(parser.options.manager); return null } }))
  return l
}
export const warnLoad = (what: string) => (e: unknown): void => console.warn(`niben glb ${what}`, e instanceof Error ? e.message : e)
