import fs from 'node:fs';
import crypto from 'node:crypto';

// Visual-evidence capture ONLY (SOURCE_OF_TRUTH.md §6). It pulls the pinned
// jerusalem2 source scans into qa-artifacts/ for human review. It does NOT
// define or enforce requirements: official-question fidelity is gated by the
// locked snapshot in official-source-qa.mjs / official-render-qa.mjs, which do
// not touch the network. Because jerusalem2 is a PRIVATE repo, this fetch needs
// a token with access to it; CI runners (and the default GITHUB_TOKEN, which is
// scoped to THIS repo only) usually cannot read it and get HTTP 404. An
// unreachable source is therefore treated as "evidence unavailable in this
// environment" and must NOT fail the QA gate; only a reachable-but-corrupt
// asset is a hard error. Provide SOURCE_EVIDENCE_TOKEN (a PAT with jerusalem2
// read access) to actually capture the images.

const SOURCE_REPO='yanivmizrachiy/jerusalem2';
const SOURCE_COMMIT='45a6024f2448417f42114caa866006d1942cb714';
const SOURCE_DIR='public/media/curriculum/idkun-geometri-8/pages';
const pages=[14,15,16,19];
const token=process.env.SOURCE_EVIDENCE_TOKEN||process.env.GH_TOKEN||process.env.GITHUB_TOKEN||'';
const outDir=new URL('./qa-artifacts/',import.meta.url);
fs.mkdirSync(outDir,{recursive:true});

const manifest={
  schemaVersion:1,
  purpose:'Visual evidence only for SOURCE_OF_TRUTH.md §6 official-question fidelity; does not create requirements.',
  source:{repository:SOURCE_REPO,commit:SOURCE_COMMIT,directory:SOURCE_DIR},
  tokenProvided:Boolean(token),
  files:[],
  unavailable:[]
};

let captured=0, unavailable=0;

for(const n of pages){
  const nn=String(n).padStart(3,'0');
  const sourcePath=`${SOURCE_DIR}/page-${nn}.webp`;
  const apiUrl=`https://api.github.com/repos/${SOURCE_REPO}/contents/${sourcePath}?ref=${SOURCE_COMMIT}`;
  const headers={Accept:'application/vnd.github+json','User-Agent':'galil-official-source-evidence'};
  if(token) headers.Authorization=`Bearer ${token}`;
  let response;
  try{
    response=await fetch(apiUrl,{headers});
  }catch(err){
    unavailable++; manifest.unavailable.push({page:n,sourcePath,reason:`network error: ${err.message}`});
    continue;
  }
  // Access/availability problems from this environment are non-fatal: record and continue.
  if(response.status===404||response.status===403||response.status===401){
    unavailable++; manifest.unavailable.push({page:n,sourcePath,reason:`HTTP ${response.status} ${response.statusText}${token?'':' (no token for private source repo)'}`});
    continue;
  }
  // Any other non-OK status is unexpected and should surface loudly.
  if(!response.ok) throw new Error(`source page ${n}: unexpected GitHub contents API HTTP ${response.status} ${response.statusText}`);
  const payload=await response.json();
  // Present-but-malformed content is a real corruption signal — fail hard.
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
  captured++;
}

manifest.status=captured===pages.length?'complete':captured>0?'partial':'unavailable';
fs.writeFileSync(new URL('official-source-visual-manifest.json',outDir),JSON.stringify(manifest,null,2)+'\n');

if(captured===0){
  console.warn(`OFFICIAL SOURCE VISUAL EVIDENCE SKIPPED: ${SOURCE_REPO}@${SOURCE_COMMIT} is a private repo not reachable from this environment (${unavailable}/${pages.length} pages returned access errors). This is non-fatal — fidelity is gated by the locked snapshot in official-source-qa.mjs / official-render-qa.mjs. Set SOURCE_EVIDENCE_TOKEN (a PAT with ${SOURCE_REPO} read access) to capture the evidence images.`);
}else if(captured<pages.length){
  console.warn(`OFFICIAL SOURCE VISUAL EVIDENCE PARTIAL: captured ${captured}/${pages.length} pinned source pages from ${SOURCE_REPO}@${SOURCE_COMMIT}; ${unavailable} unavailable in this environment (see manifest). Non-fatal.`);
}else{
  console.log(`OFFICIAL SOURCE VISUAL EVIDENCE PASS: pinned ${captured} source page images from ${SOURCE_REPO}@${SOURCE_COMMIT}; manifest written.`);
}
