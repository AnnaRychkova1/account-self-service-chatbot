import type { SupabaseClient } from "@supabase/supabase-js";

import type { AccountContext, DatabaseError } from "@/lib/account/types";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  mapAccountContext,
  type AccountHolderRow,
  type CallAppointmentRow,
  type PromiseToPayRow,
  type RelatedPersonRow,
  type TransactionRow,
} from "@/lib/account/mappers";

export function assertNoDatabaseError(
  operation: string,
  error: DatabaseError | null,
): void {
  if (error) {
    throw new Error(`${operation}: ${error.message}`);
  }
}

export async function getAccount(
  accountId: string,
  supabase: SupabaseClient = createServerSupabaseClient(),
): Promise<AccountContext> {
  const normalizedAccountId = accountId.trim();

  if (!normalizedAccountId) {
    throw new Error("Account ID is required.");
  }

  const accountHolderResult = await supabase
    .from("account_holders")
    .select("*")
    .eq("account_id", normalizedAccountId)
    .single<AccountHolderRow>();

  assertNoDatabaseError(
    "Failed to load account holder",
    accountHolderResult.error,
  );

  if (!accountHolderResult.data) {
    throw new Error(`Account "${normalizedAccountId}" was not found.`);
  }

  const accountHolder = accountHolderResult.data;

  const [
    relatedPeopleResult,
    promisesToPayResult,
    transactionsResult,
    callAppointmentsResult,
  ] = await Promise.all([
    supabase
      .from("related_people")
      .select("*")
      .eq("account_holder_id", accountHolder.id)
      .returns<RelatedPersonRow[]>(),

    supabase
      .from("promises_to_pay")
      .select("*")
      .eq("account_holder_id", accountHolder.id)
      .order("created_at", {
        ascending: false,
      })
      .returns<PromiseToPayRow[]>(),

    supabase
      .from("transactions")
      .select("*")
      .eq("account_holder_id", accountHolder.id)
      .order("transaction_date", {
        ascending: false,
      })
      .returns<TransactionRow[]>(),

    supabase
      .from("call_appointments")
      .select("*")
      .eq("account_holder_id", accountHolder.id)
      .order("scheduled_at", {
        ascending: true,
      })
      .returns<CallAppointmentRow[]>(),
  ]);

  assertNoDatabaseError(
    "Failed to load related people",
    relatedPeopleResult.error,
  );

  assertNoDatabaseError(
    "Failed to load promises to pay",
    promisesToPayResult.error,
  );

  assertNoDatabaseError(
    "Failed to load transactions",
    transactionsResult.error,
  );

  assertNoDatabaseError(
    "Failed to load call appointments",
    callAppointmentsResult.error,
  );

  return mapAccountContext({
    accountHolder,
    relatedPeople: relatedPeopleResult.data ?? [],
    promisesToPay: promisesToPayResult.data ?? [],
    transactions: transactionsResult.data ?? [],
    callAppointments: callAppointmentsResult.data ?? [],
  });
}
