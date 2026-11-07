(function(){
'use strict';
const code=document.getElementById('code'),out=document.getElementById('output'),gutter=document.getElementById('gutter'),stats=document.getElementById('stats'),status=document.getElementById('runstatus'),file=document.getElementById('file'),filename=document.getElementById('filename');
const filelist=document.getElementById('filelist'),savehint=document.getElementById('savehint');
const STORAGE_KEY='veter-studio-workspace-v1';
let files=[{name:'main.vtr',content:code.value}],activeFile=0,saveTimer=null;
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({files,activeFile}));savehint.textContent='Saved in this browser';}catch(e){savehint.textContent='Browser storage unavailable';}}
function scheduleSave(){savehint.textContent='Unsaved changes…';clearTimeout(saveTimer);saveTimer=setTimeout(persist,350);}
function renderFiles(){filelist.replaceChildren();files.forEach((f,i)=>{const button=document.createElement('button');button.type='button';button.className='filechip'+(i===activeFile?' active':'');button.textContent=f.name;button.setAttribute('aria-pressed',String(i===activeFile));button.addEventListener('click',()=>switchFile(i));filelist.appendChild(button);});filename.textContent=files[activeFile].name;}
function switchFile(i){files[activeFile].content=code.value;activeFile=i;code.value=files[i].content;renderFiles();refresh();status.textContent='Opened '+files[i].name;out.textContent='Ready to run '+files[i].name;out.classList.add('empty');out.classList.remove('error');}
function newFile(){files[activeFile].content=code.value;let n=1,name;do{name='file'+n+'.vtr';n++;}while(files.some(f=>f.name===name));files.push({name,content:'# New Veter file\\ndisplay "Hello from '+name+'"'});activeFile=files.length-1;code.value=files[activeFile].content;renderFiles();refresh();scheduleSave();}
function renameFile(){const name=prompt('New file name (use .vtr):',files[activeFile].name);if(name===null)return;const clean=name.trim();if(!/^[A-Za-z0-9_-]+\\.vtr$/.test(clean)){alert('Use a simple file name ending in .vtr');return;}if(files.some((f,i)=>i!==activeFile&&f.name.toLowerCase()===clean.toLowerCase())){alert('A file with that name already exists.');return;}files[activeFile].name=clean;renderFiles();scheduleSave();}
function deleteFile(){if(files.length===1){alert('Keep at least one project file.');return;}if(!confirm('Delete '+files[activeFile].name+' from this browser workspace?'))return;files.splice(activeFile,1);activeFile=Math.max(0,activeFile-1);code.value=files[activeFile].content;renderFiles();refresh();scheduleSave();}
try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(saved&&Array.isArray(saved.files)&&saved.files.length&&saved.files.every(f=>f&&typeof f.name==='string'&&typeof f.content==='string')){files=saved.files.slice(0,30);activeFile=Math.min(Math.max(0,Number(saved.activeFile)||0),files.length-1);code.value=files[activeFile].content;}}catch(e){savehint.textContent='Starting a fresh workspace';}

const examples={
hello:'remember name as "Veter"\\ndisplay "Hello from " + name',
math:'remember price as 120\\nremember quantity as 3\\ndisplay price * quantity',
update:'remember score as 95\\nrevise score as score + 5\\ndisplay score'
};
function refresh(){const n=code.value.split('\\n').length;gutter.textContent=Array.from({length:n},(_,i)=>i+1).join('\\n');stats.textContent=n+' lines · '+code.value.length+' characters';}
function exportProject(){files[activeFile].content=code.value;const payload={format:'veter-studio-project',version:1,activeFile,files};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='veter-project.vproj.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);persist();status.textContent='Project exported';}
function importProject(data){if(!data||data.format!=='veter-studio-project'||data.version!==1||!Array.isArray(data.files)||!data.files.length)throw Error('This is not a supported Veter Studio project file.');if(data.files.length>30)throw Error('A project can contain at most 30 files.');const valid=data.files.every(f=>f&&typeof f.name==='string'&&/^[A-Za-z0-9_-]+\\.vtr$/.test(f.name)&&typeof f.content==='string'&&f.content.length<=200000);if(!valid)throw Error('Project contains an invalid file name or file content.');if(new Set(data.files.map(f=>f.name.toLowerCase())).size!==data.files.length)throw Error('Project contains duplicate file names.');files=data.files.map(f=>({name:f.name,content:f.content}));activeFile=Math.min(Math.max(0,Number(data.activeFile)||0),files.length-1);code.value=files[activeFile].content;renderFiles();refresh();persist();status.textContent='Project imported';out.textContent='Imported '+files.length+' project file(s).';out.classList.remove('error');out.classList.add('empty');}
function save(){const blob=new Blob([code.value],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename.textContent.endsWith('.vtr')?filename.textContent:'main.vtr';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);status.textContent='Downloaded';}
function tokenize(s){const t=[];let i=0;while(i<s.length){if(/\\s/.test(s[i])){i++;continue;}if(s[i]==='"'||s[i]==="'"){const q=s[i++];let v='';let closed=false;while(i<s.length){let c=s[i++];if(c===q){closed=true;break;}if(c==='\\\\'&&i<s.length){const e=s[i++];v+=e==='n'?'\\n':e==='t'?'\\t':e;}else v+=c;}if(!closed)throw Error('Unclosed string');t.push({k:'str',v});continue;}if(/[0-9]/.test(s[i])){let a=i++;while(i<s.length&&/[0-9.]/.test(s[i]))i++;const n=Number(s.slice(a,i));if(!Number.isFinite(n))throw Error('Invalid number');t.push({k:'num',v:n});continue;}if(/[A-Za-z_]/.test(s[i])){let a=i++;while(i<s.length&&/[A-Za-z0-9_]/.test(s[i]))i++;t.push({k:'id',v:s.slice(a,i)});continue;}if('+-*/%()'.includes(s[i])){t.push({k:s[i],v:s[i++]});continue;}throw Error('Unexpected character: '+s[i]);}return t;}
function expression(source,vars){const ts=tokenize(source);let p=0;function atom(){const x=ts[p++];if(!x)throw Error('Expected a value');if(x.k==='num'||x.k==='str')return x.v;if(x.k==='id'){if(!(x.v in vars))throw Error('Unknown variable: '+x.v);return vars[x.v];}if(x.k==='-')return -Number(atom());if(x.k==='+')return Number(atom());if(x.k==='('){const v=expr(0);if(!ts[p]||ts[p++].k!==')')throw Error('Expected )');return v;}throw Error('Expected a value');}const prec={'+':10,'-':10,'*':20,'/':20,'%':20};function expr(min){let left=atom();while(ts[p]&&prec[ts[p].k]>=min){const op=ts[p++].k,right=expr(prec[op]+1);if(op==='+'&&(typeof left==='string'||typeof right==='string'))left=String(left)+String(right);else{const a=Number(left),b=Number(right);if(!Number.isFinite(a)||!Number.isFinite(b))throw Error('Arithmetic needs numbers');if((op==='/'||op==='%')&&b===0)throw Error('Cannot divide by zero');left=op==='+'?a+b:op==='-'?a-b:op==='*'?a*b:op==='/'?a/b:a%b;}}return left;}const result=expr(0);if(p!==ts.length)throw Error('Unexpected token: '+ts[p].v);return result;}
let wasmModulePromise=null,wasmWorkspaceFiles=[],compilerStdout=[],compilerStderr=[],compilerInput='';
function loadWasmCompiler(){
 if(wasmModulePromise)return wasmModulePromise;
 wasmModulePromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='/assets/wasm/veterc.js';
  script.async=true;
  script.onload=()=>{
   if(typeof window.createVeterModule!=='function'){wasmModulePromise=null;reject(Error('Compiler loader did not initialize.'));return;}
   window.createVeterModule({
    locateFile:(path)=>'/assets/wasm/'+path,
    print:(line)=>{compilerStdout.push(line);},
    printErr:(line)=>{compilerStderr.push(line);},
    stdin:()=>{if(!compilerInput.length)return null;const ch=compilerInput.charCodeAt(0);compilerInput=compilerInput.slice(1);return ch;}
   }).then((module)=>{window.veterRuntime=module;resolve(module);},(error)=>{wasmModulePromise=null;reject(error);});
  };
  script.onerror=()=>{wasmModulePromise=null;reject(Error('The real Veter compiler is not deployed yet. Please try again after the WebAssembly build finishes.'));};
  document.head.appendChild(script);
 });
 return wasmModulePromise;
}
async function run(){
 const runButton=document.getElementById('run');
 const artifactButton=document.getElementById('downloadartifact');
 artifactButton.hidden=true;
 document.getElementById('artifactstatus').textContent='';
 runButton.disabled=true;
 status.textContent='Loading compiler…';
 out.textContent='Starting the real Veter compiler…';
 out.classList.remove('error','empty');
 try{
  const runtime=await loadWasmCompiler();
  const workspace='/workspace';
  try{runtime.FS.mkdir(workspace);}catch(e){}
  files[activeFile].content=code.value;
  // Remove files from the previous run so deleted/renamed workspace files cannot linger.
  wasmWorkspaceFiles.forEach((path)=>{try{runtime.FS.unlink(path);}catch(e){}});
  wasmWorkspaceFiles=[];
  files.forEach((projectFile)=>{
   if(!/^[A-Za-z0-9_-]+\.vtr$/i.test(projectFile.name))throw Error('Invalid workspace file name: '+projectFile.name);
   const path=workspace+'/'+projectFile.name;
   runtime.FS.writeFile(path,projectFile.content);
   wasmWorkspaceFiles.push(path);
  });
  const sourcePath=workspace+'/'+files[activeFile].name;
  try{runtime.FS.unlink(sourcePath+'.html');}catch(e){}
  compilerStdout=[];compilerStderr=[];
  compilerInput=(document.getElementById('programinput').value||'').replace(/\r\n/g,'\n');
  if(compilerInput && !compilerInput.endsWith('\n'))compilerInput+='\n';
  const exitCode=runtime.callMain([sourcePath]);
  if(exitCode!==0)throw Error(compilerStderr.join('\\n').trim()||('Compiler exited with code '+exitCode));
  out.textContent=compilerStdout.join('\\n').trimEnd()||'Program finished with no output.';
  const generatedPath=sourcePath+'.html';
  if(runtime.FS.analyzePath(generatedPath).exists){artifactButton.dataset.path=generatedPath;artifactButton.hidden=false;document.getElementById('artifactstatus').textContent='Generated file is ready.';}
  out.classList.remove('error','empty');
  status.textContent='Compiled · Veter Core 1.0';
 }catch(e){
  out.textContent='Compiler error: '+(e&&e.message?e.message:String(e));
  out.classList.add('error');out.classList.remove('empty');
  status.textContent='Compiler unavailable or program failed';
 }finally{runButton.disabled=false;}
}
code.addEventListener('input',()=>{refresh();files[activeFile].content=code.value;scheduleSave();});code.addEventListener('scroll',()=>{gutter.scrollTop=code.scrollTop;});code.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const a=code.selectionStart,b=code.selectionEnd;code.setRangeText('  ',a,b,'end');refresh();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save();}});
document.getElementById('examples').addEventListener('change',e=>{const name='main.vtr',content=examples[e.target.value]||examples.hello;let i=files.findIndex(f=>f.name===name);if(i<0){if(files.length>=30){alert('Workspace limit is 30 files. Delete a file first.');return;}files.push({name,content});i=files.length-1;}else files[i].content=content;activeFile=i;code.value=content;renderFiles();refresh();scheduleSave();status.textContent='Example loaded';});
document.getElementById('run').addEventListener('click',run);document.getElementById('downloadartifact').addEventListener('click',()=>{try{const path=document.getElementById('downloadartifact').dataset.path;if(!path)throw Error('No generated file is available. Run a website project first.');const bytes=window.veterRuntime.FS.readFile(path);const blob=new Blob([bytes],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=path.split('/').pop();document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);document.getElementById('artifactstatus').textContent='Download started.';}catch(e){document.getElementById('artifactstatus').textContent=e.message;}});document.getElementById('clear').addEventListener('click',()=>{code.value='';out.textContent='Output cleared.';out.classList.add('empty');out.classList.remove('error');status.textContent='Ready';refresh();});
document.getElementById('download').addEventListener('click',()=>{files[activeFile].content=code.value;save();});document.getElementById('open').addEventListener('click',()=>{file.accept='.vtr,.txt,text/plain';file.click();});file.addEventListener('change',async()=>{const f=file.files&&file.files[0];if(!f)return;try{const text=await f.text();if(f.name.endsWith('.json')){importProject(JSON.parse(text));}else{if(!/^[A-Za-z0-9_-]+\\.vtr$/i.test(f.name))throw Error('Choose a .vtr source file or Veter project .json file.');const existing=files.findIndex(x=>x.name.toLowerCase()===f.name.toLowerCase());if(existing>=0){files[existing].content=text;activeFile=existing;}else{if(files.length>=30)throw Error('Workspace limit is 30 files.');files.push({name:f.name,content:text});activeFile=files.length-1;}code.value=files[activeFile].content;renderFiles();refresh();persist();status.textContent='Source file opened';}}catch(e){alert('Could not open file: '+e.message);}finally{file.value='';}});document.getElementById('exportproject').addEventListener('click',exportProject);document.getElementById('importproject').addEventListener('click',()=>{file.accept='.json,application/json';file.click();});
document.getElementById('newfile').addEventListener('click',newFile);document.getElementById('renamefile').addEventListener('click',renameFile);document.getElementById('deletefile').addEventListener('click',deleteFile);\nrenderFiles();refresh();
})();