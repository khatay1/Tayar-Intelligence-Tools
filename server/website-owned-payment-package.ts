import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { readApplicationDefinition } from '../src/modules/website-builder/core/application-validation';
import { compileOwnedStripeOrderSchema } from './website-owned-stripe-order-schema';
import { compileOwnedPaymentAccessSchema } from './website-owned-payment-access-schema';

/** Source-only payment additions. Caller supplies the initial application
 * schema and wraps all statements in one transaction. No keys or API effects. */
export function compileOwnedPaymentPackage(definition:ApplicationDefinition,projectId:string){
 const app=readApplicationDefinition(definition),tables=app.tables.filter(table=>table.payment);
 if(!tables.length)return{statements:[] as string[],rewrites:[] as Array<{source:string;destination:string}>};
 const ledger=compileOwnedStripeOrderSchema(projectId).trim();
 if(!ledger.startsWith('begin;')||!ledger.endsWith('commit;'))throw new Error('Payment schema unavailable.');
 return{
  statements:[ledger.slice('begin;'.length,-'commit;'.length).trim(),...compileOwnedPaymentAccessSchema(app)],
  rewrites:[{source:'/api/stripe-webhook',destination:'/api/application?tayarRoute=stripe-webhook'},
   ...tables.flatMap(table=>['checkout','refund','status'].map(action=>({source:`/api/stripe-order/${table.id}/${action}`,
    destination:`/api/application?tayarRoute=stripe-order-${action}:${table.id}`})))],
 };
}
