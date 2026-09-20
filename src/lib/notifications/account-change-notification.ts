import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAuthenticatedServerSupabaseClient } from "@/lib/supabase/server";
import { generateEncryptedAccountSummaryPdf } from "@/lib/notifications/account-summary-pdf";

import type { AccountContext } from "@/lib/account/types";

export type AccountChangeNotification = {
  accountId: string;
  changedBy: "account_holder" | "authorized_representative";
  changeSummary: string;
  accountSnapshot: AccountContext;
};

export type AccountChangeNotificationResult = {
  notificationId: string;
  sent: boolean;
  redactedRecipient: string;
};

export async function sendAccountChangeNotification(
  notification: AccountChangeNotification,
): Promise<AccountChangeNotificationResult> {
  const account = notification.accountSnapshot.account;
  const recipientEmail = account.email.trim();

  if (!recipientEmail) {
    throw new Error("Notification recipient email is required.");
  }

  const supabase = await createAuthenticatedServerSupabaseClient();

  const attemptResult = await supabase
    .from("notification_attempts")
    .insert({
      account_holder_id: await getAccountHolderId(
        notification.accountId,
        supabase,
      ),
      trigger_action: notification.changeSummary,
      recipient_email: recipientEmail,
      email_provider: "resend",
      status: "queued",
      sensitive_detail_in_pdf: true,
      error_message: null,
    })
    .select("id")
    .single<{ id: string }>();

  if (attemptResult.error || !attemptResult.data) {
    throw new Error("Failed to record notification attempt.");
  }

  const notificationId = attemptResult.data.id;

  try {
    const pdf = await generateEncryptedAccountSummaryPdf(
      notification.accountSnapshot,
    );

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const NOTIFICATION_FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL;

    if (!RESEND_API_KEY || !NOTIFICATION_FROM_EMAIL) {
      await updateNotificationAttempt(notificationId, "logged", null, supabase);

      return {
        notificationId,
        sent: false,
        redactedRecipient: redactEmail(recipientEmail),
      };
    }

    const resend = new Resend(RESEND_API_KEY);

    const result = await resend.emails.send({
      from: NOTIFICATION_FROM_EMAIL,
      to: recipientEmail,
      subject: "Your account has been updated",
      text: getGenericEmailBody(),
      attachments: [
        {
          filename: "account-summary.pdf",
          content: pdf,
        },
      ],
    });

    if (result.error) {
      throw new Error("Email provider rejected the notification.");
    }

    await updateNotificationAttempt(notificationId, "sent", null, supabase);

    return {
      notificationId,
      sent: true,
      redactedRecipient: redactEmail(recipientEmail),
    };
  } catch (error) {
    const safeErrorMessage =
      error instanceof Error ? error.message : "Notification delivery failed.";

    await updateNotificationAttempt(
      notificationId,
      "failed",
      safeErrorMessage,
      supabase,
    );

    throw new Error("Account-change notification could not be sent.");
  }
}

async function getAccountHolderId(
  accountId: string,
  supabase: SupabaseClient,
): Promise<string> {
  const normalizedAccountId = accountId.trim();

  if (!normalizedAccountId) {
    throw new Error("Account ID is required.");
  }

  const result = await supabase
    .from("account_holders")
    .select("id")
    .eq("account_id", normalizedAccountId)
    .single<{ id: string }>();

  if (result.error || !result.data) {
    throw new Error("Failed to load account holder for notification.");
  }

  return result.data.id;
}

async function updateNotificationAttempt(
  notificationId: string,
  status: "sent" | "failed" | "logged",
  errorMessage: string | null,
  supabase: SupabaseClient,
): Promise<void> {
  const result = await supabase
    .from("notification_attempts")
    .update({
      status,
      error_message: errorMessage,
    })
    .eq("id", notificationId);

  if (result.error) {
    throw new Error("Failed to update notification attempt.");
  }
}

function getGenericEmailBody(): string {
  return [
    "A change has been made to your account.",
    "",
    "For your privacy, account details are not included in this email.",
    "Please see the attached password-protected PDF for the updated account summary.",
    "",
    "The PDF password is the last four digits of your current account phone number.",
  ].join("\n");
}

function redactEmail(email: string): string {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return "***";
  }

  const visible = localPart.slice(0, 1);

  return `${visible}***@${domain}`;
}
