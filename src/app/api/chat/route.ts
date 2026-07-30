import { NextResponse } from "next/server";

import { executeChatAction } from "@/lib/chat/actions";
import { parseMessage } from "@/lib/chat/parser";

import type {
  ChatRequest,
  ChatResponse,
  ParsedAction,
  PendingChatAction,
} from "@/lib/chat/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ChatRequest>;
    const accountId = body.accountId?.trim();
    const message = body.message?.trim();

    if (!accountId || !message) {
      return NextResponse.json(
        { error: "accountId and message are required." },
        { status: 400 },
      );
    }

    const rawParsedAction = await parseMessage(message, body.pendingAction);
    console.log("Raw parsed action:", rawParsedAction);

    const parsedAction = normalizeParsedAction(
      rawParsedAction,
      body.pendingAction,
    );

    console.log("Normalized action:", parsedAction);

    console.log("Pending action:", body.pendingAction);

    const result = await executeChatAction({
      accountId,
      parsedAction,
    });

    const pendingAction =
      parsedAction.missingFields.length > 0
        ? {
            action: parsedAction.action,
            fields: parsedAction.fields,
            missingFields: parsedAction.missingFields,
          }
        : null;

    const response: ChatResponse = {
      conversationId: body.conversationId ?? "starter-conversation",

      message: {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.reply,
        createdAt: new Date().toISOString(),
      },

      result,
      pendingAction,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Chat API error:", error);

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

  if (Object.keys(parsedAction.fields).length === 0) {
    return parsedAction;
  }

  if (!pendingAction) {
    return {
      ...parsedAction,
      missingFields: [],
    };
  }
  return parsedAction;
}
