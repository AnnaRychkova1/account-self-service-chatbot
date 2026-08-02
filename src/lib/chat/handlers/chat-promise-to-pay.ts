import {
  createPromiseToPay,
  getPromisesToPay,
} from "@/lib/account/services/promise-to-pay";

import type { PromiseToPay, PromiseToPayRow } from "@/lib/account/types";

import type {
  ChatActionResult,
  ParsedAction,
  PendingChatAction,
} from "@/lib/chat/types";

export async function handlePromiseToPay({
  accountId,
  parsedAction,
}: {
  accountId: string;
  parsedAction: ParsedAction;
}): Promise<ChatActionResult> {
  switch (parsedAction.action) {
    case "read_promises_to_pay":
      return handleReadPromisesToPay(accountId);

    case "create_promise_to_pay":
      return handleCreatePromiseToPay(accountId, parsedAction);

    default:
      return {
        action: parsedAction.action,
        success: false,
        reply: "The promise-to-pay request could not be completed.",
      };
  }
}

async function handleReadPromisesToPay(
  accountId: string,
): Promise<ChatActionResult> {
  try {
    const rows = await getPromisesToPay(accountId);
    const promisesToPay = rows.map(mapPromiseToPayRow);

    if (promisesToPay.length === 0) {
      return {
        action: "read_promises_to_pay",
        success: true,
        reply: "There are no promises to pay on your account.",
        promisesToPay,
      };
    }

    const reply = promisesToPay
      .map(
        (promise) =>
          `${formatAmount(promise.amountCents, promise.currency)} due on ${promise.dueDate} (${promise.status})`,
      )
      .join("; ");

    return {
      action: "read_promises_to_pay",
      success: true,
      reply: `Your promises to pay are: ${reply}.`,
      promisesToPay,
    };
  } catch (error) {
    return actionFailure("read_promises_to_pay", error);
  }
}

async function handleCreatePromiseToPay(
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
    const amountCents = parseAmount(parsedAction.fields.amount);
    const dueDate = parsedAction.fields.dueDate?.trim();

    if (!dueDate) {
      return createPendingResult(
        parsedAction,
        "What date would you like to promise the payment for?",
        ["dueDate"],
      );
    }

    const account = await createPromiseToPay(accountId, {
      amountCents,
      dueDate,
    });

    const promiseToPay = account.promisesToPay.find(
      (promise) =>
        promise.amountCents === amountCents &&
        promise.dueDate === dueDate &&
        promise.status === "active",
    );

    return {
      action: "create_promise_to_pay",
      success: true,
      reply: `Your promise to pay ${formatAmount(
        amountCents,
        account.account.currency,
      )} on ${dueDate} has been recorded.`,
      account,
      promiseToPay,
      notificationQueued: false,
    };
  } catch (error) {
    return actionFailure("create_promise_to_pay", error);
  }
}

function parseAmount(value?: string): number {
  if (!value) {
    throw new Error("Please provide a payment amount.");
  }

  const amountCents = Number(value);

  if (!Number.isInteger(amountCents)) {
    throw new Error("Please provide a valid payment amount.");
  }

  return amountCents;
}

function getMissingFieldReply(missingFields: string[]): string | null {
  if (missingFields.length === 0) {
    return null;
  }

  const missingAmount = missingFields.includes("amount");
  const missingDueDate = missingFields.includes("dueDate");

  if (missingAmount && missingDueDate) {
    return "Please provide the amount and future date for the promise to pay.";
  }

  if (missingAmount) {
    return "How much would you like to promise to pay?";
  }

  if (missingDueDate) {
    return "What date would you like to promise the payment for?";
  }

  return "Please provide the missing promise-to-pay information.";
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

function mapPromiseToPayRow(row: PromiseToPayRow): PromiseToPay {
  return {
    id: row.id,
    amountCents: row.amount_cents,
    currency: row.currency,
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at,
  };
}

function formatAmount(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
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
        : "The promise-to-pay request could not be completed.",
  };
}
