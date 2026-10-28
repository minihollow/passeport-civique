// Builds the Windows package: out/Passeport-civique-Windows.zip (Node 18+, Windows).
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out', 'Passeport-civique');
const APP = join(OUT, 'app');
// Empty out/ rather than deleting it: a folder open in Explorer cannot be deleted.
const clean = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    try { rmSync(p, { recursive: true, force: true }); } catch (err) { if (e.isDirectory()) clean(p); else throw err; }
  }
};
mkdirSync(join(ROOT, 'out'), { recursive: true });
clean(join(ROOT, 'out'));
mkdirSync(APP, { recursive: true });

console.log('== Interface');
execSync('npm run build --silent', { cwd: join(ROOT, 'web'), stdio: 'inherit' });

// PowerShell 5 reads .ps1 files as UTF-8 only with a BOM; Windows prefers CRLF
const ps1 = (src, dest) => {
  const txt = readFileSync(src, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  writeFileSync(dest, '﻿' + txt, 'utf8');
};

console.log('== Application');
cpSync(join(ROOT, 'launcher', 'dist'), join(APP, 'dist'), { recursive: true });
ps1(join(ROOT, 'launcher', 'launcher.ps1'), join(APP, 'launcher.ps1'));
cpSync(join(ROOT, 'tools', 'icon', 'coco.ico'), join(APP, 'coco.ico'));

console.log('== Installer and guide');
ps1(join(ROOT, 'package', 'installer.ps1'), join(OUT, 'installer.ps1'));
writeFileSync(join(OUT, 'Installer.bat'),
  '@echo off\r\ntitle Passeport civique - installation\r\npowershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer.ps1"\r\nif errorlevel 1 pause\r\n', 'ascii');
cpSync(join(ROOT, 'package', 'Install guide.html'), join(OUT, 'Install guide.html'));

console.log('== Zip');
const ZIP = join(ROOT, 'out', 'Passeport-civique-Windows.zip');
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${OUT}' -DestinationPath '${ZIP}' -Force"`, { stdio: 'inherit' });
console.log(`-> ${ZIP}`);
