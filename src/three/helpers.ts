import * as THREE from 'three'

/** `add(geometry, material, x, y, z, parent?)`: puts a shadow-casting mesh in `root` (or in `parent`) and returns it. */
export function meshAdder(root: THREE.Object3D): (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number, parent?: THREE.Object3D) => THREE.Mesh {
  return (geo, mat, x, y, z, parent = root) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    parent.add(m)
    return m
  }
}
