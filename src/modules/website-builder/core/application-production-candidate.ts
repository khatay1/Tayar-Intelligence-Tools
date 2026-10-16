/** Closed, non-retryable publishing limitation. Never includes provider data. */
export class ProductionCandidateRequiredError extends Error {
  readonly code = 'production-candidate-required';
  constructor() {
    super('Production publishing requires a separately staged and verified Production release.');
  }
}
