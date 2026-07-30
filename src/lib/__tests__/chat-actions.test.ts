import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeChatAction } from "@/lib/chat/actions";
import { handleReadAccountHolder } from "@/lib/chat/handlers/chat-read";
import { handleUpdateAccountHolder } from "@/lib/chat/handlers/chat-update";

import type {
  ChatAction,
  ChatActionResult,
  ParsedAction,
} from "@/lib/chat/types";

vi.mock("@/lib/chat/handlers/chat-read", () => ({
  handleReadAccountHolder: vi.fn(),
}));

vi.mock("@/lib/chat/handlers/chat-update", () => ({
  handleUpdateAccountHolder: vi.fn(),
}));

const mockedHandleReadAccountHolder = vi.mocked(handleReadAccountHolder);

const mockedHandleUpdateAccountHolder = vi.mocked(handleUpdateAccountHolder);

function createParsedAction(
  action: ChatAction,
  fields: Record<string, string> = {},
  missingFields: string[] = [],
): ParsedAction {
  return {
    action,
    fields,
    missingFields,
  };
}

describe("executeChatAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("account ID validation", () => {
    it("rejects a blank account ID before routing the action", async () => {
      const result = await executeChatAction({
        accountId: "   ",
        parsedAction: createParsedAction("read_account"),
      });

      expect(result).toEqual({
        action: "unsupported",
        success: false,
        reply: "Account ID is required.",
      });

      expect(mockedHandleReadAccountHolder).not.toHaveBeenCalled();
      expect(mockedHandleUpdateAccountHolder).not.toHaveBeenCalled();
    });

    it("trims the account ID before passing it to a handler", async () => {
      const handlerResult: ChatActionResult = {
        action: "read_account",
        success: true,
        reply: "Account loaded.",
      };

      mockedHandleReadAccountHolder.mockResolvedValueOnce(handlerResult);

      const parsedAction = createParsedAction("read_account");

      const result = await executeChatAction({
        accountId: "  account-123  ",
        parsedAction,
      });

      expect(mockedHandleReadAccountHolder).toHaveBeenCalledWith({
        accountId: "account-123",
        parsedAction,
      });

      expect(result).toEqual(handlerResult);
    });
  });

  describe("read routing", () => {
    it.each<ChatAction>(["read_account", "read_preferred_contact_method"])(
      "routes %s to the account read handler",
      async (action) => {
        const handlerResult: ChatActionResult = {
          action,
          success: true,
          reply: "Read completed.",
        };

        mockedHandleReadAccountHolder.mockResolvedValueOnce(handlerResult);

        const parsedAction = createParsedAction(action);

        const result = await executeChatAction({
          accountId: "account-123",
          parsedAction,
        });

        expect(mockedHandleReadAccountHolder).toHaveBeenCalledOnce();

        expect(mockedHandleReadAccountHolder).toHaveBeenCalledWith({
          accountId: "account-123",
          parsedAction,
        });

        expect(mockedHandleUpdateAccountHolder).not.toHaveBeenCalled();
        expect(result).toEqual(handlerResult);
      },
    );
  });

  describe("update routing", () => {
    it.each<ChatAction>([
      "update_account_holder",
      "update_preferred_contact_method",
    ])("routes %s to the account update handler", async (action) => {
      const handlerResult: ChatActionResult = {
        action,
        success: true,
        reply: "Update completed.",
      };

      mockedHandleUpdateAccountHolder.mockResolvedValueOnce(handlerResult);

      const parsedAction = createParsedAction(action);

      const result = await executeChatAction({
        accountId: "account-123",
        parsedAction,
      });

      expect(mockedHandleUpdateAccountHolder).toHaveBeenCalledOnce();

      expect(mockedHandleUpdateAccountHolder).toHaveBeenCalledWith({
        accountId: "account-123",
        parsedAction,
      });

      expect(mockedHandleReadAccountHolder).not.toHaveBeenCalled();
      expect(result).toEqual(handlerResult);
    });
  });

  describe("features that are not implemented yet", () => {
    it.each<ChatAction>([
      "add_related_person",
      "update_related_person",
      "remove_related_person",
      "read_related_people",
      "create_promise_to_pay",
      "read_promises_to_pay",
      "mock_payment",
      "read_transactions",
      "book_call_appointment",
      "read_call_appointments",
    ])("returns not implemented for %s", async (action) => {
      const result = await executeChatAction({
        accountId: "account-123",
        parsedAction: createParsedAction(action),
      });

      expect(result).toEqual({
        action,
        success: false,
        reply: "This account feature has not been implemented yet.",
      });

      expect(mockedHandleReadAccountHolder).not.toHaveBeenCalled();
      expect(mockedHandleUpdateAccountHolder).not.toHaveBeenCalled();
    });
  });

  describe("clarification responses", () => {
    it("asks which information should be updated", async () => {
      const result = await executeChatAction({
        accountId: "account-123",
        parsedAction: createParsedAction(
          "clarify",
          {
            intentType: "update",
          },
          ["action"],
        ),
      });

      expect(result).toEqual({
        action: "clarify",
        success: false,
        reply:
          "What information would you like to update? You can change your name, email, phone number, address, or preferred contact method.",
      });
    });

    it("asks which information should be viewed", async () => {
      const result = await executeChatAction({
        accountId: "account-123",
        parsedAction: createParsedAction(
          "clarify",
          {
            intentType: "read",
          },
          ["action"],
        ),
      });

      expect(result).toEqual({
        action: "clarify",
        success: false,
        reply: "What account information would you like to view?",
      });
    });

    it("returns a general clarification question without intentType", async () => {
      const result = await executeChatAction({
        accountId: "account-123",
        parsedAction: createParsedAction("clarify", {}, ["action"]),
      });

      expect(result).toEqual({
        action: "clarify",
        success: false,
        reply: "What would you like help with on your account?",
      });
    });
  });

  describe("unsupported requests", () => {
    it("returns a safe response for an unsupported action", async () => {
      const result = await executeChatAction({
        accountId: "account-123",
        parsedAction: createParsedAction("unsupported"),
      });

      expect(result).toEqual({
        action: "unsupported",
        success: false,
        reply: "I cannot safely complete that account request.",
      });
    });
  });
});
