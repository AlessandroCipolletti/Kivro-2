'use client';

import {useEffect,useState} from 'react';
import {InputContractSchema,type InputContract} from
  '../../../../../packages/contracts/src/capability-io.js';
import {PLATFORM_FILE_LIMITS} from
  '../../../../../packages/contracts/src/file-limits.js';

type Field=InputContract['fields'][number];
type FieldType=Field['type'];
type Saved={id:string;contract:InputContract;revision:number;updatedAt:string};
const types:readonly FieldType[]=['SHORT_TEXT','LONG_TEXT','MARKDOWN','INTEGER',
  'NUMBER','BOOLEAN','SELECT','MULTI_SELECT','URL','JSON','FILE','FILES'];
function newField(type:FieldType,key:string,order:number):Field{
  const base={key,label:'New input',required:false,order};
  if(type==='SHORT_TEXT'||type==='LONG_TEXT'||type==='MARKDOWN')
    return {...base,type,constraints:{maxLength:type==='SHORT_TEXT'?256:10_000}};
  if(type==='INTEGER'||type==='NUMBER')return {...base,type,constraints:{}};
  if(type==='SELECT'||type==='MULTI_SELECT')
    return {...base,type,constraints:{allowedValues:['option-one']}};
  if(type==='JSON')return {...base,type,maxBytes:65_536};
  if(type==='FILE'||type==='FILES')return {...base,type,constraints:{
    minFiles:0,maxFiles:type==='FILE'?1:Math.min(10,PLATFORM_FILE_LIMITS.maxFilesPerField),
    maxFileSizeBytes:Math.min(10_000_000,PLATFORM_FILE_LIMITS.maxSingleFileBytes),
    maxTotalSizeBytes:Math.min(50_000_000,PLATFORM_FILE_LIMITS.maxTotalFieldBytes),
    allowedMimeTypes:['application/pdf'],allowedExtensions:['.pdf']}};
  return {...base,type};
}
function preview(field:Field,value:unknown,onChange:(value:unknown)=>void){
  if(field.type==='BOOLEAN')return <input type="checkbox"
    checked={value===true} onChange={(event)=>onChange(event.target.checked)}/>;
  if(field.type==='SELECT'||field.type==='MULTI_SELECT')return <select
    multiple={field.type==='MULTI_SELECT'} value={field.type==='MULTI_SELECT'?
      Array.isArray(value)?value as string[]:[]:String(value??'')}
    onChange={(event)=>onChange(field.type==='MULTI_SELECT'?
      Array.from(event.target.selectedOptions).map((item)=>item.value):
      event.target.value)}>
    <option value="">Choose…</option>{field.constraints.allowedValues.map((value)=><option
      key={value}>{value}</option>)}
  </select>;
  if(field.type==='FILE'||field.type==='FILES')return <input type="file"
    multiple={field.type==='FILES'} disabled
    accept={field.constraints.allowedExtensions.join(',')}/>;
  if(['LONG_TEXT','MARKDOWN','JSON'].includes(field.type))return <textarea
    rows={3} value={String(value??'')} onChange={(event)=>onChange(event.target.value)}/>;
  return <input type={field.type==='URL'?'url':
    field.type==='INTEGER'||field.type==='NUMBER'?'number':'text'}
    value={String(value??'')} onChange={(event)=>onChange(field.type==='INTEGER'||
      field.type==='NUMBER'?event.target.value===''?undefined:
        Number(event.target.value):event.target.value)}/>;
}
function conditionValue(field:Field):string|number|boolean{
  if(field.type==='BOOLEAN')return true;
  if(field.type==='SELECT')return field.constraints.allowedValues[0]??'';
  if(field.type==='INTEGER'||field.type==='NUMBER')
    return field.constraints?.minimum??0;
  return field.required?'value':'';
}
function canControlCondition(field:Field):boolean{
  return ['BOOLEAN','SELECT','INTEGER','NUMBER','SHORT_TEXT','LONG_TEXT',
    'MARKDOWN'].includes(field.type);
}
export default function InputContractBuilder(){
  const [drafts,setDrafts]=useState<Saved[]>([]);
  const [id,setId]=useState<string|null>(null);
  const [revision,setRevision]=useState(0);
  const [savedContract,setSavedContract]=useState<string|null>(null);
  const [fields,setFields]=useState<Field[]>([newField('SHORT_TEXT','instructions',0)]);
  const [previewValues,setPreviewValues]=useState<Record<string,unknown>>({});
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const load=async(clearMessage=true)=>{
    try{const response=await fetch('/api/seller/input-contract',{cache:'no-store'});
      if(!response.ok)throw new Error('UNAVAILABLE');
      const body=await response.json() as {drafts:Saved[]};
      setDrafts(body.drafts);if(clearMessage)setMessage('');}
    catch{setMessage('Private drafts are unavailable. Retry when the connection returns.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);
  const pick=(draft:Saved)=>{setId(draft.id);setRevision(draft.revision);
    setFields([...draft.contract.fields].sort((a,b)=>a.order-b.order));
    setSavedContract(JSON.stringify(draft.contract));setPreviewValues({});setMessage('');};
  const update=(index:number,edit:(field:Field)=>Field)=>setFields((prior)=>
    prior.map((field,i)=>i===index?edit(field):field));
  const move=(index:number,direction:-1|1)=>setFields((prior)=>{
    const next=[...prior],other=index+direction;
    if(other<0||other>=next.length)return prior;
    [next[index],next[other]]=[next[other]!,next[index]!];
    return next.map((field,order)=>({...field,order}));
  });
  const changeType=(index:number,type:FieldType)=>update(index,(field)=>({
    ...newField(type,field.key,field.order),label:field.label,
    description:field.description,required:field.required} as Field));
  const editConstraints=(index:number,patch:Record<string,unknown>)=>
    update(index,(field)=>({...field,constraints:{...
      ('constraints' in field?field.constraints:{}),...patch}} as Field));
  const save=async()=>{
    const parsed=InputContractSchema.safeParse({schemaVersion:1,
      fields:fields.map((field,order)=>({...field,order}))});
    if(!parsed.success){setMessage(parsed.error.issues.map((issue)=>issue.message)
      .slice(0,2).join(' · '));return;}
    // Keep the identity stable if the server commits but the response is lost.
    const draftId=id??crypto.randomUUID();
    if(!id)setId(draftId);
    setSaving(true);setMessage('');
    try{const response=await fetch('/api/seller/input-contract',{method:'POST',
      headers:{'content-type':'application/json'},body:JSON.stringify({
        draftId,expectedRevision:revision,
        contract:parsed.data})});
      const body=await response.json() as Saved&{code?:string};
      if(!response.ok){setMessage(body.code==='REVISION_CONFLICT'
        ?'This draft changed in another tab. Reload it before saving again.'
        :'The contract was not saved. Check field constraints and retry.');return;}
      setId(body.id);setRevision(body.revision);setFields(body.contract.fields);
      setSavedContract(JSON.stringify(body.contract));
      setMessage(`Saved private draft · revision ${body.revision}. Worker review is still required.`);
      await load(false);
    }catch{setMessage('The connection failed. Your edits remain in this tab. Retry saving.');}
    finally{setSaving(false);}
  };
  const exportContract=()=>{
    const parsed=InputContractSchema.safeParse({schemaVersion:1,
      fields:fields.map((field,order)=>({...field,order}))});
    if(!parsed.success||!id||JSON.stringify(parsed.data)!==savedContract){
      setMessage('Save the current input contract before exporting it.');return;
    }
    const blob=new Blob([JSON.stringify(parsed.data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`kivro-input-contract-${id??'draft'}.json`;
    link.click();URL.revokeObjectURL(url);
  };
  return <section className="input-contract-builder" aria-label="Input contract builder">
    <div className="input-contract-toolbar">
      <div><h2>Input fields</h2><p>Fields are contract data. Saving this draft grants no Worker access.</p></div>
      <div><button type="button" onClick={()=>{setId(null);setRevision(0);
        setSavedContract(null);setFields([newField('SHORT_TEXT','instructions',0)]);
        setPreviewValues({});
        setMessage('New private draft.');}}>
        New draft</button><button type="button" onClick={()=>void save()} disabled={saving}>
        {saving?'Saving…':'Save draft'}</button></div>
    </div>
    {loading?<p role="status">Loading private drafts…</p>:drafts.length>0&&
      <label className="input-contract-select">Saved drafts
        <select value={id??''} onChange={(event)=>{
          const draft=drafts.find((item)=>item.id===event.target.value);
          if(draft)pick(draft);
          else {setId(null);setRevision(0);setSavedContract(null);
            setFields([newField('SHORT_TEXT','instructions',0)]);
            setPreviewValues({});setMessage('New private draft.');}}}>
          <option value="">New draft</option>{drafts.map((draft)=><option
            key={draft.id} value={draft.id}>{draft.contract.fields.map((field)=>field.label)
              .slice(0,2).join(', ')} · revision {draft.revision}</option>)}
        </select></label>}
    <ol className="input-contract-fields">{fields.map((field,index)=><li key={`${field.key}-${index}`}>
      <div className="input-contract-field-head"><strong>{index+1}. {field.label||'Untitled input'}</strong>
        <div><button type="button" aria-label={`Move ${field.label} up`}
          disabled={index===0} onClick={()=>move(index,-1)}>↑</button>
          <button type="button" aria-label={`Move ${field.label} down`}
            disabled={index===fields.length-1} onClick={()=>move(index,1)}>↓</button>
          <button type="button" disabled={fields.length===1}
            onClick={()=>setFields((prior)=>prior.filter((_,i)=>i!==index)
              .map((item,order)=>({...item,order})))}>Remove</button></div></div>
      <div className="input-contract-controls">
        <label>Key<input value={field.key} maxLength={64}
          onChange={(event)=>update(index,(item)=>({...item,key:event.target.value}))}/></label>
        <label>Label<input value={field.label} maxLength={120}
          onChange={(event)=>update(index,(item)=>({...item,label:event.target.value}))}/></label>
        <label>Type<select value={field.type} onChange={(event)=>
          changeType(index,event.target.value as FieldType)}>
          {types.map((type)=><option key={type} value={type}>
            {type.replaceAll('_',' ').toLowerCase()}</option>)}</select></label>
        <label className="input-contract-wide">Description<input value={field.description??''}
          maxLength={1000} onChange={(event)=>update(index,(item)=>({...item,
            description:event.target.value}))}/></label>
        <label className="input-contract-check"><input type="checkbox"
          checked={field.required} onChange={(event)=>update(index,(item)=>({...item,
            required:event.target.checked}))}/>Required</label>
        {index>0&&<label>Show when
          <select value={field.visibleWhen?.fieldKey??''} onChange={(event)=>{
            const source=fields.slice(0,index).find((item)=>
              item.key===event.target.value);
            update(index,(item)=>({...item,visibleWhen:source?
              {fieldKey:source.key,equals:conditionValue(source)}:undefined}));
          }}><option value="">Always visible</option>
            {fields.slice(0,index).filter(canControlCondition).map((item)=><option
              key={item.key} value={item.key}>{item.label||item.key}</option>)}
          </select></label>}
        {field.visibleWhen&&(()=>{
          const source=fields.slice(0,index).find((item)=>
            item.key===field.visibleWhen?.fieldKey);
          if(!source)return null;
          const setEquals=(value:string|number|boolean)=>update(index,(item)=>({
            ...item,visibleWhen:{fieldKey:source.key,equals:value}}));
          return <label>Equals
            {source.type==='SELECT'?<select value={String(field.visibleWhen.equals)}
              onChange={(event)=>setEquals(event.target.value)}>
              {source.constraints.allowedValues.map((value)=><option
                key={value} value={value}>{value}</option>)}
            </select>:source.type==='BOOLEAN'?<select
              value={String(field.visibleWhen.equals)} onChange={(event)=>
                setEquals(event.target.value==='true')}>
              <option value="true">Yes</option><option value="false">No</option>
            </select>:<input type={source.type==='INTEGER'||source.type==='NUMBER'
              ?'number':'text'} value={String(field.visibleWhen.equals)}
              onChange={(event)=>setEquals(source.type==='INTEGER'||
                source.type==='NUMBER'?Number(event.target.value):event.target.value)}/>}</label>;
        })()}
        {(field.type==='SHORT_TEXT'||field.type==='LONG_TEXT'||field.type==='MARKDOWN')&&<>
          <label>Minimum characters<input type="number" min={0} value={field.constraints?.minLength??0}
            onChange={(event)=>editConstraints(index,{minLength:Number(event.target.value)})}/></label>
          <label>Maximum characters<input type="number" min={1} value={field.constraints?.maxLength??''}
            onChange={(event)=>editConstraints(index,{maxLength:Number(event.target.value)})}/></label></>}
        {(field.type==='INTEGER'||field.type==='NUMBER')&&<>
          <label>Minimum<input type="number" value={field.constraints?.minimum??''}
            onChange={(event)=>editConstraints(index,{minimum:event.target.value===''?
              undefined:Number(event.target.value)})}/></label>
          <label>Maximum<input type="number" value={field.constraints?.maximum??''}
            onChange={(event)=>editConstraints(index,{maximum:event.target.value===''?
              undefined:Number(event.target.value)})}/></label></>}
        {(field.type==='SELECT'||field.type==='MULTI_SELECT')&&<>
          <label className="input-contract-wide">Options, one per line<textarea rows={3}
            value={field.constraints.allowedValues.join('\n')}
            onChange={(event)=>editConstraints(index,{allowedValues:event.target.value
              .split('\n').map((item)=>item.trim()).filter(Boolean)})}/></label>
          {field.type==='MULTI_SELECT'&&<label>Maximum selections<input type="number"
            min={1} value={field.constraints.maxSelections??''}
            onChange={(event)=>editConstraints(index,{maxSelections:event.target.value===''?
              undefined:Number(event.target.value)})}/></label>}</>}
        {(field.type==='SHORT_TEXT'||field.type==='LONG_TEXT'||
          field.type==='MARKDOWN'||field.type==='SELECT')&&<label>
          Default value {field.required&&<small>Optional when omitted by the buyer</small>}
          {field.type==='SELECT'?<select value={field.defaultValue??''}
            onChange={(event)=>update(index,(item)=>({...item,
              defaultValue:event.target.value||undefined} as Field))}>
            <option value="">No default</option>{field.constraints.allowedValues.map(
              (value)=><option key={value} value={value}>{value}</option>)}
          </select>:<input value={field.defaultValue??''}
            onChange={(event)=>update(index,(item)=>({...item,
              defaultValue:event.target.value||undefined} as Field))}/>}</label>}
        {(field.type==='INTEGER'||field.type==='NUMBER')&&<label>Default value
          <input type="number" step={field.type==='INTEGER'?'1':'any'}
            value={field.defaultValue??''} onChange={(event)=>update(index,
              (item)=>({...item,defaultValue:event.target.value===''?
                undefined:Number(event.target.value)} as Field))}/></label>}
        {field.type==='BOOLEAN'&&<label>Default value
          <select value={field.defaultValue===undefined?'':String(field.defaultValue)}
            onChange={(event)=>update(index,(item)=>({...item,
              defaultValue:event.target.value===''?undefined:
                event.target.value==='true'} as Field))}>
            <option value="">No default</option><option value="true">Yes</option>
            <option value="false">No</option>
          </select></label>}
        {(field.type==='FILE'||field.type==='FILES')&&<>
          <label>Maximum files<input type="number" min={1}
            max={PLATFORM_FILE_LIMITS.maxFilesPerField} disabled={field.type==='FILE'}
            value={field.constraints.maxFiles} onChange={(event)=>editConstraints(index,
              {maxFiles:Number(event.target.value)})}/></label>
          <label>Max file size, bytes<input type="number" min={1}
            value={field.constraints.maxFileSizeBytes}
            onChange={(event)=>editConstraints(index,
              {maxFileSizeBytes:Number(event.target.value)})}/></label>
          <label>Max total size, bytes<input type="number" min={1}
            value={field.constraints.maxTotalSizeBytes}
            onChange={(event)=>editConstraints(index,
              {maxTotalSizeBytes:Number(event.target.value)})}/></label>
          <label>Allowed extensions<input value={field.constraints.allowedExtensions.join(', ')}
            onChange={(event)=>editConstraints(index,{allowedExtensions:event.target.value
              .split(',').map((item)=>item.trim()).filter(Boolean)})}/></label>
          <label>Allowed MIME types<input value={field.constraints.allowedMimeTypes.join(', ')}
            onChange={(event)=>editConstraints(index,{allowedMimeTypes:event.target.value
              .split(',').map((item)=>item.trim()).filter(Boolean)})}/></label></>}
        {field.type==='JSON'&&<label>Maximum JSON bytes<input type="number" min={1}
          value={field.maxBytes} onChange={(event)=>update(index,(item)=>({...item,
            maxBytes:Number(event.target.value)} as Field))}/></label>}
      </div>
    </li>)}</ol>
    <button type="button" onClick={()=>setFields((prior)=>[
      ...prior,newField('SHORT_TEXT',`input${prior.length+1}`,prior.length)])}
      disabled={fields.length>=64}>+ Add input</button>
    <details className="input-contract-preview"><summary>Preview buyer form</summary>
      <fieldset><legend>Buyer provides</legend>{fields.filter((field)=>{
        if(!field.visibleWhen)return true;
        const source=fields.find((item)=>item.key===field.visibleWhen?.fieldKey);
        const chosen=previewValues[field.visibleWhen.fieldKey]??
          (source&&'defaultValue' in source?source.defaultValue:undefined);
        return chosen===field.visibleWhen.equals;
      }).map((field)=><label
        key={field.key}>{field.label}{field.required?' · required':''}
        {field.visibleWhen&&<small>Shown when {fields.find((item)=>
          item.key===field.visibleWhen?.fieldKey)?.label??field.visibleWhen.fieldKey}
          {' = '}{String(field.visibleWhen.equals)}</small>}
        {field.description&&<small>{field.description}</small>}{preview(field,
          previewValues[field.key]??('defaultValue' in field?field.defaultValue:undefined),
          (value)=>setPreviewValues((prior)=>({...prior,[field.key]:value})))}</label>)}</fieldset>
      <p className="seller-muted">Preview only. No data is submitted or uploaded.</p>
    </details>
    <p className="seller-muted">Use the exported JSON as <code>ioContract.input</code> in
      your private Worker authoring file. The Worker validates and tests that
      exact contract; publication requires your separate approval.</p>
    <button type="button" onClick={exportContract}>Export input contract JSON</button>
    {message&&<p role="status" className="notice">{message}</p>}
  </section>;
}
