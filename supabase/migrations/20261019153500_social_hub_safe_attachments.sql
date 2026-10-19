create function private.social_hub_attachment_refs_valid(p_value jsonb)
returns boolean language plpgsql immutable parallel safe set search_path='' as $$
declare item jsonb;begin
 if p_value is null or jsonb_typeof(p_value)<>'array' or jsonb_array_length(p_value)>30 then return false;end if;
 for item in select value from jsonb_array_elements(p_value)loop
  if jsonb_typeof(item)<>'object' or not(item?'type') or jsonb_typeof(item->'type')<>'string'
   or item->>'type' not in('image','document','audio','video','sticker')
   or exists(select 1 from jsonb_object_keys(item)key where key not in('type','providerId'))
   or(item?'providerId'and(jsonb_typeof(item->'providerId')<>'string'or length(item->>'providerId')not between 1 and 256
    or not(item->>'providerId'~'^[A-Za-z0-9_.:@=-]+$')))
  then return false;end if;
 end loop;
 return true;
end $$;
revoke all on function private.social_hub_attachment_refs_valid(jsonb) from public,anon,authenticated,service_role;

-- New writes are checked immediately. Existing provider references remain
-- quarantined until a later audited backfill validates them.
alter table private.social_hub_messages add constraint social_hub_attachment_refs_shape
 check(private.social_hub_attachment_refs_valid(attachment_refs)) not valid;
