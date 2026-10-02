import type {SupabaseClient} from '@supabase/supabase-js';
import type {ByoSourceCapabilities} from '../src/modules/website-builder/core/application-byo-source-capabilities';
import type {OwnedSourceReader} from './website-owned-source-capture';
import {runWebsiteOwnedByoProductionPublish,runWebsiteOwnedByoPublish} from './website-byo-publish-adapters';
import {createWebsiteByoPublishStore} from './website-byo-publish-store';
import {captureWebsiteByoPublishTargets} from './website-byo-publish-targets';
import {prepareWebsiteOwnedBackend} from './website-owned-backend-preparation-worker';

type Client=Pick<SupabaseClient,'rpc'>;
type Scope={ownerId:string;projectId:string;operationId:string};
type VerifyRuntime=Parameters<typeof runWebsiteOwnedByoPublish>[0]['verifyRuntime'];

function status(checkpoint:NonNullable<Awaited<ReturnType<ReturnType<typeof createWebsiteByoPublishStore>['read']>>>) {
  return{status:checkpoint.stage==='ready'?'ready' as const:checkpoint.stage==='blocked'?'blocked' as const:'pending' as const,checkpoint};
}

/** Trusted endpoint runners. The HTTP request never supplies connection IDs,
 * versions, provider accounts, credentials or runtime bindings. */
export function createWebsiteByoPublishRunners(input:{client:Client;reader:OwnedSourceReader;
  platformOrigin:string;platformUrl:string;platformSupabaseOrganizationId:string;platformVercelAccountId:string;
  githubAppClientId:string;githubAppPrivateKeyPkcs8:string;verifyRuntime:VerifyRuntime;
  requiredEnvironment(capabilities:ByoSourceCapabilities):Promise<string[]>;fetcher?:typeof fetch;
}){
  const capture=(scope:Pick<Scope,'ownerId'|'projectId'>&{requireProduction?:boolean})=>
    captureWebsiteByoPublishTargets({client:input.client,...scope});
  return{
    async runPreview(scope:Scope){
      await prepareWebsiteOwnedBackend({client:input.client,reader:input.reader,...scope,environment:'preview',
        platformOrigin:input.platformOrigin,platformSupabaseOrganizationId:input.platformSupabaseOrganizationId,
        platformVercelAccountId:input.platformVercelAccountId,fetcher:input.fetcher});
      const selected=await capture(scope);
      return runWebsiteOwnedByoPublish({client:input.client,...scope,environment:'preview',reader:input.reader,
        githubConnectionId:selected.targets.githubPreview.connectionId,
        vercelConnectionId:selected.targets.vercelPreview.connectionId,
        platformOrigin:input.platformOrigin,platformUrl:input.platformUrl,
        platformVercelAccountId:input.platformVercelAccountId,githubAppClientId:input.githubAppClientId,
        githubAppPrivateKeyPkcs8:input.githubAppPrivateKeyPkcs8,ownerCurrent:selected.isCurrent,
        verifyRuntime:input.verifyRuntime,requiredEnvironment:input.requiredEnvironment,fetcher:input.fetcher});
    },
    async runProduction(scope:Scope&{previewOperationId:string}){
      const selected=await capture({...scope,requireProduction:true});
      const production=selected.targets.vercelProduction;
      if(!production)throw new Error('BYO production target unavailable.');
      return runWebsiteOwnedByoProductionPublish({client:input.client,...scope,
        previewVercelConnectionId:selected.targets.vercelPreview.connectionId,
        productionVercelConnectionId:production.connectionId,
        previewConnectionVersion:selected.targets.vercelPreview.version,
        productionConnectionVersion:production.version,
        reader:input.reader,ownerCurrent:selected.isCurrent,fetcher:input.fetcher});
    },
    async readStatus(scope:Scope&{environment:'preview'|'production'}){
      const store=createWebsiteByoPublishStore({client:input.client,...scope,isCurrent:()=>true});
      const checkpoint=await store.read(scope.operationId);
      if(!checkpoint)throw new Error('BYO publish status unavailable.');
      return status(checkpoint);
    },
  };
}
