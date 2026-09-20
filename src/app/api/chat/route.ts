import { NextResponse } from "next/server";

import { getCurrentAccount } from "@/lib/account/services/account-current";
import { executeChatAction } from "@/lib/chat/actions";
import { parseMessage } from "@/lib/chat/parser";
import {
  clearPendingChatAction,
  getPendingChatAction,
  savePendingChatAction,
} from "@/lib/chat/services/pending-action";

import type {
  ChatRequest,
  ChatResponse,
  ParsedAction,
  PendingChatAction,
} from "@/lib/chat/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ChatRequest>;

    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 },
      );
    }

    const accountContext = await getCurrentAccount();
    const accountId = accountContext.account.accountId;
    const conversationId = body.conversationId ?? "starter-conversation";
    const pendingAction =
      (await getPendingChatAction(accountId, conversationId)) ?? undefined;

    const rawParsedAction = await parseMessage(message, pendingAction);

    const parsedAction = normalizeParsedAction(rawParsedAction, pendingAction);

    const result = await executeChatAction({
      accountId,
      parsedAction,
      requestId: body.requestId,
    });

    const nextPendingAction =
      (result.pendingAction ?? parsedAction.missingFields.length > 0)
        ? {
            action: parsedAction.action,
            fields: parsedAction.fields,
            missingFields: parsedAction.missingFields,
          }
        : null;

    if (nextPendingAction) {
      await savePendingChatAction(accountId, conversationId, nextPendingAction);
    } else {
      await clearPendingChatAction(accountId, conversationId);
    }

    const response: ChatResponse = {
      conversationId: body.conversationId ?? "starter-conversation",

      message: {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.reply,
        createdAt: new Date().toISOString(),
      },

      result,
      pendingAction: nextPendingAction,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("CHAT API ERROR:", error);
    const isRateLimitError =
      error instanceof Error &&
      (error.message.includes("status 429") ||
        error.message.includes("Rate limit exceeded"));

    if (isRateLimitError) {
      return NextResponse.json(
        {
          error:
            "The AI service request limit has been reached. Please try again later.",
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        error: "The chat request could not be completed.",
      },
      { status: 500 },
    );
  }
}

function normalizeParsedAction(
  parsedAction: ParsedAction,
  pendingAction?: PendingChatAction,
): ParsedAction {
  if (parsedAction.action !== "update_account_holder") {
    return parsedAction;
  }

  const fields = { ...parsedAction.fields };
  const missingFields = new Set(parsedAction.missingFields);

  const phoneValue = fields.phone?.trim().toLowerCase();

  if (phoneValue === "phone" || phoneValue === "phone number") {
    delete fields.phone;
    missingFields.add("phone");
  }

  const emailValue = fields.email?.trim().toLowerCase();

  if (emailValue === "email" || emailValue === "email address") {
    delete fields.email;
    missingFields.add("email");
  }

  const normalizedAction: ParsedAction = {
    ...parsedAction,
    fields,
    missingFields: [...missingFields],
  };

  if (Object.keys(normalizedAction.fields).length === 0) {
    return normalizedAction;
  }

  if (!pendingAction) {
    return {
      ...normalizedAction,
      missingFields: [],
    };
  }

  return normalizedAction;
}
