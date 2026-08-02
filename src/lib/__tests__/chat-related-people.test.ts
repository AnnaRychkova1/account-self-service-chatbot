import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addRelatedPerson,
  getRelatedPeople,
  removeRelatedPerson,
  updateRelatedPerson,
} from "@/lib/account/services/related-people";
import { handleRelatedPeople } from "@/lib/chat/handlers/chat-related-people";
import { sendAccountChangeNotification } from "@/lib/notifications/account-change-notification";

import type { AccountContext, RelatedPersonRow } from "@/lib/account/types";

vi.mock("@/lib/account/services/related-people", () => ({
  addRelatedPerson: vi.fn(),
  getRelatedPeople: vi.fn(),
  removeRelatedPerson: vi.fn(),
  updateRelatedPerson: vi.fn(),
}));

vi.mock("@/lib/notifications/account-change-notification", () => ({
  sendAccountChangeNotification: vi.fn(),
}));

const mockedAddRelatedPerson = vi.mocked(addRelatedPerson);
const mockedGetRelatedPeople = vi.mocked(getRelatedPeople);
const mockedRemoveRelatedPerson = vi.mocked(removeRelatedPerson);
const mockedUpdateRelatedPerson = vi.mocked(updateRelatedPerson);
const mockedSendAccountChangeNotification = vi.mocked(
  sendAccountChangeNotification,
);

const relatedPersonRows: RelatedPersonRow[] = [
  {
    id: "person-1",
    account_holder_id: "holder-1",
    name: "Mark Murphy",
    email: "mark@example.test",
    phone: "+353831998877",
    relationship: "brother",
    authorized_to_act: true,
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-01T10:00:00.000Z",
  },
  {
    id: "person-2",
    account_holder_id: "holder-1",
    name: "Sarah Collins",
    email: "sarah@example.test",
    phone: "+353831998866",
    relationship: null,
    authorized_to_act: false,
    created_at: "2026-07-02T10:00:00.000Z",
    updated_at: "2026-07-02T10:00:00.000Z",
  },
];

const accountContext: AccountContext = {
  account: {
    accountId: "account-123",
    accountHolderFirstName: "Jane",
    accountHolderLastName: "Collins",
    email: "jane@example.test",
    phone: "+353831112233",
    address: {
      line1: "1 Main Street",
      city: "Carlow",
      postalCode: "R93 TEST",
      country: "Ireland",
    },
    preferredContactMethod: "email",
    reference: "REF-123",
    creditorName: "Example Creditor",
    currency: "EUR",
    balanceCents: 100_000,
    status: "overdue",
    daysPastDue: 20,
    minimumPaymentCents: 2_000,
    lastPaymentDate: "2026-06-01",
    lastPaymentAmountCents: 5_000,
  },
  billing: {
    currentAmountCents: 100_000,
    lastStatementAmountCents: 100_000,
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
  relatedPeople: [
    {
      id: "person-1",
      name: "Mark Murphy",
      email: "mark@example.test",
      phone: "+353831998877",
      relationship: "brother",
      authorizedToAct: true,
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

describe("handleRelatedPeople", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedGetRelatedPeople.mockResolvedValue(relatedPersonRows);
    mockedAddRelatedPerson.mockResolvedValue(accountContext);
    mockedUpdateRelatedPerson.mockResolvedValue(accountContext);
    mockedRemoveRelatedPerson.mockResolvedValue(accountContext);
    mockedSendAccountChangeNotification.mockResolvedValue({
      notificationId: "notification-1",
      sent: true,
      redactedRecipient: "j***@example.test",
    });
  });

  describe("read_related_people", () => {
    it("returns all related people", async () => {
      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "read_related_people",
          fields: {},
          missingFields: [],
        },
      });

      expect(mockedGetRelatedPeople).toHaveBeenCalledWith("account-123");

      expect(result).toEqual({
        action: "read_related_people",
        success: true,
        reply:
          "The related people on your account are: Mark Murphy, relationship: brother, email: mark@example.test, phone: +353831998877, authorized to act; Sarah Collins, email: sarah@example.test, phone: +353831998866, not authorized to act.",
        relatedPeople: [
          {
            id: "person-1",
            name: "Mark Murphy",
            email: "mark@example.test",
            phone: "+353831998877",
            relationship: "brother",
            authorizedToAct: true,
          },
          {
            id: "person-2",
            name: "Sarah Collins",
            email: "sarah@example.test",
            phone: "+353831998866",
            relationship: undefined,
            authorizedToAct: false,
          },
        ],
      });
    });

    it("returns an empty result when no related people exist", async () => {
      mockedGetRelatedPeople.mockResolvedValueOnce([]);

      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "read_related_people",
          fields: {},
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "read_related_people",
        success: true,
        reply: "There are no related people on your account.",
        relatedPeople: [],
      });
    });

    it("returns the service error when related people cannot be loaded", async () => {
      mockedGetRelatedPeople.mockRejectedValueOnce(
        new Error("Failed to load related people."),
      );

      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "read_related_people",
          fields: {},
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "read_related_people",
        success: false,
        reply: "Failed to load related people.",
      });
    });

    it("does not send a notification when reading related people", async () => {
      await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "read_related_people",
          fields: {},
          missingFields: [],
        },
      });

      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });
  });

  describe("add_related_person", () => {
    it("adds an authorized related person", async () => {
      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "add_related_person",
          fields: {
            name: "Mark Murphy",
            email: "mark@example.test",
            phone: "+353831998877",
            relationship: "brother",
            authorizedToAct: "true",
          },
          missingFields: [],
        },
      });

      expect(mockedAddRelatedPerson).toHaveBeenCalledWith("account-123", {
        name: "Mark Murphy",
        email: "mark@example.test",
        phone: "+353831998877",
        relationship: "brother",
        authorizedToAct: true,
      });

      expect(mockedSendAccountChangeNotification).toHaveBeenCalledWith({
        accountId: "account-123",
        changedBy: "account_holder",
        changeSummary: "related_person_added",
        accountSnapshot: accountContext,
      });

      expect(result).toEqual({
        action: "add_related_person",
        success: true,
        reply: "Mark Murphy has been added as a related person.",
        account: accountContext,
        relatedPeople: accountContext.relatedPeople,
        notificationQueued: true,
      });
    });

    it("keeps add successful when notification delivery fails", async () => {
      mockedSendAccountChangeNotification.mockRejectedValueOnce(
        new Error("Notification failed."),
      );

      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "add_related_person",
          fields: {
            name: "Mark Murphy",
            email: "mark@example.test",
            phone: "+353831998877",
            relationship: "brother",
            authorizedToAct: "true",
          },
          missingFields: [],
        },
      });

      expect(mockedAddRelatedPerson).toHaveBeenCalledWith("account-123", {
        name: "Mark Murphy",
        email: "mark@example.test",
        phone: "+353831998877",
        relationship: "brother",
        authorizedToAct: true,
      });

      expect(mockedSendAccountChangeNotification).toHaveBeenCalledWith({
        accountId: "account-123",
        changedBy: "account_holder",
        changeSummary: "related_person_added",
        accountSnapshot: accountContext,
      });

      expect(result).toEqual({
        action: "add_related_person",
        success: true,
        reply: "Mark Murphy has been added as a related person.",
        account: accountContext,
        relatedPeople: accountContext.relatedPeople,
        notificationQueued: false,
      });
    });

    it("adds a related person who is not authorized to act", async () => {
      await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "add_related_person",
          fields: {
            name: "Sarah Collins",
            email: "sarah@example.test",
            phone: "+353831998866",
            authorizedToAct: "false",
          },
          missingFields: [],
        },
      });

      expect(mockedAddRelatedPerson).toHaveBeenCalledWith("account-123", {
        name: "Sarah Collins",
        email: "sarah@example.test",
        phone: "+353831998866",
        relationship: undefined,
        authorizedToAct: false,
      });
    });

    it.each([
      {
        missingFields: ["name"],
        reply: "Please provide full name.",
      },
      {
        missingFields: ["email"],
        reply: "Please provide email address.",
      },
      {
        missingFields: ["phone"],
        reply: "Please provide phone number.",
      },
      {
        missingFields: ["authorizedToAct"],
        reply:
          "Should this person be authorized to speak or act on your behalf?",
      },
    ])("asks for a missing add field", async ({ missingFields, reply }) => {
      const parsedAction = {
        action: "add_related_person" as const,
        fields: {
          relationship: "brother",
        },
        missingFields,
      };

      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction,
      });

      expect(mockedAddRelatedPerson).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "add_related_person",
        success: false,
        reply,
        missingFields,
        pendingAction: {
          action: "add_related_person",
          fields: {
            relationship: "brother",
          },
          missingFields,
        },
      });
    });

    it("rejects a missing name even when missingFields is empty", async () => {
      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "add_related_person",
          fields: {
            email: "mark@example.test",
            phone: "+353831998877",
            authorizedToAct: "true",
          },
          missingFields: [],
        },
      });

      expect(mockedAddRelatedPerson).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "add_related_person",
        success: false,
        reply: "Please provide the related person's name.",
      });
    });

    it("rejects an invalid authorization value", async () => {
      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "add_related_person",
          fields: {
            name: "Mark Murphy",
            email: "mark@example.test",
            phone: "+353831998877",
            authorizedToAct: "maybe",
          },
          missingFields: [],
        },
      });

      expect(mockedAddRelatedPerson).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "add_related_person",
        success: false,
        reply:
          "Please confirm whether the related person is authorized to act.",
      });
    });

    it("returns the service error when adding fails", async () => {
      mockedAddRelatedPerson.mockRejectedValueOnce(
        new Error("Related person could not be added."),
      );

      const result = await handleRelatedPeople({
        accountId: "account-123",
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

      expect(result).toEqual({
        action: "add_related_person",
        success: false,
        reply: "Related person could not be added.",
      });
    });
  });

  describe("update_related_person", () => {
    it("updates a uniquely matched related person", async () => {
      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "update_related_person",
          fields: {
            personName: "Mark",
            phone: "+353831112233",
          },
          missingFields: [],
        },
      });

      expect(mockedGetRelatedPeople).toHaveBeenCalledWith("account-123");

      expect(mockedUpdateRelatedPerson).toHaveBeenCalledWith(
        "account-123",
        "person-1",
        {
          phone: "+353831112233",
        },
      );

      expect(mockedSendAccountChangeNotification).toHaveBeenCalledWith({
        accountId: "account-123",
        changedBy: "account_holder",
        changeSummary: "related_person_updated",
        accountSnapshot: accountContext,
      });

      expect(result).toEqual({
        action: "update_related_person",
        success: true,
        reply: "Mark Murphy's information has been updated successfully.",
        account: accountContext,
        relatedPeople: accountContext.relatedPeople,
        notificationQueued: true,
      });
    });

    it("keeps update successful when notification delivery fails", async () => {
      mockedSendAccountChangeNotification.mockRejectedValueOnce(
        new Error("Notification failed."),
      );

      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "update_related_person",
          fields: {
            personName: "Mark",
            phone: "+353831112233",
          },
          missingFields: [],
        },
      });

      expect(mockedUpdateRelatedPerson).toHaveBeenCalledWith(
        "account-123",
        "person-1",
        {
          phone: "+353831112233",
        },
      );

      expect(mockedSendAccountChangeNotification).toHaveBeenCalledWith({
        accountId: "account-123",
        changedBy: "account_holder",
        changeSummary: "related_person_updated",
        accountSnapshot: accountContext,
      });

      expect(result).toEqual({
        action: "update_related_person",
        success: true,
        reply: "Mark Murphy's information has been updated successfully.",
        account: accountContext,
        relatedPeople: accountContext.relatedPeople,
        notificationQueued: false,
      });
    });

    it("updates all supported related-person fields", async () => {
      await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "update_related_person",
          fields: {
            personName: "Mark Murphy",
            newName: "Marcus Murphy",
            email: "marcus@example.test",
            phone: "+353831112233",
            relationship: "friend",
            authorizedToAct: "false",
          },
          missingFields: [],
        },
      });

      expect(mockedUpdateRelatedPerson).toHaveBeenCalledWith(
        "account-123",
        "person-1",
        {
          name: "Marcus Murphy",
          email: "marcus@example.test",
          phone: "+353831112233",
          relationship: "friend",
          authorizedToAct: false,
        },
      );
    });

    it("matches a related person without case sensitivity", async () => {
      await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "update_related_person",
          fields: {
            personName: "mark murphy",
            phone: "+353831112233",
          },
          missingFields: [],
        },
      });

      expect(mockedUpdateRelatedPerson).toHaveBeenCalledWith(
        "account-123",
        "person-1",
        {
          phone: "+353831112233",
        },
      );
    });

    it("asks which person should be updated when personName is missing", async () => {
      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "update_related_person",
          fields: {
            phone: "+353831112233",
          },
          missingFields: ["personName"],
        },
      });

      expect(mockedGetRelatedPeople).not.toHaveBeenCalled();
      expect(mockedUpdateRelatedPerson).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "update_related_person",
        success: false,
        reply: "Which related person would you like to update?",
        missingFields: ["personName"],
        pendingAction: {
          action: "update_related_person",
          fields: {
            phone: "+353831112233",
          },
          missingFields: ["personName"],
        },
      });
    });

    it("asks for the missing update value", async () => {
      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "update_related_person",
          fields: {
            personName: "Mark",
          },
          missingFields: ["phone"],
        },
      });

      expect(mockedGetRelatedPeople).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "update_related_person",
        success: false,
        reply: "What is the related person's phone number?",
        missingFields: ["phone"],
        pendingAction: {
          action: "update_related_person",
          fields: {
            personName: "Mark",
          },
          missingFields: ["phone"],
        },
      });
    });

    it("returns not found when no related person matches", async () => {
      mockedGetRelatedPeople.mockResolvedValueOnce([]);

      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "update_related_person",
          fields: {
            personName: "Unknown Person",
            phone: "+353831112233",
          },
          missingFields: [],
        },
      });

      expect(mockedUpdateRelatedPerson).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "update_related_person",
        success: false,
        reply: "I could not find a related person matching Unknown Person.",
      });
    });

    it("asks for a full name when multiple related people match", async () => {
      mockedGetRelatedPeople.mockResolvedValueOnce([
        relatedPersonRows[0],
        {
          ...relatedPersonRows[0],
          id: "person-3",
          name: "Mark Collins",
          email: "mark.collins@example.test",
        },
      ]);

      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "update_related_person",
          fields: {
            personName: "Mark",
            phone: "+353831112233",
          },
          missingFields: [],
        },
      });

      expect(mockedUpdateRelatedPerson).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "update_related_person",
        success: false,
        reply:
          "I found more than one related person matching Mark. Please provide the full name.",
        missingFields: ["personName"],
        pendingAction: {
          action: "update_related_person",
          fields: {
            personName: "Mark",
            phone: "+353831112233",
          },
          missingFields: ["personName"],
        },
      });
    });

    it("asks which field should be updated when no update values exist", async () => {
      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "update_related_person",
          fields: {
            personName: "Mark",
          },
          missingFields: [],
        },
      });

      expect(mockedUpdateRelatedPerson).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "update_related_person",
        success: false,
        reply: "What information would you like to update for Mark Murphy?",
        missingFields: ["relatedPersonField"],
        pendingAction: {
          action: "update_related_person",
          fields: {
            personName: "Mark",
          },
          missingFields: ["relatedPersonField"],
        },
      });
    });

    it("rejects an invalid updated authorization value", async () => {
      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "update_related_person",
          fields: {
            personName: "Mark",
            authorizedToAct: "maybe",
          },
          missingFields: [],
        },
      });

      expect(mockedUpdateRelatedPerson).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "update_related_person",
        success: false,
        reply: "Authorization status must be either true or false.",
      });
    });

    it("returns the service error when updating fails", async () => {
      mockedUpdateRelatedPerson.mockRejectedValueOnce(
        new Error("Related person update failed."),
      );

      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "update_related_person",
          fields: {
            personName: "Mark",
            phone: "+353831112233",
          },
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "update_related_person",
        success: false,
        reply: "Related person update failed.",
      });
    });
  });

  describe("remove_related_person", () => {
    it("removes a uniquely matched related person", async () => {
      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "remove_related_person",
          fields: {
            personName: "Mark",
          },
          missingFields: [],
        },
      });

      expect(mockedGetRelatedPeople).toHaveBeenCalledWith("account-123");

      expect(mockedRemoveRelatedPerson).toHaveBeenCalledWith(
        "account-123",
        "person-1",
      );

      expect(mockedSendAccountChangeNotification).toHaveBeenCalledWith({
        accountId: "account-123",
        changedBy: "account_holder",
        changeSummary: "related_person_removed",
        accountSnapshot: accountContext,
      });

      expect(result).toEqual({
        action: "remove_related_person",
        success: true,
        reply: "Mark Murphy has been removed from your related people.",
        account: accountContext,
        relatedPeople: accountContext.relatedPeople,
        notificationQueued: true,
      });
    });

    it("keeps removal successful when notification delivery fails", async () => {
      mockedSendAccountChangeNotification.mockRejectedValueOnce(
        new Error("Notification failed."),
      );

      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "remove_related_person",
          fields: {
            personName: "Mark",
          },
          missingFields: [],
        },
      });

      expect(mockedRemoveRelatedPerson).toHaveBeenCalledWith(
        "account-123",
        "person-1",
      );

      expect(mockedSendAccountChangeNotification).toHaveBeenCalledWith({
        accountId: "account-123",
        changedBy: "account_holder",
        changeSummary: "related_person_removed",
        accountSnapshot: accountContext,
      });

      expect(result).toEqual({
        action: "remove_related_person",
        success: true,
        reply: "Mark Murphy has been removed from your related people.",
        account: accountContext,
        relatedPeople: accountContext.relatedPeople,
        notificationQueued: false,
      });
    });

    it("asks which related person should be removed", async () => {
      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "remove_related_person",
          fields: {},
          missingFields: ["personName"],
        },
      });

      expect(mockedGetRelatedPeople).not.toHaveBeenCalled();
      expect(mockedRemoveRelatedPerson).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "remove_related_person",
        success: false,
        reply: "Which related person would you like to remove?",
        missingFields: ["personName"],
        pendingAction: {
          action: "remove_related_person",
          fields: {},
          missingFields: ["personName"],
        },
      });
    });

    it("returns not found when no related person matches", async () => {
      mockedGetRelatedPeople.mockResolvedValueOnce([]);

      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "remove_related_person",
          fields: {
            personName: "Unknown Person",
          },
          missingFields: [],
        },
      });

      expect(mockedRemoveRelatedPerson).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "remove_related_person",
        success: false,
        reply: "I could not find a related person matching Unknown Person.",
      });
    });

    it("asks for a full name when multiple related people match", async () => {
      mockedGetRelatedPeople.mockResolvedValueOnce([
        relatedPersonRows[0],
        {
          ...relatedPersonRows[0],
          id: "person-3",
          name: "Mark Collins",
          email: "mark.collins@example.test",
        },
      ]);

      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "remove_related_person",
          fields: {
            personName: "Mark",
          },
          missingFields: [],
        },
      });

      expect(mockedRemoveRelatedPerson).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "remove_related_person",
        success: false,
        reply:
          "I found more than one related person matching Mark. Please provide the full name.",
        missingFields: ["personName"],
        pendingAction: {
          action: "remove_related_person",
          fields: {
            personName: "Mark",
          },
          missingFields: ["personName"],
        },
      });
    });

    it("returns the service error when removing fails", async () => {
      mockedRemoveRelatedPerson.mockRejectedValueOnce(
        new Error("Related person removal failed."),
      );

      const result = await handleRelatedPeople({
        accountId: "account-123",
        parsedAction: {
          action: "remove_related_person",
          fields: {
            personName: "Mark",
          },
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "remove_related_person",
        success: false,
        reply: "Related person removal failed.",
      });
    });
  });

  it("rejects an action that is not a related-people action", async () => {
    const result = await handleRelatedPeople({
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
      reply: "The related person request could not be completed.",
    });

    expect(mockedGetRelatedPeople).not.toHaveBeenCalled();
    expect(mockedAddRelatedPerson).not.toHaveBeenCalled();
    expect(mockedUpdateRelatedPerson).not.toHaveBeenCalled();
    expect(mockedRemoveRelatedPerson).not.toHaveBeenCalled();
    expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
  });
});
