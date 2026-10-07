'use client';

import { useEffect,useState } from 'react';

/** Server fallback is an unambiguous UTC instant; hydration presents buyer-local time. */
export default function LocalAvailabilityTime({value,prefix='Next available'}:{value:string;prefix?:string}){
  const [label,setLabel]=useState(()=>new Date(value).toUTCString());
  useEffect(()=>{
    setLabel(new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'})
      .format(new Date(value)));
  },[value]);
  return <time dateTime={value}>{prefix}: {label}</time>;
}
