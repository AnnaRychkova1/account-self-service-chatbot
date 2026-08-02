import { updateAccountHolder } from "@/lib/account/services/account-update";

import type { UpdateAccountHolderInput } from "@/lib/account/types";
import type { ChatActionResult, ParsedAction } from "../types";

type NotificationInput = {
  accountId: string;
  changedFields: string[];
};

export async function handleUpdateAccountHolder({
  accountId,
  parsedAction,
}: {
  accountId: string;
  parsedAction: ParsedAction;
}): Promise<ChatActionResult> {
  const action = parsedAction.action;

  const missingFieldReply = getMissingFieldReply(parsedAction.missingFields);

  if (missingFieldReply) {
    return {
      action,
      success: false,
      reply: missingFieldReply,
    };
  }

  try {
    const updateInput = mapFieldsToUpdateInput(parsedAction.fields);

    if (Object.keys(updateInput).length === 0) {
      return {
        action,
        success: false,
        reply:
          action === "update_preferred_contact_method"
            ? "Which contact method would you prefer: email, SMS, or phone?"
            : "What account-holder information would you like to update? You can change your name, email, phone number, address, or preferred contact method.",
      };
    }

    const account = await updateAccountHolder(accountId, updateInput);

    const notificationQueued = await queueAccountChangeNotification({
      accountId,
      changedFields: getChangedFields(updateInput),
    });

    return {
      action,
      success: true,
      reply: getSuccessReply(parsedAction, updateInput),
      account,
      notificationQueued,
    };
  } catch (error) {
    return {
      action,
      success: false,
      reply:
        error instanceof Error
          ? error.message
          : "The request could not be completed.",
    };
  }
}

function mapFieldsToUpdateInput(
  fields: Record<string, string>,
): UpdateAccountHolderInput {
  const updateInput: UpdateAccountHolderInput = {};

  if (fields.firstName !== undefined) {
    updateInput.accountHolderFirstName = fields.firstName;
  }

  if (fields.lastName !== undefined) {
    updateInput.accountHolderLastName = fields.lastName;
  }

  if (fields.email !== undefined) {
    updateInput.email = fields.email;
  }

  if (fields.phone !== undefined) {
    updateInput.phone = fields.phone;
  }

  if (fields.preferredContactMethod !== undefined) {
    const preferredContactMethod = fields.preferredContactMethod.toLowerCase();

    if (
      preferredContactMethod !== "email" &&
      preferredContactMethod !== "sms" &&
      preferredContactMethod !== "phone"
    ) {
      throw new Error("Preferred contact method must be email, SMS, or phone.");
    }

    updateInput.preferredContactMethod = preferredContactMethod;
  }

  const address: NonNullable<UpdateAccountHolderInput["address"]> = {};

  if (fields.addressLine1 !== undefined) {
    address.line1 = fields.addressLine1;
  }

  if (fields.addressLine2 !== undefined) {
    address.line2 = fields.addressLine2;
  }

  if (fields.city !== undefined) {
    address.city = fields.city;
  }

  if (fields.postalCode !== undefined) {
    address.postalCode = fields.postalCode;
  }

  if (fields.country !== undefined) {
    address.country = fields.country;
  }

  if (Object.keys(address).length > 0) {
    updateInput.address = address;
  }

  return updateInput;
}

function getMissingFieldReply(missingFields: string[]): string | null {
  if (missingFields.length === 0) {
    return null;
  }

  if (
    missingFields.includes("firstName") &&
    missingFields.includes("lastName")
  ) {
    return "What first and last name would you like to use?";
  }

  if (missingFields.includes("firstName")) {
    return "What first name would you like to use?";
  }

  if (missingFields.includes("lastName")) {
    return "What last name would you like to use?";
  }

  if (missingFields.includes("phone")) {
    return "What phone number would you like to use?";
  }

  if (missingFields.includes("email")) {
    return "What email address would you like to use?";
  }

  if (missingFields.includes("preferredContactMethod")) {
    return "Which contact method would you prefer: email, SMS, or phone?";
  }

  if (missingFields.includes("addressLine1")) {
    return "What street address would you like to use?";
  }

  if (missingFields.includes("addressLine2")) {
    return "What additional address information would you like to use?";
  }

  if (missingFields.includes("city")) {
    return "What city would you like to use?";
  }

  if (missingFields.includes("postalCode")) {
    return "What postal code would you like to use?";
  }

  if (missingFields.includes("country")) {
    return "What country would you like to use?";
  }

  return "Please provide the missing account-holder information.";
}

function getSuccessReply(
  parsedAction: ParsedAction,
  updateInput: UpdateAccountHolderInput,
): string {
  if (
    parsedAction.action === "update_preferred_contact_method" &&
    updateInput.preferredContactMethod
  ) {
    return `Your preferred contact method has been updated to ${updateInput.preferredContactMethod}.`;
  }

  return "Your account information has been updated successfully.";
}

function getChangedFields(updateInput: UpdateAccountHolderInput): string[] {
  const changedFields: string[] = [];

  if (updateInput.accountHolderFirstName !== undefined) {
    changedFields.push("firstName");
  }

  if (updateInput.accountHolderLastName !== undefined) {
    changedFields.push("lastName");
  }

  if (updateInput.email !== undefined) {
    changedFields.push("email");
  }

  if (updateInput.phone !== undefined) {
    changedFields.push("phone");
  }

  if (updateInput.preferredContactMethod !== undefined) {
    changedFields.push("preferredContactMethod");
  }

  if (updateInput.address?.line1 !== undefined) {
    changedFields.push("addressLine1");
  }

  if (updateInput.address?.line2 !== undefined) {
    changedFields.push("addressLine2");
  }

  if (updateInput.address?.city !== undefined) {
    changedFields.push("city");
  }

  if (updateInput.address?.postalCode !== undefined) {
    changedFields.push("postalCode");
  }

  if (updateInput.address?.country !== undefined) {
    changedFields.push("country");
  }

  return changedFields;
}

async function queueAccountChangeNotification(
  input: NotificationInput,
): Promise<boolean> {
  void input;

  return false;
}
