import {
  createCallAppointment,
  getCallAppointments,
} from "@/lib/account/services/call-appointment";

import { sendAccountChangeNotification } from "@/lib/notifications/account-change-notification";

import type { CallAppointment, CallAppointmentRow } from "@/lib/account/types";

import type {
  ChatActionResult,
  ParsedAction,
  PendingChatAction,
} from "@/lib/chat/types";

export async function handleCallAppointment({
  accountId,
  parsedAction,
}: {
  accountId: string;
  parsedAction: ParsedAction;
}): Promise<ChatActionResult> {
  switch (parsedAction.action) {
    case "read_call_appointments":
      return handleReadCallAppointments(accountId);

    case "book_call_appointment":
      return handleBookCallAppointment(accountId, parsedAction);

    default:
      return {
        action: parsedAction.action,
        success: false,
        reply: "The call appointment request could not be completed.",
      };
  }
}

async function handleReadCallAppointments(
  accountId: string,
): Promise<ChatActionResult> {
  try {
    const rows = await getCallAppointments(accountId);
    const callAppointments = rows.map(mapCallAppointmentRow);

    if (callAppointments.length === 0) {
      return {
        action: "read_call_appointments",
        success: true,
        reply: "There are no call appointments on your account.",
        callAppointments,
      };
    }

    const reply = callAppointments
      .map((appointment) => {
        const reason = appointment.reason ? ` about ${appointment.reason}` : "";

        return `${formatDateTime(appointment.scheduledAt)} on ${appointment.phone}${reason} (${appointment.status})`;
      })
      .join("; ");

    return {
      action: "read_call_appointments",
      success: true,
      reply: `Your call appointments are: ${reply}.`,
      callAppointments,
    };
  } catch (error) {
    return actionFailure("read_call_appointments", error);
  }
}

async function handleBookCallAppointment(
  accountId: string,
  parsedAction: ParsedAction,
): Promise<ChatActionResult> {
  const missingFieldReply = getMissingFieldReply(parsedAction.missingFields);

  if (missingFieldReply) {
    return createPendingResult(
      parsedAction,
      missingFieldReply,
      parsedAction.missingFields,
    );
  }

  try {
    const scheduledAt = parsedAction.fields.scheduledAt?.trim();

    if (!scheduledAt) {
      return createPendingResult(
        parsedAction,
        "What future date and time would you like the call?",
        ["scheduledAt"],
      );
    }

    const account = await createCallAppointment(accountId, {
      scheduledAt,
      phone: parsedAction.fields.phone,
      reason: parsedAction.fields.reason,
    });

    let notificationQueued = false;

    try {
      await sendAccountChangeNotification({
        accountId,
        changedBy: "account_holder",
        changeSummary: "call_appointment_booked",
        accountSnapshot: account,
      });

      notificationQueued = true;
    } catch (error) {
      console.error("Account-change notification failed:", error);
    }

    const callAppointment = account.callAppointments.find(
      (appointment) =>
        appointment.scheduledAt === new Date(scheduledAt).toISOString(),
    );

    const phone =
      callAppointment?.phone ??
      parsedAction.fields.phone ??
      account.account.phone;

    return {
      action: "book_call_appointment",
      success: true,
      reply: `Your call has been booked for ${formatDateTime(
        scheduledAt,
      )} on ${phone}.`,
      account,
      callAppointment,
      notificationQueued,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The call appointment request could not be completed.";

    if (
      message ===
      "Call appointment must be scheduled for a future date and time."
    ) {
      const fields = { ...parsedAction.fields };

      delete fields.scheduledAt;

      return {
        action: "book_call_appointment",
        success: false,
        reply:
          "That time is in the past. Please provide a future date and time.",
        missingFields: ["scheduledAt"],
        pendingAction: {
          action: "book_call_appointment",
          fields,
          missingFields: ["scheduledAt"],
        },
      };
    }

    return actionFailure("book_call_appointment", error);
  }
}

function getMissingFieldReply(missingFields: string[]): string | null {
  if (missingFields.length === 0) {
    return null;
  }

  if (missingFields.includes("scheduledAt")) {
    return "What future date and time would you like the call?";
  }

  return "Please provide the missing call appointment information.";
}

function createPendingResult(
  parsedAction: ParsedAction,
  reply: string,
  missingFields: string[],
): ChatActionResult {
  const pendingAction: PendingChatAction = {
    action: parsedAction.action,
    fields: parsedAction.fields,
    missingFields,
  };

  return {
    action: parsedAction.action,
    success: false,
    reply,
    missingFields,
    pendingAction,
  };
}

function mapCallAppointmentRow(row: CallAppointmentRow): CallAppointment {
  return {
    id: row.id,
    scheduledAt: row.scheduled_at,
    phone: row.phone,
    reason: row.reason ?? undefined,
    status: row.status,
  };
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Dublin",
  }).format(new Date(value));
}

function actionFailure(
  action: ParsedAction["action"],
  error: unknown,
): ChatActionResult {
  return {
    action,
    success: false,
    reply:
      error instanceof Error
        ? error.message
        : "The call appointment request could not be completed.",
  };
}
