import { useEffect, useRef, useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization';
import { socialHubClient, type SocialMessage } from './client';

const attachmentLabels:Record<string,string>={image:'Image attachment',document:'Document attachment',audio:'Audio attachment',video:'Video attachment',sticker:'Sticker attachment'};
function safeAttachmentTypes(value:unknown):string[]{
  if(!Array.isArray(value)||value.length>30)return[];
  const result:string[]=[];
  for(const item of value){
    if(!item||typeof item!=='object'||Array.isArray(item))continue;
    const type=(item as {type?:unknown}).type;
    if(typeof type==='string'&&Object.prototype.hasOwnProperty.call(attachmentLabels,type))result.push(type);
  }
  return result;
}

export default function SocialMessageHistory({conversationId,onLatestInbound}:{
  conversationId:string;onLatestInbound:(conversationId:string,messageId:string|undefined)=>void;
}){
  const l=useLocalizer();
  const [messages,setMessages]=useState<SocialMessage[]>([]),[next,setNext]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const generation=useRef(0),alive=useRef(true),paging=useRef(false);
  const loaded=useRef<SocialMessage[]>([]);
  useEffect(()=>{
    let current=true;alive.current=true;
    async function refresh(){
      if(paging.current)return;
      const revision=++generation.current;
      try{
        const page=await socialHubClient.history(conversationId);
        if(!current||revision!==generation.current)return;
        const previous=loaded.current,known=new Set(previous.map(item=>item.id));
        const overlaps=page.messages.some(item=>known.has(item.id));
        // A burst larger than a page resets pagination, avoiding a hidden gap.
        const newestIds=new Set(page.messages.map(item=>item.id));
        const merged=overlaps?[...page.messages,...previous.filter(item=>!newestIds.has(item.id))]:page.messages;
        loaded.current=merged;setMessages(merged);
        if(!overlaps)setNext(page.nextBeforeId);
        onLatestInbound(conversationId,page.messages.find(item=>item.direction==='inbound')?.id);
        setNotice('');
      }catch{if(current&&revision===generation.current)setNotice(l('Conversation history unavailable.'));}
    }
    void refresh();
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh();},15000);
    const ref=generation;
    return()=>{current=false;alive.current=false;ref.current++;window.clearInterval(timer);};
  },[conversationId,l,onLatestInbound]);
  async function older(){
    if(!next||paging.current)return;
    paging.current=true;setBusy(true);const revision=++generation.current;
    try{
      const page=await socialHubClient.history(conversationId,next);
      if(!alive.current||revision!==generation.current)return;
      const previous=loaded.current,known=new Set(previous.map(item=>item.id));
      const merged=[...previous,...page.messages.filter(item=>!known.has(item.id))];loaded.current=merged;setMessages(merged);
      setNext(page.nextBeforeId);setNotice('');
    }catch{if(alive.current)setNotice(l('Conversation history unavailable.'));}
    finally{paging.current=false;if(alive.current)setBusy(false);}
  }
  return <div className="space-y-2">
    {next&&<button disabled={busy} onClick={()=>void older()}>{l('Load older messages')}</button>}
    <div role="log" aria-label={l('Conversation messages')} aria-live="polite">
      {[...messages].reverse().map(message=>{const attachments=safeAttachmentTypes(message.attachment_refs);return <div key={message.id} className="border-b p-2"><p>{message.direction}: {message.text}</p>
        {!!attachments.length&&<ul>{attachments.map((type,index)=><li key={`${type}-${index}`}>{l(attachmentLabels[type])}</li>)}</ul>}
      </div>;})}
    </div>
    {notice&&<p role="status">{notice}</p>}
  </div>;
}
