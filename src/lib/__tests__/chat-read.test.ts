import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAccount } from "@/lib/account/services/account-get";
import { handleReadAccountHolder } from "@/lib/chat/handlers/chat-read";

import type { AccountContext } from "@/lib/account/types";

vi.mock("@/lib/account/services/account-get", () => ({
  getAccount: vi.fn(),
}));

const mockedGetAccount = vi.mocked(getAccount);

const accountContext: AccountContext = {
  account: {
    accountId: "account-123",
    accountHolderFirstName: "Anna",
    accountHolderLastName: "Rychkova",
    email: "anna@example.com",
    phone: "+353851234567",
    address: {
      line1: "1 Main Street",
      line2: "Apartment 2",
      city: "Carlow",
      postalCode: "R93TEST",
      country: "Ireland",
    },
    preferredContactMethod: "email",
    reference: "REF-123",
    creditorName: "Example Creditor",
    currency: "EUR",
    balanceCents: 10000,
    status: "overdue",
    daysPastDue: 10,
    minimumPaymentCents: 1000,
    lastPaymentDate: "2026-07-01",
    lastPaymentAmountCents: 2000,
  },
  billing: {
    currentAmountCents: 10000,
    lastStatementAmountCents: 12000,
    dueDate: "2026-08-10",
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
    supportPhone: "+353100000000",
    supportEmail: "support@example.com",
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

describe("handleReadAccountHolder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAccount.mockResolvedValue(accountContext);
  });

  it("reads the account-holder full name using fullName", async () => {
    const result = await handleReadAccountHolder({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "fullName",
        },
        missingFields: [],
      },
    });

    expect(mockedGetAccount).toHaveBeenCalledOnce();
    expect(mockedGetAccount).toHaveBeenCalledWith("account-123");

    expect(result).toMatchObject({
      action: "read_account",
      success: true,
      reply: "The account-holder name is Anna Rychkova.",
    });
  });

  it("reads the account-holder full name using name", async () => {
    const result = await handleReadAccountHolder({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "name",
        },
        missingFields: [],
      },
    });

    expect(result).toMatchObject({
      action: "read_account",
      success: true,
      reply: "The account-holder name is Anna Rychkova.",
    });
  });

  it("reads the account-holder first name", async () => {
    const result = await handleReadAccountHolder({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "firstName",
        },
        missingFields: [],
      },
    });

    expect(result).toMatchObject({
      action: "read_account",
      success: true,
      reply: "The first name on your account is Anna.",
    });
  });

  it("reads the account-holder last name", async () => {
    const result = await handleReadAccountHolder({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "lastName",
        },
        missingFields: [],
      },
    });

    expect(result).toMatchObject({
      action: "read_account",
      success: true,
      reply: "The last name on your account is Rychkova.",
    });
  });

  it("reads the account-holder email address", async () => {
    const result = await handleReadAccountHolder({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "email",
        },
        missingFields: [],
      },
    });

    expect(result).toMatchObject({
      action: "read_account",
      success: true,
      reply: "The email address on your account is anna@example.com.",
    });
  });

  it("reads the account-holder phone number", async () => {
    const result = await handleReadAccountHolder({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "phone",
        },
        missingFields: [],
      },
    });

    expect(result).toMatchObject({
      action: "read_account",
      success: true,
      reply: "The phone number on your account is +353851234567.",
    });
  });

  it("reads the preferred contact method", async () => {
    const result = await handleReadAccountHolder({
      accountId: "account-123",
      parsedAction: {
        action: "read_preferred_contact_method",
        fields: {},
        missingFields: [],
      },
    });

    expect(result).toMatchObject({
      action: "read_preferred_contact_method",
      success: true,
      reply: "Your preferred contact method is email.",
    });
  });

  it("reads the preferred contact method through read_account", async () => {
    const result = await handleReadAccountHolder({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "preferredContactMethod",
        },
        missingFields: [],
      },
    });

    expect(result).toMatchObject({
      action: "read_account",
      success: true,
      reply: "Your preferred contact method is email.",
    });
  });

  it("reads the full postal address", async () => {
    const result = await handleReadAccountHolder({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "address",
        },
        missingFields: [],
      },
    });

    expect(result).toMatchObject({
      action: "read_account",
      success: true,
      reply:
        "The address on your account is 1 Main Street, Apartment 2, Carlow, R93TEST, Ireland.",
    });
  });

  it("reads the first address line", async () => {
    const result = await handleReadAccountHolder({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "addressLine1",
        },
        missingFields: [],
      },
    });

    expect(result.reply).toBe(
      "The first address line on your account is 1 Main Street.",
    );
  });

  it("reads the second address line", async () => {
    const result = await handleReadAccountHolder({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "addressLine2",
        },
        missingFields: [],
      },
    });

    expect(result.reply).toBe(
      "The second address line on your account is Apartment 2.",
    );
  });

  it("reads the account-holder city", async () => {
    const result = await handleReadAccountHolder({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "city",
        },
        missingFields: [],
      },
    });

    expect(result.reply).toBe("The city on your account is Carlow.");
  });

  it("reads the account-holder postal code", async () => {
    const result = await handleReadAccountHolder({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "postalCode",
        },
        missingFields: [],
      },
    });

    expect(result.reply).toBe("The postal code on your account is R93TEST.");
  });

  it("reads the account-holder country", async () => {
    const result = await handleReadAccountHolder({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "country",
        },
        missingFields: [],
      },
    });

    expect(result.reply).toBe("The country on your account is Ireland.");
  });

  it("asks which detail should be displayed when the field is missing", async () => {
    const result = await handleReadAccountHolder({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {},
        missingFields: [],
      },
    });

    expect(result).toMatchObject({
      action: "read_account",
      success: true,
    });

    expect(result.reply).toContain(
      "Which account detail would you like to view?",
    );
  });

  it("returns the service error when the account cannot be loaded", async () => {
    mockedGetAccount.mockRejectedValueOnce(new Error("Account not found."));

    const result = await handleReadAccountHolder({
      accountId: "missing-account",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "email",
        },
        missingFields: [],
      },
    });

    expect(result).toEqual({
      action: "read_account",
      success: false,
      reply: "Account not found.",
    });
  });
});
