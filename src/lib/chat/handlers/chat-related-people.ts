import {
  addRelatedPerson,
  getRelatedPeople,
  removeRelatedPerson,
  updateRelatedPerson,
} from "@/lib/account/services/related-people";

import type {
  CreateRelatedPersonInput,
  RelatedPerson,
  RelatedPersonRow,
  UpdateRelatedPersonInput,
} from "@/lib/account/types";

import type {
  ChatActionResult,
  ParsedAction,
  PendingChatAction,
} from "@/lib/chat/types";

export async function handleRelatedPeople({
  accountId,
  parsedAction,
}: {
  accountId: string;
  parsedAction: ParsedAction;
}): Promise<ChatActionResult> {
  switch (parsedAction.action) {
    case "read_related_people":
      return handleReadRelatedPeople(accountId);

    case "add_related_person":
      return handleAddRelatedPerson(accountId, parsedAction);

    case "update_related_person":
      return handleUpdateRelatedPerson(accountId, parsedAction);

    case "remove_related_person":
      return handleRemoveRelatedPerson(accountId, parsedAction);

    default:
      return {
        action: parsedAction.action,
        success: false,
        reply: "The related person request could not be completed.",
      };
  }
}

async function handleReadRelatedPeople(
  accountId: string,
): Promise<ChatActionResult> {
  try {
    const rows = await getRelatedPeople(accountId);
    const relatedPeople = rows.map(mapRelatedPersonRow);

    if (relatedPeople.length === 0) {
      return {
        action: "read_related_people",
        success: true,
        reply: "There are no related people on your account.",
        relatedPeople,
      };
    }

    const reply = relatedPeople
      .map((person) => {
        const authorization = person.authorizedToAct
          ? "authorized to act"
          : "not authorized to act";

        const relationship = person.relationship
          ? `, relationship: ${person.relationship}`
          : "";

        return `${person.name}${relationship}, email: ${person.email}, phone: ${person.phone}, ${authorization}`;
      })
      .join("; ");

    return {
      action: "read_related_people",
      success: true,
      reply: `The related people on your account are: ${reply}.`,
      relatedPeople,
    };
  } catch (error) {
    return actionFailure("read_related_people", error);
  }
}

async function handleAddRelatedPerson(
  accountId: string,
  parsedAction: ParsedAction,
): Promise<ChatActionResult> {
  const missingFieldReply = getMissingFieldReply(
    "add_related_person",
    parsedAction.missingFields,
  );

  if (missingFieldReply) {
    return createPendingResult(
      parsedAction,
      missingFieldReply,
      parsedAction.missingFields,
    );
  }

  try {
    const input = mapAddFields(parsedAction.fields);
    const account = await addRelatedPerson(accountId, input);

    return {
      action: "add_related_person",
      success: true,
      reply: `${input.name} has been added as a related person.`,
      account,
      relatedPeople: account.relatedPeople,
      notificationQueued: false,
    };
  } catch (error) {
    return actionFailure("add_related_person", error);
  }
}

async function handleUpdateRelatedPerson(
  accountId: string,
  parsedAction: ParsedAction,
): Promise<ChatActionResult> {
  const missingFieldReply = getMissingFieldReply(
    "update_related_person",
    parsedAction.missingFields,
  );

  if (missingFieldReply) {
    return createPendingResult(
      parsedAction,
      missingFieldReply,
      parsedAction.missingFields,
    );
  }

  const personName = parsedAction.fields.personName?.trim();

  if (!personName) {
    return createPendingResult(
      parsedAction,
      "Which related person would you like to update?",
      ["personName"],
    );
  }

  try {
    const relatedPeople = await getRelatedPeople(accountId);
    const matches = findRelatedPeopleByName(relatedPeople, personName);

    if (matches.length === 0) {
      return {
        action: "update_related_person",
        success: false,
        reply: `I could not find a related person matching ${personName}.`,
      };
    }

    if (matches.length > 1) {
      return createPendingResult(
        parsedAction,
        `I found more than one related person matching ${personName}. Please provide the full name.`,
        ["personName"],
      );
    }

    const updateInput = mapUpdateFields(parsedAction.fields);

    if (Object.keys(updateInput).length === 0) {
      return createPendingResult(
        parsedAction,
        `What information would you like to update for ${matches[0].name}?`,
        ["relatedPersonField"],
      );
    }

    const account = await updateRelatedPerson(
      accountId,
      matches[0].id,
      updateInput,
    );

    return {
      action: "update_related_person",
      success: true,
      reply: `${matches[0].name}'s information has been updated successfully.`,
      account,
      relatedPeople: account.relatedPeople,
      notificationQueued: false,
    };
  } catch (error) {
    return actionFailure("update_related_person", error);
  }
}

async function handleRemoveRelatedPerson(
  accountId: string,
  parsedAction: ParsedAction,
): Promise<ChatActionResult> {
  const missingFieldReply = getMissingFieldReply(
    "remove_related_person",
    parsedAction.missingFields,
  );

  if (missingFieldReply) {
    return createPendingResult(
      parsedAction,
      missingFieldReply,
      parsedAction.missingFields,
    );
  }

  const personName = parsedAction.fields.personName?.trim();

  if (!personName) {
    return createPendingResult(
      parsedAction,
      "Which related person would you like to remove?",
      ["personName"],
    );
  }

  try {
    const relatedPeople = await getRelatedPeople(accountId);
    const matches = findRelatedPeopleByName(relatedPeople, personName);

    if (matches.length === 0) {
      return {
        action: "remove_related_person",
        success: false,
        reply: `I could not find a related person matching ${personName}.`,
      };
    }

    if (matches.length > 1) {
      return createPendingResult(
        parsedAction,
        `I found more than one related person matching ${personName}. Please provide the full name.`,
        ["personName"],
      );
    }

    const account = await removeRelatedPerson(accountId, matches[0].id);

    return {
      action: "remove_related_person",
      success: true,
      reply: `${matches[0].name} has been removed from your related people.`,
      account,
      relatedPeople: account.relatedPeople,
      notificationQueued: false,
    };
  } catch (error) {
    return actionFailure("remove_related_person", error);
  }
}

function mapAddFields(
  fields: Record<string, string>,
): CreateRelatedPersonInput {
  const authorizedToAct = parseAuthorizedToAct(fields.authorizedToAct);

  if (!fields.name) {
    throw new Error("Please provide the related person's name.");
  }

  if (!fields.email) {
    throw new Error("Please provide the related person's email address.");
  }

  if (!fields.phone) {
    throw new Error("Please provide the related person's phone number.");
  }

  if (authorizedToAct === undefined) {
    throw new Error(
      "Please confirm whether the related person is authorized to act.",
    );
  }

  return {
    name: fields.name,
    email: fields.email,
    phone: fields.phone,
    relationship: fields.relationship,
    authorizedToAct,
  };
}

function mapUpdateFields(
  fields: Record<string, string>,
): UpdateRelatedPersonInput {
  const updateInput: UpdateRelatedPersonInput = {};

  if (fields.newName !== undefined) {
    updateInput.name = fields.newName;
  }

  if (fields.email !== undefined) {
    updateInput.email = fields.email;
  }

  if (fields.phone !== undefined) {
    updateInput.phone = fields.phone;
  }

  if (fields.relationship !== undefined) {
    updateInput.relationship = fields.relationship;
  }

  if (fields.authorizedToAct !== undefined) {
    const authorizedToAct = parseAuthorizedToAct(fields.authorizedToAct);

    if (authorizedToAct === undefined) {
      throw new Error("Authorization status must be either true or false.");
    }

    updateInput.authorizedToAct = authorizedToAct;
  }

  return updateInput;
}

function parseAuthorizedToAct(value?: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  return undefined;
}

function findRelatedPeopleByName(
  relatedPeople: RelatedPersonRow[],
  personName: string,
): RelatedPersonRow[] {
  const normalizedName = personName.trim().toLowerCase();

  if (!normalizedName) {
    return [];
  }

  return relatedPeople.filter((person) =>
    person.name.trim().toLowerCase().includes(normalizedName),
  );
}

function mapRelatedPersonRow(row: RelatedPersonRow): RelatedPerson {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    relationship: row.relationship ?? undefined,
    authorizedToAct: row.authorized_to_act,
  };
}

function getMissingFieldReply(
  action: ParsedAction["action"],
  missingFields: string[],
): string | null {
  if (missingFields.length === 0) {
    return null;
  }

  if (action === "add_related_person") {
    if (missingFields.length === 1 && missingFields[0] === "authorizedToAct") {
      return "Should this person be authorized to speak or act on your behalf?";
    }

    const labels: Record<string, string> = {
      name: "full name",
      email: "email address",
      phone: "phone number",
      authorizedToAct:
        "whether they should be authorized to act on your behalf",
    };

    const missing = missingFields.map((field) => labels[field]).filter(Boolean);

    return `Please provide ${missing.join(", ")}.`;
  }

  if (missingFields.includes("personName")) {
    return action === "remove_related_person"
      ? "Which related person would you like to remove?"
      : "Which related person would you like to update?";
  }

  if (missingFields.includes("phone")) {
    return "What is the related person's phone number?";
  }

  if (missingFields.includes("email")) {
    return "What is the related person's email address?";
  }

  return "Please provide the missing related person information.";
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
        : "The related person request could not be completed.",
  };
}
