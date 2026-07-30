import type { ChatAction, ChatActionResult, ParsedAction } from "./types";
import { handleUpdateAccountHolder } from "./handlers/chat-update";
import { handleReadAccountHolder } from "./handlers/chat-read";

function notImplemented(action: ChatAction): ChatActionResult {
  return {
    action,
    success: false,
    reply: "This account feature has not been implemented yet.",
  };
}

export async function executeChatAction({
  accountId,
  parsedAction,
}: {
  accountId: string;
  parsedAction: ParsedAction;
}): Promise<ChatActionResult> {
  console.log("executeChatAction:", {
    accountId,
    parsedAction,
  });
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
      return notImplemented(parsedAction.action);

    case "create_promise_to_pay":
    case "read_promises_to_pay":
      return notImplemented(parsedAction.action);

    case "mock_payment":
    case "read_transactions":
      return notImplemented(parsedAction.action);

    case "book_call_appointment":
    case "read_call_appointments":
      return notImplemented(parsedAction.action);

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
    return "What information would you like to update? You can change your name, email, phone number, address, or preferred contact method.";
  }

  if (intentType === "read") {
    return "What account information would you like to view?";
  }

  return "What would you like help with on your account?";
}
