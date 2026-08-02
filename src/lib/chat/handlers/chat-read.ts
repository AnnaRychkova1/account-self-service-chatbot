import { getAccount } from "@/lib/account/services/account-get";

import type { AccountContext } from "@/lib/account/types";
import type { ChatActionResult, ParsedAction } from "../types";

export async function handleReadAccountHolder({
  accountId,
  parsedAction,
}: {
  accountId: string;
  parsedAction: ParsedAction;
}): Promise<ChatActionResult> {
  try {
    const accountContext = await getAccount(accountId);

    const reply =
      parsedAction.action === "read_preferred_contact_method"
        ? getPreferredContactMethodReply(accountContext)
        : getAccountFieldReply(accountContext, parsedAction);

    return {
      action: parsedAction.action,
      success: true,
      reply,
      account: accountContext,
    };
  } catch (error) {
    return {
      action: parsedAction.action,
      success: false,
      reply:
        error instanceof Error
          ? error.message
          : "The account information could not be loaded.",
    };
  }
}

function getAccountFieldReply(
  accountContext: AccountContext,
  parsedAction: ParsedAction,
): string {
  const requestedField =
    parsedAction.fields.requestedField ??
    parsedAction.fields.accountField ??
    parsedAction.fields.field;

  const account = accountContext.account;

  if (!requestedField) {
    return getAccountSummaryReply(accountContext);
  }

  switch (requestedField) {
    case "firstName":
      return `The first name on your account is ${account.accountHolderFirstName}.`;

    case "lastName":
      return `The last name on your account is ${account.accountHolderLastName}.`;

    case "name":
    case "fullName":
      return `The account-holder name is ${account.accountHolderFirstName} ${account.accountHolderLastName}.`;

    case "email":
      return `The email address on your account is ${account.email}.`;

    case "phone":
      return `The phone number on your account is ${account.phone}.`;

    case "address":
      return `The address on your account is ${formatAddress(accountContext)}.`;

    case "addressLine1":
      return `The first address line on your account is ${account.address.line1}.`;

    case "addressLine2":
      return account.address.line2
        ? `The second address line on your account is ${account.address.line2}.`
        : "There is no second address line on your account.";

    case "city":
      return `The city on your account is ${account.address.city}.`;

    case "postalCode":
      return `The postal code on your account is ${account.address.postalCode}.`;

    case "country":
      return `The country on your account is ${account.address.country}.`;

    case "preferredContactMethod":
      return getPreferredContactMethodReply(accountContext);
    case "balance":
      return `Your current account balance is ${formatCurrency(
        account.balanceCents,
        account.currency,
      )}.`;

    case "reference":
      return `Your account reference is ${account.reference}.`;

    case "creditorName":
      return `Your creditor is ${account.creditorName}.`;

    case "status":
      return `Your account status is ${account.status}.`;

    case "daysPastDue":
      return `Your account is ${account.daysPastDue} days past due.`;

    case "billingDueDate":
      return `Your billing due date is ${accountContext.billing.dueDate}.`;

    case "supportPhone":
      return `The support phone number is ${accountContext.support.supportPhone}.`;

    case "supportEmail":
      return `The support email address is ${accountContext.support.supportEmail}.`;

    case "lastPayment":
      return `Your last payment was ${formatCurrency(
        account.lastPaymentAmountCents,
        account.currency,
      )} on ${account.lastPaymentDate}.`;

    default:
      return "I could not identify which account detail you want to view.";
  }
}

function getPreferredContactMethodReply(
  accountContext: AccountContext,
): string {
  const method = accountContext.account.preferredContactMethod;

  return `Your preferred contact method is ${formatContactMethod(method)}.`;
}

function formatAddress(accountContext: AccountContext): string {
  const address = accountContext.account.address;

  return [
    address.line1,
    address.line2,
    address.city,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function formatContactMethod(method: string): string {
  return method === "sms" ? "SMS" : method;
}

function getAccountSummaryReply(accountContext: AccountContext): string {
  const account = accountContext.account;

  return [
    `Name: ${account.accountHolderFirstName} ${account.accountHolderLastName}`,
    `Email: ${account.email}`,
    `Phone: ${account.phone}`,
    `Address: ${formatAddress(accountContext)}`,
    `Preferred contact method: ${formatContactMethod(
      account.preferredContactMethod,
    )}`,
    `Current balance: ${formatCurrency(
      account.balanceCents,
      account.currency,
    )}`,
  ].join("\n");
}

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}
