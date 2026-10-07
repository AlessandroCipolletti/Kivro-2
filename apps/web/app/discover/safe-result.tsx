import type { ReactNode } from 'react';

function inline(value:string):ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((part,index)=>{
    if(part.startsWith('**')&&part.endsWith('**'))return <strong key={index}>{part.slice(2,-2)}</strong>;
    if(part.startsWith('*')&&part.endsWith('*'))return <em key={index}>{part.slice(1,-1)}</em>;
    if(part.startsWith('`')&&part.endsWith('`'))return <code key={index}>{part.slice(1,-1)}</code>;
    return part;
  });
}

/** Markdown is rendered as escaped React text. Raw HTML, remote images and links are never interpreted. */
export function SafeResult({type,value}:{type:string;value:unknown}){
  if(type==='JSON'||typeof value!=='string')return <pre className="result-code">{JSON.stringify(value,null,2)}</pre>;
  if(type!=='MARKDOWN')return <p className="result-plain">{value}</p>;
  const blocks=value.replaceAll('\r\n','\n').split(/\n\s*\n/);
  return <div className="result-markdown">{blocks.map((block,index)=>{
    const lines=block.split('\n');
    if(lines[0]?.startsWith('```'))return <pre key={index}><code>{lines.slice(1,
      lines.at(-1)?.startsWith('```')?-1:undefined).join('\n')}</code></pre>;
    if(lines.every((line)=>/^[-*] /.test(line)))return <ul key={index}>{lines.map((line,i)=><li key={i}>{inline(line.slice(2))}</li>)}</ul>;
    if(lines.every((line)=>/^\d+\. /.test(line)))return <ol key={index}>{lines.map((line,i)=><li key={i}>{inline(line.replace(/^\d+\. /,''))}</li>)}</ol>;
    if(lines.length===1&&/^#{1,4} /.test(lines[0]!)){
      const text=lines[0]!.replace(/^#{1,4} /,'');
      return <h4 key={index}>{inline(text)}</h4>;
    }
    return <p key={index}>{lines.map((line,i)=><span key={i}>{i>0&&<br/>}{inline(line)}</span>)}</p>;
  })}</div>;
}
