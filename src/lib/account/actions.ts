import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapAccountContext,
  type AccountHolderRow,
  type CallAppointmentRow,
  type PromiseToPayRow,
  type RelatedPersonRow,
  type TransactionRow,
} from "@/lib/account/mappers";

import type {
  AccountContext,
  UpdateAccountHolderInput,
} from "@/lib/account/types";

import { createServerSupabaseClient } from "@/lib/supabase/server";

type DatabaseError = {
  message: string;
};

type AccountHolderUpdateRow = Partial<
  Pick<
    AccountHolderRow,
    | "first_name"
    | "last_name"
    | "email"
    | "phone"
    | "address_line1"
    | "address_line2"
    | "city"
    | "postal_code"
    | "country"
    | "preferred_contact_method"
  >
>;

function assertNoDatabaseError(
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

function buildAccountHolderUpdate(
  fields: UpdateAccountHolderInput,
): AccountHolderUpdateRow {
  const updateData: AccountHolderUpdateRow = {};

  if (fields.accountHolderFirstName !== undefined) {
    const firstName = fields.accountHolderFirstName.trim();

    if (firstName.length < 2) {
      throw new Error("Please provide a valid first name.");
    }

    updateData.first_name = firstName;
  }

  if (fields.accountHolderLastName !== undefined) {
    const lastName = fields.accountHolderLastName.trim();

    if (lastName.length < 2) {
      throw new Error("Please provide a valid last name.");
    }

    updateData.last_name = lastName;
  }

  if (fields.email !== undefined) {
    const email = fields.email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please provide a valid email address.");
    }

    updateData.email = email;
  }

  if (fields.phone !== undefined) {
    const phone = fields.phone.trim();

    if (!/^\+?[0-9]{7,15}$/.test(phone)) {
      throw new Error("Please provide a valid phone number.");
    }

    updateData.phone = phone;
  }

  if (fields.preferredContactMethod !== undefined) {
    if (
      fields.preferredContactMethod !== "email" &&
      fields.preferredContactMethod !== "sms" &&
      fields.preferredContactMethod !== "phone"
    ) {
      throw new Error("Preferred contact method must be email, sms, or phone.");
    }

    updateData.preferred_contact_method = fields.preferredContactMethod;
  }

  if (fields.address?.line1 !== undefined) {
    const line1 = fields.address.line1.trim();

    if (line1.length < 3) {
      throw new Error("Please provide a valid address line.");
    }

    updateData.address_line1 = line1;
  }

  if (fields.address?.line2 !== undefined) {
    updateData.address_line2 = fields.address.line2.trim() || null;
  }

  if (fields.address?.city !== undefined) {
    const city = fields.address.city.trim();

    if (city.length < 2) {
      throw new Error("Please provide a valid city.");
    }

    updateData.city = city;
  }

  if (fields.address?.postalCode !== undefined) {
    const postalCode = fields.address.postalCode.trim();

    if (postalCode.length < 3) {
      throw new Error("Please provide a valid postal code.");
    }

    updateData.postal_code = postalCode;
  }

  if (fields.address?.country !== undefined) {
    const country = fields.address.country.trim();

    if (country.length < 2) {
      throw new Error("Please provide a valid country.");
    }

    updateData.country = country;
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error("At least one account holder field is required.");
  }

  return updateData;
}

export async function updateAccountHolder(
  accountId: string,
  fields: UpdateAccountHolderInput,
  supabase: SupabaseClient = createServerSupabaseClient(),
): Promise<AccountContext> {
  const normalizedAccountId = accountId.trim();

  if (!normalizedAccountId) {
    throw new Error("Account ID is required.");
  }

  const updateData = buildAccountHolderUpdate(fields);

  const updateResult = await supabase
    .from("account_holders")
    .update(updateData)
    .eq("account_id", normalizedAccountId)
    .select("account_id")
    .maybeSingle<{ account_id: string }>();

  assertNoDatabaseError("Failed to update account holder", updateResult.error);

  if (!updateResult.data) {
    throw new Error(`Account "${normalizedAccountId}" was not found.`);
  }

  return getAccount(normalizedAccountId, supabase);
}
