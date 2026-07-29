import type {
  AccountContext,
  CallAppointment,
  ContactMethod,
  PromiseToPay,
  RelatedPerson,
  Transaction,
} from "@/lib/account/types";

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

function mapRelatedPerson(row: RelatedPersonRow): RelatedPerson {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    relationship: row.relationship ?? undefined,
    authorizedToAct: row.authorized_to_act,
  };
}

function mapPromiseToPay(row: PromiseToPayRow): PromiseToPay {
  return {
    id: row.id,
    amountCents: row.amount_cents,
    currency: row.currency,
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    amountCents: row.amount_cents,
    currency: row.currency,
    description: row.description,
    transactionDate: row.transaction_date,
  };
}

function mapCallAppointment(row: CallAppointmentRow): CallAppointment {
  return {
    id: row.id,
    scheduledAt: row.scheduled_at,
    phone: row.phone,
    reason: row.reason ?? undefined,
    status: row.status,
  };
}

export function mapAccountContext({
  accountHolder,
  relatedPeople,
  promisesToPay,
  transactions,
  callAppointments,
}: AccountContextRows): AccountContext {
  return {
    account: {
      accountId: accountHolder.account_id,
      accountHolderFirstName: accountHolder.first_name,
      accountHolderLastName: accountHolder.last_name,
      email: accountHolder.email,
      phone: accountHolder.phone,

      address: {
        line1: accountHolder.address_line1,
        line2: accountHolder.address_line2 ?? undefined,
        city: accountHolder.city,
        postalCode: accountHolder.postal_code,
        country: accountHolder.country,
      },

      preferredContactMethod: accountHolder.preferred_contact_method,
      reference: accountHolder.reference,
      creditorName: accountHolder.creditor_name,
      currency: accountHolder.currency,
      balanceCents: accountHolder.balance_cents,
      status: accountHolder.status,
      daysPastDue: accountHolder.days_past_due,
      minimumPaymentCents: accountHolder.minimum_payment_cents,
      lastPaymentDate: accountHolder.last_payment_date ?? "",
      lastPaymentAmountCents: accountHolder.last_payment_amount_cents,
    },

    billing: {
      currentAmountCents: accountHolder.balance_cents,
      lastStatementAmountCents: accountHolder.balance_cents,
      dueDate:
        promisesToPay.find((promise) => promise.status === "active")
          ?.due_date ?? "",
    },

    paymentOptions: {
      payNowEnabled: true,
      promiseToPayEnabled: true,
      mockPaymentsEnabled: true,
      arrangementEnabled: false,
      eligibleArrangementOptions: [],
    },

    support: {
      humanSupportAvailable: true,
      supportPhone: "+3531800000000",
      supportEmail: "support@example.test",
    },

    relatedPeople: relatedPeople.map(mapRelatedPerson),

    promisesToPay: promisesToPay.map(mapPromiseToPay),

    transactions: transactions.map(mapTransaction),

    callAppointments: callAppointments.map(mapCallAppointment),

    notificationRules: {
      sendEmailOnDataChange: true,
      pdfPasswordSource: "account_phone_last4",
    },
  };
}
