// electron-builder config for "niben musikk" – the same shell as "niben", opening just the music player.
//   npx electron-builder --config music.builder.js --mac --arm64
const base = require('./package.json').build
module.exports = {
  ...base,
  appId: 'no.niben.musikk',
  productName: 'niben musikk',
  artifactName: 'niben-musikk-${os}-${arch}.${ext}',
  extraMetadata: { name: 'niben-musikk', productName: 'niben musikk', nibenKind: 'music' },
  dmg: { title: 'niben musikk' },
  nsis: { ...base.nsis, shortcutName: 'niben musikk' },
}
