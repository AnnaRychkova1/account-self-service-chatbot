import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  assertNoDatabaseError,
  getAccount,
} from "@/lib/account/services/account-get";

import type {
  AccountContext,
  CreatePromiseToPayInput,
  PromiseToPayInsertRow,
  PromiseToPayRow,
} from "@/lib/account/types";

async function getAccountHolder(
  accountId: string,
  supabase: SupabaseClient,
): Promise<{
  id: string;
  currency: string;
}> {
  const normalizedAccountId = accountId.trim();

  if (!normalizedAccountId) {
    throw new Error("Account ID is required.");
  }

  const result = await supabase
    .from("account_holders")
    .select("id, currency")
    .eq("account_id", normalizedAccountId)
    .single<{
      id: string;
      currency: string;
    }>();

  assertNoDatabaseError("Failed to load account holder", result.error);

  if (!result.data) {
    throw new Error(`Account "${normalizedAccountId}" was not found.`);
  }

  return result.data;
}

function validatePromiseToPayInput(
  input: CreatePromiseToPayInput,
  currentDate: Date = new Date(),
): CreatePromiseToPayInput {
  if (
    !Number.isInteger(input.amountCents) ||
    !Number.isFinite(input.amountCents) ||
    input.amountCents <= 0
  ) {
    throw new Error("Please provide a valid payment amount.");
  }

  const dueDate = input.dueDate.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new Error("Please provide a valid due date.");
  }

  const parsedDueDate = new Date(`${dueDate}T00:00:00.000Z`);

  if (Number.isNaN(parsedDueDate.getTime())) {
    throw new Error("Please provide a valid due date.");
  }

  const normalizedDueDate = parsedDueDate.toISOString().slice(0, 10);

  if (normalizedDueDate !== dueDate) {
    throw new Error("Please provide a valid due date.");
  }

  const todayUtc = new Date(
    Date.UTC(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      currentDate.getUTCDate(),
    ),
  );

  if (parsedDueDate <= todayUtc) {
    throw new Error("Promise-to-pay due date must be in the future.");
  }

  return {
    amountCents: input.amountCents,
    dueDate,
  };
}

export async function getPromisesToPay(
  accountId: string,
  supabase: SupabaseClient = createServerSupabaseClient(),
): Promise<PromiseToPayRow[]> {
  const accountHolder = await getAccountHolder(accountId, supabase);

  const result = await supabase
    .from("promises_to_pay")
    .select("*")
    .eq("account_holder_id", accountHolder.id)
    .order("created_at", {
      ascending: false,
    })
    .returns<PromiseToPayRow[]>();

  assertNoDatabaseError("Failed to load promises to pay", result.error);

  return result.data ?? [];
}

export async function createPromiseToPay(
  accountId: string,
  input: CreatePromiseToPayInput,
  supabase: SupabaseClient = createServerSupabaseClient(),
): Promise<AccountContext> {
  const normalizedAccountId = accountId.trim();

  if (!normalizedAccountId) {
    throw new Error("Account ID is required.");
  }

  const validatedInput = validatePromiseToPayInput(input);

  const accountHolder = await getAccountHolder(normalizedAccountId, supabase);

  const insertData: PromiseToPayInsertRow = {
    account_holder_id: accountHolder.id,
    amount_cents: validatedInput.amountCents,
    currency: accountHolder.currency,
    due_date: validatedInput.dueDate,
    status: "active",
  };

  const result = await supabase
    .from("promises_to_pay")
    .insert(insertData)
    .select("id")
    .single<{ id: string }>();

  assertNoDatabaseError("Failed to create promise to pay", result.error);

  if (!result.data) {
    throw new Error("Failed to create promise to pay.");
  }

  return getAccount(normalizedAccountId, supabase);
}
