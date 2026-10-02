# Fullstack MAX — isolated infrastructure activation

This runbook covers the first authorized activation rehearsal for Tayar's customer-owned GitHub, Supabase and Vercel infrastructure. It is intentionally read-only until an operator separately approves migrations, secret configuration and deployment against a disposable isolated platform environment.

## Read-only gate

Supply configuration through the operator's secret manager, set `TAYAR_INFRASTRUCTURE_ACTIVATION_MODE=isolated`, and run:

```sh
npm run preflight:website-builder:infrastructure-activation
```

The gate verifies the fixed 29-migration manifest, the three generated Edge entries, callback JWT configuration, exclusion from the existing production deploy script, required key presence, exact Supabase callback/browser endpoint topology, one HTTPS return origin and absence of secret-shaped public variables. Its JSON output contains names only and never prints configured values.

The command performs no provider request, database connection, migration, deployment or file write. A nonzero exit means activation must stop.

## Authorized isolated sequence

1. Create or select a disposable Tayar platform Supabase environment containing the expected platform Auth and `public.projects` prerequisites.
2. Review the 29 migrations against that isolated database and run the provider CLI's dry-run/diff checks.
3. Register isolated GitHub, Supabase and Vercel OAuth applications with the exact callbacks checked by the gate.
4. Place server credentials only in the isolated function secret store and public endpoint URLs only in the browser build environment.
5. Run the read-only gate and retain its secret-free report.
6. Only after explicit mutation approval, apply migrations and deploy the three generated functions to the isolated project.
7. Exercise sign-in, callback, account/project selection, binding, refresh, disconnect/reconnect, Preview preparation and Production promotion with disposable provider resources.
8. Preserve identifiers and redacted receipts for review; remove disposable provider resources when the rehearsal is complete.

Production remains a separate decision. Never reuse customer runtime credentials as Tayar platform credentials, never place service-role/OAuth/private-key material in public-prefixed variables, and never infer readiness from a callback or mocked success alone.
