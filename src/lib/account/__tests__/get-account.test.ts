import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { getAccount } from "@/lib/account/actions";

const accountHolderRow = {
  id: "f608019a-f288-42ef-ae51-f0b8ad2c65f1",
  account_id: "acc_standard_001",
  first_name: "Jane",
  last_name: "Murphy",
  email: "jane.murphy@example.test",
  phone: "+353831234567",
  address_line1: "12 River Walk",
  address_line2: "Rathmines",
  city: "Dublin",
  postal_code: "D06 X123",
  country: "Ireland",
  preferred_contact_method: "email",
  reference: "EI-2026-000123",
  creditor_name: "Example Energy Ireland",
  currency: "EUR",
  balance_cents: 128_500,
  status: "overdue",
  days_past_due: 47,
  minimum_payment_cents: 2_500,
  last_payment_date: "2026-01-10",
  last_payment_amount_cents: 5_000,
  created_at: "2026-01-01T10:00:00.000Z",
  updated_at: "2026-01-01T10:00:00.000Z",
};

const relatedPersonRow = {
  id: "person-1",
  account_holder_id: accountHolderRow.id,
  name: "John Murphy",
  email: "john.murphy@example.test",
  phone: "+353831987654",
  relationship: "spouse",
  authorized_to_act: false,
  created_at: "2026-01-01T10:00:00.000Z",
  updated_at: "2026-01-01T10:00:00.000Z",
};

const promiseToPayRow = {
  id: "promise-1",
  account_holder_id: accountHolderRow.id,
  amount_cents: 25_000,
  currency: "EUR",
  due_date: "2026-07-15",
  status: "active",
  created_at: "2026-06-20T10:15:00.000Z",
};

const transactionRows = [
  {
    id: "transaction-1",
    account_holder_id: accountHolderRow.id,
    type: "payment",
    status: "completed",
    amount_cents: 5_000,
    currency: "EUR",
    description: "Card payment",
    transaction_date: "2026-01-10",
    created_at: "2026-01-10T10:00:00.000Z",
  },
  {
    id: "transaction-2",
    account_holder_id: accountHolderRow.id,
    type: "charge",
    status: "posted",
    amount_cents: 12_500,
    currency: "EUR",
    description: "Winter usage adjustment",
    transaction_date: "2026-01-18",
    created_at: "2026-01-18T10:00:00.000Z",
  },
];

const callAppointmentRow = {
  id: "appointment-1",
  account_holder_id: accountHolderRow.id,
  scheduled_at: "2026-07-03T08:30:00.000Z",
  phone: "+353831234567",
  reason: "Discuss payment options",
  status: "scheduled",
  created_at: "2026-06-20T10:00:00.000Z",
  updated_at: "2026-06-20T10:00:00.000Z",
};

type MockResult = {
  data: unknown;
  error: null;
};

function createQueryBuilder(result: MockResult) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
    returns: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.single.mockResolvedValue(result);
  builder.returns.mockResolvedValue(result);

  return builder;
}

function createMockSupabaseClient() {
  const builders = {
    account_holders: createQueryBuilder({
      data: accountHolderRow,
      error: null,
    }),

    related_people: createQueryBuilder({
      data: [relatedPersonRow],
      error: null,
    }),

    promises_to_pay: createQueryBuilder({
      data: [promiseToPayRow],
      error: null,
    }),

    transactions: createQueryBuilder({
      data: transactionRows,
      error: null,
    }),

    call_appointments: createQueryBuilder({
      data: [callAppointmentRow],
      error: null,
    }),
  };

  const from = vi.fn((tableName: string) => {
    const builder = builders[tableName as keyof typeof builders];

    if (!builder) {
      throw new Error(`Unexpected table requested: ${tableName}`);
    }

    return builder;
  });

  const supabase = {
    from,
  } as unknown as SupabaseClient;

  return {
    supabase,
    builders,
    from,
  };
}

describe("getAccount", () => {
  it("loads and maps the complete account context", async () => {
    const { supabase } = createMockSupabaseClient();

    const result = await getAccount("acc_standard_001", supabase);

    expect(result).toEqual({
      account: {
        accountId: "acc_standard_001",
        accountHolderFirstName: "Jane",
        accountHolderLastName: "Murphy",
        email: "jane.murphy@example.test",
        phone: "+353831234567",

        address: {
          line1: "12 River Walk",
          line2: "Rathmines",
          city: "Dublin",
          postalCode: "D06 X123",
          country: "Ireland",
        },

        preferredContactMethod: "email",
        reference: "EI-2026-000123",
        creditorName: "Example Energy Ireland",
        currency: "EUR",
        balanceCents: 128_500,
        status: "overdue",
        daysPastDue: 47,
        minimumPaymentCents: 2_500,
        lastPaymentDate: "2026-01-10",
        lastPaymentAmountCents: 5_000,
      },

      billing: {
        currentAmountCents: 128_500,
        lastStatementAmountCents: 128_500,
        dueDate: "2026-07-15",
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

      relatedPeople: [
        {
          id: "person-1",
          name: "John Murphy",
          email: "john.murphy@example.test",
          phone: "+353831987654",
          relationship: "spouse",
          authorizedToAct: false,
        },
      ],

      promisesToPay: [
        {
          id: "promise-1",
          amountCents: 25_000,
          currency: "EUR",
          dueDate: "2026-07-15",
          status: "active",
          createdAt: "2026-06-20T10:15:00.000Z",
        },
      ],

      transactions: [
        {
          id: "transaction-1",
          type: "payment",
          status: "completed",
          amountCents: 5_000,
          currency: "EUR",
          description: "Card payment",
          transactionDate: "2026-01-10",
        },
        {
          id: "transaction-2",
          type: "charge",
          status: "posted",
          amountCents: 12_500,
          currency: "EUR",
          description: "Winter usage adjustment",
          transactionDate: "2026-01-18",
        },
      ],

      callAppointments: [
        {
          id: "appointment-1",
          scheduledAt: "2026-07-03T08:30:00.000Z",
          phone: "+353831234567",
          reason: "Discuss payment options",
          status: "scheduled",
        },
      ],

      notificationRules: {
        sendEmailOnDataChange: true,
        pdfPasswordSource: "account_phone_last4",
      },
    });
  });

  it("queries the account using the public account ID", async () => {
    const { supabase, builders } = createMockSupabaseClient();

    await getAccount("  acc_standard_001  ", supabase);

    expect(builders.account_holders.select).toHaveBeenCalledWith("*");

    expect(builders.account_holders.eq).toHaveBeenCalledWith(
      "account_id",
      "acc_standard_001",
    );

    expect(builders.account_holders.single).toHaveBeenCalledOnce();
  });

  it("queries related records using the internal account holder ID", async () => {
    const { supabase, builders } = createMockSupabaseClient();

    await getAccount("acc_standard_001", supabase);

    expect(builders.related_people.eq).toHaveBeenCalledWith(
      "account_holder_id",
      accountHolderRow.id,
    );

    expect(builders.promises_to_pay.eq).toHaveBeenCalledWith(
      "account_holder_id",
      accountHolderRow.id,
    );

    expect(builders.transactions.eq).toHaveBeenCalledWith(
      "account_holder_id",
      accountHolderRow.id,
    );

    expect(builders.call_appointments.eq).toHaveBeenCalledWith(
      "account_holder_id",
      accountHolderRow.id,
    );
  });

  it("sorts account records in the required order", async () => {
    const { supabase, builders } = createMockSupabaseClient();

    await getAccount("acc_standard_001", supabase);

    expect(builders.promises_to_pay.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });

    expect(builders.transactions.order).toHaveBeenCalledWith(
      "transaction_date",
      {
        ascending: false,
      },
    );

    expect(builders.call_appointments.order).toHaveBeenCalledWith(
      "scheduled_at",
      {
        ascending: true,
      },
    );
  });

  it("queries all required Supabase tables", async () => {
    const { supabase, from } = createMockSupabaseClient();

    await getAccount("acc_standard_001", supabase);

    expect(from).toHaveBeenCalledWith("account_holders");
    expect(from).toHaveBeenCalledWith("related_people");
    expect(from).toHaveBeenCalledWith("promises_to_pay");
    expect(from).toHaveBeenCalledWith("transactions");
    expect(from).toHaveBeenCalledWith("call_appointments");

    expect(from).toHaveBeenCalledTimes(5);
  });

  it("rejects an empty account ID without querying the database", async () => {
    const { supabase, from } = createMockSupabaseClient();

    await expect(getAccount("   ", supabase)).rejects.toThrow(
      "Account ID is required.",
    );

    expect(from).not.toHaveBeenCalled();
  });
});
