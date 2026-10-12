// Shared fingerprint of everything that renders into galil-student.pdf (SOURCE_OF_TRUTH.md §19).
// Deterministic: sorted file list, sha256 per file, sha256 over "path:sha" lines. No browser needed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const MANIFEST = 'galil-student.pdf.manifest.json';

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

function walk(dir, rel, out){
  for(const name of fs.readdirSync(dir).sort()){
    const full = path.join(dir, name), r = rel ? `${rel}/${name}` : name;
    if(fs.statSync(full).isDirectory()) walk(full, r, out); else out.push(r);
  }
}

export function sourceFiles(root){
  const files = fs.readdirSync(root).filter(n => /^page-\d+\.html$/.test(n))
    .sort((a,b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  files.push('cover.html');
  files.push('assets/cover-bg.jpg');
  files.push('assets/district-logo.png');
  files.push('styles.css');
  if(fs.existsSync(path.join(root, 'vendor'))) walk(path.join(root, 'vendor'), 'vendor', files);
  return files;
}

export function sourceDigest(root){
  const files = {};
  for(const f of sourceFiles(root)) files[f] = sha256(fs.readFileSync(path.join(root, f)));
  const digest = sha256(Object.entries(files).map(([f, h]) => `${f}:${h}`).join('\n'));
  return { files, digest };
}

export const pdfDigest = pdfPath => sha256(fs.readFileSync(pdfPath));
