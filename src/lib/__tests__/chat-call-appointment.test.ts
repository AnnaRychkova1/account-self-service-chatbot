import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendAccountChangeNotification } from "@/lib/notifications/account-change-notification";

import {
  createCallAppointment,
  getCallAppointments,
} from "@/lib/account/services/call-appointment";
import { handleCallAppointment } from "@/lib/chat/handlers/chat-call-appointment";

import type { AccountContext, CallAppointmentRow } from "@/lib/account/types";

vi.mock("@/lib/account/services/call-appointment", () => ({
  createCallAppointment: vi.fn(),
  getCallAppointments: vi.fn(),
}));

vi.mock("@/lib/notifications/account-change-notification", () => ({
  sendAccountChangeNotification: vi.fn(),
}));

const mockedCreateCallAppointment = vi.mocked(createCallAppointment);
const mockedGetCallAppointments = vi.mocked(getCallAppointments);

const appointmentRows: CallAppointmentRow[] = [
  {
    id: "appointment-1",
    account_holder_id: "holder-1",
    scheduled_at: "2026-08-04T09:00:00.000Z",
    phone: "+353831234567",
    reason: "Discuss payment options",
    status: "scheduled",
    created_at: "2026-08-02T10:00:00.000Z",
    updated_at: "2026-08-02T10:00:00.000Z",
  },
  {
    id: "appointment-2",
    account_holder_id: "holder-1",
    scheduled_at: "2026-08-05T13:30:00.000Z",
    phone: "+353851112233",
    reason: null,
    status: "scheduled",
    created_at: "2026-08-02T11:00:00.000Z",
    updated_at: "2026-08-02T11:00:00.000Z",
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
  transactions: [],
  callAppointments: [
    {
      id: "appointment-new",
      scheduledAt: "2026-08-04T09:00:00.000Z",
      phone: "+353831234567",
      reason: "my bill",
      status: "scheduled",
    },
  ],
  notificationRules: {
    sendEmailOnDataChange: true,
    pdfPasswordSource: "account_phone_last4",
  },
};

const mockedSendAccountChangeNotification = vi.mocked(
  sendAccountChangeNotification,
);

describe("handleCallAppointment", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedGetCallAppointments.mockResolvedValue(appointmentRows);
    mockedCreateCallAppointment.mockResolvedValue(accountContext);
    mockedSendAccountChangeNotification.mockResolvedValue({
      notificationId: "notification-1",
      sent: true,
      redactedRecipient: "j***@example.test",
    });
  });

  describe("read_call_appointments", () => {
    it("returns all call appointments", async () => {
      const result = await handleCallAppointment({
        accountId: "account-123",
        parsedAction: {
          action: "read_call_appointments",
          fields: {},
          missingFields: [],
        },
      });

      expect(mockedGetCallAppointments).toHaveBeenCalledWith("account-123");

      expect(result).toEqual({
        action: "read_call_appointments",
        success: true,
        reply:
          "Your call appointments are: 4 Aug 2026, 10:00 on +353831234567 about Discuss payment options (scheduled); 5 Aug 2026, 14:30 on +353851112233 (scheduled).",
        callAppointments: [
          {
            id: "appointment-1",
            scheduledAt: "2026-08-04T09:00:00.000Z",
            phone: "+353831234567",
            reason: "Discuss payment options",
            status: "scheduled",
          },
          {
            id: "appointment-2",
            scheduledAt: "2026-08-05T13:30:00.000Z",
            phone: "+353851112233",
            reason: undefined,
            status: "scheduled",
          },
        ],
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });

    it("returns an empty result when no appointments exist", async () => {
      mockedGetCallAppointments.mockResolvedValueOnce([]);

      const result = await handleCallAppointment({
        accountId: "account-123",
        parsedAction: {
          action: "read_call_appointments",
          fields: {},
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "read_call_appointments",
        success: true,
        reply: "There are no call appointments on your account.",
        callAppointments: [],
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });

    it("returns the service error when appointments cannot be loaded", async () => {
      mockedGetCallAppointments.mockRejectedValueOnce(
        new Error("Failed to load call appointments."),
      );

      const result = await handleCallAppointment({
        accountId: "account-123",
        parsedAction: {
          action: "read_call_appointments",
          fields: {},
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "read_call_appointments",
        success: false,
        reply: "Failed to load call appointments.",
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });
  });

  describe("book_call_appointment", () => {
    it("books a future call using the stored account phone", async () => {
      const result = await handleCallAppointment({
        accountId: "account-123",
        parsedAction: {
          action: "book_call_appointment",
          fields: {
            scheduledAt: "2026-08-04T09:00:00.000Z",
            reason: "my bill",
          },
          missingFields: [],
        },
      });

      expect(mockedCreateCallAppointment).toHaveBeenCalledWith("account-123", {
        scheduledAt: "2026-08-04T09:00:00.000Z",
        phone: undefined,
        reason: "my bill",
      });

      expect(mockedSendAccountChangeNotification).toHaveBeenCalledWith({
        accountId: "account-123",
        changedBy: "account_holder",
        changeSummary: "call_appointment_booked",
        accountSnapshot: accountContext,
      });

      expect(result).toEqual({
        action: "book_call_appointment",
        success: true,
        reply:
          "Your call has been booked for 4 Aug 2026, 10:00 on +353831234567.",
        account: accountContext,
        callAppointment: accountContext.callAppointments[0],
        notificationQueued: true,
      });
    });

    it("keeps the booking successful when notification delivery fails", async () => {
      mockedSendAccountChangeNotification.mockRejectedValueOnce(
        new Error("Notification failed."),
      );

      const result = await handleCallAppointment({
        accountId: "account-123",
        parsedAction: {
          action: "book_call_appointment",
          fields: {
            scheduledAt: "2026-08-04T09:00:00.000Z",
            reason: "my bill",
          },
          missingFields: [],
        },
      });

      expect(mockedCreateCallAppointment).toHaveBeenCalledWith("account-123", {
        scheduledAt: "2026-08-04T09:00:00.000Z",
        phone: undefined,
        reason: "my bill",
      });

      expect(mockedSendAccountChangeNotification).toHaveBeenCalledWith({
        accountId: "account-123",
        changedBy: "account_holder",
        changeSummary: "call_appointment_booked",
        accountSnapshot: accountContext,
      });

      expect(result).toEqual({
        action: "book_call_appointment",
        success: true,
        reply:
          "Your call has been booked for 4 Aug 2026, 10:00 on +353831234567.",
        account: accountContext,
        callAppointment: accountContext.callAppointments[0],
        notificationQueued: false,
      });
    });

    it("passes a supplied phone number to the service", async () => {
      const customAccountContext: AccountContext = {
        ...accountContext,
        callAppointments: [
          {
            id: "appointment-new",
            scheduledAt: "2026-08-04T09:00:00.000Z",
            phone: "+353851112233",
            reason: "my bill",
            status: "scheduled",
          },
        ],
      };

      mockedCreateCallAppointment.mockResolvedValueOnce(customAccountContext);

      const result = await handleCallAppointment({
        accountId: "account-123",
        parsedAction: {
          action: "book_call_appointment",
          fields: {
            scheduledAt: "2026-08-04T09:00:00.000Z",
            phone: "+353851112233",
            reason: "my bill",
          },
          missingFields: [],
        },
      });

      expect(mockedCreateCallAppointment).toHaveBeenCalledWith("account-123", {
        scheduledAt: "2026-08-04T09:00:00.000Z",
        phone: "+353851112233",
        reason: "my bill",
      });

      expect(result.reply).toBe(
        "Your call has been booked for 4 Aug 2026, 10:00 on +353851112233.",
      );

      expect(mockedSendAccountChangeNotification).toHaveBeenCalledWith({
        accountId: "account-123",
        changedBy: "account_holder",
        changeSummary: "call_appointment_booked",
        accountSnapshot: customAccountContext,
      });
    });

    it("asks for a future date and time when scheduledAt is missing", async () => {
      const parsedAction = {
        action: "book_call_appointment" as const,
        fields: {},
        missingFields: ["scheduledAt"],
      };

      const result = await handleCallAppointment({
        accountId: "account-123",
        parsedAction,
      });

      expect(mockedCreateCallAppointment).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "book_call_appointment",
        success: false,
        reply: "What future date and time would you like the call?",
        missingFields: ["scheduledAt"],
        pendingAction: {
          action: "book_call_appointment",
          fields: {},
          missingFields: ["scheduledAt"],
        },
      });

      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });

    it("asks for scheduledAt when parser omits it unexpectedly", async () => {
      const result = await handleCallAppointment({
        accountId: "account-123",
        parsedAction: {
          action: "book_call_appointment",
          fields: {
            reason: "my bill",
          },
          missingFields: [],
        },
      });

      expect(mockedCreateCallAppointment).not.toHaveBeenCalled();

      expect(result).toEqual({
        action: "book_call_appointment",
        success: false,
        reply: "What future date and time would you like the call?",
        missingFields: ["scheduledAt"],
        pendingAction: {
          action: "book_call_appointment",
          fields: {
            reason: "my bill",
          },
          missingFields: ["scheduledAt"],
        },
      });

      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });

    it("rejects a past appointment and preserves the other fields", async () => {
      mockedCreateCallAppointment.mockRejectedValueOnce(
        new Error(
          "Call appointment must be scheduled for a future date and time.",
        ),
      );

      const result = await handleCallAppointment({
        accountId: "account-123",
        parsedAction: {
          action: "book_call_appointment",
          fields: {
            scheduledAt: "2026-08-01T09:00:00.000Z",
            phone: "+353851112233",
            reason: "my bill",
          },
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "book_call_appointment",
        success: false,
        reply:
          "That time is in the past. Please provide a future date and time.",
        missingFields: ["scheduledAt"],
        pendingAction: {
          action: "book_call_appointment",
          fields: {
            phone: "+353851112233",
            reason: "my bill",
          },
          missingFields: ["scheduledAt"],
        },
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });

    it("returns an invalid phone validation error", async () => {
      mockedCreateCallAppointment.mockRejectedValueOnce(
        new Error("Please provide a valid phone number."),
      );

      const result = await handleCallAppointment({
        accountId: "account-123",
        parsedAction: {
          action: "book_call_appointment",
          fields: {
            scheduledAt: "2026-08-04T09:00:00.000Z",
            phone: "123",
          },
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "book_call_appointment",
        success: false,
        reply: "Please provide a valid phone number.",
      });

      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });

    it("returns the service error when appointment creation fails", async () => {
      mockedCreateCallAppointment.mockRejectedValueOnce(
        new Error("Failed to create call appointment."),
      );

      const result = await handleCallAppointment({
        accountId: "account-123",
        parsedAction: {
          action: "book_call_appointment",
          fields: {
            scheduledAt: "2026-08-04T09:00:00.000Z",
          },
          missingFields: [],
        },
      });

      expect(result).toEqual({
        action: "book_call_appointment",
        success: false,
        reply: "Failed to create call appointment.",
      });
      expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
    });
  });

  it("rejects an action that is not a call appointment action", async () => {
    const result = await handleCallAppointment({
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
      reply: "The call appointment request could not be completed.",
    });

    expect(mockedGetCallAppointments).not.toHaveBeenCalled();
    expect(mockedCreateCallAppointment).not.toHaveBeenCalled();
    expect(mockedSendAccountChangeNotification).not.toHaveBeenCalled();
  });
});
