import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getTransactions,
  processMockPayment,
} from "@/lib/account/services/payment";
import { handlePayment } from "@/lib/chat/handlers/chat-payment";

import type { AccountContext, TransactionRow } from "@/lib/account/types";

vi.mock("@/lib/account/services/payment", () => ({
  getTransactions: vi.fn(),
  processMockPayment: vi.fn(),
}));

const mockedGetTransactions = vi.mocked(getTransactions);
const mockedProcessMockPayment = vi.mocked(processMockPayment);

const transactionRows: TransactionRow[] = [
  {
    id: "transaction-1",
    account_holder_id: "holder-1",
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
    account_holder_id: "holder-1",
    type: "charge",
    status: "posted",
    amount_cents: 12_500,
    currency: "EUR",
    description: "Winter usage adjustment",
    transaction_date: "2026-01-18",
    created_at: "2026-01-18T10:00:00.000Z",
  },
];

const accountContext: AccountContext = {
  account: {
    accountId: "account-123",
    accountHolderFirstName: "Jane",
    accountHolderLastName: "Murphy",
    email: "jane@example.test",
    phone: "+353831234567",
    address: {
      line1: "1 Main Street",
      city: "Dublin",
      postalCode: "D01 TEST",
      country: "Ireland",
    },
    preferredContactMethod: "email",
    reference: "REF-123",
    creditorName: "Example Creditor",
    currency: "EUR",
    balanceCents: 113_500,
    status: "overdue",
    daysPastDue: 47,
    minimumPaymentCents: 2_500,
    lastPaymentDate: "2026-08-02",
    lastPaymentAmountCents: 15_000,
  },
  billing: {
    currentAmountCents: 113_500,
    lastStatementAmountCents: 128_500,
    dueDate: "2026-08-15",
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
  relatedPeople: [],
  promisesToPay: [],
  transactions: [
    {
      id: "payment-transaction-1",
      type: "payment",
      status: "completed",
      amountCents: 15_000,
      currency: "EUR",
      description: "Mocked payment using saved payment details",
      transactionDate: "2026-08-02",
    },
    {
      id: "transaction-1",
      type: "payment",
      status: "completed",
      amountCents: 5_000,
      currency: "EUR",
      description: "Card payment",
      transactionDate: "2026-01-10",
    },
  ],
  callAppointments: [],
  notificationRules: {
    sendEmailOnDataChange: true,
    pdfPasswordSource: "account_phone_last4",
  },
};

describe("handlePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedGetTransactions.mockResolvedValue(transactionRows);

    mockedProcessMockPayment.mockResolvedValue({
      payment: {
        transactionId: "payment-transaction-1",
        newBalanceCents: 113_500,
        duplicate: false,
      },
      account: accountContext,
    });
  });

  describe("read_transactions", () => {
    it("returns all transactions", async () => {
      const result = await handlePayment({
        accountId: "account-123",
        parsedAction: {
          action: "read_transactions",
          fields: {},
          missingFields: [],
        },
      });

      expect(mockedGetTransactions).toHaveBeenCalledWith("account-123");

      expect(result).toEqual({
        action: "read_transactions",
        success: true,
        reply:
          "Your transactions are: €50.00 payment on 2026-01-10 (completed); €125.00 charge on 2026-01-18 (posted).",
        transactions: [
          {
            id: "transaction-1",
            type: "payment",
            status: "completed",
            amountCents: 5_000,
            currency: "EUR",
            description: "Card payment",
            transactionDate: "2026-01-10",
          },
          {
            id: "transaction-2",
            type: "charge",
            status: "posted",
            amountCents: 12_500,
            currency: "EUR",
            description: "Winter usage adjustment",
            transactionDate: "2026-01-18",
          },
        ],
      });
    });

    it("returns an empty result when no transactions exist", async () => {
      mockedGetTransactions.mockResolvedValueOnce([]);

      const result = await handlePayment({
        accountId: "account-123",
        parsedAction: {
          action: "read_transactions",
          fields: {},
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "read_transactions",
        success: true,
        reply: "There are no transactions on your account.",
        transactions: [],
      });
    });

    it("does not require a request ID to read transactions", async () => {
      const result = await handlePayment({
        accountId: "account-123",
        parsedAction: {
          action: "read_transactions",
          fields: {},
          missingFields: [],
        },
      });

      expect(result.success).toBe(true);
      expect(mockedGetTransactions).toHaveBeenCalledOnce();
      expect(mockedProcessMockPayment).not.toHaveBeenCalled();
    });

    it("returns the service error when transactions cannot be loaded", async () => {
      mockedGetTransactions.mockRejectedValueOnce(
        new Error("Failed to load transactions."),
      );

      const result = await handlePayment({
        accountId: "account-123",
        parsedAction: {
          action: "read_transactions",
          fields: {},
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "read_transactions",
        success: false,
        reply: "Failed to load transactions.",
      });
    });
  });

  describe("mock_payment", () => {
    it("processes a mocked payment using saved payment details", async () => {
      const result = await handlePayment({
        accountId: "account-123",
        requestId: "request-123",
        parsedAction: {
          action: "mock_payment",
          fields: {
            amount: "15000",
          },
          missingFields: [],
        },
      });

      expect(mockedProcessMockPayment).toHaveBeenCalledWith("account-123", {
        amountCents: 15_000,
        requestId: "request-123",
      });

      expect(result).toEqual({
        action: "mock_payment",
        success: true,
        reply:
          "Your payment of €150.00 has been completed using the payment details on file.",
        account: accountContext,
        transaction: accountContext.transactions[0],
        transactions: accountContext.transactions,
        notificationQueued: false,
      });
    });

    it("returns the existing payment for a duplicate request", async () => {
      mockedProcessMockPayment.mockResolvedValueOnce({
        payment: {
          transactionId: "payment-transaction-1",
          newBalanceCents: 113_500,
          duplicate: true,
        },
        account: accountContext,
      });

      const result = await handlePayment({
        accountId: "account-123",
        requestId: "request-123",
        parsedAction: {
          action: "mock_payment",
          fields: {
            amount: "15000",
          },
          missingFields: [],
        },
      });

      expect(mockedProcessMockPayment).toHaveBeenCalledOnce();

      expect(result).toEqual({
        action: "mock_payment",
        success: true,
        reply:
          "This payment request was already processed. No additional payment was taken.",
        account: accountContext,
        transaction: accountContext.transactions[0],
        transactions: accountContext.transactions,
        notificationQueued: false,
      });
    });

    it("rejects a payment without a request ID", async () => {
      const result = await handlePayment({
        accountId: "account-123",
        parsedAction: {
          action: "mock_payment",
          fields: {
            amount: "15000",
          },
          missingFields: [],
        },
      });

      expect(mockedProcessMockPayment).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "mock_payment",
        success: false,
        reply: "Payment request ID is required.",
      });
    });

    it("asks for the amount when it is missing", async () => {
      const parsedAction = {
        action: "mock_payment" as const,
        fields: {},
        missingFields: ["amount"],
      };

      const result = await handlePayment({
        accountId: "account-123",
        requestId: "request-123",
        parsedAction,
      });

      expect(mockedProcessMockPayment).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "mock_payment",
        success: false,
        reply: "How much would you like to pay?",
        missingFields: ["amount"],
        pendingAction: {
          action: "mock_payment",
          fields: {},
          missingFields: ["amount"],
        },
      });
    });

    it("rejects a missing amount when parser fields omit it unexpectedly", async () => {
      const result = await handlePayment({
        accountId: "account-123",
        requestId: "request-123",
        parsedAction: {
          action: "mock_payment",
          fields: {},
          missingFields: [],
        },
      });

      expect(mockedProcessMockPayment).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "mock_payment",
        success: false,
        reply: "Please provide a payment amount.",
      });
    });

    it.each(["abc", "12.5", "NaN"])(
      "rejects malformed amount %s before calling the payment service",
      async (amount) => {
        const result = await handlePayment({
          accountId: "account-123",
          requestId: "request-123",
          parsedAction: {
            action: "mock_payment",
            fields: {
              amount,
            },
            missingFields: [],
          },
        });

        expect(mockedProcessMockPayment).not.toHaveBeenCalled();

        expect(result).toEqual({
          action: "mock_payment",
          success: false,
          reply: "Please provide a valid payment amount.",
        });
      },
    );

    it("passes zero to deterministic service validation", async () => {
      mockedProcessMockPayment.mockRejectedValueOnce(
        new Error("Please provide a valid payment amount."),
      );

      const result = await handlePayment({
        accountId: "account-123",
        requestId: "request-123",
        parsedAction: {
          action: "mock_payment",
          fields: {
            amount: "0",
          },
          missingFields: [],
        },
      });

      expect(mockedProcessMockPayment).toHaveBeenCalledWith("account-123", {
        amountCents: 0,
        requestId: "request-123",
      });

      expect(result).toEqual({
        action: "mock_payment",
        success: false,
        reply: "Please provide a valid payment amount.",
      });
    });

    it("passes a negative amount to deterministic service validation", async () => {
      mockedProcessMockPayment.mockRejectedValueOnce(
        new Error("Please provide a valid payment amount."),
      );

      const result = await handlePayment({
        accountId: "account-123",
        requestId: "request-123",
        parsedAction: {
          action: "mock_payment",
          fields: {
            amount: "-15000",
          },
          missingFields: [],
        },
      });

      expect(mockedProcessMockPayment).toHaveBeenCalledWith("account-123", {
        amountCents: -15_000,
        requestId: "request-123",
      });

      expect(result).toEqual({
        action: "mock_payment",
        success: false,
        reply: "Please provide a valid payment amount.",
      });
    });

    it("returns an over-balance validation error from the payment service", async () => {
      mockedProcessMockPayment.mockRejectedValueOnce(
        new Error(
          "Failed to process mocked payment: Payment amount cannot exceed the current balance.",
        ),
      );

      const result = await handlePayment({
        accountId: "account-123",
        requestId: "request-123",
        parsedAction: {
          action: "mock_payment",
          fields: {
            amount: "200000",
          },
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "mock_payment",
        success: false,
        reply:
          "Failed to process mocked payment: Payment amount cannot exceed the current balance.",
      });
    });

    it("returns a reused request ID error from the payment service", async () => {
      mockedProcessMockPayment.mockRejectedValueOnce(
        new Error(
          "Failed to process mocked payment: Payment request ID has already been used with a different amount.",
        ),
      );

      const result = await handlePayment({
        accountId: "account-123",
        requestId: "request-123",
        parsedAction: {
          action: "mock_payment",
          fields: {
            amount: "20000",
          },
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "mock_payment",
        success: false,
        reply:
          "Failed to process mocked payment: Payment request ID has already been used with a different amount.",
      });
    });

    it("returns the service error when payment processing fails", async () => {
      mockedProcessMockPayment.mockRejectedValueOnce(
        new Error("Failed to process mocked payment."),
      );

      const result = await handlePayment({
        accountId: "account-123",
        requestId: "request-123",
        parsedAction: {
          action: "mock_payment",
          fields: {
            amount: "15000",
          },
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "mock_payment",
        success: false,
        reply: "Failed to process mocked payment.",
      });
    });
  });

  it("rejects an action that is not a payment action", async () => {
    const result = await handlePayment({
      accountId: "account-123",
      requestId: "request-123",
      parsedAction: {
        action: "read_account",
        fields: {},
        missingFields: [],
      },
    });

    expect(result).toEqual({
      action: "read_account",
      success: false,
      reply: "The payment request could not be completed.",
    });

    expect(mockedGetTransactions).not.toHaveBeenCalled();
    expect(mockedProcessMockPayment).not.toHaveBeenCalled();
  });
});
