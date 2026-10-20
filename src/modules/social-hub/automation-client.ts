import { supabase } from '@/lib/supabase';
export interface BusinessHoursSlot { day:number;openMinute:number;closeMinute:number }
export interface AutomationRule { id:string;enabled:boolean;trigger:'message.received'|'conversation.assigned'|'human.requested'|'outside.hours'|'order.status.changed'|'booking.reminder';contains:string;action:'suggest'|'handoff'|'notify'|'reply';approved_answer_id:string|null }
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{const {data,error}=await supabase.rpc(name,args);if(error)throw Error('Automation unavailable.');return data as T;}
export const socialAutomationClient={
  rules:(scopeId:string)=>rpc<AutomationRule[]|null>('get_social_hub_automation_rules',{p_scope_id:scopeId}),
  activate:(scopeId:string,enabled:boolean)=>rpc('set_social_hub_automation',{p_scope_id:scopeId,p_enabled:enabled}),
  schedule:(scopeId:string,timeZone:string,hours:BusinessHoursSlot[])=>rpc('configure_social_hub_business_hours',{p_scope_id:scopeId,p_time_zone:timeZone,p_hours:hours}),
  save:(scopeId:string,rule:Omit<AutomationRule,'id'>&{id:string|null})=>rpc<string>('save_social_hub_event_rule',{
    p_scope_id:scopeId,p_id:rule.id,p_enabled:rule.enabled,p_trigger:rule.trigger,p_contains:rule.contains,p_action:rule.action,p_answer_id:rule.action==='reply'?rule.approved_answer_id:null,
  }),
};
