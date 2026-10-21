import type { OwnedApplicationRouteManifest } from '../src/modules/website-builder/services/websiteOwnedApplicationRouteService';
import { createOwnedPaymentRpcClient } from './website-owned-payment-rpc';
import { createOwnedPaymentAccess } from './website-owned-payment-access';
import { createOwnedStripeOrderEventStore } from './website-owned-stripe-order-store';
import { serveOwnedStripeOrderCheckout,serveOwnedStripeOrderRefund,serveOwnedStripeOrderStatus } from './website-owned-stripe-order-actions';
import { serveOwnedStripeWebhook } from './website-owned-stripe-webhook';

/** Mounted owned server routes. Routing and return paths come from saved data
 * views, never from request amounts, role IDs or external redirect parameters. */
export async function serveOwnedPaymentRoute(request:Request,input:{manifest:OwnedApplicationRouteManifest;
 route:string;runtimeDigest:string;environment:Record<string,string>;fetcher?:typeof fetch}){
 try{
  const {manifest,environment}=input;
  if(!manifest.definition.tables.some(table=>table.payment))return new Response('Not found',{status:404});
  const client=createOwnedPaymentRpcClient({definition:manifest.definition,backend:manifest.backend,
   expectedProjectRef:manifest.expectedProjectRef,secretKey:environment.SUPABASE_SECRET_KEY,fetcher:input.fetcher});
  const url=new URL(request.url);url.searchParams.delete('tayarRoute');
  if(input.route==='stripe-webhook'){
   url.pathname='/api/stripe-webhook';
   return await serveOwnedStripeWebhook(new Request(url,request),{projectId:manifest.projectId,
    applicationOrigin:manifest.applicationOrigin,endpointSecret:environment.STRIPE_WEBHOOK_SECRET,
    store:createOwnedStripeOrderEventStore(client,input.runtimeDigest)});
  }
  const match=/^stripe-order-(checkout|refund|status):([A-Za-z0-9][A-Za-z0-9_-]{0,119})$/.exec(input.route);
  if(!match)return new Response('Not found',{status:404});
  const table=manifest.definition.tables.find(table=>table.id===match[2]&&table.payment);
  const page=manifest.pages.find(page=>page.sections.some(section=>section.applicationDataView?.tableId===table?.id));
  if(!table||!page)return new Response('Not found',{status:404});
  const access=createOwnedPaymentAccess({definition:manifest.definition,tableId:table.id,returnPath:page.path,client});
  const dependencies={...access,client,projectId:manifest.projectId,applicationOrigin:manifest.applicationOrigin,
   secretKey:environment.STRIPE_SECRET_KEY,authenticate:client.authenticate,fetcher:input.fetcher};
  url.pathname=`/api/stripe-order-${match[1]}`;
  return await(match[1]==='checkout'?serveOwnedStripeOrderCheckout:match[1]==='refund'?serveOwnedStripeOrderRefund:serveOwnedStripeOrderStatus)(new Request(url,request),dependencies);
 }catch{return Response.json({error:'Payment runtime unavailable.'},{status:503,headers:{'cache-control':'private, no-store'}});}
}
