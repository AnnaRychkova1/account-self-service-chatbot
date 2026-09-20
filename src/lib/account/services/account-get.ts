import type { SupabaseClient } from "@supabase/supabase-js";

import { createAuthenticatedServerSupabaseClient } from "@/lib/supabase/server";
import { mapAccountContext } from "@/lib/account/mappers";

import type {
  AccountHolderRow,
  CallAppointmentRow,
  PromiseToPayRow,
  RelatedPersonRow,
  TransactionRow,
  AccountContext,
  DatabaseError,
} from "@/lib/account/types";

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
  supabase?: SupabaseClient,
): Promise<AccountContext> {
  const normalizedAccountId = accountId.trim();

  const client = supabase ?? (await createAuthenticatedServerSupabaseClient());

  if (!normalizedAccountId) {
    throw new Error("Account ID is required.");
  }

  const accountHolderResult = await client
    .from("account_holders")
    .select("*")
    .eq("account_id", normalizedAccountId)
    // .maybeSingle<AccountHolderRow>();

    // TODO back to single
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
    client
      .from("related_people")
      .select("*")
      .eq("account_holder_id", accountHolder.id)
      .returns<RelatedPersonRow[]>(),

    client
      .from("promises_to_pay")
      .select("*")
      .eq("account_holder_id", accountHolder.id)
      .order("created_at", {
        ascending: false,
      })
      .returns<PromiseToPayRow[]>(),

    client
      .from("transactions")
      .select("*")
      .eq("account_holder_id", accountHolder.id)
      .order("transaction_date", {
        ascending: false,
      })
      .returns<TransactionRow[]>(),

    client
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
