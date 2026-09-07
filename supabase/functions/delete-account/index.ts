import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createAdminClient,
  handleError,
  HttpError,
  jsonResponse,
  requireAuthenticatedUser,
  stripeRequest,
} from "../_shared/billing.ts";

const USER_OWNED_BUCKETS = ["website-media", "published-sites"] as const;
const LIST_PAGE_SIZE = 1000;
const MAX_STORAGE_OBJECTS = 20_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StorageEntry = {
  id?: string | null;
  name: string;
};

type StripeSubscriptionList = {
  data?: Array<{ id?: unknown; status?: unknown }>;
  has_more?: unknown;
};

async function collectStoragePaths(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const storage = admin.storage.from(bucket);
  const files: string[] = [];
  const pending = [prefix];

  while (pending.length) {
    const folder = pending.pop() as string;
    let offset = 0;

    for (;;) {
      const { data, error } = await storage.list(folder, {
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new HttpError(503, `Could not inspect ${bucket} storage`);

      const entries = (data || []) as StorageEntry[];
      for (const entry of entries) {
        const path = `${folder}/${entry.name}`;
        if (entry.id) files.push(path);
        else pending.push(path);

        if (files.length + pending.length > MAX_STORAGE_OBJECTS) {
          throw new HttpError(409, "Account storage is too large for automatic deletion. Contact support.");
        }
      }

      if (entries.length < LIST_PAGE_SIZE) break;
      offset += entries.length;
    }
  }

  return files;
}

async function removeStoragePaths(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  paths: string[],
): Promise<void> {
  const storage = admin.storage.from(bucket);
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await storage.remove(paths.slice(index, index + 100));
    if (error) throw new HttpError(503, `Could not delete ${bucket} storage`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    // Suspended users retain the right to delete their own account. The
    // authorization checks below still prevent them from acting as admins.
    const actor = await requireAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const requestedTargetId = String(body?.targetUserId || "").trim();
    const targetUserId = requestedTargetId || actor.id;
    if (!UUID_PATTERN.test(targetUserId)) throw new HttpError(400, "Invalid account ID");

    const adminAction = targetUserId !== actor.id;
    const requiredConfirmation = adminAction ? "DELETE_USER" : "DELETE";
    if (body?.confirmation !== requiredConfirmation) {
      throw new HttpError(400, `Type ${requiredConfirmation} to confirm account deletion`);
    }

    const admin = createAdminClient();
    const [actorProfileResult, targetProfileResult, subscriptionResult, targetAuthResult] = await Promise.all([
      admin.from("profiles").select("role,suspended").eq("id", actor.id).maybeSingle(),
      admin.from("profiles").select("role").eq("id", targetUserId).maybeSingle(),
      admin
        .from("subscriptions")
        .select("stripe_customer_id,stripe_subscription_id,status")
        .eq("user_id", targetUserId)
        .maybeSingle(),
      admin.auth.admin.getUserById(targetUserId),
    ]);

    if (actorProfileResult.error || targetProfileResult.error || subscriptionResult.error) {
      throw new HttpError(503, "Account deletion preflight failed");
    }
    if (targetAuthResult.error || !targetAuthResult.data.user) {
      throw new HttpError(404, "User account not found");
    }

    if (adminAction) {
      if (actorProfileResult.data?.role !== "admin" || actorProfileResult.data.suspended === true) {
        throw new HttpError(403, "Administrator access required");
      }
      if (targetProfileResult.data?.role === "admin") {
        throw new HttpError(409, "Demote the administrator account before deleting it");
      }
    } else if (actorProfileResult.data?.role === "admin") {
      throw new HttpError(409, "Administrator accounts must be transferred and deleted by another administrator");
    }

    const shouldBlockEmail = adminAction && body?.blockEmail === true;
    const targetEmail = String(targetAuthResult.data.user.email || "").trim().toLowerCase();
    let blockExpiresAt: string | null = null;
    if (shouldBlockEmail) {
      if (!targetEmail || !targetEmail.includes("@")) throw new HttpError(409, "The target account has no blockable email address");
      if (body?.blockExpiresAt) {
        const expiry = new Date(String(body.blockExpiresAt));
        if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()) {
          throw new HttpError(400, "Block expiration must be in the future");
        }
        blockExpiresAt = expiry.toISOString();
      }
    }

    // Finish all read-only preflight work before canceling billing or removing
    // anything so size/configuration failures leave the account untouched.
    const storageByBucket = await Promise.all(USER_OWNED_BUCKETS.map(async (bucket) => ({
      bucket,
      paths: await collectStoragePaths(admin, bucket, targetUserId),
    })));

    const subscriptionIds = new Set<string>();
    const stripeCustomerId = String(subscriptionResult.data?.stripe_customer_id || "").trim();
    const storedSubscriptionId = String(subscriptionResult.data?.stripe_subscription_id || "").trim();
    const storedSubscriptionStatus = String(subscriptionResult.data?.status || "").trim();
    const terminalSubscriptionStatuses = new Set(["canceled", "incomplete_expired"]);

    if (storedSubscriptionId && !stripeCustomerId && !terminalSubscriptionStatuses.has(storedSubscriptionStatus)) {
      if (!/^sub_[A-Za-z0-9]+$/.test(storedSubscriptionId)) {
        throw new HttpError(409, "Billing account needs support review before deletion");
      }
      subscriptionIds.add(storedSubscriptionId);
    }

    // Query Stripe by customer as well as trusting the local row. This catches
    // subscription drift and prevents a deleted account from continuing to bill.
    if (stripeCustomerId) {
      if (!/^cus_[A-Za-z0-9]+$/.test(stripeCustomerId)) {
        throw new HttpError(409, "Billing account needs support review before deletion");
      }
      const query = new URLSearchParams({ customer: stripeCustomerId, status: "all", limit: "100" });
      const stripeSubscriptions = await stripeRequest<StripeSubscriptionList>(
        `/v1/subscriptions?${query.toString()}`,
        { method: "GET" },
      );
      if (stripeSubscriptions.has_more === true) {
        throw new HttpError(409, "Billing account has too many subscriptions for automatic deletion");
      }
      for (const item of stripeSubscriptions.data || []) {
        if (typeof item.status === "string" && terminalSubscriptionStatuses.has(item.status)) continue;
        const subscriptionId = typeof item.id === "string" ? item.id : "";
        if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) {
          throw new HttpError(409, "Billing account needs support review before deletion");
        }
        subscriptionIds.add(subscriptionId);
      }
    }

    for (const stripeSubscriptionId of subscriptionIds) {
      try {
        await stripeRequest(`/v1/subscriptions/${encodeURIComponent(stripeSubscriptionId)}`, {
          method: "DELETE",
        });
      } catch (error) {
        // A retry after Stripe already deleted the subscription is safe.
        if (!(error instanceof HttpError && error.code === "resource_missing")) throw error;
      }
    }

    for (const { bucket, paths } of storageByBucket) {
      await removeStoragePaths(admin, bucket, paths);
    }

    // Team invites are addressed by normalized email rather than user_id. Clear
    // any pending/expired invite rows for the deleted identity so personal data
    // is not left behind when the Auth user disappears.
    if (targetEmail) {
      const { error: inviteDeleteError } = await admin
        .from("team_workspace_invites")
        .delete()
        .eq("email", targetEmail);
      if (inviteDeleteError) throw new HttpError(503, "Could not delete pending team invitations");
    }

    if (shouldBlockEmail) {
      const { error: blockError } = await admin.from("account_blocks").upsert({
        email: targetEmail,
        reason: String(body?.blockReason || "").slice(0, 500),
        blocked_by: actor.id,
        expires_at: blockExpiresAt,
        source_user_id: targetUserId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "email" });
      if (blockError) throw new HttpError(503, "Could not block the deleted account email");
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId, false);
    if (deleteError) throw new HttpError(503, "Could not permanently delete the account");

    if (adminAction) {
      const { error: logError } = await admin.from("system_logs").insert({
        level: "warning",
        category: "admin",
        message: shouldBlockEmail
          ? "Administrator deleted user account and blocked re-registration"
          : "Administrator deleted user account",
        metadata: {
          actor_id: actor.id,
          target_user_id: targetUserId,
          email_blocked: shouldBlockEmail,
          block_expires_at: blockExpiresAt,
        },
      });
      if (logError) console.error("[ACCOUNT DELETION] Account deleted but audit logging failed");
    }

    return jsonResponse({ deleted: true, targetUserId });
  } catch (error) {
    return handleError(error);
  }
});