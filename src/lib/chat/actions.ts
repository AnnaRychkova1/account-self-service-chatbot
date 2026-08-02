import type { ChatActionResult, ParsedAction } from "./types";
import { handleUpdateAccountHolder } from "./handlers/chat-update";
import { handleReadAccountHolder } from "./handlers/chat-read";
import { handleRelatedPeople } from "./handlers/chat-related-people";
import { handlePromiseToPay } from "./handlers/chat-promise-to-pay";
import { handlePayment } from "./handlers/chat-payment";
import { handleCallAppointment } from "./handlers/chat-call-appointment";

export async function executeChatAction({
  accountId,
  parsedAction,
  requestId,
}: {
  accountId: string;
  parsedAction: ParsedAction;
  requestId?: string;
}): Promise<ChatActionResult> {
  const normalizedAccountId = accountId.trim();

  if (!normalizedAccountId) {
    return {
      action: "unsupported",
      success: false,
      reply: "Account ID is required.",
    };
  }

  switch (parsedAction.action) {
    case "update_account_holder":
    case "update_preferred_contact_method":
      return handleUpdateAccountHolder({
        accountId: normalizedAccountId,
        parsedAction,
      });

    case "read_account":
    case "read_preferred_contact_method":
      return handleReadAccountHolder({
        accountId: normalizedAccountId,
        parsedAction,
      });

    case "add_related_person":
    case "update_related_person":
    case "remove_related_person":
    case "read_related_people":
      return handleRelatedPeople({
        accountId: normalizedAccountId,
        parsedAction,
      });

    case "create_promise_to_pay":
    case "read_promises_to_pay":
      return handlePromiseToPay({
        accountId: normalizedAccountId,
        parsedAction,
      });

    case "mock_payment":
    case "read_transactions":
      return handlePayment({
        accountId: normalizedAccountId,
        parsedAction,
        requestId,
      });

    case "book_call_appointment":
    case "read_call_appointments":
      return handleCallAppointment({
        accountId: normalizedAccountId,
        parsedAction,
      });

    case "clarify":
      return {
        action: "clarify",
        success: false,
        reply: getClarificationReply(parsedAction),
      };

    case "unsupported":
      return {
        action: "unsupported",
        success: false,
        reply: "I cannot safely complete that account request.",
      };
  }
}

function getClarificationReply(parsedAction: ParsedAction): string {
  const intentType = parsedAction.fields.intentType;

  if (intentType === "update") {
    return "What account information or service would you like to update?";
  }

  if (intentType === "read") {
    return "What account information would you like to view?";
  }

  return "What would you like help with on your account?";
}
