import { createAuthenticatedServerSupabaseClient } from "@/lib/supabase/server";

import type { PendingChatAction } from "@/lib/chat/types";

type PendingChatActionRow = {
  action: PendingChatAction["action"];
  fields: Record<string, string>;
  missing_fields: string[];
};

async function getAccountHolderId(accountId: string): Promise<string> {
  const supabase = await createAuthenticatedServerSupabaseClient();

  const { data, error } = await supabase
    .from("account_holders")
    .select("id")
    .eq("account_id", accountId)
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error("Account holder was not found.");
  }

  return data.id;
}

export async function getPendingChatAction(
  accountId: string,
  conversationId: string,
): Promise<PendingChatAction | null> {
  const supabase = await createAuthenticatedServerSupabaseClient();
  const accountHolderId = await getAccountHolderId(accountId);

  const { data, error } = await supabase
    .from("pending_chat_actions")
    .select("action, fields, missing_fields")
    .eq("account_holder_id", accountHolderId)
    .eq("conversation_id", conversationId)
    .maybeSingle<PendingChatActionRow>();

  if (error) {
    throw new Error("Failed to load pending chat action.");
  }

  if (!data) {
    return null;
  }

  return {
    action: data.action,
    fields: data.fields,
    missingFields: data.missing_fields,
  };
}

export async function savePendingChatAction(
  accountId: string,
  conversationId: string,
  pendingAction: PendingChatAction,
): Promise<void> {
  const supabase = await createAuthenticatedServerSupabaseClient();
  const accountHolderId = await getAccountHolderId(accountId);

  const { error } = await supabase.from("pending_chat_actions").upsert(
    {
      account_holder_id: accountHolderId,
      conversation_id: conversationId,
      action: pendingAction.action,
      fields: pendingAction.fields,
      missing_fields: pendingAction.missingFields,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "account_holder_id,conversation_id",
    },
  );

  if (error) {
    throw new Error("Failed to save pending chat action.");
  }
}

export async function clearPendingChatAction(
  accountId: string,
  conversationId: string,
): Promise<void> {
  const supabase = await createAuthenticatedServerSupabaseClient();
  const accountHolderId = await getAccountHolderId(accountId);

  const { error } = await supabase
    .from("pending_chat_actions")
    .delete()
    .eq("account_holder_id", accountHolderId)
    .eq("conversation_id", conversationId);

  if (error) {
    throw new Error("Failed to clear pending chat action.");
  }
}
