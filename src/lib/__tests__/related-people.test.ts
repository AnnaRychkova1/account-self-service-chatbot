import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAccount } from "@/lib/account/services/account-get";
import {
  addRelatedPerson,
  getRelatedPeople,
  removeRelatedPerson,
  updateRelatedPerson,
} from "@/lib/account/services/related-people";

import type { AccountContext, RelatedPersonRow } from "@/lib/account/types";

vi.mock("@/lib/account/services/account-get", () => ({
  assertNoDatabaseError: (
    operation: string,
    error: { message: string } | null,
  ) => {
    if (error) {
      throw new Error(`${operation}: ${error.message}`);
    }
  },
  getAccount: vi.fn(),
}));

const mockedGetAccount = vi.mocked(getAccount);

const accountHolderId = "f608019a-f288-42ef-ae51-f0b8ad2c65f1";
const accountId = "acc_standard_001";

const relatedPersonRow: RelatedPersonRow = {
  id: "person-1",
  account_holder_id: accountHolderId,
  name: "John Murphy",
  email: "john.murphy@example.test",
  phone: "+353831987654",
  relationship: "spouse",
  authorized_to_act: false,
  created_at: "2026-01-01T10:00:00.000Z",
  updated_at: "2026-01-01T10:00:00.000Z",
};

const refreshedAccountContext: AccountContext = {
  account: {
    accountId,
    accountHolderFirstName: "Jane",
    accountHolderLastName: "Murphy",
    email: "jane.murphy@example.test",
    phone: "+353831234567",
    address: {
      line1: "12 River Walk",
      line2: "Rathmines",
      city: "Dublin",
      postalCode: "D06 X123",
      country: "Ireland",
    },
    preferredContactMethod: "email",
    reference: "EI-2026-000123",
    creditorName: "Example Energy Ireland",
    currency: "EUR",
    balanceCents: 128_500,
    status: "overdue",
    daysPastDue: 47,
    minimumPaymentCents: 2_500,
    lastPaymentDate: "2026-01-10",
    lastPaymentAmountCents: 5_000,
  },
  billing: {
    currentAmountCents: 128_500,
    lastStatementAmountCents: 128_500,
    dueDate: "2026-07-15",
  },
  paymentOptions: {
    payNowEnabled: true,
    promiseToPayEnabled: true,
    mockPaymentsEnabled: true,
    arrangementEnabled: false,
    eligibleArrangementOptions: [],
  },
  support: {
    humanSupportAvailable: true,
    supportPhone: "+3531800000000",
    supportEmail: "support@example.test",
  },
  relatedPeople: [
    {
      id: "person-1",
      name: "John Murphy",
      email: "john.murphy@example.test",
      phone: "+353831987654",
      relationship: "spouse",
      authorizedToAct: false,
    },
  ],
  promisesToPay: [],
  transactions: [],
  callAppointments: [],
  notificationRules: {
    sendEmailOnDataChange: true,
    pdfPasswordSource: "account_phone_last4",
  },
};

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function createQueryBuilder({
  singleResult = { data: null, error: null },
  returnsResult = { data: null, error: null },
  maybeSingleResult = { data: null, error: null },
}: {
  singleResult?: QueryResult;
  returnsResult?: QueryResult;
  maybeSingleResult?: QueryResult;
} = {}) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    returns: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.single.mockResolvedValue(singleResult);
  builder.maybeSingle.mockResolvedValue(maybeSingleResult);
  builder.returns.mockResolvedValue(returnsResult);

  return builder;
}

function createMockSupabaseClient({
  accountHolderResult = {
    data: { id: accountHolderId },
    error: null,
  },
  relatedPeopleResult = {
    data: [relatedPersonRow],
    error: null,
  },
  mutationResult = {
    data: { id: relatedPersonRow.id },
    error: null,
  },
}: {
  accountHolderResult?: QueryResult;
  relatedPeopleResult?: QueryResult;
  mutationResult?: QueryResult;
} = {}) {
  const accountHoldersBuilder = createQueryBuilder({
    singleResult: accountHolderResult,
  });

  const relatedPeopleBuilder = createQueryBuilder({
    returnsResult: relatedPeopleResult,
    singleResult: mutationResult,
    maybeSingleResult: mutationResult,
  });

  const from = vi.fn((tableName: string) => {
    if (tableName === "account_holders") {
      return accountHoldersBuilder;
    }

    if (tableName === "related_people") {
      return relatedPeopleBuilder;
    }

    throw new Error(`Unexpected table requested: ${tableName}`);
  });

  return {
    supabase: { from } as unknown as SupabaseClient,
    from,
    accountHoldersBuilder,
    relatedPeopleBuilder,
  };
}

describe("related people services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAccount.mockResolvedValue(refreshedAccountContext);
  });

  describe("getRelatedPeople", () => {
    it("loads related people for the requested account", async () => {
      const { supabase } = createMockSupabaseClient();

      const result = await getRelatedPeople(accountId, supabase);

      expect(result).toEqual([relatedPersonRow]);
    });

    it("trims the account ID before loading the account holder", async () => {
      const { supabase, accountHoldersBuilder } = createMockSupabaseClient();

      await getRelatedPeople(`  ${accountId}  `, supabase);

      expect(accountHoldersBuilder.eq).toHaveBeenCalledWith(
        "account_id",
        accountId,
      );
    });

    it("queries related people using the internal account holder ID", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await getRelatedPeople(accountId, supabase);

      expect(relatedPeopleBuilder.select).toHaveBeenCalledWith("*");
      expect(relatedPeopleBuilder.eq).toHaveBeenCalledWith(
        "account_holder_id",
        accountHolderId,
      );
      expect(relatedPeopleBuilder.order).toHaveBeenCalledWith("created_at", {
        ascending: true,
      });
    });

    it("returns an empty array when the account has no related people", async () => {
      const { supabase } = createMockSupabaseClient({
        relatedPeopleResult: {
          data: null,
          error: null,
        },
      });

      const result = await getRelatedPeople(accountId, supabase);

      expect(result).toEqual([]);
    });

    it("rejects an empty account ID without querying Supabase", async () => {
      const { supabase, from } = createMockSupabaseClient();

      await expect(getRelatedPeople("   ", supabase)).rejects.toThrow(
        "Account ID is required.",
      );

      expect(from).not.toHaveBeenCalled();
    });

    it("rejects an account that cannot be found", async () => {
      const { supabase } = createMockSupabaseClient({
        accountHolderResult: {
          data: null,
          error: null,
        },
      });

      await expect(getRelatedPeople(accountId, supabase)).rejects.toThrow(
        `Account "${accountId}" was not found.`,
      );
    });

    it("returns the account-holder query error", async () => {
      const { supabase } = createMockSupabaseClient({
        accountHolderResult: {
          data: null,
          error: {
            message: "Database unavailable",
          },
        },
      });

      await expect(getRelatedPeople(accountId, supabase)).rejects.toThrow(
        "Failed to load account holder: Database unavailable",
      );
    });

    it("returns the related-people query error", async () => {
      const { supabase } = createMockSupabaseClient({
        relatedPeopleResult: {
          data: null,
          error: {
            message: "Query failed",
          },
        },
      });

      await expect(getRelatedPeople(accountId, supabase)).rejects.toThrow(
        "Failed to load related people: Query failed",
      );
    });
  });

  describe("addRelatedPerson", () => {
    it("adds a validated related person", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      const result = await addRelatedPerson(
        accountId,
        {
          name: "  Mark Murphy  ",
          email: "  MARK@EXAMPLE.TEST  ",
          phone: "  +353831998877  ",
          relationship: "  brother  ",
          authorizedToAct: true,
        },
        supabase,
      );

      expect(relatedPeopleBuilder.insert).toHaveBeenCalledWith({
        account_holder_id: accountHolderId,
        name: "Mark Murphy",
        email: "mark@example.test",
        phone: "+353831998877",
        relationship: "brother",
        authorized_to_act: true,
      });

      expect(relatedPeopleBuilder.select).toHaveBeenCalledWith("id");
      expect(relatedPeopleBuilder.single).toHaveBeenCalledOnce();

      expect(mockedGetAccount).toHaveBeenCalledWith(accountId, supabase);
      expect(result).toEqual(refreshedAccountContext);
    });

    it("stores a missing relationship as null", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await addRelatedPerson(
        accountId,
        {
          name: "Mark Murphy",
          email: "mark@example.test",
          phone: "+353831998877",
          authorizedToAct: true,
        },
        supabase,
      );

      expect(relatedPeopleBuilder.insert).toHaveBeenCalledWith({
        account_holder_id: accountHolderId,
        name: "Mark Murphy",
        email: "mark@example.test",
        phone: "+353831998877",
        relationship: null,
        authorized_to_act: true,
      });
    });

    it("stores a blank relationship as null", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await addRelatedPerson(
        accountId,
        {
          name: "Mark Murphy",
          email: "mark@example.test",
          phone: "+353831998877",
          relationship: "   ",
          authorizedToAct: false,
        },
        supabase,
      );

      expect(relatedPeopleBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          relationship: null,
        }),
      );
    });

    it("rejects an invalid name", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await expect(
        addRelatedPerson(
          accountId,
          {
            name: "M",
            email: "mark@example.test",
            phone: "+353831998877",
            authorizedToAct: true,
          },
          supabase,
        ),
      ).rejects.toThrow("Please provide a valid related person name.");

      expect(relatedPeopleBuilder.insert).not.toHaveBeenCalled();
      expect(mockedGetAccount).not.toHaveBeenCalled();
    });

    it("rejects an invalid email address", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await expect(
        addRelatedPerson(
          accountId,
          {
            name: "Mark Murphy",
            email: "invalid-email",
            phone: "+353831998877",
            authorizedToAct: true,
          },
          supabase,
        ),
      ).rejects.toThrow("Please provide a valid email address.");

      expect(relatedPeopleBuilder.insert).not.toHaveBeenCalled();
    });

    it("rejects an invalid phone number", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await expect(
        addRelatedPerson(
          accountId,
          {
            name: "Mark Murphy",
            email: "mark@example.test",
            phone: "123",
            authorizedToAct: true,
          },
          supabase,
        ),
      ).rejects.toThrow("Please provide a valid phone number.");

      expect(relatedPeopleBuilder.insert).not.toHaveBeenCalled();
    });

    it("rejects an invalid relationship", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await expect(
        addRelatedPerson(
          accountId,
          {
            name: "Mark Murphy",
            email: "mark@example.test",
            phone: "+353831998877",
            relationship: "x",
            authorizedToAct: true,
          },
          supabase,
        ),
      ).rejects.toThrow("Please provide a valid relationship.");

      expect(relatedPeopleBuilder.insert).not.toHaveBeenCalled();
    });

    it("returns the insert error", async () => {
      const { supabase } = createMockSupabaseClient({
        mutationResult: {
          data: null,
          error: {
            message: "Insert failed",
          },
        },
      });

      await expect(
        addRelatedPerson(
          accountId,
          {
            name: "Mark Murphy",
            email: "mark@example.test",
            phone: "+353831998877",
            authorizedToAct: true,
          },
          supabase,
        ),
      ).rejects.toThrow("Failed to add related person: Insert failed");

      expect(mockedGetAccount).not.toHaveBeenCalled();
    });

    it("rejects an empty successful insert result", async () => {
      const { supabase } = createMockSupabaseClient({
        mutationResult: {
          data: null,
          error: null,
        },
      });

      await expect(
        addRelatedPerson(
          accountId,
          {
            name: "Mark Murphy",
            email: "mark@example.test",
            phone: "+353831998877",
            authorizedToAct: true,
          },
          supabase,
        ),
      ).rejects.toThrow("Failed to add related person.");

      expect(mockedGetAccount).not.toHaveBeenCalled();
    });
  });

  describe("updateRelatedPerson", () => {
    it("updates all related-person fields", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      const result = await updateRelatedPerson(
        accountId,
        "  person-1  ",
        {
          name: "  Mark Murphy  ",
          email: "  MARK@EXAMPLE.TEST  ",
          phone: "  +353831112233  ",
          relationship: "  brother  ",
          authorizedToAct: true,
        },
        supabase,
      );

      expect(relatedPeopleBuilder.update).toHaveBeenCalledWith({
        name: "Mark Murphy",
        email: "mark@example.test",
        phone: "+353831112233",
        relationship: "brother",
        authorized_to_act: true,
      });

      expect(relatedPeopleBuilder.eq).toHaveBeenCalledWith("id", "person-1");

      expect(relatedPeopleBuilder.eq).toHaveBeenCalledWith(
        "account_holder_id",
        accountHolderId,
      );

      expect(mockedGetAccount).toHaveBeenCalledWith(accountId, supabase);
      expect(result).toEqual(refreshedAccountContext);
    });

    it("supports a partial phone update", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await updateRelatedPerson(
        accountId,
        "person-1",
        {
          phone: "+353831112233",
        },
        supabase,
      );

      expect(relatedPeopleBuilder.update).toHaveBeenCalledWith({
        phone: "+353831112233",
      });
    });

    it("supports a partial authorization update", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await updateRelatedPerson(
        accountId,
        "person-1",
        {
          authorizedToAct: false,
        },
        supabase,
      );

      expect(relatedPeopleBuilder.update).toHaveBeenCalledWith({
        authorized_to_act: false,
      });
    });

    it("clears the relationship using a blank value", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await updateRelatedPerson(
        accountId,
        "person-1",
        {
          relationship: "   ",
        },
        supabase,
      );

      expect(relatedPeopleBuilder.update).toHaveBeenCalledWith({
        relationship: null,
      });
    });

    it("rejects an empty related person ID", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await expect(
        updateRelatedPerson(
          accountId,
          "   ",
          {
            phone: "+353831112233",
          },
          supabase,
        ),
      ).rejects.toThrow("Related person ID is required.");

      expect(relatedPeopleBuilder.update).not.toHaveBeenCalled();
    });

    it("rejects an update without fields", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await expect(
        updateRelatedPerson(accountId, "person-1", {}, supabase),
      ).rejects.toThrow("At least one related person field is required.");

      expect(relatedPeopleBuilder.update).not.toHaveBeenCalled();
      expect(mockedGetAccount).not.toHaveBeenCalled();
    });

    it("rejects an invalid updated name", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await expect(
        updateRelatedPerson(
          accountId,
          "person-1",
          {
            name: "M",
          },
          supabase,
        ),
      ).rejects.toThrow("Please provide a valid related person name.");

      expect(relatedPeopleBuilder.update).not.toHaveBeenCalled();
    });

    it("rejects an invalid updated email", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await expect(
        updateRelatedPerson(
          accountId,
          "person-1",
          {
            email: "invalid-email",
          },
          supabase,
        ),
      ).rejects.toThrow("Please provide a valid email address.");

      expect(relatedPeopleBuilder.update).not.toHaveBeenCalled();
    });

    it("rejects an invalid updated phone number", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await expect(
        updateRelatedPerson(
          accountId,
          "person-1",
          {
            phone: "123",
          },
          supabase,
        ),
      ).rejects.toThrow("Please provide a valid phone number.");

      expect(relatedPeopleBuilder.update).not.toHaveBeenCalled();
    });

    it("rejects an invalid updated relationship", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await expect(
        updateRelatedPerson(
          accountId,
          "person-1",
          {
            relationship: "x",
          },
          supabase,
        ),
      ).rejects.toThrow("Please provide a valid relationship.");

      expect(relatedPeopleBuilder.update).not.toHaveBeenCalled();
    });

    it("rejects a related person outside the requested account", async () => {
      const { supabase } = createMockSupabaseClient({
        mutationResult: {
          data: null,
          error: null,
        },
      });

      await expect(
        updateRelatedPerson(
          accountId,
          "person-from-another-account",
          {
            phone: "+353831112233",
          },
          supabase,
        ),
      ).rejects.toThrow("Related person was not found.");

      expect(mockedGetAccount).not.toHaveBeenCalled();
    });

    it("returns the update query error", async () => {
      const { supabase } = createMockSupabaseClient({
        mutationResult: {
          data: null,
          error: {
            message: "Update failed",
          },
        },
      });

      await expect(
        updateRelatedPerson(
          accountId,
          "person-1",
          {
            phone: "+353831112233",
          },
          supabase,
        ),
      ).rejects.toThrow("Failed to update related person: Update failed");
    });
  });

  describe("removeRelatedPerson", () => {
    it("removes a related person belonging to the account", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      const result = await removeRelatedPerson(
        `  ${accountId}  `,
        "  person-1  ",
        supabase,
      );

      expect(relatedPeopleBuilder.delete).toHaveBeenCalledOnce();

      expect(relatedPeopleBuilder.eq).toHaveBeenCalledWith("id", "person-1");

      expect(relatedPeopleBuilder.eq).toHaveBeenCalledWith(
        "account_holder_id",
        accountHolderId,
      );

      expect(relatedPeopleBuilder.select).toHaveBeenCalledWith("id");
      expect(relatedPeopleBuilder.maybeSingle).toHaveBeenCalledOnce();

      expect(mockedGetAccount).toHaveBeenCalledWith(accountId, supabase);
      expect(result).toEqual(refreshedAccountContext);
    });

    it("rejects an empty account ID", async () => {
      const { supabase, from } = createMockSupabaseClient();

      await expect(
        removeRelatedPerson("   ", "person-1", supabase),
      ).rejects.toThrow("Account ID is required.");

      expect(from).not.toHaveBeenCalled();
    });

    it("rejects an empty related person ID", async () => {
      const { supabase, relatedPeopleBuilder } = createMockSupabaseClient();

      await expect(
        removeRelatedPerson(accountId, "   ", supabase),
      ).rejects.toThrow("Related person ID is required.");

      expect(relatedPeopleBuilder.delete).not.toHaveBeenCalled();
    });

    it("rejects a related person that does not belong to the account", async () => {
      const { supabase } = createMockSupabaseClient({
        mutationResult: {
          data: null,
          error: null,
        },
      });

      await expect(
        removeRelatedPerson(accountId, "person-from-another-account", supabase),
      ).rejects.toThrow("Related person was not found.");

      expect(mockedGetAccount).not.toHaveBeenCalled();
    });

    it("returns the delete query error", async () => {
      const { supabase } = createMockSupabaseClient({
        mutationResult: {
          data: null,
          error: {
            message: "Delete failed",
          },
        },
      });

      await expect(
        removeRelatedPerson(accountId, "person-1", supabase),
      ).rejects.toThrow("Failed to remove related person: Delete failed");

      expect(mockedGetAccount).not.toHaveBeenCalled();
    });
  });
});
