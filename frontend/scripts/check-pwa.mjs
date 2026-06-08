import { readFile, stat } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);

async function requireFile(path) {
  const file = new URL(path, dist);
  const details = await stat(file);
  if (!details.isFile() || details.size === 0) {
    throw new Error(`${path} is missing or empty.`);
  }
  return file;
}

const manifestFile = await requireFile('manifest.webmanifest');
const serviceWorkerFile = await requireFile('sw.js');
const registerFile = await requireFile('registerSW.js');

const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
const requiredSizes = new Set(['192x192', '512x512']);
for (const icon of manifest.icons ?? []) {
  requiredSizes.delete(icon.sizes);
  await requireFile(icon.src.replace(/^\//, ''));
}
if (requiredSizes.size) {
  throw new Error(`Manifest is missing icons: ${[...requiredSizes].join(', ')}`);
}
const maskableIcon = (manifest.icons ?? []).find(
  (icon) => icon.purpose === 'maskable'
);
if (!maskableIcon) {
  throw new Error('Manifest is missing a maskable icon.');
}
const maskablePng = await readFile(
  new URL(maskableIcon.src.replace(/^\//, ''), dist)
);
const pngColorType = maskablePng[25];
if (
  pngColorType === 4 ||
  pngColorType === 6 ||
  maskablePng.includes(Buffer.from('tRNS'))
) {
  throw new Error('Maskable icon must use a full-bleed opaque background.');
}

const serviceWorker = await readFile(serviceWorkerFile, 'utf8');
if (!serviceWorker.includes('index.html')) {
  throw new Error('Service worker does not precache the application shell.');
}
if (
  !serviceWorker.includes('skipWaiting') ||
  !serviceWorker.includes('clientsClaim')
) {
  throw new Error('Service worker is not configured to activate updates.');
}
const registration = await readFile(registerFile, 'utf8');
if (!registration.includes('sw.js')) {
  throw new Error('Service worker registration is missing.');
}

console.log(
  'PWA manifest, icons, update activation, registration, and offline shell verified.'
);
