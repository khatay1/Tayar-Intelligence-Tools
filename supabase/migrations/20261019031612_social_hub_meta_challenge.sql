alter table private.social_hub_webhook_bindings add column challenge_secret_id uuid unique;

create or replace function private.social_hub_webhook_secret_cleanup()returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from vault.secrets where id in(old.secret_id,old.challenge_secret_id);
 return old;
end $$;

create function private.configure_social_hub_webhook_challenge(p_scope_id uuid,p_connection_id uuid,p_webhook_hash text,p_verify_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_old uuid;v_id uuid;begin
 if p_webhook_hash is null or p_webhook_hash!~'^[a-f0-9]{64}$' or p_verify_token is null
   or length(p_verify_token)<16 or length(p_verify_token)>256 or p_verify_token~E'[[:space:][:cntrl:]]'
 then raise exception 'Invalid challenge setup';end if;
 select challenge_secret_id into v_old from private.social_hub_webhook_bindings b
 join private.social_hub_connections c on c.id=b.connection_id and c.scope_id=b.scope_id
 where b.scope_id=p_scope_id and b.connection_id=p_connection_id and b.webhook_hash=p_webhook_hash
   and c.channel in('whatsapp','facebook','instagram') and c.status='connected' and c.permissions_verified
   and(c.expires_at is null or c.expires_at>now()) for update of b;
 if not found then raise exception 'Challenge binding unavailable';end if;
 v_id:=vault.create_secret(p_verify_token,'social-webhook-challenge-'||gen_random_uuid()::text,'Scoped Meta webhook verification token',null);
 update private.social_hub_webhook_bindings set challenge_secret_id=v_id where connection_id=p_connection_id and scope_id=p_scope_id;
 if v_old is not null then delete from vault.secrets where id=v_old;end if;
 return v_id;
end $$;

create function private.resolve_social_hub_webhook_challenge(p_webhook_hash text)returns text language sql security definer set search_path='' as $$
 select d.decrypted_secret from private.social_hub_webhook_bindings b
 join vault.decrypted_secrets d on d.id=b.challenge_secret_id
 join private.social_hub_connections c on c.id=b.connection_id and c.scope_id=b.scope_id
 join private.social_hub_scopes s on s.id=b.scope_id
 where b.webhook_hash=p_webhook_hash and s.enabled and c.channel in('whatsapp','facebook','instagram')
 and c.status='connected' and c.permissions_verified and(c.expires_at is null or c.expires_at>now())
$$;

revoke all on function private.configure_social_hub_webhook_challenge(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function private.configure_social_hub_webhook_challenge(uuid,uuid,text,text) to service_role;
create function public.configure_social_hub_webhook_challenge(p_scope_id uuid,p_connection_id uuid,p_webhook_hash text,p_verify_token text)
returns uuid language sql security invoker set search_path='' as $$select private.configure_social_hub_webhook_challenge(p_scope_id,p_connection_id,p_webhook_hash,p_verify_token)$$;
revoke all on function public.configure_social_hub_webhook_challenge(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.configure_social_hub_webhook_challenge(uuid,uuid,text,text) to service_role;

revoke all on function private.resolve_social_hub_webhook_challenge(text) from public,anon,authenticated;
grant execute on function private.resolve_social_hub_webhook_challenge(text) to service_role;
create function public.resolve_social_hub_webhook_challenge(p_webhook_hash text)returns text language sql security invoker set search_path='' as $$select private.resolve_social_hub_webhook_challenge(p_webhook_hash)$$;
revoke all on function public.resolve_social_hub_webhook_challenge(text) from public,anon,authenticated;
grant execute on function public.resolve_social_hub_webhook_challenge(text) to service_role;
