import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/chat/route";
import { getCurrentAccount } from "@/lib/account/services/account-current";
import { executeChatAction } from "@/lib/chat/actions";
import {
  clearPendingChatAction,
  getPendingChatAction,
  savePendingChatAction,
} from "@/lib/chat/services/pending-action";
import { parseMessage } from "@/lib/chat/parser";

import type { PendingChatAction } from "@/lib/chat/types";

vi.mock("@/lib/chat/parser", () => ({
  parseMessage: vi.fn(),
}));

vi.mock("@/lib/chat/actions", () => ({
  executeChatAction: vi.fn(),
}));

vi.mock("@/lib/account/services/account-current", () => ({
  getCurrentAccount: vi.fn(),
}));

vi.mock("@/lib/chat/services/pending-action", () => ({
  getPendingChatAction: vi.fn(),
  savePendingChatAction: vi.fn(),
  clearPendingChatAction: vi.fn(),
}));

const mockedParseMessage = vi.mocked(parseMessage);
const mockedExecuteChatAction = vi.mocked(executeChatAction);
const mockedGetCurrentAccount = vi.mocked(getCurrentAccount);
const mockedGetPendingChatAction = vi.mocked(getPendingChatAction);
const mockedSavePendingChatAction = vi.mocked(savePendingChatAction);
const mockedClearPendingChatAction = vi.mocked(clearPendingChatAction);

function createRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedGetCurrentAccount.mockResolvedValue({
      account: {
        accountId: "account-123",
      },
    } as Awaited<ReturnType<typeof getCurrentAccount>>);

    mockedGetPendingChatAction.mockResolvedValue(null);
    mockedSavePendingChatAction.mockResolvedValue(undefined);
    mockedClearPendingChatAction.mockResolvedValue(undefined);
  });

  it("returns 400 when message is missing", async () => {
    const response = await POST(createRequest({}));

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Message is required.",
    });

    expect(mockedParseMessage).not.toHaveBeenCalled();
    expect(mockedExecuteChatAction).not.toHaveBeenCalled();
  });

  it("returns 400 when message contains only whitespace", async () => {
    const response = await POST(
      createRequest({
        message: "   ",
      }),
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Message is required.",
    });

    expect(mockedParseMessage).not.toHaveBeenCalled();
    expect(mockedExecuteChatAction).not.toHaveBeenCalled();
  });

  it("trims the message before processing", async () => {
    mockedParseMessage.mockResolvedValueOnce({
      action: "read_account",
      fields: {
        requestedField: "phone",
      },
      missingFields: [],
    });

    mockedExecuteChatAction.mockResolvedValueOnce({
      action: "read_account",
      success: true,
      reply: "Your phone number is +353851234567.",
    });

    const response = await POST(
      createRequest({
        message: "  Show my phone number  ",
        conversationId: "conversation-123",
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(200);

    expect(mockedGetCurrentAccount).toHaveBeenCalled();

    expect(mockedParseMessage).toHaveBeenCalledWith(
      "Show my phone number",
      undefined,
    );

    expect(mockedExecuteChatAction).toHaveBeenCalledWith({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "phone",
        },
        missingFields: [],
      },
      requestId: undefined,
    });

    expect(body).toEqual({
      conversationId: "conversation-123",
      message: {
        id: expect.any(String),
        role: "assistant",
        content: "Your phone number is +353851234567.",
        createdAt: expect.any(String),
      },
      result: {
        action: "read_account",
        success: true,
        reply: "Your phone number is +353851234567.",
      },
      pendingAction: null,
    });

    expect(mockedClearPendingChatAction).toHaveBeenCalledWith(
      "account-123",
      "conversation-123",
    );
  });

  it("uses the default conversation ID when none is provided", async () => {
    mockedParseMessage.mockResolvedValueOnce({
      action: "read_account",
      fields: {
        requestedField: "email",
      },
      missingFields: [],
    });

    mockedExecuteChatAction.mockResolvedValueOnce({
      action: "read_account",
      success: true,
      reply: "Your email address is anna@example.test.",
    });

    const response = await POST(
      createRequest({
        message: "Show my email",
      }),
    );

    const body = await response.json();

    expect(body.conversationId).toBe("starter-conversation");

    expect(mockedGetPendingChatAction).toHaveBeenCalledWith(
      "account-123",
      "starter-conversation",
    );
  });

  it("allows a direct partial account-holder update", async () => {
    mockedParseMessage.mockResolvedValueOnce({
      action: "update_account_holder",
      fields: {
        city: "Cork",
      },
      missingFields: ["addressLine1", "postalCode", "country"],
    });

    mockedExecuteChatAction.mockResolvedValueOnce({
      action: "update_account_holder",
      success: true,
      reply: "Your account information has been updated successfully.",
    });

    const response = await POST(
      createRequest({
        message: "Change my city to Cork",
      }),
    );

    const body = await response.json();

    expect(mockedExecuteChatAction).toHaveBeenCalledWith({
      accountId: "account-123",
      parsedAction: {
        action: "update_account_holder",
        fields: {
          city: "Cork",
        },
        missingFields: [],
      },
      requestId: undefined,
    });

    expect(body.pendingAction).toBeNull();

    expect(mockedClearPendingChatAction).toHaveBeenCalledWith(
      "account-123",
      "starter-conversation",
    );
  });

  it("does not normalize an account-holder update with no supplied fields", async () => {
    mockedParseMessage.mockResolvedValueOnce({
      action: "update_account_holder",
      fields: {},
      missingFields: ["phone"],
    });

    mockedExecuteChatAction.mockResolvedValueOnce({
      action: "update_account_holder",
      success: false,
      reply: "Please provide the new phone number.",
    });

    const response = await POST(
      createRequest({
        message: "Change my phone number",
      }),
    );

    const body = await response.json();

    expect(mockedExecuteChatAction).toHaveBeenCalledWith({
      accountId: "account-123",
      parsedAction: {
        action: "update_account_holder",
        fields: {},
        missingFields: ["phone"],
      },
      requestId: undefined,
    });

    expect(body.pendingAction).toEqual({
      action: "update_account_holder",
      fields: {},
      missingFields: ["phone"],
    });

    expect(mockedSavePendingChatAction).toHaveBeenCalledWith(
      "account-123",
      "starter-conversation",
      {
        action: "update_account_holder",
        fields: {},
        missingFields: ["phone"],
      },
    );
  });

  it("preserves missing fields during an account-holder follow-up turn", async () => {
    const pendingAction: PendingChatAction = {
      action: "update_account_holder",
      fields: {},
      missingFields: ["firstName", "lastName"],
    };

    mockedGetPendingChatAction.mockResolvedValueOnce(pendingAction);

    mockedParseMessage.mockResolvedValueOnce({
      action: "update_account_holder",
      fields: {
        firstName: "Jane",
      },
      missingFields: ["lastName"],
    });

    mockedExecuteChatAction.mockResolvedValueOnce({
      action: "update_account_holder",
      success: false,
      reply: "Please provide your last name.",
    });

    const response = await POST(
      createRequest({
        message: "Jane",
        conversationId: "conversation-123",
      }),
    );

    const body = await response.json();

    expect(mockedGetPendingChatAction).toHaveBeenCalledWith(
      "account-123",
      "conversation-123",
    );

    expect(mockedParseMessage).toHaveBeenCalledWith("Jane", pendingAction);

    expect(mockedExecuteChatAction).toHaveBeenCalledWith({
      accountId: "account-123",
      parsedAction: {
        action: "update_account_holder",
        fields: {
          firstName: "Jane",
        },
        missingFields: ["lastName"],
      },
      requestId: undefined,
    });

    expect(body.pendingAction).toEqual({
      action: "update_account_holder",
      fields: {
        firstName: "Jane",
      },
      missingFields: ["lastName"],
    });

    expect(mockedSavePendingChatAction).toHaveBeenCalledWith(
      "account-123",
      "conversation-123",
      {
        action: "update_account_holder",
        fields: {
          firstName: "Jane",
        },
        missingFields: ["lastName"],
      },
    );
  });

  it("does not normalize missing fields for another action", async () => {
    mockedParseMessage.mockResolvedValueOnce({
      action: "add_related_person",
      fields: {
        name: "Mark Murphy",
      },
      missingFields: ["email", "phone", "authorizedToAct"],
    });

    mockedExecuteChatAction.mockResolvedValueOnce({
      action: "add_related_person",
      success: false,
      reply:
        "Please provide Mark's email, phone number and authorization status.",
    });

    const response = await POST(
      createRequest({
        message: "Add Mark Murphy",
      }),
    );

    const body = await response.json();

    expect(mockedExecuteChatAction).toHaveBeenCalledWith({
      accountId: "account-123",
      parsedAction: {
        action: "add_related_person",
        fields: {
          name: "Mark Murphy",
        },
        missingFields: ["email", "phone", "authorizedToAct"],
      },
      requestId: undefined,
    });

    expect(body.pendingAction).toEqual({
      action: "add_related_person",
      fields: {
        name: "Mark Murphy",
      },
      missingFields: ["email", "phone", "authorizedToAct"],
    });

    expect(mockedSavePendingChatAction).toHaveBeenCalledWith(
      "account-123",
      "starter-conversation",
      {
        action: "add_related_person",
        fields: {
          name: "Mark Murphy",
        },
        missingFields: ["email", "phone", "authorizedToAct"],
      },
    );
  });

  it("completes an account update using a follow-up turn", async () => {
    const pendingAction: PendingChatAction = {
      action: "update_account_holder",
      fields: {},
      missingFields: ["phone"],
    };

    mockedGetPendingChatAction
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pendingAction);

    mockedParseMessage
      .mockResolvedValueOnce(pendingAction)
      .mockResolvedValueOnce({
        action: "update_account_holder",
        fields: {
          phone: "+353831112233",
        },
        missingFields: [],
      });

    mockedExecuteChatAction
      .mockResolvedValueOnce({
        action: "update_account_holder",
        success: false,
        reply: "Please provide the new phone number.",
      })
      .mockResolvedValueOnce({
        action: "update_account_holder",
        success: true,
        reply: "Your account information has been updated successfully.",
      });

    const firstResponse = await POST(
      createRequest({
        conversationId: "conversation-123",
        message: "Change my phone number",
      }),
    );

    const firstBody = await firstResponse.json();

    expect(firstBody.pendingAction).toEqual(pendingAction);

    expect(mockedSavePendingChatAction).toHaveBeenCalledWith(
      "account-123",
      "conversation-123",
      pendingAction,
    );

    const secondResponse = await POST(
      createRequest({
        conversationId: "conversation-123",
        message: "+353831112233",
      }),
    );

    const secondBody = await secondResponse.json();

    expect(mockedParseMessage).toHaveBeenNthCalledWith(
      2,
      "+353831112233",
      pendingAction,
    );

    expect(mockedExecuteChatAction).toHaveBeenLastCalledWith({
      accountId: "account-123",
      parsedAction: {
        action: "update_account_holder",
        fields: {
          phone: "+353831112233",
        },
        missingFields: [],
      },
      requestId: undefined,
    });

    expect(secondBody.conversationId).toBe("conversation-123");
    expect(secondBody.result.success).toBe(true);
    expect(secondBody.pendingAction).toBeNull();

    expect(mockedClearPendingChatAction).toHaveBeenCalledWith(
      "account-123",
      "conversation-123",
    );
  });

  it("passes requestId to action execution", async () => {
    mockedParseMessage.mockResolvedValueOnce({
      action: "read_account",
      fields: {
        requestedField: "balance",
      },
      missingFields: [],
    });

    mockedExecuteChatAction.mockResolvedValueOnce({
      action: "read_account",
      success: true,
      reply: "Your current balance is €950.00.",
    });

    const response = await POST(
      createRequest({
        message: "Show my balance",
        requestId: "request-123",
      }),
    );

    expect(response.status).toBe(200);

    expect(mockedExecuteChatAction).toHaveBeenCalledWith({
      accountId: "account-123",
      parsedAction: {
        action: "read_account",
        fields: {
          requestedField: "balance",
        },
        missingFields: [],
      },
      requestId: "request-123",
    });
  });

  it("returns 429 when the AI provider rate limit is reached", async () => {
    mockedParseMessage.mockRejectedValueOnce(
      new Error(
        "OpenRouter request failed with status 429: Rate limit exceeded",
      ),
    );

    const response = await POST(
      createRequest({
        message: "Show my balance",
      }),
    );

    expect(response.status).toBe(429);

    await expect(response.json()).resolves.toEqual({
      error:
        "The AI service request limit has been reached. Please try again later.",
    });

    expect(mockedExecuteChatAction).not.toHaveBeenCalled();
  });

  it("returns 500 when parsing fails unexpectedly", async () => {
    mockedParseMessage.mockRejectedValueOnce(
      new Error("Unexpected parser failure"),
    );

    const response = await POST(
      createRequest({
        message: "Show my balance",
      }),
    );

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "The chat request could not be completed.",
    });

    expect(mockedExecuteChatAction).not.toHaveBeenCalled();
  });

  it("returns 500 when action execution fails unexpectedly", async () => {
    mockedParseMessage.mockResolvedValueOnce({
      action: "read_account",
      fields: {
        requestedField: "balance",
      },
      missingFields: [],
    });

    mockedExecuteChatAction.mockRejectedValueOnce(
      new Error("Database connection failed"),
    );

    const response = await POST(
      createRequest({
        message: "Show my balance",
      }),
    );

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "The chat request could not be completed.",
    });
  });
});
