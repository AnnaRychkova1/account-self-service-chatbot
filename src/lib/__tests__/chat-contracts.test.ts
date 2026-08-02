import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeChatAction } from "@/lib/chat/actions";
import { updateAccountHolder } from "@/lib/account/services/account-update";
import { addRelatedPerson } from "@/lib/account/services/related-people";
import { createPromiseToPay } from "@/lib/account/services/promise-to-pay";
import { processMockPayment } from "@/lib/account/services/payment";
import { createCallAppointment } from "@/lib/account/services/call-appointment";
import { sendAccountChangeNotification } from "@/lib/notifications/account-change-notification";

import type { AccountContext } from "@/lib/account/types";

vi.mock("@/lib/account/services/account-update", () => ({
  updateAccountHolder: vi.fn(),
}));

vi.mock("@/lib/account/services/related-people", () => ({
  addRelatedPerson: vi.fn(),
  updateRelatedPerson: vi.fn(),
  removeRelatedPerson: vi.fn(),
  getRelatedPeople: vi.fn(),
}));

vi.mock("@/lib/account/services/promise-to-pay", () => ({
  createPromiseToPay: vi.fn(),
  getPromisesToPay: vi.fn(),
}));

vi.mock("@/lib/account/services/payment", () => ({
  processMockPayment: vi.fn(),
  getTransactions: vi.fn(),
}));

vi.mock("@/lib/account/services/call-appointment", () => ({
  createCallAppointment: vi.fn(),
  getCallAppointments: vi.fn(),
}));

vi.mock("@/lib/notifications/account-change-notification", () => ({
  sendAccountChangeNotification: vi.fn(),
}));

const mockedUpdateAccountHolder = vi.mocked(updateAccountHolder);
const mockedAddRelatedPerson = vi.mocked(addRelatedPerson);
const mockedCreatePromiseToPay = vi.mocked(createPromiseToPay);
const mockedProcessMockPayment = vi.mocked(processMockPayment);
const mockedCreateCallAppointment = vi.mocked(createCallAppointment);
const mockedSendNotification = vi.mocked(sendAccountChangeNotification);

const accountId = "account-123";

const accountContext: AccountContext = {
  account: {
    accountId: "account-123",
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
  relatedPeople: [],
  promisesToPay: [],
  transactions: [],
  callAppointments: [],
  notificationRules: {
    sendEmailOnDataChange: true,
    pdfPasswordSource: "account_phone_last4",
  },
};

describe("chat action acceptance contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedSendNotification.mockResolvedValue({
      notificationId: "notification-123",
      sent: true,
      redactedRecipient: "a***@example.com",
    });
  });
  it("updates the account holder phone number and queues a redacted notification", async () => {
    mockedUpdateAccountHolder.mockResolvedValue({
      ...accountContext,
      account: {
        ...accountContext.account,
        phone: "+353831112233",
      },
    });

    const result = await executeChatAction({
      accountId,
      parsedAction: {
        action: "update_account_holder",
        fields: {
          phone: "+353831112233",
        },
        missingFields: [],
      },
    });

    expect(mockedUpdateAccountHolder).toHaveBeenCalledWith(accountId, {
      phone: "+353831112233",
    });

    expect(mockedSendNotification).toHaveBeenCalledOnce();

    expect(result).toMatchObject({
      action: "update_account_holder",
      success: true,
      notificationQueued: true,
    });
  });

  it("adds an authorized related person with name, email, and phone", async () => {
    const updatedAccount = {
      ...accountContext,
      relatedPeople: [
        {
          id: "person-123",
          name: "Mark Murphy",
          email: "mark@example.test",
          phone: "+353831998877",
          authorizedToAct: true,
        },
      ],
    };

    mockedAddRelatedPerson.mockResolvedValue(updatedAccount);

    const result = await executeChatAction({
      accountId,
      parsedAction: {
        action: "add_related_person",
        fields: {
          name: "Mark Murphy",
          email: "mark@example.test",
          phone: "+353831998877",
          authorizedToAct: "true",
        },
        missingFields: [],
      },
    });

    expect(result).toMatchObject({
      action: "add_related_person",
      success: true,
      notificationQueued: true,
    });

    expect(mockedAddRelatedPerson).toHaveBeenCalledOnce();
    expect(mockedSendNotification).toHaveBeenCalledOnce();
  });

  it("completes a pending action from details supplied in a follow-up turn", async () => {
    const firstResult = await executeChatAction({
      accountId,
      parsedAction: {
        action: "add_related_person",
        fields: {
          relationship: "brother",
          authorizedToAct: "true",
        },
        missingFields: ["name", "email", "phone"],
      },
    });

    expect(firstResult.success).toBe(false);
    expect(firstResult.pendingAction).toBeDefined();
    expect(firstResult.missingFields).toEqual(["name", "email", "phone"]);

    const updatedAccount = {
      ...accountContext,
      relatedPeople: [
        {
          id: "person-123",
          name: "Mark Murphy",
          email: "mark@example.test",
          phone: "+353831998877",
          relationship: "brother",
          authorizedToAct: true,
        },
      ],
    };

    mockedAddRelatedPerson.mockResolvedValue(updatedAccount);

    const secondResult = await executeChatAction({
      accountId,
      parsedAction: {
        action: "add_related_person",
        fields: {
          relationship: "brother",
          authorizedToAct: "true",
          name: "Mark Murphy",
          email: "mark@example.test",
          phone: "+353831998877",
        },
        missingFields: [],
      },
    });

    expect(secondResult.success).toBe(true);
    expect(mockedAddRelatedPerson).toHaveBeenCalledOnce();
  });

  it("records a one-time promise to pay with amount and future due date", async () => {
    const updatedAccount: AccountContext = {
      ...accountContext,
      promisesToPay: [
        {
          id: "promise-123",
          amountCents: 50000,
          currency: "EUR",
          dueDate: "2026-09-01",
          status: "active",
          createdAt: "2026-08-02T10:00:00.000Z",
        },
      ],
    };

    mockedCreatePromiseToPay.mockResolvedValue(updatedAccount);

    const result = await executeChatAction({
      accountId,
      parsedAction: {
        action: "create_promise_to_pay",
        fields: {
          amount: "50000",
          dueDate: "2026-09-01",
        },
        missingFields: [],
      },
    });

    expect(mockedCreatePromiseToPay).toHaveBeenCalledWith(accountId, {
      amountCents: 50000,
      dueDate: "2026-09-01",
    });

    expect(result).toMatchObject({
      action: "create_promise_to_pay",
      success: true,
      notificationQueued: true,
    });
  });

  it("records a mocked payment transaction and deducts it from balance", async () => {
    mockedProcessMockPayment.mockResolvedValue({
      payment: {
        transactionId: "transaction-123",
        newBalanceCents: 85000,
        duplicate: false,
      },
      account: {
        ...accountContext,
        account: {
          ...accountContext.account,
          balanceCents: 85000,
        },
        transactions: [
          {
            id: "transaction-123",
            type: "payment",
            status: "completed",
            amountCents: 15000,
            currency: "EUR",
            description: "Mock payment",
            transactionDate: "2026-08-02",
          },
        ],
      },
    });

    const result = await executeChatAction({
      accountId,
      requestId: "request-123",
      parsedAction: {
        action: "mock_payment",
        fields: {
          amount: "15000",
        },
        missingFields: [],
      },
    });

    expect(mockedProcessMockPayment).toHaveBeenCalledWith(accountId, {
      amountCents: 15000,
      requestId: "request-123",
    });

    expect(result.success).toBe(true);
    expect(result.account?.account.balanceCents).toBe(85000);
    expect(result.transaction?.amountCents).toBe(15000);
    expect(result.notificationQueued).toBe(true);
  });

  it("books a future call appointment and rejects dates in the past", async () => {
    const futureDate = "2026-08-10T10:00:00.000Z";

    mockedCreateCallAppointment.mockResolvedValueOnce({
      ...accountContext,
      callAppointments: [
        {
          id: "appointment-123",
          scheduledAt: futureDate,
          phone: "+353851234567",
          reason: "bill",
          status: "scheduled",
        },
      ],
    });

    const successResult = await executeChatAction({
      accountId,
      parsedAction: {
        action: "book_call_appointment",
        fields: {
          scheduledAt: futureDate,
          reason: "bill",
        },
        missingFields: [],
      },
    });

    expect(successResult).toMatchObject({
      action: "book_call_appointment",
      success: true,
      notificationQueued: true,
    });

    mockedCreateCallAppointment.mockRejectedValueOnce(
      new Error(
        "Call appointment must be scheduled for a future date and time.",
      ),
    );

    const pastResult = await executeChatAction({
      accountId,
      parsedAction: {
        action: "book_call_appointment",
        fields: {
          scheduledAt: "2026-07-01T10:00:00.000Z",
        },
        missingFields: [],
      },
    });

    expect(pastResult).toMatchObject({
      action: "book_call_appointment",
      success: false,
      missingFields: ["scheduledAt"],
    });

    expect(pastResult.pendingAction).toBeDefined();
  });
});
