import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthenticatedServerSupabaseClient } from "@/lib/supabase/server";
import { generateEncryptedAccountSummaryPdf } from "@/lib/notifications/account-summary-pdf";
import { sendAccountChangeNotification } from "@/lib/notifications/account-change-notification";

import type { AccountContext } from "@/lib/account/types";

const { mockedResendSend } = vi.hoisted(() => ({
  mockedResendSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: mockedResendSend,
    };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/notifications/account-summary-pdf", () => ({
  generateEncryptedAccountSummaryPdf: vi.fn(),
}));

const mockedCreateAuthenticatedServerSupabaseClient = vi.mocked(
  createAuthenticatedServerSupabaseClient,
);

const mockedGenerateEncryptedAccountSummaryPdf = vi.mocked(
  generateEncryptedAccountSummaryPdf,
);

const accountContext: AccountContext = {
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
  relatedPeople: [],
  promisesToPay: [],
  transactions: [],
  callAppointments: [],
  notificationRules: {
    sendEmailOnDataChange: true,
    pdfPasswordSource: "account_phone_last4",
  },
};

type DatabaseResult = {
  data: unknown;
  error: {
    message: string;
  } | null;
};

function createMockSupabase({
  accountHolderResult = {
    data: {
      id: "holder-1",
    },
    error: null,
  },
  insertResult = {
    data: {
      id: "notification-1",
    },
    error: null,
  },
  updateResult = {
    data: null,
    error: null,
  },
}: {
  accountHolderResult?: DatabaseResult;
  insertResult?: DatabaseResult;
  updateResult?: DatabaseResult;
} = {}) {
  const accountHolderBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };

  accountHolderBuilder.select.mockReturnValue(accountHolderBuilder);
  accountHolderBuilder.eq.mockReturnValue(accountHolderBuilder);
  accountHolderBuilder.single.mockResolvedValue(accountHolderResult);

  const notificationBuilder = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
  };

  notificationBuilder.insert.mockReturnValue(notificationBuilder);
  notificationBuilder.select.mockReturnValue(notificationBuilder);
  notificationBuilder.single.mockResolvedValue(insertResult);
  notificationBuilder.update.mockReturnValue(notificationBuilder);
  notificationBuilder.eq.mockResolvedValue(updateResult);

  const from = vi.fn((tableName: string) => {
    if (tableName === "account_holders") {
      return accountHolderBuilder;
    }

    if (tableName === "notification_attempts") {
      return notificationBuilder;
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
    notificationBuilder,
  };
}

describe("sendAccountChangeNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubEnv("RESEND_API_KEY", "test-api-key");
    vi.stubEnv(
      "NOTIFICATION_FROM_EMAIL",
      "Account Portal <onboarding@resend.dev>",
    );

    mockedGenerateEncryptedAccountSummaryPdf.mockResolvedValue(
      Buffer.from("encrypted-pdf"),
    );

    mockedResendSend.mockResolvedValue({
      data: {
        id: "email-1",
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the authenticated Supabase client", async () => {
    const { supabase } = createMockSupabase();

    mockedCreateAuthenticatedServerSupabaseClient.mockResolvedValue(supabase);

    await sendAccountChangeNotification({
      accountId: "acc_standard_001",
      changedBy: "account_holder",
      changeSummary: "phone_updated",
      accountSnapshot: accountContext,
    });

    expect(
      mockedCreateAuthenticatedServerSupabaseClient,
    ).toHaveBeenCalledOnce();
  });

  it("sends a generic email with an encrypted PDF attachment", async () => {
    const { supabase, notificationBuilder } = createMockSupabase();

    mockedCreateAuthenticatedServerSupabaseClient.mockResolvedValue(supabase);

    const result = await sendAccountChangeNotification({
      accountId: "acc_standard_001",
      changedBy: "account_holder",
      changeSummary: "phone_updated",
      accountSnapshot: accountContext,
    });

    expect(mockedGenerateEncryptedAccountSummaryPdf).toHaveBeenCalledOnce();

    expect(mockedGenerateEncryptedAccountSummaryPdf).toHaveBeenCalledWith(
      accountContext,
    );

    expect(mockedResendSend).toHaveBeenCalledOnce();

    expect(mockedResendSend).toHaveBeenCalledWith({
      from: "Account Portal <onboarding@resend.dev>",
      to: "jane.murphy@example.test",
      subject: "Your account has been updated",
      text: expect.any(String),
      attachments: [
        {
          filename: "account-summary.pdf",
          content: Buffer.from("encrypted-pdf"),
        },
      ],
    });

    const emailInput = mockedResendSend.mock.calls[0][0];

    expect(emailInput.text).toContain(
      "For your privacy, account details are not included in this email.",
    );

    expect(emailInput.text).not.toContain("Jane");
    expect(emailInput.text).not.toContain("Murphy");
    expect(emailInput.text).not.toContain("+353831234567");
    expect(emailInput.text).not.toContain("128500");
    expect(emailInput.text).not.toContain("EI-2026-000123");

    expect(notificationBuilder.update).toHaveBeenCalledWith({
      status: "sent",
      error_message: null,
    });

    expect(notificationBuilder.eq).toHaveBeenCalledWith("id", "notification-1");

    expect(result).toEqual({
      notificationId: "notification-1",
      sent: true,
      redactedRecipient: "j***@example.test",
    });
  });

  it("records a queued notification attempt before delivery", async () => {
    const { supabase, notificationBuilder } = createMockSupabase();

    mockedCreateAuthenticatedServerSupabaseClient.mockResolvedValue(supabase);

    await sendAccountChangeNotification({
      accountId: "acc_standard_001",
      changedBy: "account_holder",
      changeSummary: "phone_updated",
      accountSnapshot: accountContext,
    });

    expect(notificationBuilder.insert).toHaveBeenCalledWith({
      account_holder_id: "holder-1",
      trigger_action: "phone_updated",
      recipient_email: "jane.murphy@example.test",
      email_provider: "resend",
      status: "queued",
      sensitive_detail_in_pdf: true,
      error_message: null,
    });
  });

  it("loads the account holder using the public account ID", async () => {
    const { supabase, accountHolderBuilder } = createMockSupabase();

    mockedCreateAuthenticatedServerSupabaseClient.mockResolvedValue(supabase);

    await sendAccountChangeNotification({
      accountId: "  acc_standard_001  ",
      changedBy: "account_holder",
      changeSummary: "phone_updated",
      accountSnapshot: accountContext,
    });

    expect(accountHolderBuilder.select).toHaveBeenCalledWith("id");

    expect(accountHolderBuilder.eq).toHaveBeenCalledWith(
      "account_id",
      "acc_standard_001",
    );

    expect(accountHolderBuilder.single).toHaveBeenCalledOnce();
  });

  it("returns a redacted recipient address", async () => {
    const { supabase } = createMockSupabase();

    mockedCreateAuthenticatedServerSupabaseClient.mockResolvedValue(supabase);

    const result = await sendAccountChangeNotification({
      accountId: "acc_standard_001",
      changedBy: "account_holder",
      changeSummary: "email_updated",
      accountSnapshot: accountContext,
    });

    expect(result.redactedRecipient).toBe("j***@example.test");
  });

  it("logs the notification locally when Resend is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    const { supabase, notificationBuilder } = createMockSupabase();

    mockedCreateAuthenticatedServerSupabaseClient.mockResolvedValue(supabase);

    const result = await sendAccountChangeNotification({
      accountId: "acc_standard_001",
      changedBy: "account_holder",
      changeSummary: "address_updated",
      accountSnapshot: accountContext,
    });

    expect(mockedResendSend).not.toHaveBeenCalled();

    expect(mockedGenerateEncryptedAccountSummaryPdf).toHaveBeenCalledWith(
      accountContext,
    );

    expect(notificationBuilder.update).toHaveBeenCalledWith({
      status: "logged",
      error_message: null,
    });

    expect(result).toEqual({
      notificationId: "notification-1",
      sent: false,
      redactedRecipient: "j***@example.test",
    });
  });

  it("records a failed attempt when Resend rejects the email", async () => {
    const { supabase, notificationBuilder } = createMockSupabase();

    mockedCreateAuthenticatedServerSupabaseClient.mockResolvedValue(supabase);

    mockedResendSend.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Provider rejected email",
      },
    });

    await expect(
      sendAccountChangeNotification({
        accountId: "acc_standard_001",
        changedBy: "account_holder",
        changeSummary: "phone_updated",
        accountSnapshot: accountContext,
      }),
    ).rejects.toThrow("Account-change notification could not be sent.");

    expect(notificationBuilder.update).toHaveBeenCalledWith({
      status: "failed",
      error_message: "Email provider rejected the notification.",
    });

    expect(notificationBuilder.eq).toHaveBeenCalledWith("id", "notification-1");
  });

  it("records a failed attempt when PDF generation fails", async () => {
    const { supabase, notificationBuilder } = createMockSupabase();

    mockedCreateAuthenticatedServerSupabaseClient.mockResolvedValue(supabase);

    mockedGenerateEncryptedAccountSummaryPdf.mockRejectedValueOnce(
      new Error("PDF generation failed"),
    );

    await expect(
      sendAccountChangeNotification({
        accountId: "acc_standard_001",
        changedBy: "account_holder",
        changeSummary: "phone_updated",
        accountSnapshot: accountContext,
      }),
    ).rejects.toThrow("Account-change notification could not be sent.");

    expect(notificationBuilder.update).toHaveBeenCalledWith({
      status: "failed",
      error_message: "PDF generation failed",
    });

    expect(mockedResendSend).not.toHaveBeenCalled();
  });

  it("rejects an empty recipient email before accessing Supabase", async () => {
    const context: AccountContext = {
      ...accountContext,
      account: {
        ...accountContext.account,
        email: "   ",
      },
    };

    await expect(
      sendAccountChangeNotification({
        accountId: "acc_standard_001",
        changedBy: "account_holder",
        changeSummary: "phone_updated",
        accountSnapshot: context,
      }),
    ).rejects.toThrow("Notification recipient email is required.");

    expect(
      mockedCreateAuthenticatedServerSupabaseClient,
    ).not.toHaveBeenCalled();

    expect(mockedGenerateEncryptedAccountSummaryPdf).not.toHaveBeenCalled();

    expect(mockedResendSend).not.toHaveBeenCalled();
  });

  it("rejects an empty account ID", async () => {
    const { supabase } = createMockSupabase();

    mockedCreateAuthenticatedServerSupabaseClient.mockResolvedValue(supabase);

    await expect(
      sendAccountChangeNotification({
        accountId: "   ",
        changedBy: "account_holder",
        changeSummary: "phone_updated",
        accountSnapshot: accountContext,
      }),
    ).rejects.toThrow("Account ID is required.");

    expect(mockedGenerateEncryptedAccountSummaryPdf).not.toHaveBeenCalled();

    expect(mockedResendSend).not.toHaveBeenCalled();
  });

  it("rejects an account that cannot be loaded", async () => {
    const { supabase } = createMockSupabase({
      accountHolderResult: {
        data: null,
        error: {
          message: "Account lookup failed",
        },
      },
    });

    mockedCreateAuthenticatedServerSupabaseClient.mockResolvedValue(supabase);

    await expect(
      sendAccountChangeNotification({
        accountId: "acc_standard_001",
        changedBy: "account_holder",
        changeSummary: "phone_updated",
        accountSnapshot: accountContext,
      }),
    ).rejects.toThrow("Failed to load account holder for notification.");

    expect(mockedGenerateEncryptedAccountSummaryPdf).not.toHaveBeenCalled();
  });

  it("rejects an account lookup with no returned data", async () => {
    const { supabase } = createMockSupabase({
      accountHolderResult: {
        data: null,
        error: null,
      },
    });

    mockedCreateAuthenticatedServerSupabaseClient.mockResolvedValue(supabase);

    await expect(
      sendAccountChangeNotification({
        accountId: "acc_standard_001",
        changedBy: "account_holder",
        changeSummary: "phone_updated",
        accountSnapshot: accountContext,
      }),
    ).rejects.toThrow("Failed to load account holder for notification.");
  });

  it("rejects a failed notification-attempt insert", async () => {
    const { supabase } = createMockSupabase({
      insertResult: {
        data: null,
        error: {
          message: "Insert failed",
        },
      },
    });

    mockedCreateAuthenticatedServerSupabaseClient.mockResolvedValue(supabase);

    await expect(
      sendAccountChangeNotification({
        accountId: "acc_standard_001",
        changedBy: "account_holder",
        changeSummary: "phone_updated",
        accountSnapshot: accountContext,
      }),
    ).rejects.toThrow("Failed to record notification attempt.");

    expect(mockedGenerateEncryptedAccountSummaryPdf).not.toHaveBeenCalled();

    expect(mockedResendSend).not.toHaveBeenCalled();
  });

  it("rejects an empty notification-attempt insert result", async () => {
    const { supabase } = createMockSupabase({
      insertResult: {
        data: null,
        error: null,
      },
    });

    mockedCreateAuthenticatedServerSupabaseClient.mockResolvedValue(supabase);

    await expect(
      sendAccountChangeNotification({
        accountId: "acc_standard_001",
        changedBy: "account_holder",
        changeSummary: "phone_updated",
        accountSnapshot: accountContext,
      }),
    ).rejects.toThrow("Failed to record notification attempt.");

    expect(mockedGenerateEncryptedAccountSummaryPdf).not.toHaveBeenCalled();
  });

  it("logs the notification locally when the from email is not configured", async () => {
    vi.stubEnv("NOTIFICATION_FROM_EMAIL", "");

    const { supabase, notificationBuilder } = createMockSupabase();

    mockedCreateAuthenticatedServerSupabaseClient.mockResolvedValue(supabase);

    const result = await sendAccountChangeNotification({
      accountId: "acc_standard_001",
      changedBy: "account_holder",
      changeSummary: "address_updated",
      accountSnapshot: accountContext,
    });

    expect(mockedResendSend).not.toHaveBeenCalled();

    expect(notificationBuilder.update).toHaveBeenCalledWith({
      status: "logged",
      error_message: null,
    });

    expect(result).toEqual({
      notificationId: "notification-1",
      sent: false,
      redactedRecipient: "j***@example.test",
    });
  });
});
