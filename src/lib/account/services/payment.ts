import type { SupabaseClient } from "@supabase/supabase-js";

import { createAuthenticatedServerSupabaseClient } from "@/lib/supabase/server";
import {
  assertNoDatabaseError,
  getAccount,
} from "@/lib/account/services/account-get";

import type {
  AccountContext,
  MockPaymentInput,
  MockPaymentResult,
  MockPaymentRpcRow,
  TransactionRow,
} from "@/lib/account/types";

function validateMockPaymentInput(input: MockPaymentInput): MockPaymentInput {
  if (
    !Number.isInteger(input.amountCents) ||
    !Number.isFinite(input.amountCents) ||
    input.amountCents <= 0
  ) {
    throw new Error("Please provide a valid payment amount.");
  }

  const requestId = input.requestId.trim();

  if (!requestId) {
    throw new Error("Payment request ID is required.");
  }

  return {
    amountCents: input.amountCents,
    requestId,
  };
}

export async function getTransactions(
  accountId: string,
  supabase?: SupabaseClient,
): Promise<TransactionRow[]> {
  const client = supabase ?? (await createAuthenticatedServerSupabaseClient());
  const normalizedAccountId = accountId.trim();

  if (!normalizedAccountId) {
    throw new Error("Account ID is required.");
  }

  const accountHolderResult = await client
    .from("account_holders")
    .select("id")
    .eq("account_id", normalizedAccountId)
    .single<{ id: string }>();

  assertNoDatabaseError(
    "Failed to load account holder",
    accountHolderResult.error,
  );

  if (!accountHolderResult.data) {
    throw new Error(`Account "${normalizedAccountId}" was not found.`);
  }

  const result = await client
    .from("transactions")
    .select("*")
    .eq("account_holder_id", accountHolderResult.data.id)
    .order("transaction_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .returns<TransactionRow[]>();

  assertNoDatabaseError("Failed to load transactions", result.error);

  return result.data ?? [];
}

export async function processMockPayment(
  accountId: string,
  input: MockPaymentInput,
  supabase?: SupabaseClient,
): Promise<{
  payment: MockPaymentResult;
  account: AccountContext;
}> {
  const client = supabase ?? (await createAuthenticatedServerSupabaseClient());
  const normalizedAccountId = accountId.trim();

  if (!normalizedAccountId) {
    throw new Error("Account ID is required.");
  }

  const validatedInput = validateMockPaymentInput(input);

  const result = await client.rpc("process_mock_payment", {
    p_account_id: normalizedAccountId,
    p_amount_cents: validatedInput.amountCents,
    p_request_id: validatedInput.requestId,
  });

  assertNoDatabaseError("Failed to process mocked payment", result.error);

  const rows = result.data as MockPaymentRpcRow[] | null;
  const row = rows?.[0];

  if (!row) {
    throw new Error("Failed to process mocked payment.");
  }

  const payment: MockPaymentResult = {
    transactionId: row.transaction_id,
    newBalanceCents: row.new_balance_cents,
    duplicate: row.duplicate,
  };

  const account = await getAccount(normalizedAccountId, client);

  return {
    payment,
    account,
  };
}
