const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const checkoutId=/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;
const price=/^price_[A-Za-z0-9]{8,128}$/;
const secret=/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/;
const session=/^cs_(test|live)_[A-Za-z0-9]+$/;

export interface OwnedStripeCheckoutTarget{id:string;previewPriceId:string;productionPriceId:string;}

function fail(status:number,message:string){return new Response(message,{status,headers:{'cache-control':'private, no-store',
 'content-type':'text/plain; charset=utf-8','x-content-type-options':'nosniff'}});}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();
 return value as Record<string,unknown>;}

export async function serveOwnedStripeCheckout(request:Request,input:{projectId:string;applicationOrigin:string;
 pagePaths:readonly string[];checkouts:readonly OwnedStripeCheckoutTarget[];fetcher?:typeof fetch;}):Promise<Response>{
 try{
  if(typeof window!=='undefined'||!uuid.test(input.projectId)||input.checkouts.length<1||input.checkouts.length>200
   ||input.pagePaths.length<1||input.pagePaths.length>100)throw new Error();
  const origin=new URL(input.applicationOrigin);
  if(origin.protocol!=='https:'||origin.origin!==input.applicationOrigin)throw new Error();
  const ids=new Set<string>();
  for(const item of input.checkouts){
   if(!item||!checkoutId.test(item.id)||ids.has(item.id)||!price.test(item.previewPriceId)||!price.test(item.productionPriceId))throw new Error();
   ids.add(item.id);
  }
  const paths=new Set(input.pagePaths);
  if([...paths].some(path=>!/^\/(?:[\p{L}\p{N}._-]+\/)*[\p{L}\p{N}._-]+\.html$/u.test(path)))throw new Error();
  if(request.method!=='POST')return fail(405,'Method not allowed.');
  if(request.headers.get('origin')!==origin.origin
   ||(request.headers.has('sec-fetch-site')&&request.headers.get('sec-fetch-site')!=='same-origin'))return fail(403,'Origin not allowed.');
  const referer=request.headers.get('referer');if(!referer)return fail(403,'Origin not allowed.');
  const from=new URL(referer);if(from.origin!==origin.origin||(!paths.has(from.pathname)&&from.pathname!=='/'))return fail(403,'Origin not allowed.');
  if(!(request.headers.get('content-type')??'').toLowerCase().startsWith('application/json'))return fail(415,'Unsupported media type.');
  const raw=await request.text();if(raw.length>4096)throw new Error();const body=object(JSON.parse(raw));
  if(Object.keys(body).sort().join(',')!=='checkoutId'||typeof body.checkoutId!=='string')return fail(400,'Invalid checkout request.');
  const selected=input.checkouts.find(item=>item.id===body.checkoutId);if(!selected)return fail(400,'Invalid checkout request.');

  const vercelEnvironment=process.env.VERCEL_ENV;
  const mode=vercelEnvironment==='production'?'live':vercelEnvironment==='preview'?'test':null;
  const credential=process.env.STRIPE_SECRET_KEY??'',match=secret.exec(credential);
  if(!mode||!match||match[2]!==mode||credential.length>4096||/[\r\n]/.test(credential))throw new Error();
  const priceId=mode==='live'?selected.productionPriceId:selected.previewPriceId;
  const returnUrl=new URL(from.pathname,origin);
  const success=new URL(returnUrl);success.searchParams.set('checkout','success');
  const cancel=new URL(returnUrl);cancel.searchParams.set('checkout','cancel');
  const form=new URLSearchParams();
  form.set('mode','payment');form.set('line_items[0][price]',priceId);form.set('line_items[0][quantity]','1');
  form.set('success_url',success.href);form.set('cancel_url',cancel.href);form.set('client_reference_id',input.projectId);
  const response=await(input.fetcher??fetch)('https://api.stripe.com/v1/checkout/sessions',{method:'POST',redirect:'error',
   cache:'no-store',signal:AbortSignal.timeout(8000),headers:{Authorization:`Bearer ${credential}`,
    Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});
  if(response.status!==200||Number(response.headers.get('content-length')??0)>131072)throw new Error();
  const text=await response.text();if(text.length>131072)throw new Error();const value=object(JSON.parse(text));
  const id=typeof value.id==='string'?session.exec(value.id):null;
  if(value.object!=='checkout.session'||!id||id[1]!==mode||value.livemode!==(mode==='live')||typeof value.url!=='string')throw new Error();
  const target=new URL(value.url);
  if(target.protocol!=='https:'||target.hostname!=='checkout.stripe.com'||target.username||target.password||target.port)throw new Error();
  return new Response(JSON.stringify({url:target.href}),{status:200,headers:{'content-type':'application/json; charset=utf-8',
   'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
 }catch{return fail(503,'Checkout unavailable.');}
}
