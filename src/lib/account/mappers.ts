import type {
  AccountContext,
  AccountContextRows,
  CallAppointment,
  CallAppointmentRow,
  PromiseToPay,
  PromiseToPayRow,
  RelatedPerson,
  RelatedPersonRow,
  Transaction,
  TransactionRow,
} from "@/lib/account/types";

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
