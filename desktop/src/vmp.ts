// electron-builder afterPack hook: VMP-signs the packed app with castlabs EVS. Spotify only hands out its DRM licence
// to a Widevine build it trusts (Verified Media Path); without this signature the app's player starts every song,
// fails, and Spotify jumps on to the next one. Needs a (free) castlabs EVS account once on the build machine:
//   ./vmp-setup.sh
// Without it the app is still built – the website then sees that it can't play and uses the other Spotify devices.
import { execFileSync } from 'node:child_process'

interface PackContext { appOutDir: string; electronPlatformName: string }
export default async function vmpSign(ctx: PackContext): Promise<void> {
  const py = process.platform === 'win32' ? 'python' : 'python3'
  try {
    execFileSync(py, ['-m', 'castlabs_evs.vmp', 'sign-pkg', ctx.appOutDir], { stdio: 'inherit' })
    console.log(`VMP-signert: ${ctx.appOutDir}`)
  } catch {
    console.warn('\n⚠  Ikke VMP-signert (castlabs EVS mangler – kjør ./vmp-setup.sh). Spotify vil ikke spille i appen; nettsiden spiller da på andre enheter.\n')
  }
}
