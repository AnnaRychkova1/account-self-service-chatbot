import type { SupabaseClient } from "@supabase/supabase-js";

import { createAuthenticatedServerSupabaseClient } from "@/lib/supabase/server";
import {
  assertNoDatabaseError,
  getAccount,
} from "@/lib/account/services/account-get";

import type {
  AccountContext,
  CreateRelatedPersonInput,
  RelatedPersonInsertRow,
  RelatedPersonRow,
  RelatedPersonUpdateRow,
  UpdateRelatedPersonInput,
} from "@/lib/account/types";

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

  assertNoDatabaseError("Failed to load account holder", result.error);

  if (!result.data) {
    throw new Error(`Account "${normalizedAccountId}" was not found.`);
  }

  return result.data.id;
}

function normalizeName(value: string): string {
  const name = value.trim();

  if (name.length < 2) {
    throw new Error("Please provide a valid related person name.");
  }

  return name;
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please provide a valid email address.");
  }

  return email;
}

function normalizePhone(value: string): string {
  const phone = value.trim();

  if (!/^\+?[0-9]{7,15}$/.test(phone)) {
    throw new Error("Please provide a valid phone number.");
  }

  return phone;
}

function normalizeRelationship(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const relationship = value.trim();

  if (!relationship) {
    return null;
  }

  if (relationship.length < 2) {
    throw new Error("Please provide a valid relationship.");
  }

  return relationship;
}

function buildRelatedPersonInsert(
  accountHolderId: string,
  input: CreateRelatedPersonInput,
): RelatedPersonInsertRow {
  return {
    account_holder_id: accountHolderId,
    name: normalizeName(input.name),
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
    relationship: normalizeRelationship(input.relationship),
    authorized_to_act: input.authorizedToAct,
  };
}

function buildRelatedPersonUpdate(
  input: UpdateRelatedPersonInput,
): RelatedPersonUpdateRow {
  const updateData: RelatedPersonUpdateRow = {};

  if (input.name !== undefined) {
    updateData.name = normalizeName(input.name);
  }

  if (input.email !== undefined) {
    updateData.email = normalizeEmail(input.email);
  }

  if (input.phone !== undefined) {
    updateData.phone = normalizePhone(input.phone);
  }

  if (input.relationship !== undefined) {
    updateData.relationship = normalizeRelationship(input.relationship);
  }

  if (input.authorizedToAct !== undefined) {
    updateData.authorized_to_act = input.authorizedToAct;
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error("At least one related person field is required.");
  }

  return updateData;
}

export async function getRelatedPeople(
  accountId: string,
  supabase?: SupabaseClient,
): Promise<RelatedPersonRow[]> {
  const client = supabase ?? (await createAuthenticatedServerSupabaseClient());
  const accountHolderId = await getAccountHolderId(accountId, client);

  const result = await client
    .from("related_people")
    .select("*")
    .eq("account_holder_id", accountHolderId)
    .order("created_at", { ascending: true })
    .returns<RelatedPersonRow[]>();

  assertNoDatabaseError("Failed to load related people", result.error);

  return result.data ?? [];
}

export async function addRelatedPerson(
  accountId: string,
  input: CreateRelatedPersonInput,
  supabase?: SupabaseClient,
): Promise<AccountContext> {
  const client = supabase ?? (await createAuthenticatedServerSupabaseClient());
  const normalizedAccountId = accountId.trim();

  if (!normalizedAccountId) {
    throw new Error("Account ID is required.");
  }

  const accountHolderId = await getAccountHolderId(normalizedAccountId, client);

  const insertData = buildRelatedPersonInsert(accountHolderId, input);

  const result = await client
    .from("related_people")
    .insert(insertData)
    .select("id")
    .single<{ id: string }>();

  assertNoDatabaseError("Failed to add related person", result.error);

  if (!result.data) {
    throw new Error("Failed to add related person.");
  }

  return getAccount(normalizedAccountId, client);
}

export async function updateRelatedPerson(
  accountId: string,
  relatedPersonId: string,
  input: UpdateRelatedPersonInput,
  supabase?: SupabaseClient,
): Promise<AccountContext> {
  const client = supabase ?? (await createAuthenticatedServerSupabaseClient());
  const normalizedAccountId = accountId.trim();
  const normalizedRelatedPersonId = relatedPersonId.trim();

  if (!normalizedAccountId) {
    throw new Error("Account ID is required.");
  }

  if (!normalizedRelatedPersonId) {
    throw new Error("Related person ID is required.");
  }

  const accountHolderId = await getAccountHolderId(normalizedAccountId, client);

  const updateData = buildRelatedPersonUpdate(input);

  const result = await client
    .from("related_people")
    .update(updateData)
    .eq("id", normalizedRelatedPersonId)
    .eq("account_holder_id", accountHolderId)
    .select("id")
    .maybeSingle<{ id: string }>();

  assertNoDatabaseError("Failed to update related person", result.error);

  if (!result.data) {
    throw new Error("Related person was not found.");
  }

  return getAccount(normalizedAccountId, client);
}

export async function removeRelatedPerson(
  accountId: string,
  relatedPersonId: string,
  supabase?: SupabaseClient,
): Promise<AccountContext> {
  const client = supabase ?? (await createAuthenticatedServerSupabaseClient());
  const normalizedAccountId = accountId.trim();
  const normalizedRelatedPersonId = relatedPersonId.trim();

  if (!normalizedAccountId) {
    throw new Error("Account ID is required.");
  }

  if (!normalizedRelatedPersonId) {
    throw new Error("Related person ID is required.");
  }

  const accountHolderId = await getAccountHolderId(normalizedAccountId, client);

  const result = await client
    .from("related_people")
    .delete()
    .eq("id", normalizedRelatedPersonId)
    .eq("account_holder_id", accountHolderId)
    .select("id")
    .maybeSingle<{ id: string }>();

  assertNoDatabaseError("Failed to remove related person", result.error);

  if (!result.data) {
    throw new Error("Related person was not found.");
  }

  return getAccount(normalizedAccountId, client);
}
