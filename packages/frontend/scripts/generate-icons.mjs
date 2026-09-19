import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
// Source icon checked into repo root (186x186). Slight upscale to 192/512 is fine for a boilerplate.
const src = path.resolve(root, '..', 'App+Icon+186.png')
const publicDir = path.resolve(root, 'public')
const iconsDir = path.resolve(publicDir, 'icons')

await mkdir(iconsDir, { recursive: true })

// PWA installability set: PNG is required for install prompts / maskable.
// WebP variants are progressive enhancement with PNG fallback in manifest.
await sharp(src).resize(192, 192, { fit: 'cover' }).png().toFile(path.join(iconsDir, 'icon-192.png'))
await sharp(src).resize(512, 512, { fit: 'cover' }).png().toFile(path.join(iconsDir, 'icon-512.png'))
await sharp(src).resize(512, 512, { fit: 'cover' }).png().toFile(path.join(iconsDir, 'icon-maskable-512.png'))
await sharp(src).resize(192, 192, { fit: 'cover' }).webp({ quality: 85 }).toFile(path.join(iconsDir, 'icon-192.webp'))
await sharp(src).resize(512, 512, { fit: 'cover' }).webp({ quality: 85 }).toFile(path.join(iconsDir, 'icon-512.webp'))

// iOS + tab icons: PNG is the reliable format, keep SVG + ICO as well.
await sharp(src).resize(180, 180, { fit: 'cover' }).png().toFile(path.join(publicDir, 'apple-touch-icon.png'))
await sharp(src).resize(32, 32, { fit: 'cover' }).png().toFile(path.join(publicDir, 'favicon-32x32.png'))
await sharp(src).resize(16, 16, { fit: 'cover' }).png().toFile(path.join(publicDir, 'favicon-16x16.png'))

const icoBuf = await pngToIco([
  path.join(publicDir, 'favicon-16x16.png'),
  path.join(publicDir, 'favicon-32x32.png'),
])
const { writeFile } = await import('node:fs/promises')
await writeFile(path.join(publicDir, 'favicon.ico'), icoBuf)

console.log('icons generated')
