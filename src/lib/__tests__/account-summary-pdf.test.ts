import { describe, expect, it } from "vitest";

import {
  generateEncryptedAccountSummaryPdf,
  getAccountPdfPassword,
} from "@/lib/notifications/account-summary-pdf";

import type { AccountContext } from "@/lib/account/types";

const accountContext: AccountContext = {
  account: {
    accountId: "account-123",
    accountHolderFirstName: "Anna",
    accountHolderLastName: "Rychkova",
    email: "anna@example.com",
    phone: "+353831234567",
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
  relatedPeople: [
    {
      id: "person-1",
      name: "John Murphy",
      email: "john@example.com",
      phone: "+353851112233",
      relationship: "brother",
      authorizedToAct: true,
    },
  ],
  promisesToPay: [
    {
      id: "promise-1",
      amountCents: 50000,
      currency: "EUR",
      dueDate: "2026-09-01",
      status: "active",
      createdAt: "2026-08-02T10:00:00.000Z",
    },
  ],
  transactions: [
    {
      id: "transaction-1",
      type: "payment",
      status: "completed",
      amountCents: 15000,
      currency: "EUR",
      description: "Mock payment",
      transactionDate: "2026-08-02",
    },
  ],
  callAppointments: [
    {
      id: "appointment-1",
      scheduledAt: "2026-08-10T10:00:00.000Z",
      phone: "+353851234567",
      reason: "Discuss balance",
      status: "scheduled",
    },
  ],
  notificationRules: {
    sendEmailOnDataChange: true,
    pdfPasswordSource: "account_phone_last4",
  },
};

describe("account summary PDF", () => {
  describe("getAccountPdfPassword", () => {
    it("uses the last four digits of the current account phone number", () => {
      expect(getAccountPdfPassword(accountContext)).toBe("4567");
    });

    it("ignores non-digit characters in the phone number", () => {
      const context: AccountContext = {
        ...accountContext,
        account: {
          ...accountContext.account,
          phone: "+353 83 123 9876",
        },
      };

      expect(getAccountPdfPassword(context)).toBe("9876");
    });

    it("rejects a phone number with fewer than four digits", () => {
      const context: AccountContext = {
        ...accountContext,
        account: {
          ...accountContext.account,
          phone: "+12",
        },
      };

      expect(() => getAccountPdfPassword(context)).toThrow(
        "Account phone number cannot be used as the PDF password.",
      );
    });
  });

  describe("generateEncryptedAccountSummaryPdf", () => {
    it("generates a non-empty PDF buffer", async () => {
      const pdf = await generateEncryptedAccountSummaryPdf(accountContext);

      expect(Buffer.isBuffer(pdf)).toBe(true);
      expect(pdf.length).toBeGreaterThan(0);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    });

    it("generates a PDF when optional account collections are empty", async () => {
      const context: AccountContext = {
        ...accountContext,
        relatedPeople: [],
        promisesToPay: [],
        transactions: [],
        callAppointments: [],
      };

      const pdf = await generateEncryptedAccountSummaryPdf(context);

      expect(Buffer.isBuffer(pdf)).toBe(true);
      expect(pdf.length).toBeGreaterThan(0);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    });

    it("rejects PDF generation when the phone cannot provide a password", async () => {
      const context: AccountContext = {
        ...accountContext,
        account: {
          ...accountContext.account,
          phone: "123",
        },
      };

      await expect(generateEncryptedAccountSummaryPdf(context)).rejects.toThrow(
        "Account phone number cannot be used as the PDF password.",
      );
    });
  });
});
