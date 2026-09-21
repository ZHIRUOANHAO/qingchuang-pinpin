import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('preview/index.html', root), 'utf8');
const output = new URL('miniprogram/assets/icons/', root);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
try {
  const page = await browser.newPage();
  for (const name of ['arrow-left', 'bookmark', 'rotate', 'zoom-in', 'zoom-out', 'x']) {
    const base64 = await page.evaluate(async ({ html, name }) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const symbol = doc.querySelector(`#i-${name}`);
      if (!symbol) throw new Error(`Missing website icon: ${name}`);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="${symbol.getAttribute('viewBox')}" fill="none" stroke="#e8efff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${symbol.innerHTML}</svg>`;
      const image = new Image();
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      canvas.getContext('2d').drawImage(image, 0, 0);
      return canvas.toDataURL('image/png').split(',')[1];
    }, { html, name });
    await writeFile(new URL(`${name}.png`, output), Buffer.from(base64, 'base64'));
  }
  console.log(`Exported 6 existing website icons to ${fileURLToPath(output)}`);
} finally {
  await browser.close();
}
