import fs from 'node:fs';
import crypto from 'node:crypto';

const SOURCE_REPO='yanivmizrachiy/jerusalem2';
const SOURCE_COMMIT='45a6024f2448417f42114caa866006d1942cb714';
const SOURCE_DIR='public/media/curriculum/idkun-geometri-8/pages';
const pages=[14,15,16,19];
const outDir=new URL('./qa-artifacts/',import.meta.url);
fs.mkdirSync(outDir,{recursive:true});

const manifest={
  schemaVersion:1,
  purpose:'Visual evidence only for SOURCE_OF_TRUTH.md §6 official-question fidelity; does not create requirements.',
  source:{repository:SOURCE_REPO,commit:SOURCE_COMMIT,directory:SOURCE_DIR},
  files:[]
};

for(const n of pages){
  const nn=String(n).padStart(3,'0');
  const sourcePath=`${SOURCE_DIR}/page-${nn}.webp`;
  const apiUrl=`https://api.github.com/repos/${SOURCE_REPO}/contents/${sourcePath}?ref=${SOURCE_COMMIT}`;
  const response=await fetch(apiUrl,{headers:{Accept:'application/vnd.github+json','User-Agent':'galil-official-source-evidence'}});
  if(!response.ok) throw new Error(`source page ${n}: GitHub contents API HTTP ${response.status} ${response.statusText}`);
  const payload=await response.json();
  if(payload?.encoding!=='base64'||typeof payload?.content!=='string') throw new Error(`source page ${n}: expected base64 GitHub contents payload`);
  const bytes=Buffer.from(payload.content.replace(/\s/g,''),'base64');
  if(bytes.length<20000) throw new Error(`source page ${n}: suspiciously small (${bytes.length} bytes)`);
  if(bytes.subarray(0,4).toString('ascii')!=='RIFF'||bytes.subarray(8,12).toString('ascii')!=='WEBP'){
    throw new Error(`source page ${n}: not a valid RIFF/WEBP file`);
  }
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const fileName=`source-page-${nn}.webp`;
  fs.writeFileSync(new URL(fileName,outDir),bytes);
  manifest.files.push({page:n,file:fileName,sourcePath,gitBlobSha:payload.sha,bytes:bytes.length,sha256});
}

fs.writeFileSync(new URL('official-source-visual-manifest.json',outDir),JSON.stringify(manifest,null,2)+'\n');
console.log(`OFFICIAL SOURCE VISUAL EVIDENCE PASS: pinned ${pages.length} source page images from ${SOURCE_REPO}@${SOURCE_COMMIT}; manifest written.`);
