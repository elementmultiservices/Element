import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { requestMeta, type RequestMeta } from "@/lib/security/request-meta";

export type AuditAction =
  | "auth.sign_in.success"
  | "auth.sign_in.failure"
  | "auth.sign_in.locked"
  | "auth.sign_up.requested"
  | "auth.sign_up.existing"
  | "auth.sign_out"
  | "auth.session.ended"
  | "auth.password_reset.requested"
  | "auth.password.updated"
  | "auth.link.verified"
  | "auth.mfa.enrolled"
  | "auth.mfa.verified"
  | "auth.mfa.failed"
  | "auth.mfa.disabled"
  | "auth.mfa.recovery_used"
  | "auth.mfa.recovery_failed"
  | "auth.mfa.recovery_regenerated"
  | "user.role.changed"
  | "user.profile.updated"
  | "file.uploaded"
  | "file.upload_rejected"
  | "file.downloaded"
  | "file.trashed"
  | "file.restored"
  | "file.deleted_permanently"
  | "file.purged"
  | "user.invited"
  | "user.invitation_resent"
  | "user.activated"
  | "user.deactivated"
  | "user.password_reset.forced"
  | "user.quota.changed"
  | "user.upload.granted"
  | "user.upload.revoked"
  | "user.upload.preauthorized"
  | "user.upload.preauthorization_removed"
  | "category.created"
  | "category.renamed"
  | "category.archived"
  | "category.unarchived"
  | "admin.export"
  | "post.created"
  | "post.updated"
  | "post.published"
  | "post.deleted"
  | "post.cover_updated"
  | "post.cover_removed"
  | "post_category.created"
  | "post_category.updated"
  | "post_category.deleted"
  | "contact.received"
  | "contact.handled"
  | "contact.reopened"
  | "admin.bootstrap"
  | "admin.settings_updated"
  | "newsletter.subscribed"
  | "newsletter.unsubscribed"
  | "newsletter.removed"
  | "newsletter.sent";

export type AuditEntry = {
  actorId: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: { [key: string]: Json };
};

/**
 * Appends an audit entry (service role; audit_logs is append-only). Never put
 * secrets, passwords or file contents in metadata. Failures are logged but do
 * not break the user flow.
 */
export async function audit(entry: AuditEntry, meta?: RequestMeta): Promise<void> {
  try {
    const { ip, userAgent } = meta ?? (await requestMeta());
    const { error } = await createAdminClient()
      .from("audit_logs")
      .insert({
        actor_id: entry.actorId,
        action: entry.action,
        target_type: entry.targetType ?? null,
        target_id: entry.targetId ?? null,
        metadata: entry.metadata ?? {},
        ip,
        user_agent: userAgent,
      });
    if (error) console.error(`[audit] insert failed for ${entry.action}: ${error.code}`);
  } catch {
    console.error(`[audit] insert threw for ${entry.action}`);
  }
}
