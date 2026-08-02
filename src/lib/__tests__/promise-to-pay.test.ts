import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAccount } from "@/lib/account/services/account-get";
import {
  createPromiseToPay,
  getPromisesToPay,
} from "@/lib/account/services/promise-to-pay";

import type { AccountContext, PromiseToPayRow } from "@/lib/account/types";

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

const accountId = "acc_standard_001";
const accountHolderId = "holder-1";

const promiseRow: PromiseToPayRow = {
  id: "promise-1",
  account_holder_id: accountHolderId,
  amount_cents: 50_000,
  currency: "EUR",
  due_date: "2026-09-01",
  status: "active",
  created_at: "2026-08-02T10:00:00.000Z",
};

const accountContext = {
  account: {
    accountId,
  },
  promisesToPay: [],
} as unknown as AccountContext;

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function createQueryBuilder({
  singleResult = { data: null, error: null },
  returnsResult = { data: null, error: null },
}: {
  singleResult?: QueryResult;
  returnsResult?: QueryResult;
} = {}) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(),
    returns: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.single.mockResolvedValue(singleResult);
  builder.returns.mockResolvedValue(returnsResult);

  return builder;
}

function createMockSupabaseClient({
  accountHolderResult = {
    data: {
      id: accountHolderId,
      currency: "EUR",
    },
    error: null,
  },
  promisesResult = {
    data: [promiseRow],
    error: null,
  },
  mutationResult = {
    data: {
      id: "promise-2",
    },
    error: null,
  },
}: {
  accountHolderResult?: QueryResult;
  promisesResult?: QueryResult;
  mutationResult?: QueryResult;
} = {}) {
  const accountHolderBuilder = createQueryBuilder({
    singleResult: accountHolderResult,
  });

  const promisesBuilder = createQueryBuilder({
    singleResult: mutationResult,
    returnsResult: promisesResult,
  });

  const from = vi.fn((tableName: string) => {
    if (tableName === "account_holders") {
      return accountHolderBuilder;
    }

    if (tableName === "promises_to_pay") {
      return promisesBuilder;
    }

    throw new Error(`Unexpected table requested: ${tableName}`);
  });

  return {
    supabase: {
      from,
    } as unknown as SupabaseClient,
    from,
    accountHolderBuilder,
    promisesBuilder,
  };
}

describe("promise-to-pay services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAccount.mockResolvedValue(accountContext);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T12:00:00.000Z"));
  });

  describe("getPromisesToPay", () => {
    it("loads promises for the account", async () => {
      const { supabase } = createMockSupabaseClient();

      const result = await getPromisesToPay(accountId, supabase);

      expect(result).toEqual([promiseRow]);
    });

    it("queries promises using the internal account holder ID", async () => {
      const { supabase, promisesBuilder } = createMockSupabaseClient();

      await getPromisesToPay(accountId, supabase);

      expect(promisesBuilder.select).toHaveBeenCalledWith("*");
      expect(promisesBuilder.eq).toHaveBeenCalledWith(
        "account_holder_id",
        accountHolderId,
      );
      expect(promisesBuilder.order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
    });

    it("returns an empty array when no promises exist", async () => {
      const { supabase } = createMockSupabaseClient({
        promisesResult: {
          data: null,
          error: null,
        },
      });

      const result = await getPromisesToPay(accountId, supabase);

      expect(result).toEqual([]);
    });

    it("rejects an empty account ID", async () => {
      const { supabase, from } = createMockSupabaseClient();

      await expect(getPromisesToPay("   ", supabase)).rejects.toThrow(
        "Account ID is required.",
      );

      expect(from).not.toHaveBeenCalled();
    });

    it("returns the query error", async () => {
      const { supabase } = createMockSupabaseClient({
        promisesResult: {
          data: null,
          error: {
            message: "Query failed",
          },
        },
      });

      await expect(getPromisesToPay(accountId, supabase)).rejects.toThrow(
        "Failed to load promises to pay: Query failed",
      );
    });
  });

  describe("createPromiseToPay", () => {
    it("creates a valid future promise to pay", async () => {
      const { supabase, promisesBuilder } = createMockSupabaseClient();

      const result = await createPromiseToPay(
        accountId,
        {
          amountCents: 50_000,
          dueDate: "2026-09-01",
        },
        supabase,
      );

      expect(promisesBuilder.insert).toHaveBeenCalledWith({
        account_holder_id: accountHolderId,
        amount_cents: 50_000,
        currency: "EUR",
        due_date: "2026-09-01",
        status: "active",
      });

      expect(promisesBuilder.select).toHaveBeenCalledWith("id");
      expect(promisesBuilder.single).toHaveBeenCalledOnce();

      expect(mockedGetAccount).toHaveBeenCalledWith(accountId, supabase);
      expect(result).toEqual(accountContext);
    });

    it.each([0, -1, -50_000, 12.5, Number.NaN, Number.POSITIVE_INFINITY])(
      "rejects invalid amount %s",
      async (amountCents) => {
        const { supabase, promisesBuilder } = createMockSupabaseClient();

        await expect(
          createPromiseToPay(
            accountId,
            {
              amountCents,
              dueDate: "2026-09-01",
            },
            supabase,
          ),
        ).rejects.toThrow("Please provide a valid payment amount.");

        expect(promisesBuilder.insert).not.toHaveBeenCalled();
        expect(mockedGetAccount).not.toHaveBeenCalled();
      },
    );

    it.each(["", "2026/09/01", "01-09-2026", "not-a-date", "2026-02-31"])(
      "rejects malformed due date %s",
      async (dueDate) => {
        const { supabase, promisesBuilder } = createMockSupabaseClient();

        await expect(
          createPromiseToPay(
            accountId,
            {
              amountCents: 50_000,
              dueDate,
            },
            supabase,
          ),
        ).rejects.toThrow("Please provide a valid due date.");

        expect(promisesBuilder.insert).not.toHaveBeenCalled();
      },
    );

    it("rejects today's date", async () => {
      const { supabase } = createMockSupabaseClient();

      await expect(
        createPromiseToPay(
          accountId,
          {
            amountCents: 50_000,
            dueDate: "2026-08-02",
          },
          supabase,
        ),
      ).rejects.toThrow("Promise-to-pay due date must be in the future.");
    });

    it("rejects a past date", async () => {
      const { supabase } = createMockSupabaseClient();

      await expect(
        createPromiseToPay(
          accountId,
          {
            amountCents: 50_000,
            dueDate: "2026-08-01",
          },
          supabase,
        ),
      ).rejects.toThrow("Promise-to-pay due date must be in the future.");
    });

    it("accepts tomorrow", async () => {
      const { supabase } = createMockSupabaseClient();

      await expect(
        createPromiseToPay(
          accountId,
          {
            amountCents: 50_000,
            dueDate: "2026-08-03",
          },
          supabase,
        ),
      ).resolves.toEqual(accountContext);
    });

    it("uses the account currency", async () => {
      const { supabase, promisesBuilder } = createMockSupabaseClient({
        accountHolderResult: {
          data: {
            id: accountHolderId,
            currency: "GBP",
          },
          error: null,
        },
      });

      await createPromiseToPay(
        accountId,
        {
          amountCents: 50_000,
          dueDate: "2026-09-01",
        },
        supabase,
      );

      expect(promisesBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: "GBP",
        }),
      );
    });

    it("rejects an account that cannot be found", async () => {
      const { supabase } = createMockSupabaseClient({
        accountHolderResult: {
          data: null,
          error: null,
        },
      });

      await expect(
        createPromiseToPay(
          accountId,
          {
            amountCents: 50_000,
            dueDate: "2026-09-01",
          },
          supabase,
        ),
      ).rejects.toThrow(`Account "${accountId}" was not found.`);
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
        createPromiseToPay(
          accountId,
          {
            amountCents: 50_000,
            dueDate: "2026-09-01",
          },
          supabase,
        ),
      ).rejects.toThrow("Failed to create promise to pay: Insert failed");

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
        createPromiseToPay(
          accountId,
          {
            amountCents: 50_000,
            dueDate: "2026-09-01",
          },
          supabase,
        ),
      ).rejects.toThrow("Failed to create promise to pay.");

      expect(mockedGetAccount).not.toHaveBeenCalled();
    });
  });
});
