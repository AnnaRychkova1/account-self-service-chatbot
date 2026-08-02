import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPromiseToPay,
  getPromisesToPay,
} from "@/lib/account/services/promise-to-pay";
import { handlePromiseToPay } from "@/lib/chat/handlers/chat-promise-to-pay";
import { sendAccountChangeNotification } from "@/lib/notifications/account-change-notification";

import type { AccountContext, PromiseToPayRow } from "@/lib/account/types";

vi.mock("@/lib/account/services/promise-to-pay", () => ({
  createPromiseToPay: vi.fn(),
  getPromisesToPay: vi.fn(),
}));

vi.mock("@/lib/notifications/account-change-notification", () => ({
  sendAccountChangeNotification: vi.fn(),
}));

const mockedCreatePromiseToPay = vi.mocked(createPromiseToPay);
const mockedGetPromisesToPay = vi.mocked(getPromisesToPay);
const mockedSendAccountChangeNotification = vi.mocked(
  sendAccountChangeNotification,
);

const promiseRows: PromiseToPayRow[] = [
  {
    id: "promise-1",
    account_holder_id: "holder-1",
    amount_cents: 50_000,
    currency: "EUR",
    due_date: "2026-09-01",
    status: "active",
    created_at: "2026-08-02T10:00:00.000Z",
  },
  {
    id: "promise-2",
    account_holder_id: "holder-1",
    amount_cents: 25_000,
    currency: "EUR",
    due_date: "2026-08-15",
    status: "completed",
    created_at: "2026-07-20T10:00:00.000Z",
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
    dueDate: "2026-09-01",
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
  promisesToPay: [
    {
      id: "promise-new",
      amountCents: 50_000,
      currency: "EUR",
      dueDate: "2026-09-01",
      status: "active",
      createdAt: "2026-08-02T12:00:00.000Z",
    },
  ],
  transactions: [],
  callAppointments: [],
  notificationRules: {
    sendEmailOnDataChange: true,
    pdfPasswordSource: "account_phone_last4",
  },
};

describe("handlePromiseToPay", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedGetPromisesToPay.mockResolvedValue(promiseRows);
    mockedCreatePromiseToPay.mockResolvedValue(accountContext);
    mockedSendAccountChangeNotification.mockResolvedValue({
      notificationId: "notification-1",
      sent: true,
      redactedRecipient: "j***@example.test",
    });
  });

  describe("read_promises_to_pay", () => {
    it("returns all promises to pay", async () => {
      const result = await handlePromiseToPay({
        accountId: "account-123",
        parsedAction: {
          action: "read_promises_to_pay",
          fields: {},
          missingFields: [],
        },
      });

      expect(mockedGetPromisesToPay).toHaveBeenCalledWith("account-123");
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "read_promises_to_pay",
        success: true,
        reply:
          "Your promises to pay are: €500.00 due on 2026-09-01 (active); €250.00 due on 2026-08-15 (completed).",
        promisesToPay: [
          {
            id: "promise-1",
            amountCents: 50_000,
            currency: "EUR",
            dueDate: "2026-09-01",
            status: "active",
            createdAt: "2026-08-02T10:00:00.000Z",
          },
          {
            id: "promise-2",
            amountCents: 25_000,
            currency: "EUR",
            dueDate: "2026-08-15",
            status: "completed",
            createdAt: "2026-07-20T10:00:00.000Z",
          },
        ],
      });
    });

    it("returns an empty result when no promises exist", async () => {
      mockedGetPromisesToPay.mockResolvedValueOnce([]);

      const result = await handlePromiseToPay({
        accountId: "account-123",
        parsedAction: {
          action: "read_promises_to_pay",
          fields: {},
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "read_promises_to_pay",
        success: true,
        reply: "There are no promises to pay on your account.",
        promisesToPay: [],
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });

    it("returns the service error when promises cannot be loaded", async () => {
      mockedGetPromisesToPay.mockRejectedValueOnce(
        new Error("Failed to load promises to pay."),
      );

      const result = await handlePromiseToPay({
        accountId: "account-123",
        parsedAction: {
          action: "read_promises_to_pay",
          fields: {},
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "read_promises_to_pay",
        success: false,
        reply: "Failed to load promises to pay.",
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });
  });

  describe("create_promise_to_pay", () => {
    it("creates a promise to pay with amount and due date", async () => {
      const result = await handlePromiseToPay({
        accountId: "account-123",
        parsedAction: {
          action: "create_promise_to_pay",
          fields: {
            amount: "50000",
            dueDate: "2026-09-01",
          },
          missingFields: [],
        },
      });

      expect(mockedCreatePromiseToPay).toHaveBeenCalledWith("account-123", {
        amountCents: 50_000,
        dueDate: "2026-09-01",
      });

      expect(result).toEqual({
        action: "create_promise_to_pay",
        success: true,
        reply: "Your promise to pay €500.00 on 2026-09-01 has been recorded.",
        account: accountContext,
        promiseToPay: accountContext.promisesToPay[0],
        notificationQueued: true,
      });
      expect(mockedSendAccountChangeNotification).toHaveBeenCalledWith({
        accountId: "account-123",
        changedBy: "account_holder",
        changeSummary: "promise_to_pay_created",
        accountSnapshot: accountContext,
      });
    });

    it("keeps the promise successful when notification delivery fails", async () => {
      mockedSendAccountChangeNotification.mockRejectedValueOnce(
        new Error("Notification failed."),
      );

      const result = await handlePromiseToPay({
        accountId: "account-123",
        parsedAction: {
          action: "create_promise_to_pay",
          fields: {
            amount: "50000",
            dueDate: "2026-09-01",
          },
          missingFields: [],
        },
      });

      expect(mockedCreatePromiseToPay).toHaveBeenCalledWith("account-123", {
        amountCents: 50_000,
        dueDate: "2026-09-01",
      });

      expect(mockedSendAccountChangeNotification).toHaveBeenCalledWith({
        accountId: "account-123",
        changedBy: "account_holder",
        changeSummary: "promise_to_pay_created",
        accountSnapshot: accountContext,
      });

      expect(result).toEqual({
        action: "create_promise_to_pay",
        success: true,
        reply: "Your promise to pay €500.00 on 2026-09-01 has been recorded.",
        account: accountContext,
        promiseToPay: accountContext.promisesToPay[0],
        notificationQueued: false,
      });
    });

    it("asks for the amount when it is missing", async () => {
      const parsedAction = {
        action: "create_promise_to_pay" as const,
        fields: {
          dueDate: "2026-09-01",
        },
        missingFields: ["amount"],
      };

      const result = await handlePromiseToPay({
        accountId: "account-123",
        parsedAction,
      });

      expect(mockedCreatePromiseToPay).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "create_promise_to_pay",
        success: false,
        reply: "How much would you like to promise to pay?",
        missingFields: ["amount"],
        pendingAction: {
          action: "create_promise_to_pay",
          fields: {
            dueDate: "2026-09-01",
          },
          missingFields: ["amount"],
        },
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });

    it("asks for the due date when it is missing", async () => {
      const parsedAction = {
        action: "create_promise_to_pay" as const,
        fields: {
          amount: "50000",
        },
        missingFields: ["dueDate"],
      };

      const result = await handlePromiseToPay({
        accountId: "account-123",
        parsedAction,
      });

      expect(mockedCreatePromiseToPay).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "create_promise_to_pay",
        success: false,
        reply: "What date would you like to promise the payment for?",
        missingFields: ["dueDate"],
        pendingAction: {
          action: "create_promise_to_pay",
          fields: {
            amount: "50000",
          },
          missingFields: ["dueDate"],
        },
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });

    it("asks for amount and due date together when both are missing", async () => {
      const parsedAction = {
        action: "create_promise_to_pay" as const,
        fields: {},
        missingFields: ["amount", "dueDate"],
      };

      const result = await handlePromiseToPay({
        accountId: "account-123",
        parsedAction,
      });

      expect(mockedCreatePromiseToPay).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "create_promise_to_pay",
        success: false,
        reply:
          "Please provide the amount and future date for the promise to pay.",
        missingFields: ["amount", "dueDate"],
        pendingAction: {
          action: "create_promise_to_pay",
          fields: {},
          missingFields: ["amount", "dueDate"],
        },
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });

    it("asks for the due date when parser fields omit it unexpectedly", async () => {
      const result = await handlePromiseToPay({
        accountId: "account-123",
        parsedAction: {
          action: "create_promise_to_pay",
          fields: {
            amount: "50000",
          },
          missingFields: [],
        },
      });

      expect(mockedCreatePromiseToPay).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "create_promise_to_pay",
        success: false,
        reply: "What date would you like to promise the payment for?",
        missingFields: ["dueDate"],
        pendingAction: {
          action: "create_promise_to_pay",
          fields: {
            amount: "50000",
          },
          missingFields: ["dueDate"],
        },
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });

    it("rejects a missing amount when parser fields omit it unexpectedly", async () => {
      const result = await handlePromiseToPay({
        accountId: "account-123",
        parsedAction: {
          action: "create_promise_to_pay",
          fields: {
            dueDate: "2026-09-01",
          },
          missingFields: [],
        },
      });

      expect(mockedCreatePromiseToPay).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "create_promise_to_pay",
        success: false,
        reply: "Please provide a payment amount.",
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });

    it.each(["abc", "12.5", "", "NaN"])(
      "rejects malformed amount %s",
      async (amount) => {
        const result = await handlePromiseToPay({
          accountId: "account-123",
          parsedAction: {
            action: "create_promise_to_pay",
            fields: {
              amount,
              dueDate: "2026-09-01",
            },
            missingFields: [],
          },
        });

        expect(mockedCreatePromiseToPay).not.toHaveBeenCalled();
        expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();

        expect(result.success).toBe(false);
      },
    );

    it("passes zero amount to the deterministic service validation", async () => {
      mockedCreatePromiseToPay.mockRejectedValueOnce(
        new Error("Please provide a valid payment amount."),
      );

      const result = await handlePromiseToPay({
        accountId: "account-123",
        parsedAction: {
          action: "create_promise_to_pay",
          fields: {
            amount: "0",
            dueDate: "2026-09-01",
          },
          missingFields: [],
        },
      });

      expect(mockedCreatePromiseToPay).toHaveBeenCalledWith("account-123", {
        amountCents: 0,
        dueDate: "2026-09-01",
      });

      expect(result).toEqual({
        action: "create_promise_to_pay",
        success: false,
        reply: "Please provide a valid payment amount.",
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });

    it("passes negative amount to the deterministic service validation", async () => {
      mockedCreatePromiseToPay.mockRejectedValueOnce(
        new Error("Please provide a valid payment amount."),
      );

      const result = await handlePromiseToPay({
        accountId: "account-123",
        parsedAction: {
          action: "create_promise_to_pay",
          fields: {
            amount: "-5000",
            dueDate: "2026-09-01",
          },
          missingFields: [],
        },
      });

      expect(mockedCreatePromiseToPay).toHaveBeenCalledWith("account-123", {
        amountCents: -5000,
        dueDate: "2026-09-01",
      });

      expect(result).toEqual({
        action: "create_promise_to_pay",
        success: false,
        reply: "Please provide a valid payment amount.",
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });

    it("returns a past-date validation error from the service", async () => {
      mockedCreatePromiseToPay.mockRejectedValueOnce(
        new Error("Promise-to-pay due date must be in the future."),
      );

      const result = await handlePromiseToPay({
        accountId: "account-123",
        parsedAction: {
          action: "create_promise_to_pay",
          fields: {
            amount: "50000",
            dueDate: "2026-08-01",
          },
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "create_promise_to_pay",
        success: false,
        reply: "Promise-to-pay due date must be in the future.",
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });

    it("returns the service error when creating the promise fails", async () => {
      mockedCreatePromiseToPay.mockRejectedValueOnce(
        new Error("Failed to create promise to pay."),
      );

      const result = await handlePromiseToPay({
        accountId: "account-123",
        parsedAction: {
          action: "create_promise_to_pay",
          fields: {
            amount: "50000",
            dueDate: "2026-09-01",
          },
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "create_promise_to_pay",
        success: false,
        reply: "Failed to create promise to pay.",
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });
  });

  it("rejects an action that is not a promise-to-pay action", async () => {
    const result = await handlePromiseToPay({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {},
        missingFields: [],
      },
    });

    expect(result).toEqual({
      action: "read_account",
      success: false,
      reply: "The promise-to-pay request could not be completed.",
    });

    expect(mockedGetPromisesToPay).not.toHaveBeenCalled();
    expect(mockedCreatePromiseToPay).not.toHaveBeenCalled();
    expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
  });
});
