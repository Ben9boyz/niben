import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

// A GLB loader that also reads compressed models (Draco and Meshopt – what "compressed" downloads from Sketchfab and friends
// are). The Draco decoder is kept on the site itself (public/draco/), nothing is fetched from elsewhere.
let draco: DRACOLoader | null = null
export function makeGltfLoader(): GLTFLoader {
  const l = new GLTFLoader()
  draco ??= new DRACOLoader().setDecoderPath('draco/')
  l.setDRACOLoader(draco)
  l.setMeshoptDecoder(MeshoptDecoder)
  return l
}
