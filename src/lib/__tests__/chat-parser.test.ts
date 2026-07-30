import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseMessage } from "@/lib/chat/parser";

import type { PendingChatAction } from "@/lib/chat/types";

const fetchMock = vi.fn<typeof fetch>();

function createOpenRouterResponse(
  content: string,
  options: {
    ok?: boolean;
    status?: number;
    errorText?: string;
  } = {},
): Response {
  const { ok = true, status = 200, errorText = "" } = options;

  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content,
          },
        },
      ],
    }),
    text: vi.fn().mockResolvedValue(errorText),
  } as unknown as Response;
}

function getRequestBody(callIndex = 0): {
  model: string;
  temperature: number;
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
} {
  const requestInit = fetchMock.mock.calls[callIndex]?.[1];

  if (!requestInit?.body || typeof requestInit.body !== "string") {
    throw new Error("Expected the OpenRouter request to contain a JSON body.");
  }

  return JSON.parse(requestInit.body) as {
    model: string;
    temperature: number;
    messages: Array<{
      role: "system" | "user";
      content: string;
    }>;
  };
}

describe("parseMessage", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-api-key");
    vi.stubEnv("OPENROUTER_MODEL", "test-model");
    vi.stubEnv("APP_URL", "https://example.test");

    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockReset();

    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe("configuration", () => {
    it("rejects the request when the OpenRouter API key is missing", async () => {
      vi.stubEnv("OPENROUTER_API_KEY", "");

      await expect(parseMessage("What is my phone number?")).rejects.toThrow(
        "OPENROUTER_API_KEY is not configured.",
      );

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects the request when the OpenRouter model is missing", async () => {
      vi.stubEnv("OPENROUTER_MODEL", "");

      await expect(parseMessage("What is my phone number?")).rejects.toThrow(
        "OPENROUTER_MODEL is not configured.",
      );

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("empty messages", () => {
    it("returns unsupported without calling OpenRouter for a blank message", async () => {
      const result = await parseMessage("   ");

      expect(result).toEqual({
        action: "unsupported",
        fields: {},
        missingFields: [],
      });

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("OpenRouter request", () => {
    it("sends the normalized message and configured model to OpenRouter", async () => {
      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(
          JSON.stringify({
            action: "read_account",
            fields: {
              requestedField: "phone",
            },
            missingFields: [],
          }),
        ),
      );

      await parseMessage("   What phone number is on my account?   ");

      expect(fetchMock).toHaveBeenCalledOnce();

      expect(fetchMock).toHaveBeenCalledWith(
        "https://openrouter.ai/api/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://example.test",
            "X-OpenRouter-Title": "PayPathIQ Account Portal",
          },
        }),
      );

      const body = getRequestBody();

      expect(body.model).toBe("test-model");
      expect(body.temperature).toBe(0);

      expect(body.messages[0]).toMatchObject({
        role: "system",
      });

      expect(body.messages[0].content).toContain(
        "You are a constrained intent and entity parser",
      );

      expect(body.messages[1]).toEqual({
        role: "user",
        content: "What phone number is on my account?",
      });
    });
  });

  describe("valid responses", () => {
    it("returns a valid structured account-read action", async () => {
      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(
          JSON.stringify({
            action: "read_account",
            fields: {
              requestedField: "phone",
            },
            missingFields: [],
          }),
        ),
      );

      const result = await parseMessage("What phone number is on my account?");

      expect(result).toEqual({
        action: "read_account",
        fields: {
          requestedField: "phone",
        },
        missingFields: [],
      });
    });

    it("returns a valid action containing missing fields", async () => {
      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(
          JSON.stringify({
            action: "update_account_holder",
            fields: {},
            missingFields: ["phone"],
          }),
        ),
      );

      const result = await parseMessage("Change my phone number");

      expect(result).toEqual({
        action: "update_account_holder",
        fields: {},
        missingFields: ["phone"],
      });
    });

    it("extracts JSON from a markdown code fence", async () => {
      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(`
\`\`\`json
{
  "action": "read_preferred_contact_method",
  "fields": {},
  "missingFields": []
}
\`\`\`
        `),
      );

      const result = await parseMessage("What is my preferred contact method?");

      expect(result).toEqual({
        action: "read_preferred_contact_method",
        fields: {},
        missingFields: [],
      });
    });

    it("extracts a JSON object surrounded by additional text", async () => {
      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(`
Here is the result:
{
  "action": "read_transactions",
  "fields": {},
  "missingFields": []
}
End of result.
        `),
      );

      const result = await parseMessage("Show my transactions");

      expect(result).toEqual({
        action: "read_transactions",
        fields: {},
        missingFields: [],
      });
    });
  });

  describe("pending actions", () => {
    it("includes a concrete pending action in the system prompt", async () => {
      const pendingAction: PendingChatAction = {
        action: "add_related_person",
        fields: {
          relationship: "brother",
          authorizedToAct: "true",
        },
        missingFields: ["name", "email", "phone"],
      };

      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(
          JSON.stringify({
            action: "add_related_person",
            fields: {
              relationship: "brother",
              authorizedToAct: "true",
              name: "Mark Murphy",
              email: "mark@example.test",
              phone: "+353831998877",
            },
            missingFields: [],
          }),
        ),
      );

      const result = await parseMessage(
        "Mark Murphy, mark@example.test, +353831998877",
        pendingAction,
      );

      const body = getRequestBody();
      const systemMessage = body.messages[0].content;

      expect(systemMessage).toContain(
        "There is an unfinished concrete action from the previous turn.",
      );

      expect(systemMessage).toContain(JSON.stringify(pendingAction));

      expect(result).toEqual({
        action: "add_related_person",
        fields: {
          relationship: "brother",
          authorizedToAct: "true",
          name: "Mark Murphy",
          email: "mark@example.test",
          phone: "+353831998877",
        },
        missingFields: [],
      });
    });

    it("includes a pending clarification in the system prompt", async () => {
      const pendingAction: PendingChatAction = {
        action: "clarify",
        fields: {
          intentType: "update",
        },
        missingFields: ["action"],
      };

      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(
          JSON.stringify({
            action: "update_account_holder",
            fields: {},
            missingFields: ["phone"],
          }),
        ),
      );

      const result = await parseMessage("phone number", pendingAction);

      const body = getRequestBody();
      const systemMessage = body.messages[0].content;

      expect(systemMessage).toContain(
        "There is an unfinished clarification request from the previous turn.",
      );

      expect(systemMessage).toContain(JSON.stringify(pendingAction));

      expect(result).toEqual({
        action: "update_account_holder",
        fields: {},
        missingFields: ["phone"],
      });
    });
  });

  describe("invalid JSON retry", () => {
    it("retries once when the first response is not valid JSON", async () => {
      fetchMock
        .mockResolvedValueOnce(createOpenRouterResponse("This is not JSON."))
        .mockResolvedValueOnce(
          createOpenRouterResponse(
            JSON.stringify({
              action: "read_account",
              fields: {
                requestedField: "email",
              },
              missingFields: [],
            }),
          ),
        );

      const result = await parseMessage("What email address is on my account?");

      expect(fetchMock).toHaveBeenCalledTimes(2);

      expect(result).toEqual({
        action: "read_account",
        fields: {
          requestedField: "email",
        },
        missingFields: [],
      });

      const retryBody = getRequestBody(1);
      const retrySystemPrompt = retryBody.messages[0].content;

      expect(retrySystemPrompt).toContain("CRITICAL OUTPUT REQUIREMENT");

      expect(retrySystemPrompt).toContain(
        "Return exactly one valid JSON object.",
      );
    });

    it("throws when both OpenRouter responses contain invalid JSON", async () => {
      fetchMock
        .mockResolvedValueOnce(
          createOpenRouterResponse("First invalid response"),
        )
        .mockResolvedValueOnce(
          createOpenRouterResponse("Second invalid response"),
        );

      await expect(parseMessage("What is my balance?")).rejects.toThrow(
        "OpenRouter returned invalid JSON after retry: Second invalid response",
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("runtime response validation", () => {
    it("rejects an unsupported or hallucinated action", async () => {
      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(
          JSON.stringify({
            action: "delete_account",
            fields: {},
            missingFields: [],
          }),
        ),
      );

      await expect(parseMessage("Delete my account")).rejects.toThrow(
        "OpenRouter returned an invalid action structure",
      );

      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("rejects a response without fields", async () => {
      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(
          JSON.stringify({
            action: "read_account",
            missingFields: [],
          }),
        ),
      );

      await expect(parseMessage("What is my balance?")).rejects.toThrow(
        "OpenRouter returned an invalid action structure",
      );
    });

    it("rejects a response without missingFields", async () => {
      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(
          JSON.stringify({
            action: "read_account",
            fields: {
              requestedField: "balance",
            },
          }),
        ),
      );

      await expect(parseMessage("What is my balance?")).rejects.toThrow(
        "OpenRouter returned an invalid action structure",
      );
    });

    it("rejects fields containing a non-string value", async () => {
      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(
          JSON.stringify({
            action: "mock_payment",
            fields: {
              amount: 15000,
            },
            missingFields: [],
          }),
        ),
      );

      await expect(parseMessage("Pay 150 euro now")).rejects.toThrow(
        "OpenRouter returned an invalid action structure",
      );
    });

    it("rejects nested objects inside fields", async () => {
      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(
          JSON.stringify({
            action: "update_account_holder",
            fields: {
              address: {
                city: "Carlow",
              },
            },
            missingFields: [],
          }),
        ),
      );

      await expect(parseMessage("Change my city to Carlow")).rejects.toThrow(
        "OpenRouter returned an invalid action structure",
      );
    });

    it("rejects a non-array missingFields value", async () => {
      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(
          JSON.stringify({
            action: "update_account_holder",
            fields: {},
            missingFields: "phone",
          }),
        ),
      );

      await expect(parseMessage("Change my phone number")).rejects.toThrow(
        "OpenRouter returned an invalid action structure",
      );
    });

    it("rejects duplicate missing fields", async () => {
      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(
          JSON.stringify({
            action: "update_account_holder",
            fields: {},
            missingFields: ["phone", "phone"],
          }),
        ),
      );

      await expect(parseMessage("Change my phone number")).rejects.toThrow(
        "OpenRouter returned an invalid action structure",
      );
    });

    it("rejects empty strings inside missingFields", async () => {
      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(
          JSON.stringify({
            action: "update_account_holder",
            fields: {},
            missingFields: [""],
          }),
        ),
      );

      await expect(parseMessage("Change my account details")).rejects.toThrow(
        "OpenRouter returned an invalid action structure",
      );
    });

    it("rejects an array instead of a response object", async () => {
      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse(
          JSON.stringify([
            {
              action: "read_account",
              fields: {},
              missingFields: [],
            },
          ]),
        ),
      );

      await expect(parseMessage("Show my account")).rejects.toThrow(
        "OpenRouter returned an invalid action structure",
      );
    });
  });

  describe("provider failures", () => {
    it("returns an observable error when OpenRouter responds with a failure status", async () => {
      fetchMock.mockResolvedValueOnce(
        createOpenRouterResponse("", {
          ok: false,
          status: 429,
          errorText: "Rate limit exceeded",
        }),
      );

      await expect(parseMessage("What is my balance?")).rejects.toThrow(
        "OpenRouter request failed with status 429: Rate limit exceeded",
      );

      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("rejects an empty OpenRouter response", async () => {
      fetchMock.mockResolvedValueOnce(createOpenRouterResponse("   "));

      await expect(parseMessage("What is my balance?")).rejects.toThrow(
        "OpenRouter returned an empty response.",
      );
    });

    it("propagates a network failure", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network connection failed."));

      await expect(parseMessage("What is my balance?")).rejects.toThrow(
        "Network connection failed.",
      );

      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });
});
