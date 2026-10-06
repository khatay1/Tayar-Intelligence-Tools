import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { hookHarness } from './test-support/hook-harness.mjs';
const dir = await mkdtemp(join(tmpdir(),'tayar-remember-'));
const clients=[];
const store=()=>{const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
try {
  const outfile=join(dir,'storage.mjs');
  await build({entryPoints:['src/lib/auth-session-storage.ts'],outfile,bundle:true,format:'esm',platform:'node'});
  const {createAuthSessionStorage,AUTH_STORAGE_KEY:key}=await import(pathToFileURL(outfile));
  const persistent=store();
  const tab=store();
  let adapter=createAuthSessionStorage(persistent,tab);
  const user={id:'account-a',aud:'authenticated',role:'authenticated',email:'test@example.com'};
  const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'test'].join('.');
  const make=(storage)=>{
    const client=createClient('https://unit-test.supabase.co','test-key',{auth:{storage,storageKey:key,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url)=>{
      if(String(url).includes('/logout'))return new Response(null,{status:204});
      if(String(url).includes('/user'))return new Response(JSON.stringify(user),{status:200});
      return new Response(JSON.stringify({access_token:token,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user}),{status:200});
    }}});
    clients.push(client);return client;
  };
  adapter.setRememberSession(false);
  let client=make(adapter);
  assert.equal((await client.auth.signInWithPassword({email:user.email,password:'fixture'})).error,null);
  assert.ok(tab.getItem(key));assert.equal(persistent.getItem(key),null,'Unchecked must never persist token locally');
  assert.ok((await make(createAuthSessionStorage(persistent,tab)).auth.getSession()).data.session,'Reload in same tab retains login');
  assert.equal((await make(createAuthSessionStorage(persistent,store())).auth.getSession()).data.session,null,'A fresh browser tab must not inherit an unchecked login');
  assert.equal(adapter.containsUser('account-b'),false,'Another tab/account broadcast must not be accepted');
  assert.equal((await client.auth.refreshSession()).error,null);
  assert.equal(persistent.getItem(key),null,'Refresh must keep unchecked preference');
  assert.equal((await client.auth.signOut()).error,null);assert.equal(tab.getItem(key),null);
  adapter.setRememberSession(true);
  assert.equal((await client.auth.signInWithPassword({email:user.email,password:'fixture'})).error,null);
  assert.ok(persistent.getItem(key));assert.equal(tab.getItem(key),null);
  assert.ok((await make(createAuthSessionStorage(persistent,store())).auth.getSession()).data.session,'Remembered login survives a new tab/browser session');
  assert.equal((await client.auth.signOut()).error,null);assert.equal(persistent.getItem(key),null);
  for(const remember of [false,true]){
    const oauthTab=store();adapter=createAuthSessionStorage(persistent,oauthTab);adapter.setRememberSession(remember);client=make(adapter);
    const oauth=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:'https://www.tayar.se/',skipBrowserRedirect:true}});
    assert.equal(oauth.error,null);assert.equal(new URL(oauth.data.url).searchParams.get('provider'),'google');
    // A full-page OAuth redirect recreates the SDK but preserves the initiating tab storage.
    adapter=createAuthSessionStorage(persistent,oauthTab);client=make(adapter);
    assert.equal((await client.auth.setSession({access_token:token,refresh_token:'test-refresh'})).error,null);
    assert.equal(Boolean(persistent.getItem(key)),remember,'Google callback must honor the initiating choice');
    assert.equal(Boolean(oauthTab.getItem(key)),!remember);
    await client.auth.signOut();assert.equal(persistent.getItem(key),null);assert.equal(oauthTab.getItem(key),null);
  }
  const recoveryTab=store();client=make(createAuthSessionStorage(persistent,recoveryTab));
  await client.auth.setSession({access_token:token,refresh_token:'recovery-fixture'});
  assert.ok(recoveryTab.getItem(key));assert.equal(persistent.getItem(key),null,'New recovery sessions default to tab storage');
  await client.auth.signOut();
  // A legacy persistent session is preserved, then the next explicit choice removes the old copy.
  persistent.setItem(key,JSON.stringify({access_token:token,refresh_token:'legacy',user,expires_at:Math.floor(Date.now()/1000)+3600}));
  adapter=createAuthSessionStorage(persistent,store());assert.ok(adapter.getItem(key));
  adapter.setRememberSession(false);adapter.setItem(key,JSON.stringify({user}));assert.equal(persistent.getItem(key),null);
  const loginCalls=[];
  let fail=false;
  const login=hookHarness('src/components/auth/Login.tsx', {
    '@/lib/ui-localization': {useLocalizer:()=>text=>text},
    './AuthLayout': {default:'layout'},
    'lucide-react': Object.fromEntries(['Mail','Lock','Eye','EyeOff','Loader2'].map(name=>[name,name])),
    '@/context/AuthContext': {useAuth:()=>({
      signIn:async(...args)=>{loginCalls.push(['password',...args]);if(fail)throw Error('offline');return {error:null};},
      signInWithGoogle:async(...args)=>{loginCalls.push(['google',...args]);if(fail)throw Error('offline');return {error:null};},
    })},
  });
  function elements(node,type){if(!node||typeof node!=='object')return [];return [...(node.type===type?[node]:[]),...([node.props?.children].flat(Infinity).flatMap(child=>elements(child,type)))];}
  let view=login.render('default');
  let checkbox=elements(view,'input').find(x=>x.props.type==='checkbox');
  assert.equal(checkbox.props.checked,false,'Remember me is unchecked by default');
  await elements(view,'form')[0].props.onSubmit({preventDefault(){}});
  assert.equal(loginCalls.at(-1).at(-1),false);
  checkbox.props.onChange({target:{checked:true}});view=login.render('default');
  await elements(view,'button')[0].props.onClick();
  assert.deepEqual(loginCalls.at(-1),['google',true],'Google receives the selected preference');
  fail=true;await elements(view,'form')[0].props.onSubmit({preventDefault(){}});view=login.render('default');
  assert.equal(elements(view,'button').find(x=>x.props.type==='submit').props.disabled,false,'Login transport exception must release the button');
  assert.ok(JSON.stringify(view).includes('Could not sign in. Please try again.'));
  console.log('PASS checkbox defaults, password/Google choice forwarding, and login failure UI');
  console.log('PASS real SDK password login, refresh, remembered/non-remembered reload/new tab, Google redirect choice, recovery, logout, legacy migration, and account broadcast guard');
} finally { for(const c of clients)await c.auth.stopAutoRefresh();await rm(dir,{recursive:true,force:true}); }
