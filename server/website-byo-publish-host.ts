import type{SupabaseClient}from'@supabase/supabase-js';
import{createWebsiteByoPublishEdgeHandler}from'./website-byo-publish-edge';
import{createWebsiteByoPublishRunners}from'./website-byo-publish-runners';
import{createWebsiteByoPublishRuntimePolicy}from'./website-byo-publish-runtime-policy';
import{createWebsiteOwnedSourceReader}from'./website-owned-source-reader';

type Platform=Pick<SupabaseClient,'auth'|'from'|'rpc'>;
type RunnerInput=Parameters<typeof createWebsiteByoPublishRunners>[0];

/** Unmounted Node-compatible composition host. A deployment entrypoint may
 * provide environment configuration and call this factory; no browser value
 * can replace its service client, source reader or provider credentials. */
export function createWebsiteByoPublishHost(input:{platform:Platform;allowedOrigin:string;
  runner:Omit<RunnerInput,'client'|'reader'|'verifyRuntime'|'requiredEnvironment'>}){
 const reader=createWebsiteOwnedSourceReader(input.platform);
 const policy=createWebsiteByoPublishRuntimePolicy(reader);
 const runners=createWebsiteByoPublishRunners({client:input.platform,reader,...input.runner,...policy});
 return createWebsiteByoPublishEdgeHandler({platform:input.platform,allowedOrigin:input.allowedOrigin,runners});
}
