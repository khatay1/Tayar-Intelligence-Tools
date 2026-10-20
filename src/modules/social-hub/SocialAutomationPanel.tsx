import { useEffect, useRef, useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization';
import type { SocialScope } from './client';
import { socialAssistantClient, type KnowledgeAnswer } from './assistant-client';
import { socialAutomationClient as client, type AutomationRule, type BusinessHoursSlot } from './automation-client';

const triggerLabels={'message.received':'Incoming message','conversation.assigned':'Conversation assigned','human.requested':'Human follow-up requested','outside.hours':'Outside business hours'};
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const clock=(minute:number)=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
const minute=(value:string,fallback:number)=>{const[hour,part]=value.split(':').map(Number),result=hour*60+part;return Number.isInteger(result)?result:fallback;};
const emptyRule={id:null as string|null,enabled:false,trigger:'message.received' as AutomationRule['trigger'],contains:'',action:'notify' as AutomationRule['action'],approved_answer_id:null as string|null};
export default function SocialAutomationPanel({scope,onChange}:{scope:SocialScope;onChange:()=>Promise<void>}){
  const l=useLocalizer(),alive=useRef(true);
  const [rules,setRules]=useState<AutomationRule[]|null>(null),[knowledge,setKnowledge]=useState<KnowledgeAnswer[]>([]);
  const [rule,setRule]=useState(emptyRule),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [timeZone,setTimeZone]=useState(scope.business_time_zone??'UTC');
  const [hours,setHours]=useState<BusinessHoursSlot[]>(scope.business_hours??[]);
  const serializedHours=JSON.stringify(scope.business_hours??[]);
  useEffect(()=>{let current=true;alive.current=true;
    void Promise.all([client.rules(scope.id),socialAssistantClient.configuration(scope.id)]).then(([rows,configuration])=>{
      if(current){setRules(rows);setKnowledge(configuration?.knowledge??[]);}
    }).catch(()=>undefined);
    return()=>{current=false;alive.current=false;};
  },[scope.id]);
  useEffect(()=>{setTimeZone(scope.business_time_zone??'UTC');setHours(JSON.parse(serializedHours) as BusinessHoursSlot[]);},[scope.id,scope.business_time_zone,serializedHours]);
  async function run(operation:()=>Promise<void>){if(busy)return;setBusy(true);setNotice('');try{await operation();}catch{if(alive.current)setNotice(l('Automation unavailable. Check access and activation.'));}finally{if(alive.current)setBusy(false);}}
  if(rules===null)return null;
  return <details className="rounded border p-3 space-y-3"><summary>{l('Social automation')}</summary>
    <p>{l('Rules apply to new events. Automatic replies require an exact approved question; sensitive messages require human review.')}</p>
    <p>{l('Activation also requires the approved server scheduler.')}</p>
    <button disabled={busy||!scope.enabled} onClick={()=>void run(async()=>{await client.activate(scope.id,!scope.automation_enabled);await onChange();})}>
      {l(scope.automation_enabled?'Stop automation':'Enable automation')}
    </button>
    <fieldset className="rounded border p-2"><legend>{l('Business hours')}</legend>
      <label>{l('Time zone')} <input aria-label={l('Time zone')} maxLength={64} value={timeZone} onChange={e=>setTimeZone(e.target.value)} placeholder="Europe/Stockholm"/></label>
      <div className="grid gap-2 md:grid-cols-2">{days.map((day,index)=>{const slot=hours.find(item=>item.day===index);return <div key={day}>
        <label><input type="checkbox" checked={!!slot} onChange={e=>setHours(e.target.checked?[...hours,{day:index,openMinute:540,closeMinute:1020}]:hours.filter(item=>item.day!==index))}/>{l(day)}</label>
        {slot&&<><input aria-label={`${l(day)} ${l('opens')}`} type="time" value={clock(slot.openMinute)} onChange={e=>setHours(hours.map(item=>item.day===index?{...item,openMinute:minute(e.target.value,item.openMinute)}:item))}/>
          <input aria-label={`${l(day)} ${l('closes')}`} type="time" value={clock(slot.closeMinute)} onChange={e=>setHours(hours.map(item=>item.day===index?{...item,closeMinute:minute(e.target.value,item.closeMinute)}:item))}/></>}
      </div>;})}</div>
      <button disabled={busy||!timeZone.trim()||hours.some(item=>item.openMinute>=item.closeMinute)} onClick={()=>void run(async()=>{await client.schedule(scope.id,timeZone.trim(),hours);await onChange();if(alive.current)setNotice(l('Business hours saved.'));})}>{l('Save business hours')}</button>
    </fieldset>
    <label>{l('Automation rule')}<select value={rule.id??''} onChange={e=>{const item=rules.find(item=>item.id===e.target.value);setRule(item?{...item}:emptyRule);}}>
      <option value="">{l('New rule')}</option>{rules.map(item=><option key={item.id} value={item.id}>{l(triggerLabels[item.trigger])} · {item.action} {item.contains} · {l(item.enabled?'enabled':'disabled')}</option>)}
    </select></label>
    <label>{l('Trigger')}<select aria-label={l('Trigger')} value={rule.trigger} onChange={e=>setRule({...rule,trigger:e.target.value as AutomationRule['trigger'],contains:'',action:rule.action==='reply'?'notify':rule.action})}>
      <option value="message.received">{l('Incoming message')}</option><option value="conversation.assigned">{l('Conversation assigned')}</option><option value="human.requested">{l('Human follow-up requested')}</option><option value="outside.hours">{l('Outside business hours')}</option>
    </select></label>
    {rule.trigger==='message.received'&&<label>{l('Phrase contains')}<input maxLength={200} value={rule.contains} onChange={e=>setRule({...rule,contains:e.target.value})}/></label>}
    <label>{l('Action')}<select value={rule.action} onChange={e=>setRule({...rule,action:e.target.value as AutomationRule['action']})}>
      <option value="notify">{l('Create follow-up note')}</option><option value="suggest">{l('Request reply review')}</option>
      <option value="handoff">{l('Request human handoff')}</option>{rule.trigger==='message.received'&&<option value="reply">{l('Queue approved automatic reply')}</option>}
    </select></label>
    {rule.action==='reply'&&<label>{l('Approved business answers')}<select value={rule.approved_answer_id??''} onChange={e=>setRule({...rule,approved_answer_id:e.target.value||null})}>
      <option value="">{l('Select answer')}</option>{knowledge.filter(item=>item.approved&&!item.sensitive).map(item=><option key={item.id} value={item.id}>{item.question} · {item.language}</option>)}
    </select></label>}
    <label><input type="checkbox" checked={rule.enabled} onChange={e=>setRule({...rule,enabled:e.target.checked})}/>{l('Enable rule')}</label>
    <button disabled={busy||(rule.action==='reply'&&!rule.approved_answer_id)} onClick={()=>void run(async()=>{
      await client.save(scope.id,rule);const rows=await client.rules(scope.id);if(alive.current){setRules(rows);setRule(emptyRule);setNotice(l('Rule saved.'));}
    })}>{l('Save rule')}</button>
    {notice&&<p role="status">{notice}</p>}
  </details>;
}
