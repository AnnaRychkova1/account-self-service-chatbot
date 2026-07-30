import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateAccountHolder } from "@/lib/account/services/account-update";
import { handleUpdateAccountHolder } from "@/lib/chat/handlers/chat-update";

import type {
  AccountContext,
  UpdateAccountHolderInput,
} from "@/lib/account/types";
import type { ChatAction, ParsedAction } from "@/lib/chat/types";

vi.mock("@/lib/account/services/account-update", () => ({
  updateAccountHolder: vi.fn(),
}));

const mockedUpdateAccountHolder = vi.mocked(updateAccountHolder);

const updatedAccountContext: AccountContext = {
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

function createParsedAction({
  action = "update_account_holder",
  fields = {},
  missingFields = [],
}: {
  action?: ChatAction;
  fields?: Record<string, string>;
  missingFields?: string[];
} = {}): ParsedAction {
  return {
    action,
    fields,
    missingFields,
  };
}

describe("handleUpdateAccountHolder", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedUpdateAccountHolder.mockResolvedValue(updatedAccountContext);
  });

  describe("account-holder field updates", () => {
    it.each<{
      description: string;
      fields: Record<string, string>;
      expectedUpdate: UpdateAccountHolderInput;
    }>([
      {
        description: "first name",
        fields: {
          firstName: "Maria",
        },
        expectedUpdate: {
          accountHolderFirstName: "Maria",
        },
      },
      {
        description: "last name",
        fields: {
          lastName: "Smith",
        },
        expectedUpdate: {
          accountHolderLastName: "Smith",
        },
      },
      {
        description: "email address",
        fields: {
          email: "maria@example.com",
        },
        expectedUpdate: {
          email: "maria@example.com",
        },
      },
      {
        description: "phone number",
        fields: {
          phone: "+353851112222",
        },
        expectedUpdate: {
          phone: "+353851112222",
        },
      },
    ])("updates the $description", async ({ fields, expectedUpdate }) => {
      const result = await handleUpdateAccountHolder({
        accountId: "account-123",
        parsedAction: createParsedAction({
          fields,
        }),
      });

      expect(mockedUpdateAccountHolder).toHaveBeenCalledOnce();

      expect(mockedUpdateAccountHolder).toHaveBeenCalledWith(
        "account-123",
        expectedUpdate,
      );

      expect(result).toEqual({
        action: "update_account_holder",
        success: true,
        reply: "Your account information has been updated successfully.",
        account: updatedAccountContext,
        notificationQueued: false,
      });
    });

    it("updates multiple account-holder fields in one request", async () => {
      const result = await handleUpdateAccountHolder({
        accountId: "account-123",
        parsedAction: createParsedAction({
          fields: {
            firstName: "Maria",
            lastName: "Smith",
            email: "maria@example.com",
            phone: "+353851112222",
          },
        }),
      });

      expect(mockedUpdateAccountHolder).toHaveBeenCalledWith("account-123", {
        accountHolderFirstName: "Maria",
        accountHolderLastName: "Smith",
        email: "maria@example.com",
        phone: "+353851112222",
      });

      expect(result).toMatchObject({
        action: "update_account_holder",
        success: true,
        reply: "Your account information has been updated successfully.",
        account: updatedAccountContext,
        notificationQueued: false,
      });
    });
  });

  describe("address updates", () => {
    it.each<{
      description: string;
      fields: Record<string, string>;
      expectedAddress: UpdateAccountHolderInput["address"];
    }>([
      {
        description: "first address line",
        fields: {
          addressLine1: "20 High Street",
        },
        expectedAddress: {
          line1: "20 High Street",
        },
      },
      {
        description: "second address line",
        fields: {
          addressLine2: "Flat 4",
        },
        expectedAddress: {
          line2: "Flat 4",
        },
      },
      {
        description: "city",
        fields: {
          city: "Cork",
        },
        expectedAddress: {
          city: "Cork",
        },
      },
      {
        description: "postal code",
        fields: {
          postalCode: "T12TEST",
        },
        expectedAddress: {
          postalCode: "T12TEST",
        },
      },
      {
        description: "country",
        fields: {
          country: "Ireland",
        },
        expectedAddress: {
          country: "Ireland",
        },
      },
    ])(
      "supports a partial update of the $description",
      async ({ fields, expectedAddress }) => {
        const result = await handleUpdateAccountHolder({
          accountId: "account-123",
          parsedAction: createParsedAction({
            fields,
          }),
        });

        expect(mockedUpdateAccountHolder).toHaveBeenCalledWith("account-123", {
          address: expectedAddress,
        });

        expect(result).toMatchObject({
          action: "update_account_holder",
          success: true,
          notificationQueued: false,
        });
      },
    );

    it("updates the complete postal address", async () => {
      const result = await handleUpdateAccountHolder({
        accountId: "account-123",
        parsedAction: createParsedAction({
          fields: {
            addressLine1: "20 High Street",
            addressLine2: "Flat 4",
            city: "Cork",
            postalCode: "T12TEST",
            country: "Ireland",
          },
        }),
      });

      expect(mockedUpdateAccountHolder).toHaveBeenCalledWith("account-123", {
        address: {
          line1: "20 High Street",
          line2: "Flat 4",
          city: "Cork",
          postalCode: "T12TEST",
          country: "Ireland",
        },
      });

      expect(result).toEqual({
        action: "update_account_holder",
        success: true,
        reply: "Your account information has been updated successfully.",
        account: updatedAccountContext,
        notificationQueued: false,
      });
    });

    it("updates account details and address fields together", async () => {
      await handleUpdateAccountHolder({
        accountId: "account-123",
        parsedAction: createParsedAction({
          fields: {
            email: "new@example.com",
            phone: "+353859999999",
            city: "Dublin",
            postalCode: "D01TEST",
          },
        }),
      });

      expect(mockedUpdateAccountHolder).toHaveBeenCalledWith("account-123", {
        email: "new@example.com",
        phone: "+353859999999",
        address: {
          city: "Dublin",
          postalCode: "D01TEST",
        },
      });
    });
  });

  describe("preferred contact method updates", () => {
    it.each(["email", "sms", "phone"])(
      "updates the preferred contact method to %s",
      async (preferredContactMethod) => {
        const result = await handleUpdateAccountHolder({
          accountId: "account-123",
          parsedAction: createParsedAction({
            action: "update_preferred_contact_method",
            fields: {
              preferredContactMethod,
            },
          }),
        });

        expect(mockedUpdateAccountHolder).toHaveBeenCalledWith("account-123", {
          preferredContactMethod,
        });

        expect(result).toEqual({
          action: "update_preferred_contact_method",
          success: true,
          reply: `Your preferred contact method has been updated to ${preferredContactMethod}.`,
          account: updatedAccountContext,
          notificationQueued: false,
        });
      },
    );

    it("normalizes an uppercase preferred contact method", async () => {
      const result = await handleUpdateAccountHolder({
        accountId: "account-123",
        parsedAction: createParsedAction({
          action: "update_preferred_contact_method",
          fields: {
            preferredContactMethod: "SMS",
          },
        }),
      });

      expect(mockedUpdateAccountHolder).toHaveBeenCalledWith("account-123", {
        preferredContactMethod: "sms",
      });

      expect(result).toMatchObject({
        action: "update_preferred_contact_method",
        success: true,
        reply: "Your preferred contact method has been updated to sms.",
      });
    });

    it("supports preferred contact method inside update_account_holder", async () => {
      const result = await handleUpdateAccountHolder({
        accountId: "account-123",
        parsedAction: createParsedAction({
          action: "update_account_holder",
          fields: {
            preferredContactMethod: "phone",
          },
        }),
      });

      expect(mockedUpdateAccountHolder).toHaveBeenCalledWith("account-123", {
        preferredContactMethod: "phone",
      });

      expect(result).toMatchObject({
        action: "update_account_holder",
        success: true,
        reply: "Your account information has been updated successfully.",
      });
    });

    it("rejects an invalid preferred contact method", async () => {
      const result = await handleUpdateAccountHolder({
        accountId: "account-123",
        parsedAction: createParsedAction({
          action: "update_preferred_contact_method",
          fields: {
            preferredContactMethod: "letter",
          },
        }),
      });

      expect(mockedUpdateAccountHolder).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "update_preferred_contact_method",
        success: false,
        reply: "Preferred contact method must be email, SMS, or phone.",
      });
    });
  });

  describe("missing fields", () => {
    it.each<{
      missingFields: string[];
      expectedReply: string;
    }>([
      {
        missingFields: ["phone"],
        expectedReply: "What phone number would you like to use?",
      },
      {
        missingFields: ["email"],
        expectedReply: "What email address would you like to use?",
      },
      {
        missingFields: ["firstName"],
        expectedReply: "What first and last name would you like to use?",
      },
      {
        missingFields: ["lastName"],
        expectedReply: "What first and last name would you like to use?",
      },
      {
        missingFields: ["addressLine1"],
        expectedReply: "What street address would you like to use?",
      },
      {
        missingFields: ["addressLine2"],
        expectedReply:
          "What additional address information would you like to use?",
      },
      {
        missingFields: ["city"],
        expectedReply: "What city would you like to use?",
      },
      {
        missingFields: ["postalCode"],
        expectedReply: "What postal code would you like to use?",
      },
      {
        missingFields: ["country"],
        expectedReply: "What country would you like to use?",
      },
      {
        missingFields: ["preferredContactMethod"],
        expectedReply:
          "Which contact method would you prefer: email, SMS, or phone?",
      },
    ])(
      "asks for $missingFields when it is missing",
      async ({ missingFields, expectedReply }) => {
        const result = await handleUpdateAccountHolder({
          accountId: "account-123",
          parsedAction: createParsedAction({
            missingFields,
          }),
        });

        expect(mockedUpdateAccountHolder).not.toHaveBeenCalled();

        expect(result).toEqual({
          action: "update_account_holder",
          success: false,
          reply: expectedReply,
        });
      },
    );

    it("uses the first matching missing-field reply", async () => {
      const result = await handleUpdateAccountHolder({
        accountId: "account-123",
        parsedAction: createParsedAction({
          missingFields: ["email", "phone", "city"],
        }),
      });

      expect(mockedUpdateAccountHolder).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "update_account_holder",
        success: false,
        reply: "What phone number would you like to use?",
      });
    });

    it("preserves the preferred-contact action when its field is missing", async () => {
      const result = await handleUpdateAccountHolder({
        accountId: "account-123",
        parsedAction: createParsedAction({
          action: "update_preferred_contact_method",
          missingFields: ["preferredContactMethod"],
        }),
      });

      expect(mockedUpdateAccountHolder).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "update_preferred_contact_method",
        success: false,
        reply: "Which contact method would you prefer: email, SMS, or phone?",
      });
    });
  });

  describe("empty update requests", () => {
    it("asks which account-holder information should be updated", async () => {
      const result = await handleUpdateAccountHolder({
        accountId: "account-123",
        parsedAction: createParsedAction(),
      });

      expect(mockedUpdateAccountHolder).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "update_account_holder",
        success: false,
        reply:
          "What account-holder information would you like to update? You can change your name, email, phone number, address, or preferred contact method.",
      });
    });

    it("asks for the contact method for an empty preferred-contact request", async () => {
      const result = await handleUpdateAccountHolder({
        accountId: "account-123",
        parsedAction: createParsedAction({
          action: "update_preferred_contact_method",
        }),
      });

      expect(mockedUpdateAccountHolder).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "update_preferred_contact_method",
        success: false,
        reply: "Which contact method would you prefer: email, SMS, or phone?",
      });
    });
  });

  describe("service errors", () => {
    it("returns the service error when the update fails", async () => {
      mockedUpdateAccountHolder.mockRejectedValueOnce(
        new Error("Account not found."),
      );

      const result = await handleUpdateAccountHolder({
        accountId: "missing-account",
        parsedAction: createParsedAction({
          fields: {
            phone: "+353851234567",
          },
        }),
      });

      expect(mockedUpdateAccountHolder).toHaveBeenCalledWith(
        "missing-account",
        {
          phone: "+353851234567",
        },
      );

      expect(result).toEqual({
        action: "update_account_holder",
        success: false,
        reply: "Account not found.",
      });
    });

    it("returns a fallback message for a non-Error rejection", async () => {
      mockedUpdateAccountHolder.mockRejectedValueOnce(
        "Unexpected service failure",
      );

      const result = await handleUpdateAccountHolder({
        accountId: "account-123",
        parsedAction: createParsedAction({
          fields: {
            email: "new@example.com",
          },
        }),
      });

      expect(result).toEqual({
        action: "update_account_holder",
        success: false,
        reply: "The request could not be completed.",
      });
    });

    it("preserves the preferred-contact action when the service fails", async () => {
      mockedUpdateAccountHolder.mockRejectedValueOnce(
        new Error("Account update failed."),
      );

      const result = await handleUpdateAccountHolder({
        accountId: "account-123",
        parsedAction: createParsedAction({
          action: "update_preferred_contact_method",
          fields: {
            preferredContactMethod: "phone",
          },
        }),
      });

      expect(result).toEqual({
        action: "update_preferred_contact_method",
        success: false,
        reply: "Account update failed.",
      });
    });
  });
});
