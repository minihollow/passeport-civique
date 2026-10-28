// Draws the icon (Coco) as PNG at several sizes, then builds an .ico.
const { chromium } = require('playwright');
const fs = require('fs');
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect x="2" y="2" width="60" height="60" rx="16" fill="#5b3cc4"/>
<circle cx="32" cy="35" r="21" fill="#fff" stroke="#19234d" stroke-width="2.5"/>
<path d="M22 17c1.6-5 6.5-5 7.3 0 1.6-5.7 7.3-5.7 8.1 0 2.4-4 7.3-2.4 6.5 2.4-.8 3.3-3.3 4.9-4.9 5.7H23.6c-2.4-1.6-3.3-4.9-1.6-8.1z" fill="#d23c3c" stroke="#19234d" stroke-width="2" stroke-linejoin="round"/>
<circle cx="25.5" cy="34" r="3" fill="#19234d"/><circle cx="38.5" cy="34" r="3" fill="#19234d"/>
<path d="M28 40l4-2.4 4 2.4-4 4.9z" fill="#f2ad1f" stroke="#19234d" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = [];
  for (const s of sizes) {
    await p.setViewportSize({ width: 400, height: 400 });
    await p.setContent(`<html><body style="margin:0;background:transparent">${SVG.replace('<svg ', `<svg style="display:block" width="${s}" height="${s}" `)}</body></html>`);
    pngs.push(await p.locator('svg').screenshot({ omitBackground: true }));
  }
  await b.close();
  fs.writeFileSync('icon-256.png', pngs[pngs.length - 1]);
  // ICO format: header + directory + PNG images
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  const dir = Buffer.alloc(16 * sizes.length);
  let off = 6 + dir.length;
  sizes.forEach((s, i) => {
    const e = i * 16;
    dir.writeUInt8(s >= 256 ? 0 : s, e); dir.writeUInt8(s >= 256 ? 0 : s, e + 1);
    dir.writeUInt8(0, e + 2); dir.writeUInt8(0, e + 3);
    dir.writeUInt16LE(1, e + 4); dir.writeUInt16LE(32, e + 6);
    dir.writeUInt32LE(pngs[i].length, e + 8); dir.writeUInt32LE(off, e + 12);
    off += pngs[i].length;
  });
  fs.writeFileSync('coco.ico', Buffer.concat([head, dir, ...pngs]));
  console.log('coco.ico', fs.statSync('coco.ico').size);
})();
