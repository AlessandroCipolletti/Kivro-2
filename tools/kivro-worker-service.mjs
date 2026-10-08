import {execFileSync} from 'node:child_process';
import {Buffer} from 'node:buffer';
import {constants,existsSync,mkdirSync,openSync,closeSync,readSync,realpathSync,
  lstatSync,statSync,writeFileSync,rmSync} from 'node:fs';
import {homedir,platform,userInfo} from 'node:os';
import {join,resolve} from 'node:path';
import process from 'node:process';
import {fileURLToPath,URL} from 'node:url';

const label='ai.kivro.worker';
const repository=realpathSync(resolve(fileURLToPath(new URL('..',import.meta.url))));

function escapeXml(value){return value.replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');}

export function renderLaunchAgent({nodePath,repositoryPath,environmentPath,
  stdoutPath,stderrPath,serviceLabel=label,entrypointPath=join(repositoryPath,
    'tools/kivro-worker-run.mjs')}){
  const args=[nodePath,`--env-file=${environmentPath}`,
    entrypointPath];
  return `<?xml version="1.0" encoding="UTF-8"?>\n`+
    `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" `+
    `"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n`+
    `<plist version="1.0"><dict>\n`+
    `<key>Label</key><string>${escapeXml(serviceLabel)}</string>\n`+
    `<key>ProgramArguments</key><array>${args.map((arg)=>
      `<string>${escapeXml(arg)}</string>`).join('')}</array>\n`+
    `<key>WorkingDirectory</key><string>${escapeXml(repositoryPath)}</string>\n`+
    `<key>RunAtLoad</key><true/>\n<key>KeepAlive</key><true/>\n`+
    `<key>ThrottleInterval</key><integer>30</integer>\n`+
    `<key>StandardOutPath</key><string>${escapeXml(stdoutPath)}</string>\n`+
    `<key>StandardErrorPath</key><string>${escapeXml(stderrPath)}</string>\n`+
    `</dict></plist>\n`;
}

function privateRegularFile(path){
  const stat=lstatSync(path,{throwIfNoEntry:false});
  if(!stat?.isFile()||stat.isSymbolicLink()||stat.uid!==process.getuid()||
    (stat.mode&0o077)!==0)throw new Error('SERVICE_PRIVATE_ENV_REQUIRED');
}

function privateDirectory(path){
  mkdirSync(path,{recursive:true,mode:0o700});
  const stat=statSync(path);
  if(!stat.isDirectory()||stat.uid!==process.getuid()||
    (stat.mode&0o077)!==0)throw new Error('SERVICE_PRIVATE_STATE_REQUIRED');
}

function servicePaths(){
  if(platform()!=='darwin')throw new Error('SERVICE_MACOS_ONLY');
  const agentDirectory=join(homedir(),'Library','LaunchAgents');
  const logDirectory=join(homedir(),'.kivro','worker','logs');
  const environmentPath=join(repository,'.env.local');
  return {agentDirectory,agentPath:join(agentDirectory,`${label}.plist`),
    logDirectory,environmentPath,stdoutPath:join(logDirectory,'stdout.log'),
    stderrPath:join(logDirectory,'stderr.log')};
}

function launchctl(args){return execFileSync('launchctl',args,{encoding:'utf8',
  timeout:10_000,stdio:['ignore','pipe','pipe']}).trim();}

export function installLaunchAgent(paths=servicePaths()){
  if(!existsSync(join(repository,'dist','apps','worker','src','execution-runtime.js'))||
    !existsSync(join(repository,'node_modules')))
    throw new Error('SERVICE_BUILD_REQUIRED');
  privateRegularFile(paths.environmentPath);
  privateDirectory(paths.logDirectory);
  for(const path of [paths.stdoutPath,paths.stderrPath]){
    const fd=openSync(path,constants.O_CREAT|constants.O_APPEND|constants.O_WRONLY,0o600);
    closeSync(fd);privateRegularFile(path);
  }
  mkdirSync(paths.agentDirectory,{recursive:true,mode:0o700});
  const xml=renderLaunchAgent({nodePath:realpathSync(process.execPath),
    repositoryPath:repository,environmentPath:paths.environmentPath,
    stdoutPath:paths.stdoutPath,stderrPath:paths.stderrPath});
  const fd=openSync(paths.agentPath,constants.O_CREAT|constants.O_TRUNC|
    constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
  try{writeFileSync(fd,xml);}finally{closeSync(fd);}
  privateRegularFile(paths.agentPath);
  return paths.agentPath;
}

function status(){
  try{return launchctl(['print',`gui/${userInfo().uid}/${label}`]);}
  catch{return 'STOPPED';}
}

function diagnosticTail(path){
  if(!existsSync(path))return 'No Worker diagnostic log yet.';
  privateRegularFile(path);
  const size=statSync(path).size,bytes=Buffer.alloc(Math.min(size,65_536));
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{readSync(fd,bytes,0,bytes.length,size-bytes.length);}
  finally{closeSync(fd);}
  return bytes.toString('utf8').split('\n').slice(-80).join('\n');
}

export function runWorkerService(args){
  const [command,...rest]=args;
  if(rest.length||!['install','start','stop','status','logs','uninstall'].includes(command))
    throw new Error('Usage: pnpm worker:service install|start|stop|status|logs|uninstall');
  const paths=servicePaths(),target=`gui/${userInfo().uid}/${label}`;
  if(command==='install'){
    if(status()!=='STOPPED')throw new Error('SERVICE_STOP_BEFORE_INSTALL');
    return `Installed ${installLaunchAgent(paths)}. Run start to launch.`;
  }
  if(command==='start'){
    if(!existsSync(paths.agentPath))throw new Error('SERVICE_NOT_INSTALLED');
    if(status()!=='STOPPED')return 'Worker already running.';
    launchctl(['bootstrap',`gui/${userInfo().uid}`,paths.agentPath]);
    return 'Worker started by launchd.';
  }
  if(command==='stop'){
    if(status()==='STOPPED')return 'Worker already stopped.';
    launchctl(['bootout',target]);return 'Worker stopped.';
  }
  if(command==='status')return status();
  if(command==='logs')return diagnosticTail(paths.stderrPath);
  if(status()!=='STOPPED')throw new Error('SERVICE_STOP_BEFORE_UNINSTALL');
  rmSync(paths.agentPath,{force:true});return 'Worker LaunchAgent removed.';
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.stdout.write(`${runWorkerService(process.argv.slice(2))}\n`);}
  catch(error){process.stderr.write(`${error instanceof Error?error.message:
    'SERVICE_UNAVAILABLE'}\n`);process.exitCode=1;}
}
