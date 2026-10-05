// Isolated PostgreSQL; never connects to a live Supabase project.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {PGlite}=await import(process.env.TAYAR_PGLITE_MODULE || '@electric-sql/pglite');
const {pgcrypto}=await import(process.env.TAYAR_PGCRYPTO_MODULE || '@electric-sql/pglite/contrib/pgcrypto');
const db=new PGlite({extensions:{pgcrypto}});
const root=new URL('../supabase/migrations/',import.meta.url);
const functions=['rename_team_workspace','create_team_workspace_invite','revoke_team_workspace_invite','assign_project_to_team_workspace','remove_project_from_team_workspace','accept_team_workspace_invite'];
const ids={owner:'11111111-1111-4111-8111-111111111111',outsider:'22222222-2222-4222-8222-222222222222',viewer:'33333333-3333-4333-8333-333333333333',workspace:'44444444-4444-4444-8444-444444444444',project:'55555555-5555-4555-8555-555555555555',ownProject:'66666666-6666-4666-8666-666666666666',invite:'77777777-7777-4777-8777-777777777777'};
async function actor(id){await db.query("select set_config('test.uid',$1,false)",[id]);}
try{
 await db.exec(`create extension pgcrypto;create role anon;create role authenticated;create schema auth;
 create function auth.uid()returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email text);grant usage on schema auth to authenticated;grant execute on function auth.uid()to authenticated;
 create table public.team_workspaces(id uuid primary key,owner_id uuid,name text,updated_at timestamptz default now());
 create table public.team_workspace_members(workspace_id uuid,user_id uuid,role text not null,primary key(workspace_id,user_id));
 create table public.team_workspace_invites(id uuid primary key default gen_random_uuid(),workspace_id uuid,email text,role text not null,token_hash text,invited_by uuid,expires_at timestamptz,created_at timestamptz default now());
 create table public.projects(id uuid primary key,user_id uuid,workspace_id uuid,updated_at timestamptz default now());
 create function public.team_effective_plan(uuid)returns text language sql as $$select 'business'::text$$;
 create function public.website_builder_plan_entitlements(text)returns jsonb language sql as $$select '{"maxTeamMembers":10}'::jsonb$$;
 alter table public.team_workspaces enable row level security;alter table public.team_workspace_members enable row level security;alter table public.team_workspace_invites enable row level security;alter table public.projects enable row level security;
 grant select on public.team_workspaces,public.team_workspace_members,public.team_workspace_invites,public.projects to authenticated;`);
 const source=await fs.readFile(new URL('20260828155500_add_team_workspaces.sql',root),'utf8');
 for(const name of functions){const start=source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);assert.ok(start>=0);const end=source.indexOf('$$;',source.indexOf('AS $$',start))+3;await db.exec(source.slice(start,end));const grantStart=source.indexOf('REVOKE ALL ON FUNCTION',end);const grantEnd=source.indexOf(';',source.indexOf('GRANT EXECUTE',grantStart))+1;await db.exec(source.slice(grantStart,grantEnd));}
 if(!process.argv.includes('--baseline')){const names=(await fs.readdir(root)).filter(n=>n.endsWith('_team_workspace_authorization_null_guards.sql'));assert.equal(names.length,1);await db.exec(await fs.readFile(new URL(names[0],root),'utf8'));}
 await db.query('insert into auth.users values($1,$2),($3,$4),($5,$6)',[ids.owner,'owner@example.com',ids.outsider,'outsider@example.com',ids.viewer,'viewer@example.com']);
 await db.query('insert into public.team_workspaces(id,owner_id,name)values($1,$2,$3)',[ids.workspace,ids.owner,'Owner workspace']);
 await db.query('insert into public.team_workspace_members values($1,$2,$3),($1,$4,$5)',[ids.workspace,ids.owner,'owner',ids.viewer,'viewer']);
 await db.query('insert into public.projects(id,user_id,workspace_id)values($1,$2,$3),($4,$5,null)',[ids.project,ids.owner,ids.workspace,ids.ownProject,ids.outsider]);
 await db.query("insert into public.team_workspace_invites(id,workspace_id,email,role,token_hash,invited_by,expires_at)values($1,$2,'pending@example.com','viewer','fixture',$3,now()+interval '1 day')",[ids.invite,ids.workspace,ids.owner]);
 await db.exec('set role authenticated');await actor(ids.outsider);
 assert.equal((await db.query('select count(*)::int as n from public.team_workspaces')).rows[0].n,0,'fixture RLS denies outsider direct reads');
 const calls=[['rename_team_workspace',[ids.workspace,'Hijacked']],['create_team_workspace_invite',[ids.workspace,'outsider@example.com','admin']],['revoke_team_workspace_invite',[ids.invite]],['assign_project_to_team_workspace',[ids.ownProject,ids.workspace]],['remove_project_from_team_workspace',[ids.project]]];
 for(const [name,args] of calls){const query=`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})`;await assert.rejects(db.query(query,args),/access required/i,`outsider must be denied by ${name}`);console.log(`PASS outsider denied: ${name}`);}
 await actor('');await assert.rejects(db.query('select public.remove_project_from_team_workspace($1)',[ids.project]),/access required/i,'null identity must be denied');
 await actor(ids.viewer);await assert.rejects(db.query('select public.rename_team_workspace($1,$2)',[ids.workspace,'Viewer rename']),/access required/i);
 await actor(ids.owner);await db.query('select public.rename_team_workspace($1,$2)',[ids.workspace,'Owner rename']);
 const invitation=(await db.query("select public.create_team_workspace_invite($1,$2,'editor') as value",[ids.workspace,'outsider@example.com'])).rows[0].value;
 await actor(ids.outsider);await db.query('select public.accept_team_workspace_invite($1)',[invitation.token]);
 await assert.rejects(db.query('select public.rename_team_workspace($1,$2)',[ids.workspace,'Editor rename']),/access required/i);
 await actor(ids.owner);await db.query('select public.revoke_team_workspace_invite($1)',[ids.invite]);await db.query('select public.remove_project_from_team_workspace($1)',[ids.project]);await db.query('select public.assign_project_to_team_workspace($1,$2)',[ids.project,ids.workspace]);
 await db.exec('reset role');assert.equal((await db.query('select name from public.team_workspaces where id=$1',[ids.workspace])).rows[0].name,'Owner rename');
 assert.equal((await db.query('select workspace_id from public.projects where id=$1',[ids.project])).rows[0].workspace_id,ids.workspace);
 console.log('PASS null identity and viewer denied; owner management and valid invitation acceptance preserved');
}finally{await db.close();}
