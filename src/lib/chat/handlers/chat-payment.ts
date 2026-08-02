import {
  getTransactions,
  processMockPayment,
} from "@/lib/account/services/payment";

import { sendAccountChangeNotification } from "@/lib/notifications/account-change-notification";

import type { Transaction, TransactionRow } from "@/lib/account/types";

import type {
  ChatActionResult,
  ParsedAction,
  PendingChatAction,
} from "@/lib/chat/types";

export async function handlePayment({
  accountId,
  parsedAction,
  requestId,
}: {
  accountId: string;
  parsedAction: ParsedAction;
  requestId?: string;
}): Promise<ChatActionResult> {
  switch (parsedAction.action) {
    case "read_transactions":
      return handleReadTransactions(accountId);

    case "mock_payment":
      if (!requestId) {
        return {
          action: "mock_payment",
          success: false,
          reply: "Payment request ID is required.",
        };
      }

      return handleMockPayment(accountId, parsedAction, requestId);

    default:
      return {
        action: parsedAction.action,
        success: false,
        reply: "The payment request could not be completed.",
      };
  }
}

async function handleReadTransactions(
  accountId: string,
): Promise<ChatActionResult> {
  try {
    const rows = await getTransactions(accountId);
    const transactions = rows.map(mapTransactionRow);

    if (transactions.length === 0) {
      return {
        action: "read_transactions",
        success: true,
        reply: "There are no transactions on your account.",
        transactions,
      };
    }

    const reply = transactions
      .map(
        (transaction) =>
          `${formatAmount(
            transaction.amountCents,
            transaction.currency,
          )} ${transaction.type} on ${transaction.transactionDate} (${transaction.status})`,
      )
      .join("; ");

    return {
      action: "read_transactions",
      success: true,
      reply: `Your transactions are: ${reply}.`,
      transactions,
    };
  } catch (error) {
    return actionFailure("read_transactions", error);
  }
}

async function handleMockPayment(
  accountId: string,
  parsedAction: ParsedAction,
  requestId: string,
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

    const result = await processMockPayment(accountId, {
      amountCents,
      requestId,
    });

    const transaction = result.account.transactions.find(
      (item) => item.id === result.payment.transactionId,
    );

    if (result.payment.duplicate) {
      return {
        action: "mock_payment",
        success: true,
        reply:
          "This payment request was already processed. No additional payment was taken.",
        account: result.account,
        transaction,
        transactions: result.account.transactions,
        notificationQueued: false,
      };
    }

    let notificationQueued = false;

    try {
      await sendAccountChangeNotification({
        accountId,
        changedBy: "account_holder",
        changeSummary: "mock_payment_completed",
        accountSnapshot: result.account,
      });

      notificationQueued = true;
    } catch (error) {
      console.error("Account-change notification failed:", error);
    }

    return {
      action: "mock_payment",
      success: true,
      reply: `Your payment of ${formatAmount(
        amountCents,
        result.account.account.currency,
      )} has been completed using the payment details on file.`,
      account: result.account,
      transaction,
      transactions: result.account.transactions,
      notificationQueued,
    };
  } catch (error) {
    return actionFailure("mock_payment", error);
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

  if (missingFields.includes("amount")) {
    return "How much would you like to pay?";
  }

  return "Please provide the missing payment information.";
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

function mapTransactionRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    amountCents: row.amount_cents,
    currency: row.currency,
    description: row.description,
    transactionDate: row.transaction_date,
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
        : "The payment request could not be completed.",
  };
}
