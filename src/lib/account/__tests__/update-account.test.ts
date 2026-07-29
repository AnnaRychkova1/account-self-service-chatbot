import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { updateAccountHolder } from "@/lib/account/actions";

const ACCOUNT_ID = "acc_standard_001";
const ACCOUNT_HOLDER_ID = "holder-1";

const accountHolderRow = {
  id: ACCOUNT_HOLDER_ID,
  account_id: ACCOUNT_ID,
  first_name: "Anna",
  last_name: "Rychkova",
  email: "anna@example.com",
  phone: "+353851234567",
  address_line1: "1 Main Street",
  address_line2: null,
  city: "Carlow",
  postal_code: "R93 TEST",
  country: "Ireland",
  preferred_contact_method: "sms",
  reference: "REF-001",
  creditor_name: "Example Creditor",
  currency: "EUR",
  balance_cents: 50_000,
  status: "overdue",
  days_past_due: 30,
  minimum_payment_cents: 5_000,
  last_payment_date: null,
  last_payment_amount_cents: 0,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-29T00:00:00.000Z",
};

const emptyResult = {
  data: [],
  error: null,
};

type DatabaseError = {
  message: string;
  details: string | null;
  hint: string | null;
  code: string;
};

type MockSupabaseOptions = {
  updateData?: { account_id: string } | null;
  updateError?: DatabaseError | null;
  accountData?: typeof accountHolderRow | null;
  accountError?: DatabaseError | null;
};

function createRelatedRecordsQuery() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        returns: vi.fn().mockResolvedValue(emptyResult),
      }),
    }),
  };
}

function createOrderedRecordsQuery() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          returns: vi.fn().mockResolvedValue(emptyResult),
        }),
      }),
    }),
  };
}

function createMockSupabaseClient({
  updateData = {
    account_id: ACCOUNT_ID,
  },
  updateError = null,
  accountData = accountHolderRow,
  accountError = null,
}: MockSupabaseOptions = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: updateData,
    error: updateError,
  });

  const selectAfterUpdate = vi.fn().mockReturnValue({
    maybeSingle,
  });

  const eqAfterUpdate = vi.fn().mockReturnValue({
    select: selectAfterUpdate,
  });

  const update = vi.fn().mockReturnValue({
    eq: eqAfterUpdate,
  });

  const singleAccountHolder = vi.fn().mockResolvedValue({
    data: accountData,
    error: accountError,
  });

  const eqAfterAccountSelect = vi.fn().mockReturnValue({
    single: singleAccountHolder,
  });

  const accountSelect = vi.fn().mockReturnValue({
    eq: eqAfterAccountSelect,
  });

  const from = vi.fn((table: string) => {
    if (table === "account_holders") {
      return {
        update,
        select: accountSelect,
      };
    }

    if (table === "related_people") {
      return createRelatedRecordsQuery();
    }

    if (
      table === "promises_to_pay" ||
      table === "transactions" ||
      table === "call_appointments"
    ) {
      return createOrderedRecordsQuery();
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    supabase: {
      from,
    } as unknown as SupabaseClient,
    mocks: {
      from,
      update,
      eqAfterUpdate,
      selectAfterUpdate,
      maybeSingle,
      accountSelect,
      eqAfterAccountSelect,
      singleAccountHolder,
    },
  };
}

function createUnusedSupabaseClient() {
  const from = vi.fn();

  return {
    supabase: {
      from,
    } as unknown as SupabaseClient,
    from,
  };
}

describe("updateAccountHolder", () => {
  it("updates the account holder and returns the refreshed account context", async () => {
    const { supabase, mocks } = createMockSupabaseClient();

    const result = await updateAccountHolder(
      `  ${ACCOUNT_ID}  `,
      {
        phone: "+353851234567",
        preferredContactMethod: "sms",
      },
      supabase,
    );

    expect(mocks.update).toHaveBeenCalledWith({
      phone: "+353851234567",
      preferred_contact_method: "sms",
    });

    expect(mocks.eqAfterUpdate).toHaveBeenCalledWith("account_id", ACCOUNT_ID);

    expect(mocks.selectAfterUpdate).toHaveBeenCalledWith("account_id");
    expect(mocks.maybeSingle).toHaveBeenCalledOnce();

    expect(result.account.phone).toBe("+353851234567");
    expect(result.account.preferredContactMethod).toBe("sms");
  });

  it("maps and normalizes all account holder fields", async () => {
    const refreshedAccountHolder = {
      ...accountHolderRow,
      first_name: "Jane",
      last_name: "Murphy",
      email: "jane.murphy@example.test",
      phone: "+353831234567",
      address_line1: "12 River Walk",
      address_line2: null,
      city: "Dublin",
      postal_code: "D06 X123",
      country: "Ireland",
      preferred_contact_method: "email",
    };

    const { supabase, mocks } = createMockSupabaseClient({
      accountData: refreshedAccountHolder,
    });

    await updateAccountHolder(
      ACCOUNT_ID,
      {
        accountHolderFirstName: "  Jane  ",
        accountHolderLastName: "  Murphy  ",
        email: "  JANE.MURPHY@EXAMPLE.TEST  ",
        phone: "  +353831234567  ",
        preferredContactMethod: "email",
        address: {
          line1: "  12 River Walk  ",
          line2: "   ",
          city: "  Dublin  ",
          postalCode: "  D06 X123  ",
          country: "  Ireland  ",
        },
      },
      supabase,
    );

    expect(mocks.update).toHaveBeenCalledWith({
      first_name: "Jane",
      last_name: "Murphy",
      email: "jane.murphy@example.test",
      phone: "+353831234567",
      preferred_contact_method: "email",
      address_line1: "12 River Walk",
      address_line2: null,
      city: "Dublin",
      postal_code: "D06 X123",
      country: "Ireland",
    });
  });

  it.each([
    [
      "first name",
      {
        accountHolderFirstName: "A",
      },
      "Please provide a valid first name.",
    ],
    [
      "last name",
      {
        accountHolderLastName: "M",
      },
      "Please provide a valid last name.",
    ],
    [
      "email address",
      {
        email: "not-an-email",
      },
      "Please provide a valid email address.",
    ],
    [
      "phone number",
      {
        phone: "123",
      },
      "Please provide a valid phone number.",
    ],
    [
      "address line",
      {
        address: {
          line1: "A",
        },
      },
      "Please provide a valid address line.",
    ],
    [
      "city",
      {
        address: {
          city: "D",
        },
      },
      "Please provide a valid city.",
    ],
    [
      "postal code",
      {
        address: {
          postalCode: "D1",
        },
      },
      "Please provide a valid postal code.",
    ],
    [
      "country",
      {
        address: {
          country: "I",
        },
      },
      "Please provide a valid country.",
    ],
  ])(
    "rejects an invalid %s without querying the database",
    async (_fieldName, fields, expectedMessage) => {
      const { supabase, from } = createUnusedSupabaseClient();

      await expect(
        updateAccountHolder(ACCOUNT_ID, fields, supabase),
      ).rejects.toThrow(expectedMessage);

      expect(from).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid preferred contact method without querying the database", async () => {
    const { supabase, from } = createUnusedSupabaseClient();

    await expect(
      updateAccountHolder(
        ACCOUNT_ID,
        {
          preferredContactMethod: "letter",
        } as never,
        supabase,
      ),
    ).rejects.toThrow("Preferred contact method must be email, sms, or phone.");

    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an empty update without querying the database", async () => {
    const { supabase, from } = createUnusedSupabaseClient();

    await expect(updateAccountHolder(ACCOUNT_ID, {}, supabase)).rejects.toThrow(
      "At least one account holder field is required.",
    );

    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an empty account ID without querying the database", async () => {
    const { supabase, from } = createUnusedSupabaseClient();

    await expect(
      updateAccountHolder(
        "   ",
        {
          phone: "+353831112233",
        },
        supabase,
      ),
    ).rejects.toThrow("Account ID is required.");

    expect(from).not.toHaveBeenCalled();
  });

  it("throws when the account does not exist", async () => {
    const { supabase, mocks } = createMockSupabaseClient({
      updateData: null,
    });

    await expect(
      updateAccountHolder(
        "  acc_missing_001  ",
        {
          phone: "+353831112233",
        },
        supabase,
      ),
    ).rejects.toThrow('Account "acc_missing_001" was not found.');

    expect(mocks.update).toHaveBeenCalledWith({
      phone: "+353831112233",
    });

    expect(mocks.eqAfterUpdate).toHaveBeenCalledWith(
      "account_id",
      "acc_missing_001",
    );

    expect(mocks.maybeSingle).toHaveBeenCalledOnce();
    expect(mocks.accountSelect).not.toHaveBeenCalled();
  });

  it("throws when the database update fails", async () => {
    const { supabase, mocks } = createMockSupabaseClient({
      updateData: null,
      updateError: {
        message: "Database update failed",
        details: null,
        hint: null,
        code: "TEST_UPDATE_ERROR",
      },
    });

    await expect(
      updateAccountHolder(
        ACCOUNT_ID,
        {
          phone: "+353831112233",
        },
        supabase,
      ),
    ).rejects.toThrow("Failed to update account holder");

    expect(mocks.update).toHaveBeenCalledWith({
      phone: "+353831112233",
    });

    expect(mocks.eqAfterUpdate).toHaveBeenCalledWith("account_id", ACCOUNT_ID);

    expect(mocks.maybeSingle).toHaveBeenCalledOnce();
    expect(mocks.accountSelect).not.toHaveBeenCalled();
  });

  it("throws when the updated account cannot be reloaded", async () => {
    const { supabase, mocks } = createMockSupabaseClient({
      accountData: null,
      accountError: {
        message: "Reload failed",
        details: null,
        hint: null,
        code: "TEST_RELOAD_ERROR",
      },
    });

    await expect(
      updateAccountHolder(
        ACCOUNT_ID,
        {
          phone: "+353831112233",
        },
        supabase,
      ),
    ).rejects.toThrow();

    expect(mocks.update).toHaveBeenCalledWith({
      phone: "+353831112233",
    });

    expect(mocks.maybeSingle).toHaveBeenCalledOnce();
    expect(mocks.accountSelect).toHaveBeenCalledWith("*");
    expect(mocks.eqAfterAccountSelect).toHaveBeenCalledWith(
      "account_id",
      ACCOUNT_ID,
    );
    expect(mocks.singleAccountHolder).toHaveBeenCalledOnce();
  });
});
