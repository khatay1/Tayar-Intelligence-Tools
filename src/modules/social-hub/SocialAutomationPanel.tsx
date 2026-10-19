import { useEffect, useRef, useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization';
import type { SocialScope } from './client';
import { socialAssistantClient, type KnowledgeAnswer } from './assistant-client';
import { socialAutomationClient as client, type AutomationRule } from './automation-client';

const emptyRule={id:null as string|null,enabled:false,contains:'',action:'notify' as AutomationRule['action'],approved_answer_id:null as string|null};
export default function SocialAutomationPanel({scope,onChange}:{scope:SocialScope;onChange:()=>Promise<void>}){
  const l=useLocalizer(),alive=useRef(true);
  const [rules,setRules]=useState<AutomationRule[]|null>(null),[knowledge,setKnowledge]=useState<KnowledgeAnswer[]>([]);
  const [rule,setRule]=useState(emptyRule),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{let current=true;alive.current=true;
    void Promise.all([client.rules(scope.id),socialAssistantClient.configuration(scope.id)]).then(([rows,configuration])=>{
      if(current){setRules(rows);setKnowledge(configuration?.knowledge??[]);}
    }).catch(()=>undefined);
    return()=>{current=false;alive.current=false;};
  },[scope.id]);
  async function run(operation:()=>Promise<void>){if(busy)return;setBusy(true);setNotice('');try{await operation();}catch{if(alive.current)setNotice(l('Automation unavailable. Check access and activation.'));}finally{if(alive.current)setBusy(false);}}
  if(rules===null)return null;
  return <details className="rounded border p-3 space-y-3"><summary>{l('Social automation')}</summary>
    <p>{l('Rules apply to new incoming messages. Automatic replies require an exact approved question; sensitive messages require human review.')}</p>
    <p>{l('Activation also requires the approved server scheduler.')}</p>
    <button disabled={busy||!scope.enabled} onClick={()=>void run(async()=>{await client.activate(scope.id,!scope.automation_enabled);await onChange();})}>
      {l(scope.automation_enabled?'Stop automation':'Enable automation')}
    </button>
    <label>{l('Automation rule')}<select value={rule.id??''} onChange={e=>{const item=rules.find(item=>item.id===e.target.value);setRule(item?{...item}:emptyRule);}}>
      <option value="">{l('New rule')}</option>{rules.map(item=><option key={item.id} value={item.id}>{item.action} · {item.contains||l('All incoming messages')} · {l(item.enabled?'enabled':'disabled')}</option>)}
    </select></label>
    <label>{l('Phrase contains')}<input maxLength={200} value={rule.contains} onChange={e=>setRule({...rule,contains:e.target.value})}/></label>
    <label>{l('Action')}<select value={rule.action} onChange={e=>setRule({...rule,action:e.target.value as AutomationRule['action']})}>
      <option value="notify">{l('Create follow-up note')}</option><option value="suggest">{l('Request reply review')}</option>
      <option value="handoff">{l('Request human handoff')}</option><option value="reply">{l('Queue approved automatic reply')}</option>
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
