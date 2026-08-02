import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAccount } from "@/lib/account/services/account-get";
import {
  getTransactions,
  processMockPayment,
} from "@/lib/account/services/payment";

import type { AccountContext, TransactionRow } from "@/lib/account/types";

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

const transactionRows: TransactionRow[] = [
  {
    id: "transaction-1",
    account_holder_id: accountHolderId,
    type: "payment",
    status: "completed",
    amount_cents: 5_000,
    currency: "EUR",
    description: "Card payment",
    transaction_date: "2026-01-10",
    created_at: "2026-01-10T10:00:00.000Z",
  },
  {
    id: "transaction-2",
    account_holder_id: accountHolderId,
    type: "charge",
    status: "posted",
    amount_cents: 12_500,
    currency: "EUR",
    description: "Winter usage adjustment",
    transaction_date: "2026-01-18",
    created_at: "2026-01-18T10:00:00.000Z",
  },
];

const accountContext = {
  account: {
    accountId,
    balanceCents: 113_500,
  },
  transactions: [],
} as unknown as AccountContext;

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function createQueryBuilder({
  singleResult = {
    data: {
      id: accountHolderId,
    },
    error: null,
  },
  returnsResult = {
    data: transactionRows,
    error: null,
  },
}: {
  singleResult?: QueryResult;
  returnsResult?: QueryResult;
} = {}) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
    returns: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.single.mockResolvedValue(singleResult);
  builder.returns.mockResolvedValue(returnsResult);

  return builder;
}

function createMockSupabaseClient({
  accountHolderResult = {
    data: {
      id: accountHolderId,
    },
    error: null,
  },
  transactionsResult = {
    data: transactionRows,
    error: null,
  },
  rpcResult = {
    data: [
      {
        transaction_id: "payment-transaction-1",
        new_balance_cents: 113_500,
        duplicate: false,
      },
    ],
    error: null,
  },
}: {
  accountHolderResult?: QueryResult;
  transactionsResult?: QueryResult;
  rpcResult?: QueryResult;
} = {}) {
  const accountHolderBuilder = createQueryBuilder({
    singleResult: accountHolderResult,
  });

  const transactionsBuilder = createQueryBuilder({
    returnsResult: transactionsResult,
  });

  const from = vi.fn((tableName: string) => {
    if (tableName === "account_holders") {
      return accountHolderBuilder;
    }

    if (tableName === "transactions") {
      return transactionsBuilder;
    }

    throw new Error(`Unexpected table requested: ${tableName}`);
  });

  const rpc = vi.fn().mockResolvedValue(rpcResult);

  const supabase = {
    from,
    rpc,
  } as unknown as SupabaseClient;

  return {
    supabase,
    from,
    rpc,
    accountHolderBuilder,
    transactionsBuilder,
  };
}

describe("payment services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAccount.mockResolvedValue(accountContext);
  });

  describe("getTransactions", () => {
    it("loads the account transaction history", async () => {
      const { supabase } = createMockSupabaseClient();

      const result = await getTransactions(accountId, supabase);

      expect(result).toEqual(transactionRows);
    });

    it("queries the account holder using the public account ID", async () => {
      const { supabase, accountHolderBuilder } = createMockSupabaseClient();

      await getTransactions(`  ${accountId}  `, supabase);

      expect(accountHolderBuilder.select).toHaveBeenCalledWith("id");

      expect(accountHolderBuilder.eq).toHaveBeenCalledWith(
        "account_id",
        accountId,
      );

      expect(accountHolderBuilder.single).toHaveBeenCalledOnce();
    });

    it("queries transactions using the internal account holder ID", async () => {
      const { supabase, transactionsBuilder } = createMockSupabaseClient();

      await getTransactions(accountId, supabase);

      expect(transactionsBuilder.select).toHaveBeenCalledWith("*");

      expect(transactionsBuilder.eq).toHaveBeenCalledWith(
        "account_holder_id",
        accountHolderId,
      );
    });

    it("sorts transactions by date and creation time descending", async () => {
      const { supabase, transactionsBuilder } = createMockSupabaseClient();

      await getTransactions(accountId, supabase);

      expect(transactionsBuilder.order).toHaveBeenNthCalledWith(
        1,
        "transaction_date",
        {
          ascending: false,
        },
      );

      expect(transactionsBuilder.order).toHaveBeenNthCalledWith(
        2,
        "created_at",
        {
          ascending: false,
        },
      );
    });

    it("returns an empty array when no transactions exist", async () => {
      const { supabase } = createMockSupabaseClient({
        transactionsResult: {
          data: null,
          error: null,
        },
      });

      const result = await getTransactions(accountId, supabase);

      expect(result).toEqual([]);
    });

    it("rejects an empty account ID without querying Supabase", async () => {
      const { supabase, from } = createMockSupabaseClient();

      await expect(getTransactions("   ", supabase)).rejects.toThrow(
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

      await expect(getTransactions(accountId, supabase)).rejects.toThrow(
        `Account "${accountId}" was not found.`,
      );
    });

    it("returns the account lookup error", async () => {
      const { supabase } = createMockSupabaseClient({
        accountHolderResult: {
          data: null,
          error: {
            message: "Account query failed",
          },
        },
      });

      await expect(getTransactions(accountId, supabase)).rejects.toThrow(
        "Failed to load account holder: Account query failed",
      );
    });

    it("returns the transaction query error", async () => {
      const { supabase } = createMockSupabaseClient({
        transactionsResult: {
          data: null,
          error: {
            message: "Transaction query failed",
          },
        },
      });

      await expect(getTransactions(accountId, supabase)).rejects.toThrow(
        "Failed to load transactions: Transaction query failed",
      );
    });
  });

  describe("processMockPayment", () => {
    it("processes a mocked payment through the atomic RPC", async () => {
      const { supabase, rpc } = createMockSupabaseClient();

      const result = await processMockPayment(
        accountId,
        {
          amountCents: 15_000,
          requestId: "payment-request-1",
        },
        supabase,
      );

      expect(rpc).toHaveBeenCalledWith("process_mock_payment", {
        p_account_id: accountId,
        p_amount_cents: 15_000,
        p_request_id: "payment-request-1",
      });

      expect(result).toEqual({
        payment: {
          transactionId: "payment-transaction-1",
          newBalanceCents: 113_500,
          duplicate: false,
        },
        account: accountContext,
      });
    });

    it("trims the account ID and request ID before calling the RPC", async () => {
      const { supabase, rpc } = createMockSupabaseClient();

      await processMockPayment(
        `  ${accountId}  `,
        {
          amountCents: 15_000,
          requestId: "  payment-request-1  ",
        },
        supabase,
      );

      expect(rpc).toHaveBeenCalledWith("process_mock_payment", {
        p_account_id: accountId,
        p_amount_cents: 15_000,
        p_request_id: "payment-request-1",
      });
    });

    it("refreshes the complete account context after payment", async () => {
      const { supabase } = createMockSupabaseClient();

      await processMockPayment(
        accountId,
        {
          amountCents: 15_000,
          requestId: "payment-request-1",
        },
        supabase,
      );

      expect(mockedGetAccount).toHaveBeenCalledWith(accountId, supabase);
    });

    it("returns an existing payment when the request is a duplicate", async () => {
      const { supabase } = createMockSupabaseClient({
        rpcResult: {
          data: [
            {
              transaction_id: "existing-payment-1",
              new_balance_cents: 113_500,
              duplicate: true,
            },
          ],
          error: null,
        },
      });

      const result = await processMockPayment(
        accountId,
        {
          amountCents: 15_000,
          requestId: "payment-request-1",
        },
        supabase,
      );

      expect(result.payment).toEqual({
        transactionId: "existing-payment-1",
        newBalanceCents: 113_500,
        duplicate: true,
      });

      expect(mockedGetAccount).toHaveBeenCalledOnce();
    });

    it.each([0, -1, -15_000, 12.5, Number.NaN, Number.POSITIVE_INFINITY])(
      "rejects invalid amount %s before calling the RPC",
      async (amountCents) => {
        const { supabase, rpc } = createMockSupabaseClient();

        await expect(
          processMockPayment(
            accountId,
            {
              amountCents,
              requestId: "payment-request-1",
            },
            supabase,
          ),
        ).rejects.toThrow("Please provide a valid payment amount.");

        expect(rpc).not.toHaveBeenCalled();
        expect(mockedGetAccount).not.toHaveBeenCalled();
      },
    );

    it("rejects an empty account ID before calling the RPC", async () => {
      const { supabase, rpc } = createMockSupabaseClient();

      await expect(
        processMockPayment(
          "   ",
          {
            amountCents: 15_000,
            requestId: "payment-request-1",
          },
          supabase,
        ),
      ).rejects.toThrow("Account ID is required.");

      expect(rpc).not.toHaveBeenCalled();
      expect(mockedGetAccount).not.toHaveBeenCalled();
    });

    it("rejects an empty request ID before calling the RPC", async () => {
      const { supabase, rpc } = createMockSupabaseClient();

      await expect(
        processMockPayment(
          accountId,
          {
            amountCents: 15_000,
            requestId: "   ",
          },
          supabase,
        ),
      ).rejects.toThrow("Payment request ID is required.");

      expect(rpc).not.toHaveBeenCalled();
      expect(mockedGetAccount).not.toHaveBeenCalled();
    });

    it("returns an over-balance error from the RPC", async () => {
      const { supabase } = createMockSupabaseClient({
        rpcResult: {
          data: null,
          error: {
            message: "Payment amount cannot exceed the current balance.",
          },
        },
      });

      await expect(
        processMockPayment(
          accountId,
          {
            amountCents: 200_000,
            requestId: "payment-request-1",
          },
          supabase,
        ),
      ).rejects.toThrow(
        "Failed to process mocked payment: Payment amount cannot exceed the current balance.",
      );

      expect(mockedGetAccount).not.toHaveBeenCalled();
    });

    it("returns an account-not-found error from the RPC", async () => {
      const { supabase } = createMockSupabaseClient({
        rpcResult: {
          data: null,
          error: {
            message: `Account "${accountId}" was not found.`,
          },
        },
      });

      await expect(
        processMockPayment(
          accountId,
          {
            amountCents: 15_000,
            requestId: "payment-request-1",
          },
          supabase,
        ),
      ).rejects.toThrow(
        `Failed to process mocked payment: Account "${accountId}" was not found.`,
      );

      expect(mockedGetAccount).not.toHaveBeenCalled();
    });

    it("rejects reuse of a request ID with a different amount", async () => {
      const { supabase } = createMockSupabaseClient({
        rpcResult: {
          data: null,
          error: {
            message:
              "Payment request ID has already been used with a different amount.",
          },
        },
      });

      await expect(
        processMockPayment(
          accountId,
          {
            amountCents: 20_000,
            requestId: "payment-request-1",
          },
          supabase,
        ),
      ).rejects.toThrow(
        "Failed to process mocked payment: Payment request ID has already been used with a different amount.",
      );

      expect(mockedGetAccount).not.toHaveBeenCalled();
    });

    it("returns a general RPC failure", async () => {
      const { supabase } = createMockSupabaseClient({
        rpcResult: {
          data: null,
          error: {
            message: "Database connection failed",
          },
        },
      });

      await expect(
        processMockPayment(
          accountId,
          {
            amountCents: 15_000,
            requestId: "payment-request-1",
          },
          supabase,
        ),
      ).rejects.toThrow(
        "Failed to process mocked payment: Database connection failed",
      );

      expect(mockedGetAccount).not.toHaveBeenCalled();
    });

    it("rejects an empty successful RPC response", async () => {
      const { supabase } = createMockSupabaseClient({
        rpcResult: {
          data: [],
          error: null,
        },
      });

      await expect(
        processMockPayment(
          accountId,
          {
            amountCents: 15_000,
            requestId: "payment-request-1",
          },
          supabase,
        ),
      ).rejects.toThrow("Failed to process mocked payment.");

      expect(mockedGetAccount).not.toHaveBeenCalled();
    });

    it("rejects a null successful RPC response", async () => {
      const { supabase } = createMockSupabaseClient({
        rpcResult: {
          data: null,
          error: null,
        },
      });

      await expect(
        processMockPayment(
          accountId,
          {
            amountCents: 15_000,
            requestId: "payment-request-1",
          },
          supabase,
        ),
      ).rejects.toThrow("Failed to process mocked payment.");

      expect(mockedGetAccount).not.toHaveBeenCalled();
    });
  });
});
