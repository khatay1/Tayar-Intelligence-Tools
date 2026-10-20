/**
 * OpenCode optional paid-provider admission gate.
 *
 * FREE by default. No provider SDK, environment credentials, billing UI, or
 * customer-facing route are connected here.
 * For a future paid route, callers MUST supply authenticated, trusted tenant
 * approval records AND a server-side atomic funds/usage reservation.
 * This check cannot attest that caller-supplied policy is trustworthy.
 */
export const FREE_ONLY_OPENCODE_POLICY = Object.freeze({
  phase: 'free-only',
  paidProviderEnabled: false,
  automaticPaidFallback: false,
  monthlyBudgetMicroUsd: 0,
});

export class OpenCodeSpendDenied extends Error {
  constructor(code) {
    super(code);
    this.code = code;
    this.name = 'OpenCodeSpendDenied';
  }
}

const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,95}$/;
const PROVIDER = /^[a-z][a-z0-9-]{1,35}$/;
const MODEL = /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,119}$/;
const MONTH = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const safeMoney = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000_000_000;

function deny(code) { throw new OpenCodeSpendDenied(code); }

/**
 * Default local execution has zero commercial *model API fees*, not
 * guaranteed zero compute, power, or hosting expenditure.
 */
export function chooseFreeLocalOpenCode(request = {}) {
  if (request.route !== undefined && request.route !== 'local-ollama') deny('unapproved-route');
  if (request.providerID !== undefined && request.providerID !== 'ollama') deny('paid-provider-blocked');
  if (request.autoFallback === true || request.autoUpgrade === true) deny('automatic-upgrade-blocked');
  if (request.monthlyChargeMicroUsd && request.monthlyChargeMicroUsd !== 0) deny('paid-provider-blocked');
  return Object.freeze({ route: 'local-ollama', paid: false, modelApiChargeMicroUsd: 0 });
}

/**
 * Future internal-only premium preflight. It does not call a model.
 * A real paid integration must first authenticate and fetch approvals
 * server-side, then atomically reserve spend through the existing ledger.
 * Never pass browser-supplied approval/usage/flags to this function.
 */
export async function reserveOptionalOpenCodeSpend({
  request, policy = FREE_ONLY_OPENCODE_POLICY, consent, ledger, nowMs = Date.now(),
} = {}) {
  if (request?.route === undefined || request?.route === 'local-ollama') {
    return chooseFreeLocalOpenCode(request);
  }
  if (request.route !== 'paid-cloud') deny('unapproved-route');
  // Explicit opt-in per request. Customer count/usage cannot auto-upgrade.
  if (request.intent !== 'explicit-premium-selection' || request.autoFallback === true ||
      request.autoUpgrade === true) deny('automatic-upgrade-blocked');
  if (policy?.phase !== 'premium-opt-in' || policy.paidProviderEnabled !== true ||
      policy.automaticPaidFallback !== false || policy.operatorApproved !== true) {
    deny('paid-provider-disabled');
  }
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) deny('invalid-clock');
  if (typeof request.tenantId !== 'string' || !ID.test(request.tenantId) ||
      typeof request.providerID !== 'string' || !PROVIDER.test(request.providerID) ||
      typeof request.modelID !== 'string' || !MODEL.test(request.modelID)) {
    deny('invalid-paid-request');
  }
  if (!Array.isArray(policy.approvedModels) || policy.approvedModels.length < 1 ||
      policy.approvedModels.length > 25 ||
      !policy.approvedModels.some(item => item?.providerID === request.providerID &&
        item?.modelID === request.modelID)) deny('model-not-approved');
  if (consent?.tenantId !== request.tenantId || consent.confirmed !== true ||
      typeof consent.approvalId !== 'string' || !ID.test(consent.approvalId) ||
      !Number.isSafeInteger(consent.expiresAtMs) || consent.expiresAtMs <= nowMs ||
      consent.expiresAtMs > nowMs + 31 * 86_400_000) deny('explicit-consent-required');
  const month = new Date(nowMs).toISOString().slice(0, 7);
  if (!MONTH.test(month) || consent.billingMonth !== month ||
      policy.billingMonth !== month) deny('billing-month-mismatch');
  if (!safeMoney(policy.monthlyBudgetMicroUsd) || policy.monthlyBudgetMicroUsd === 0 ||
      !safeMoney(policy.maxPerRequestMicroUsd) || policy.maxPerRequestMicroUsd === 0 ||
      !safeMoney(request.quotedMicroUsd) || request.quotedMicroUsd === 0 ||
      request.quotedMicroUsd > policy.maxPerRequestMicroUsd ||
      request.quotedMicroUsd > policy.monthlyBudgetMicroUsd) deny('budget-exceeded');
  // The ledger must make the below reservation transactionally and must
  // independently verify tenant, balance, approvals, budget and idempotency.
  // Never rely on request-provided 'already spent' values.
  if (typeof ledger?.reserveAtomic !== 'function') deny('atomic-reservation-required');
  let receipt;
  try {
    receipt = await ledger.reserveAtomic(Object.freeze({
      tenantId: request.tenantId,
      billingMonth: month,
      providerID: request.providerID,
      modelID: request.modelID,
      approvalId: consent.approvalId,
      quoteMicroUsd: request.quotedMicroUsd,
      maxPerRequestMicroUsd: policy.maxPerRequestMicroUsd,
      monthlyBudgetMicroUsd: policy.monthlyBudgetMicroUsd,
    }));
  } catch { deny('atomic-reservation-failed'); }
  if (receipt?.authorized !== true || typeof receipt.reservationId !== 'string' ||
      !ID.test(receipt.reservationId) || receipt.tenantId !== request.tenantId ||
      receipt.billingMonth !== month || receipt.reservedMicroUsd !== request.quotedMicroUsd) {
    deny('atomic-reservation-invalid');
  }
  return Object.freeze({
    route: 'paid-cloud', paid: true, providerID: request.providerID,
    modelID: request.modelID, reservationId: receipt.reservationId,
    reservedMicroUsd: request.quotedMicroUsd,
  });
}
