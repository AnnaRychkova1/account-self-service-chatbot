import type { SupabaseClient } from "@supabase/supabase-js";

import { createAuthenticatedServerSupabaseClient } from "@/lib/supabase/server";
import {
  assertNoDatabaseError,
  getAccount,
} from "@/lib/account/services/account-get";

import type {
  AccountContext,
  CallAppointmentInsertRow,
  CallAppointmentRow,
  CreateCallAppointmentInput,
} from "@/lib/account/types";

async function getAccountHolder(
  accountId: string,
  supabase: SupabaseClient,
): Promise<{
  id: string;
  phone: string;
}> {
  const normalizedAccountId = accountId.trim();

  if (!normalizedAccountId) {
    throw new Error("Account ID is required.");
  }

  const result = await supabase
    .from("account_holders")
    .select("id, phone")
    .eq("account_id", normalizedAccountId)
    .single<{
      id: string;
      phone: string;
    }>();

  assertNoDatabaseError("Failed to load account holder", result.error);

  if (!result.data) {
    throw new Error(`Account "${normalizedAccountId}" was not found.`);
  }

  return result.data;
}

function validateCallAppointmentInput(
  input: CreateCallAppointmentInput,
  currentDate: Date = new Date(),
): CreateCallAppointmentInput {
  const scheduledAt = input.scheduledAt.trim();

  if (!scheduledAt) {
    throw new Error("Please provide a valid appointment date and time.");
  }

  const parsedScheduledAt = new Date(scheduledAt);

  if (Number.isNaN(parsedScheduledAt.getTime())) {
    throw new Error("Please provide a valid appointment date and time.");
  }

  if (parsedScheduledAt <= currentDate) {
    throw new Error(
      "Call appointment must be scheduled for a future date and time.",
    );
  }

  let phone: string | undefined;

  if (input.phone !== undefined) {
    phone = input.phone.trim();

    if (!/^\+?[0-9]{7,15}$/.test(phone)) {
      throw new Error("Please provide a valid phone number.");
    }
  }

  let reason: string | undefined;

  if (input.reason !== undefined) {
    reason = input.reason.trim();

    if (!reason) {
      reason = undefined;
    }
  }

  return {
    scheduledAt: parsedScheduledAt.toISOString(),
    phone,
    reason,
  };
}

export async function getCallAppointments(
  accountId: string,
  supabase?: SupabaseClient,
): Promise<CallAppointmentRow[]> {
  const client = supabase ?? (await createAuthenticatedServerSupabaseClient());
  const accountHolder = await getAccountHolder(accountId, client);

  const result = await client
    .from("call_appointments")
    .select("*")
    .eq("account_holder_id", accountHolder.id)
    .order("scheduled_at", {
      ascending: true,
    })
    .returns<CallAppointmentRow[]>();

  assertNoDatabaseError("Failed to load call appointments", result.error);

  return result.data ?? [];
}

export async function createCallAppointment(
  accountId: string,
  input: CreateCallAppointmentInput,
  supabase?: SupabaseClient,
): Promise<AccountContext> {
  const normalizedAccountId = accountId.trim();

  const client = supabase ?? (await createAuthenticatedServerSupabaseClient());

  if (!normalizedAccountId) {
    throw new Error("Account ID is required.");
  }

  const validatedInput = validateCallAppointmentInput(input);

  const accountHolder = await getAccountHolder(normalizedAccountId, client);

  const insertData: CallAppointmentInsertRow = {
    account_holder_id: accountHolder.id,
    scheduled_at: validatedInput.scheduledAt,
    phone: validatedInput.phone ?? accountHolder.phone,
    reason: validatedInput.reason ?? null,
    status: "scheduled",
  };

  const result = await client
    .from("call_appointments")
    .insert(insertData)
    .select("id")
    .single<{ id: string }>();

  assertNoDatabaseError("Failed to create call appointment", result.error);

  if (!result.data) {
    throw new Error("Failed to create call appointment.");
  }

  return getAccount(normalizedAccountId, client);
}
