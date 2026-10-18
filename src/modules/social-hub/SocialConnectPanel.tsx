import { useEffect, useRef, useState } from 'react';
import { socialConnectRequest } from './connect-client';
import type { SocialConnection, SocialScope } from './client';
type Channel = 'whatsapp' | 'telegram' | 'facebook' | 'instagram';
export default function SocialConnectPanel({ scope, connections, onChange }: {
  scope: SocialScope; connections: SocialConnection[]; onChange: () => Promise<void>;
}) {
  const [channel,setChannel] = useState<Channel>('whatsapp');
  const [accountId,setAccountId] = useState('');
  const [pageId,setPageId] = useState('');
  const [businessAccountId,setBusinessAccountId] = useState('');
  const [botToken,setBotToken] = useState('');
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const pending = useRef<{popup:Window;state:string;tenantId:string;channel:Channel;timer:number}|null>(null);
  const identity = useRef(scope.id); identity.current = scope.id;
  useEffect(() => {
    function receive(event: MessageEvent) {
      const current = pending.current;
      if (!current || event.origin !== window.location.origin || event.source !== current.popup
        || !event.data || event.data.type !== 'tayar-social-connect' || event.data.state !== current.state
        || typeof event.data.code !== 'string' || !/^[A-Za-z0-9_.-]{1,4096}$/.test(event.data.code)) return;
      window.clearTimeout(current.timer); pending.current = null; current.popup.close();
      void socialConnectRequest('callback',{tenantId:current.tenantId,channel:current.channel,state:current.state,code:event.data.code})
        .then(async()=>{if(identity.current===current.tenantId){setNotice('Account verified. Webhook setup and delivery testing are still required.');await onChange();}})
        .catch(()=>{if(identity.current===current.tenantId)setNotice('Connect verification failed. Start again.');})
        .finally(()=>{if(identity.current===current.tenantId)setBusy(false);});
    }
    window.addEventListener('message',receive);
    return ()=>{window.removeEventListener('message',receive);const current=pending.current;if(current){window.clearTimeout(current.timer);current.popup.close();pending.current=null;}};
  },[onChange]);
  async function connect() {
    if (busy || !scope.enabled) return;
    setNotice('');setBusy(true);
    const tenantId=scope.id;
    let popup:Window|null = null;
    if(channel!=='telegram')popup=window.open('about:blank','tayar-social-connect','popup,width=640,height=760');
    try {
      if(channel==='telegram') {
        const token=botToken;setBotToken('');
        await socialConnectRequest('telegram',{tenantId,ownership:scope.kind,botToken:token});
        if(identity.current===tenantId){setNotice('Bot identity verified. Configure its official webhook before messaging.');await onChange();}
      } else {
        if(!popup)throw new Error('Allow the Connect popup.');
        const result=await socialConnectRequest('start',{tenantId,channel,accountId,ownership:scope.kind,
          ...(channel==='instagram'?{pageId}:{}),...(channel==='whatsapp'?{businessAccountId}:{})});
        if(typeof result.authorizationUrl!=='string')throw new Error();
        const url=new URL(result.authorizationUrl);
        const state=url.searchParams.get('state');
        if(url.protocol!=='https:'||url.hostname!=='www.facebook.com'||url.port||url.username||url.password||!state||!/^[a-f0-9]{64}$/.test(state)||identity.current!==tenantId)throw new Error();
        const timer=window.setTimeout(()=>{const current=pending.current;if(current?.state===state){current.popup.close();pending.current=null;setBusy(false);setNotice('Connect expired. Start again.');}},10*60000);
        pending.current={popup,state,tenantId,channel,timer};popup.location.href=url.toString();
        setNotice('Complete authorization in the official platform popup.');return;
      }
    } catch { popup?.close();if(identity.current===tenantId)setNotice('Connection setup unavailable. Check access, app configuration and account approval.'); }
    if(identity.current===tenantId)setBusy(false);
  }
  return <details className="rounded border p-3"><summary>Connect official channels</summary>
    <p>Use your business account. Meta app approval and verified webhooks are required before sending.</p>
    <label>Channel <select className="text-slate-900" value={channel} disabled={busy} onChange={e=>{setChannel(e.target.value as Channel);setBotToken('');}}>
      <option value="whatsapp">WhatsApp Business</option><option value="telegram">Telegram Bot</option><option value="facebook">Facebook Page</option><option value="instagram">Instagram Professional</option>
    </select></label>
    {channel==='telegram'?<label>Bot token<input className="block text-slate-900" type="password" autoComplete="off" value={botToken} onChange={e=>setBotToken(e.target.value)}/></label>
      :<><label>{channel==='whatsapp'?'Phone number ID':channel==='facebook'?'Page ID':'Instagram account ID'}<input className="block text-slate-900" inputMode="numeric" value={accountId} onChange={e=>setAccountId(e.target.value)}/></label>
      {channel==='whatsapp'&&<label>WhatsApp Business account ID<input className="block text-slate-900" inputMode="numeric" value={businessAccountId} onChange={e=>setBusinessAccountId(e.target.value)}/></label>}
      {channel==='instagram'&&<label>Linked Facebook Page ID<input className="block text-slate-900" inputMode="numeric" value={pageId} onChange={e=>setPageId(e.target.value)}/></label>}</>}
    <button disabled={busy||!scope.enabled||(channel==='telegram'?!botToken.trim():!accountId.trim())} onClick={()=>void connect()}>Connect {channel}</button>
    {busy&&pending.current&&<button onClick={()=>{const current=pending.current;if(current){window.clearTimeout(current.timer);current.popup.close();pending.current=null;}setBusy(false);setNotice('Connect cancelled.');}}>Cancel Connect</button>}
    {notice&&<p role="status">{notice}</p>}
    {connections.map(connection=><div key={connection.id}>{connection.channel} · {connection.status}
      <button disabled={busy||connection.status==='disconnected'} onClick={()=>{
        setBusy(true);const tenantId=scope.id;
        void socialConnectRequest('disconnect',{tenantId,connectionId:connection.id}).then(async()=>{if(identity.current===tenantId)await onChange();})
          .catch(()=>{if(identity.current===tenantId)setNotice('Disconnection could not be confirmed. Refresh connection status.');}).finally(()=>{if(identity.current===tenantId)setBusy(false);});
      }}>Disconnect</button></div>)}
  </details>;
}
