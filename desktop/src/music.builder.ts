// electron-builder config for "niben musikk" – the same shell as "niben", opening just the music player.
//   npx electron-builder --config out/music.builder.js --mac --arm64   (npm run build first)
import { readFileSync } from 'node:fs'
import path from 'node:path'

interface BuilderConfig { nsis?: object; [key: string]: unknown }
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as { build: BuilderConfig }
const base = pkg.build
export = {
  ...base,
  appId: 'no.niben.musikk',
  productName: 'niben musikk',
  artifactName: 'niben-musikk-${os}-${arch}.${ext}',
  extraMetadata: { name: 'niben-musikk', productName: 'niben musikk', nibenKind: 'music' },
  dmg: { title: 'niben musikk' },
  nsis: { ...base.nsis, shortcutName: 'niben musikk' },
}
