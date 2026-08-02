import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAccount } from "@/lib/account/services/account-get";
import {
  createCallAppointment,
  getCallAppointments,
} from "@/lib/account/services/call-appointment";

import type { AccountContext, CallAppointmentRow } from "@/lib/account/types";

vi.mock("@/lib/account/services/account-get", () => ({
  assertNoDatabaseError: (
    operation: string,
    error: { message: string } | null,
  ) => {
    if (error) {
      throw new Error(`${operation}: ${error.message}`);
    }
  },
  getAccount: vi.fn(),
}));

const mockedGetAccount = vi.mocked(getAccount);

const accountId = "acc_standard_001";
const accountHolderId = "holder-1";

const appointmentRows: CallAppointmentRow[] = [
  {
    id: "appointment-1",
    account_holder_id: accountHolderId,
    scheduled_at: "2026-08-04T09:00:00.000Z",
    phone: "+353831234567",
    reason: "Discuss payment options",
    status: "scheduled",
    created_at: "2026-08-02T10:00:00.000Z",
    updated_at: "2026-08-02T10:00:00.000Z",
  },
];

const accountContext = {
  account: {
    accountId,
    phone: "+353831234567",
  },
  callAppointments: [],
} as unknown as AccountContext;

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function createQueryBuilder({
  singleResult = {
    data: {
      id: accountHolderId,
      phone: "+353831234567",
    },
    error: null,
  },
  returnsResult = {
    data: appointmentRows,
    error: null,
  },
  mutationResult = {
    data: {
      id: "appointment-new",
    },
    error: null,
  },
}: {
  singleResult?: QueryResult;
  returnsResult?: QueryResult;
  mutationResult?: QueryResult;
} = {}) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(),
    returns: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);

  builder.single
    .mockResolvedValueOnce(singleResult)
    .mockResolvedValueOnce(mutationResult);

  builder.returns.mockResolvedValue(returnsResult);

  return builder;
}

function createMockSupabaseClient({
  accountHolderResult = {
    data: {
      id: accountHolderId,
      phone: "+353831234567",
    },
    error: null,
  },
  appointmentsResult = {
    data: appointmentRows,
    error: null,
  },
  mutationResult = {
    data: {
      id: "appointment-new",
    },
    error: null,
  },
}: {
  accountHolderResult?: QueryResult;
  appointmentsResult?: QueryResult;
  mutationResult?: QueryResult;
} = {}) {
  const accountHolderBuilder = createQueryBuilder({
    singleResult: accountHolderResult,
  });

  const appointmentsBuilder = createQueryBuilder({
    returnsResult: appointmentsResult,
    mutationResult,
  });

  appointmentsBuilder.single.mockReset();
  appointmentsBuilder.single.mockResolvedValue(mutationResult);

  const from = vi.fn((tableName: string) => {
    if (tableName === "account_holders") {
      return accountHolderBuilder;
    }

    if (tableName === "call_appointments") {
      return appointmentsBuilder;
    }

    throw new Error(`Unexpected table requested: ${tableName}`);
  });

  const supabase = {
    from,
  } as unknown as SupabaseClient;

  return {
    supabase,
    from,
    accountHolderBuilder,
    appointmentsBuilder,
  };
}

describe("call appointment services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T12:00:00.000Z"));

    mockedGetAccount.mockResolvedValue(accountContext);
  });

  describe("getCallAppointments", () => {
    it("loads call appointments for the account", async () => {
      const { supabase } = createMockSupabaseClient();

      const result = await getCallAppointments(accountId, supabase);

      expect(result).toEqual(appointmentRows);
    });

    it("queries the account holder using the public account ID", async () => {
      const { supabase, accountHolderBuilder } = createMockSupabaseClient();

      await getCallAppointments(`  ${accountId}  `, supabase);

      expect(accountHolderBuilder.select).toHaveBeenCalledWith("id, phone");

      expect(accountHolderBuilder.eq).toHaveBeenCalledWith(
        "account_id",
        accountId,
      );

      expect(accountHolderBuilder.single).toHaveBeenCalledOnce();
    });

    it("queries appointments using the internal account holder ID", async () => {
      const { supabase, appointmentsBuilder } = createMockSupabaseClient();

      await getCallAppointments(accountId, supabase);

      expect(appointmentsBuilder.select).toHaveBeenCalledWith("*");

      expect(appointmentsBuilder.eq).toHaveBeenCalledWith(
        "account_holder_id",
        accountHolderId,
      );
    });

    it("sorts appointments by scheduled time ascending", async () => {
      const { supabase, appointmentsBuilder } = createMockSupabaseClient();

      await getCallAppointments(accountId, supabase);

      expect(appointmentsBuilder.order).toHaveBeenCalledWith("scheduled_at", {
        ascending: true,
      });
    });

    it("returns an empty array when no appointments exist", async () => {
      const { supabase } = createMockSupabaseClient({
        appointmentsResult: {
          data: null,
          error: null,
        },
      });

      const result = await getCallAppointments(accountId, supabase);

      expect(result).toEqual([]);
    });

    it("rejects an empty account ID without querying Supabase", async () => {
      const { supabase, from } = createMockSupabaseClient();

      await expect(getCallAppointments("   ", supabase)).rejects.toThrow(
        "Account ID is required.",
      );

      expect(from).not.toHaveBeenCalled();
    });

    it("rejects an account that cannot be found", async () => {
      const { supabase } = createMockSupabaseClient({
        accountHolderResult: {
          data: null,
          error: null,
        },
      });

      await expect(getCallAppointments(accountId, supabase)).rejects.toThrow(
        `Account "${accountId}" was not found.`,
      );
    });

    it("returns the account lookup error", async () => {
      const { supabase } = createMockSupabaseClient({
        accountHolderResult: {
          data: null,
          error: {
            message: "Account query failed",
          },
        },
      });

      await expect(getCallAppointments(accountId, supabase)).rejects.toThrow(
        "Failed to load account holder: Account query failed",
      );
    });

    it("returns the appointment query error", async () => {
      const { supabase } = createMockSupabaseClient({
        appointmentsResult: {
          data: null,
          error: {
            message: "Appointment query failed",
          },
        },
      });

      await expect(getCallAppointments(accountId, supabase)).rejects.toThrow(
        "Failed to load call appointments: Appointment query failed",
      );
    });
  });

  describe("createCallAppointment", () => {
    it("creates a future call appointment using the stored account phone", async () => {
      const { supabase, appointmentsBuilder } = createMockSupabaseClient();

      const result = await createCallAppointment(
        accountId,
        {
          scheduledAt: "2026-08-04T10:00:00.000Z",
          reason: "Discuss my bill",
        },
        supabase,
      );

      expect(appointmentsBuilder.insert).toHaveBeenCalledWith({
        account_holder_id: accountHolderId,
        scheduled_at: "2026-08-04T10:00:00.000Z",
        phone: "+353831234567",
        reason: "Discuss my bill",
        status: "scheduled",
      });

      expect(appointmentsBuilder.select).toHaveBeenCalledWith("id");
      expect(appointmentsBuilder.single).toHaveBeenCalledOnce();

      expect(mockedGetAccount).toHaveBeenCalledWith(accountId, supabase);
      expect(result).toEqual(accountContext);
    });

    it("uses a supplied phone number instead of the stored account phone", async () => {
      const { supabase, appointmentsBuilder } = createMockSupabaseClient();

      await createCallAppointment(
        accountId,
        {
          scheduledAt: "2026-08-04T10:00:00.000Z",
          phone: "+353851112233",
          reason: "Discuss my bill",
        },
        supabase,
      );

      expect(appointmentsBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: "+353851112233",
        }),
      );
    });

    it("stores a null reason when no reason is supplied", async () => {
      const { supabase, appointmentsBuilder } = createMockSupabaseClient();

      await createCallAppointment(
        accountId,
        {
          scheduledAt: "2026-08-04T10:00:00.000Z",
        },
        supabase,
      );

      expect(appointmentsBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: null,
        }),
      );
    });

    it("trims the supplied phone and reason", async () => {
      const { supabase, appointmentsBuilder } = createMockSupabaseClient();

      await createCallAppointment(
        accountId,
        {
          scheduledAt: "  2026-08-04T10:00:00.000Z  ",
          phone: "  +353851112233  ",
          reason: "  Discuss my bill  ",
        },
        supabase,
      );

      expect(appointmentsBuilder.insert).toHaveBeenCalledWith({
        account_holder_id: accountHolderId,
        scheduled_at: "2026-08-04T10:00:00.000Z",
        phone: "+353851112233",
        reason: "Discuss my bill",
        status: "scheduled",
      });
    });

    it("converts an empty reason to null", async () => {
      const { supabase, appointmentsBuilder } = createMockSupabaseClient();

      await createCallAppointment(
        accountId,
        {
          scheduledAt: "2026-08-04T10:00:00.000Z",
          reason: "   ",
        },
        supabase,
      );

      expect(appointmentsBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: null,
        }),
      );
    });

    it.each(["", "not-a-date", "invalid"])(
      "rejects invalid scheduled date %s",
      async (scheduledAt) => {
        const { supabase, appointmentsBuilder } = createMockSupabaseClient();

        await expect(
          createCallAppointment(
            accountId,
            {
              scheduledAt,
            },
            supabase,
          ),
        ).rejects.toThrow("Please provide a valid appointment date and time.");

        expect(appointmentsBuilder.insert).not.toHaveBeenCalled();
        expect(mockedGetAccount).not.toHaveBeenCalled();
      },
    );

    it("rejects an appointment scheduled exactly now", async () => {
      const { supabase, appointmentsBuilder } = createMockSupabaseClient();

      await expect(
        createCallAppointment(
          accountId,
          {
            scheduledAt: "2026-08-02T12:00:00.000Z",
          },
          supabase,
        ),
      ).rejects.toThrow(
        "Call appointment must be scheduled for a future date and time.",
      );

      expect(appointmentsBuilder.insert).not.toHaveBeenCalled();
    });

    it("rejects a past appointment", async () => {
      const { supabase, appointmentsBuilder } = createMockSupabaseClient();

      await expect(
        createCallAppointment(
          accountId,
          {
            scheduledAt: "2026-08-02T11:59:59.000Z",
          },
          supabase,
        ),
      ).rejects.toThrow(
        "Call appointment must be scheduled for a future date and time.",
      );

      expect(appointmentsBuilder.insert).not.toHaveBeenCalled();
    });

    it("accepts a future appointment", async () => {
      const { supabase } = createMockSupabaseClient();

      await expect(
        createCallAppointment(
          accountId,
          {
            scheduledAt: "2026-08-02T12:01:00.000Z",
          },
          supabase,
        ),
      ).resolves.toEqual(accountContext);
    });

    it.each([
      "",
      "123",
      "+353",
      "+353 85 111 2233",
      "abcdefgh",
      "+353851112233445566",
    ])("rejects invalid phone number %s", async (phone) => {
      const { supabase, appointmentsBuilder } = createMockSupabaseClient();

      await expect(
        createCallAppointment(
          accountId,
          {
            scheduledAt: "2026-08-04T10:00:00.000Z",
            phone,
          },
          supabase,
        ),
      ).rejects.toThrow("Please provide a valid phone number.");

      expect(appointmentsBuilder.insert).not.toHaveBeenCalled();
    });

    it("rejects an empty account ID", async () => {
      const { supabase, from } = createMockSupabaseClient();

      await expect(
        createCallAppointment(
          "   ",
          {
            scheduledAt: "2026-08-04T10:00:00.000Z",
          },
          supabase,
        ),
      ).rejects.toThrow("Account ID is required.");

      expect(from).not.toHaveBeenCalled();
    });

    it("rejects an account that cannot be found", async () => {
      const { supabase } = createMockSupabaseClient({
        accountHolderResult: {
          data: null,
          error: null,
        },
      });

      await expect(
        createCallAppointment(
          accountId,
          {
            scheduledAt: "2026-08-04T10:00:00.000Z",
          },
          supabase,
        ),
      ).rejects.toThrow(`Account "${accountId}" was not found.`);
    });

    it("returns the insert error", async () => {
      const { supabase } = createMockSupabaseClient({
        mutationResult: {
          data: null,
          error: {
            message: "Insert failed",
          },
        },
      });

      await expect(
        createCallAppointment(
          accountId,
          {
            scheduledAt: "2026-08-04T10:00:00.000Z",
          },
          supabase,
        ),
      ).rejects.toThrow("Failed to create call appointment: Insert failed");

      expect(mockedGetAccount).not.toHaveBeenCalled();
    });

    it("rejects an empty successful insert result", async () => {
      const { supabase } = createMockSupabaseClient({
        mutationResult: {
          data: null,
          error: null,
        },
      });

      await expect(
        createCallAppointment(
          accountId,
          {
            scheduledAt: "2026-08-04T10:00:00.000Z",
          },
          supabase,
        ),
      ).rejects.toThrow("Failed to create call appointment.");

      expect(mockedGetAccount).not.toHaveBeenCalled();
    });

    it("refreshes the complete account context after creation", async () => {
      const { supabase } = createMockSupabaseClient();

      await createCallAppointment(
        accountId,
        {
          scheduledAt: "2026-08-04T10:00:00.000Z",
        },
        supabase,
      );

      expect(mockedGetAccount).toHaveBeenCalledWith(accountId, supabase);
    });
  });
});
