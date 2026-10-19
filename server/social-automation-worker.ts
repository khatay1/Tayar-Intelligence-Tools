import type { SupabaseClient } from '@supabase/supabase-js';
import { planSocialAutomation, suggestSocialReply, type SocialAutomationRule, type SocialKnowledgeAnswer } from './social-assistant';
import { isUntrustedBrowserRuntime } from '../src/modules/website-builder/services/trustedServerRuntime';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail():never { throw Error('Social automation unavailable.'); }
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))fail();return value as Record<string,unknown>;}
function id(value:unknown):string{if(typeof value!=='string'||!uuid.test(value))fail();return value;}

/** Bounded local-only consumer of the existing automation events. The database rechecks every effect. */
export function createSocialAutomationWorker(client:Pick<SupabaseClient,'rpc'>,enabled:()=>boolean) {
  if(isUntrustedBrowserRuntime())fail();
  async function rpc(name:string,args:Record<string,unknown>){const {data,error}=await client.rpc(name,args);if(error)fail();return data as unknown;}
  return async():Promise<{processed:number}>=>{
    let processed=0;
    for(let i=0;i<3&&enabled()===true;i++){
      const value=await rpc('claim_social_hub_automation',{});if(value===null)break;
      const row=object(value),eventId=id(row.id),claimToken=id(row.claimToken),scopeId=id(row.scopeId);
      const trigger=row.trigger??'message.received';
      if(!['message.received','conversation.assigned','human.requested'].includes(String(trigger)))fail();
      const messageId=trigger==='message.received'?id(row.messageId):undefined;
      if(typeof row.text!=='string'||row.text.length>16000||typeof row.humanAssigned!=='boolean'||!Array.isArray(row.rules)||row.rules.length>20||!Array.isArray(row.knowledge)||row.knowledge.length>20)fail();
      const rules:SocialAutomationRule[]=row.rules.map(value=>{
        const rule=object(value);if(rule.scopeId!==scopeId||typeof rule.enabled!=='boolean'||rule.trigger!==trigger
          ||typeof rule.contains!=='string'||rule.contains.length>200||!['suggest','handoff','notify','reply'].includes(String(rule.action)))fail();
        if(trigger!=='message.received'&&(rule.action==='reply'||rule.contains!==''))fail();
        return {id:id(rule.id),scopeId,enabled:rule.enabled,trigger:trigger as SocialAutomationRule['trigger'],contains:rule.contains,action:rule.action as SocialAutomationRule['action'],approvedAnswerId:rule.approvedAnswerId===null?undefined:id(rule.approvedAnswerId)};
      });
      const knowledge:SocialKnowledgeAnswer[]=row.knowledge.map(value=>{
        const item=object(value);if(item.scopeId!==scopeId||typeof item.question!=='string'||item.question.length>400||typeof item.answer!=='string'||item.answer.length>4000||typeof item.language!=='string'||typeof item.approved!=='boolean'||typeof item.sensitive!=='boolean')fail();
        return {id:id(item.id),scopeId,question:item.question,answer:item.answer,language:item.language,approved:item.approved,sensitive:item.sensitive};
      });
      let decisions=planSocialAutomation(true,true,{id:eventId,scopeId,trigger:trigger as SocialAutomationRule['trigger'],text:row.text},rules);
      const hasHandoff=decisions.some(decision=>decision.action==='handoff');
      decisions=decisions.filter(decision=>{
        if(decision.action!=='reply')return true;
        if(!messageId||hasHandoff||row.humanAssigned)return false;
        const answer=knowledge.find(item=>item.id===decision.approvedAnswerId);if(!answer)return false;
        const reply=suggestSocialReply({enabled:true,automationEnabled:true,scopeId,messageId,text:row.text as string,language:answer.language,humanAssigned:false,knowledge});
        return reply.kind==='auto-reply-candidate'&&reply.sourceIds.length===1&&reply.sourceIds[0]===answer.id;
      });
      if(enabled()!==true)break;
      const committed=await rpc('complete_social_hub_automation',{p_event_id:eventId,p_claim_token:claimToken,p_decisions:decisions.map(({ruleId,action})=>({ruleId,action}))});
      if(committed!==true)fail();processed++;
    }
    return {processed};
  };
}
