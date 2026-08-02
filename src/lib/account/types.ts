export type ContactMethod = "email" | "sms" | "phone";

export type Address = {
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  country: string;
};

export type AccountHolder = {
  accountId: string;
  accountHolderFirstName: string;
  accountHolderLastName: string;
  email: string;
  phone: string;
  address: Address;
  preferredContactMethod: ContactMethod;
  reference: string;
  creditorName: string;
  currency: string;
  balanceCents: number;
  status: string;
  daysPastDue: number;
  minimumPaymentCents: number;
  lastPaymentDate: string;
  lastPaymentAmountCents: number;
};

export type UpdateAccountHolderInput = {
  accountHolderFirstName?: string;
  accountHolderLastName?: string;
  email?: string;
  phone?: string;
  address?: Partial<Address>;
  preferredContactMethod?: ContactMethod;
};

export type RelatedPerson = {
  id: string;
  name: string;
  email: string;
  phone: string;
  relationship?: string;
  authorizedToAct: boolean;
};

export type PromiseToPay = {
  id: string;
  amountCents: number;
  currency: string;
  dueDate: string;
  status: "active" | "completed" | "cancelled" | "missed";
  createdAt: string;
};

export type Transaction = {
  id: string;
  type: "payment" | "charge" | "fee" | "adjustment";
  status: "completed" | "pending" | "failed" | "posted";
  amountCents: number;
  currency: string;
  description: string;
  transactionDate: string;
};

export type CallAppointment = {
  id: string;
  scheduledAt: string;
  phone: string;
  reason?: string;
  status: "scheduled" | "cancelled" | "completed";
};

export type AccountContext = {
  account: AccountHolder;
  billing: {
    currentAmountCents: number;
    lastStatementAmountCents: number;
    dueDate: string;
  };
  paymentOptions: {
    payNowEnabled: boolean;
    promiseToPayEnabled: boolean;
    mockPaymentsEnabled: boolean;
    arrangementEnabled: boolean;
    eligibleArrangementOptions: Array<{
      frequency: string;
      installments: number;
      suggestedAmountCents: number;
    }>;
  };
  support: {
    humanSupportAvailable: boolean;
    supportPhone: string;
    supportEmail: string;
  };
  relatedPeople: RelatedPerson[];
  promisesToPay: PromiseToPay[];
  transactions: Transaction[];
  callAppointments: CallAppointment[];
  notificationRules: {
    sendEmailOnDataChange: boolean;
    pdfPasswordSource: "account_phone_last4";
  };
  faqContext?: {
    recentStatementReason?: string;
    acceptedPaymentMethods?: string[];
  };
  riskFlags?: Record<string, boolean>;
};

export type LegacyFixtureAccount = Omit<
  AccountHolder,
  "accountHolderFirstName" | "accountHolderLastName" | "preferredContactMethod"
> & {
  debtorFirstName: string;
  debtorLastName: string;
  preferredContactMethod: string;
};

export type LegacyPromiseToPay = Omit<PromiseToPay, "status"> & {
  status: string;
};

export type LegacyTransaction = Omit<Transaction, "type" | "status"> & {
  type: string;
  status: string;
};

export type LegacyCallAppointment = Omit<CallAppointment, "status"> & {
  status: string;
};

export type LegacyAccountFixture = Omit<
  AccountContext,
  | "account"
  | "promisesToPay"
  | "transactions"
  | "callAppointments"
  | "notificationRules"
> & {
  account: LegacyFixtureAccount;
  promisesToPay: LegacyPromiseToPay[];
  transactions: LegacyTransaction[];
  callAppointments: LegacyCallAppointment[];
  notificationRules: {
    sendEmailOnDataChange: boolean;
    pdfPasswordSource: string;
  };
};

function normalizeContactMethod(value: string): ContactMethod {
  if (value === "email" || value === "sms" || value === "phone") {
    return value;
  }

  return "email";
}

export function normalizeLegacyFixture(
  fixture: LegacyAccountFixture,
): AccountContext {
  return {
    ...fixture,
    account: {
      ...fixture.account,
      accountHolderFirstName: fixture.account.debtorFirstName,
      accountHolderLastName: fixture.account.debtorLastName,
      preferredContactMethod: normalizeContactMethod(
        fixture.account.preferredContactMethod,
      ),
    },
    promisesToPay: fixture.promisesToPay as PromiseToPay[],
    transactions: fixture.transactions as Transaction[],
    callAppointments: fixture.callAppointments as CallAppointment[],
    notificationRules: {
      sendEmailOnDataChange: fixture.notificationRules.sendEmailOnDataChange,
      pdfPasswordSource: "account_phone_last4",
    },
  };
}

export type DatabaseError = {
  message: string;
};

export type AccountHolderUpdateRow = Partial<
  Pick<
    AccountHolderRow,
    | "first_name"
    | "last_name"
    | "email"
    | "phone"
    | "address_line1"
    | "address_line2"
    | "city"
    | "postal_code"
    | "country"
    | "preferred_contact_method"
  >
>;

export type AccountHolderRow = {
  id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  postal_code: string;
  country: string;
  preferred_contact_method: ContactMethod;
  reference: string;
  creditor_name: string;
  currency: string;
  balance_cents: number;
  status: string;
  days_past_due: number;
  minimum_payment_cents: number;
  last_payment_date: string | null;
  last_payment_amount_cents: number;
  created_at: string;
  updated_at: string;
};

export type RelatedPersonRow = {
  id: string;
  account_holder_id: string;
  name: string;
  email: string;
  phone: string;
  relationship: string | null;
  authorized_to_act: boolean;
  created_at: string;
  updated_at: string;
};

export type PromiseToPayRow = {
  id: string;
  account_holder_id: string;
  amount_cents: number;
  currency: string;
  due_date: string;
  status: PromiseToPay["status"];
  created_at: string;
};

export type TransactionRow = {
  id: string;
  account_holder_id: string;
  type: Transaction["type"];
  status: Transaction["status"];
  amount_cents: number;
  currency: string;
  description: string;
  transaction_date: string;
  created_at: string;
};

export type CallAppointmentRow = {
  id: string;
  account_holder_id: string;
  scheduled_at: string;
  phone: string;
  reason: string | null;
  status: CallAppointment["status"];
  created_at: string;
  updated_at: string;
};

export type AccountContextRows = {
  accountHolder: AccountHolderRow;
  relatedPeople: RelatedPersonRow[];
  promisesToPay: PromiseToPayRow[];
  transactions: TransactionRow[];
  callAppointments: CallAppointmentRow[];
};

export type CreateRelatedPersonInput = {
  name: string;
  email: string;
  phone: string;
  relationship?: string;
  authorizedToAct: boolean;
};

export type UpdateRelatedPersonInput = Partial<CreateRelatedPersonInput>;

export type RelatedPersonInsertRow = {
  account_holder_id: string;
  name: string;
  email: string;
  phone: string;
  relationship: string | null;
  authorized_to_act: boolean;
};

export type RelatedPersonUpdateRow = Partial<
  Pick<
    RelatedPersonRow,
    "name" | "email" | "phone" | "relationship" | "authorized_to_act"
  >
>;
