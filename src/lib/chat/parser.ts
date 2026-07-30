import type {
  ChatAction,
  OpenRouterResponse,
  ParsedAction,
  PendingChatAction,
} from "@/lib/chat/types";

import { createSystemPrompt } from "./prompt";

const CHAT_ACTIONS = [
  "read_account",
  "update_account_holder",
  "read_preferred_contact_method",
  "update_preferred_contact_method",
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
  "clarify",
  "unsupported",
] as const satisfies readonly ChatAction[];

const RETRY_OUTPUT_REQUIREMENT = `
CRITICAL OUTPUT REQUIREMENT:

Return exactly one valid JSON object.

Do not return markdown, code fences, explanations, safety classifications,
labels, comments, or any text before or after the JSON object.

The first character of the response must be {
The final character of the response must be }
`;

export async function parseMessage(
  message: string,
  pendingAction?: PendingChatAction,
): Promise<ParsedAction> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  if (!model) {
    throw new Error("OPENROUTER_MODEL is not configured.");
  }

  const normalizedMessage = message.trim();

  if (!normalizedMessage) {
    return {
      action: "unsupported",
      fields: {},
      missingFields: [],
    };
  }

  const systemPrompt = createSystemPrompt({
    currentDate: getCurrentDate(),
    pendingAction,
  });

  let content = await requestParsedAction(
    apiKey,
    model,
    systemPrompt,
    normalizedMessage,
  );

  let parsed: unknown;

  try {
    parsed = parseJsonContent(content);
  } catch {
    console.warn("OpenRouter returned invalid JSON. Retrying once:", content);

    const retrySystemPrompt = `${systemPrompt}
${RETRY_OUTPUT_REQUIREMENT}`;

    content = await requestParsedAction(
      apiKey,
      model,
      retrySystemPrompt,
      normalizedMessage,
    );

    try {
      parsed = parseJsonContent(content);
    } catch {
      throw new Error(
        `OpenRouter returned invalid JSON after retry: ${content}`,
      );
    }
  }

  if (!isParsedAction(parsed)) {
    throw new Error(
      `OpenRouter returned an invalid action structure: ${content}`,
    );
  }

  console.log("Parsed action:", parsed);
  return {
    action: parsed.action,
    fields: parsed.fields,
    missingFields: parsed.missingFields,
  };
}

async function requestParsedAction(
  apiKey: string,
  model: string,
  systemPrompt: string,
  normalizedMessage: string,
): Promise<string> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
        "X-OpenRouter-Title": "PayPathIQ Account Portal",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: normalizedMessage,
          },
        ],
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `OpenRouter request failed with status ${response.status}: ${errorText}`,
    );
  }

  const data = (await response.json()) as OpenRouterResponse;
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }

  return content;
}

function getCurrentDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseJsonContent(content: string): unknown {
  const cleaned = removeMarkdownCodeFence(content).trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return JSON.parse(extractJsonObject(cleaned));
  }
}

function extractJsonObject(content: string): string {
  const cleaned = removeMarkdownCodeFence(content).trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error(`No JSON object found in OpenRouter response: ${content}`);
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

function removeMarkdownCodeFence(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

function isParsedAction(value: unknown): value is ParsedAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<ParsedAction>;

  return (
    isChatAction(candidate.action) &&
    isStringRecord(candidate.fields) &&
    isStringArray(candidate.missingFields)
  );
}

function isChatAction(value: unknown): value is ChatAction {
  return (
    typeof value === "string" && CHAT_ACTIONS.some((action) => action === value)
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (fieldValue) => typeof fieldValue === "string",
  );
}

function isStringArray(value: unknown): value is string[] {
  if (!Array.isArray(value)) {
    return false;
  }

  const containsValidStrings = value.every(
    (item) => typeof item === "string" && item.trim().length > 0,
  );

  if (!containsValidStrings) {
    return false;
  }

  return new Set(value).size === value.length;
}
