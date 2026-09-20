import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const userAEmail = process.env.RLS_TEST_USER_A_EMAIL;
const userAPassword = process.env.RLS_TEST_USER_A_PASSWORD;
const userBEmail = process.env.RLS_TEST_USER_B_EMAIL;
const userBPassword = process.env.RLS_TEST_USER_B_PASSWORD;

const requiredEnvironment = [
  supabaseUrl,
  publishableKey,
  userAEmail,
  userAPassword,
  userBEmail,
  userBPassword,
];

const hasRequiredEnvironment = requiredEnvironment.every(Boolean);

const runIntegrationTests = process.env.RLS_INTEGRATION === "true";

describe.skipIf(!runIntegrationTests || !hasRequiredEnvironment)(
  "RLS account isolation integration",
  () => {
    it("allows each user to read only their own account holder", async () => {
      const userAClient = createClient(supabaseUrl!, publishableKey!);
      const userBClient = createClient(supabaseUrl!, publishableKey!);

      const userASignIn = await userAClient.auth.signInWithPassword({
        email: userAEmail!,
        password: userAPassword!,
      });

      const userBSignIn = await userBClient.auth.signInWithPassword({
        email: userBEmail!,
        password: userBPassword!,
      });

      expect(userASignIn.error).toBeNull();
      expect(userBSignIn.error).toBeNull();

      const accountAForUserA = await userAClient
        .from("account_holders")
        .select("account_id, user_id")
        .eq("account_id", "acc_standard_001")
        .maybeSingle();

      const accountBForUserA = await userAClient
        .from("account_holders")
        .select("account_id, user_id")
        .eq("account_id", "acc_test_b")
        .maybeSingle();

      const accountBForUserB = await userBClient
        .from("account_holders")
        .select("account_id, user_id")
        .eq("account_id", "acc_test_b")
        .maybeSingle();

      const accountAForUserB = await userBClient
        .from("account_holders")
        .select("account_id, user_id")
        .eq("account_id", "acc_standard_001")
        .maybeSingle();

      expect(accountAForUserA.error).toBeNull();
      expect(accountBForUserA.error).toBeNull();
      expect(accountBForUserB.error).toBeNull();
      expect(accountAForUserB.error).toBeNull();

      expect(accountAForUserA.data?.account_id).toBe("acc_standard_001");
      expect(accountBForUserA.data).toBeNull();
      expect(accountBForUserB.data?.account_id).toBe("acc_test_b");
      expect(accountAForUserB.data).toBeNull();
    });

    it("prevents one user from updating another user's account holder", async () => {
      const userAClient = createClient(supabaseUrl!, publishableKey!);

      const signIn = await userAClient.auth.signInWithPassword({
        email: userAEmail!,
        password: userAPassword!,
      });

      expect(signIn.error).toBeNull();

      const result = await userAClient
        .from("account_holders")
        .update({
          phone: "0879999999",
        })
        .eq("account_id", "acc_test_b")
        .select("account_id");

      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);

      const accountB = await userAClient
        .from("account_holders")
        .select("account_id, phone")
        .eq("account_id", "acc_test_b")
        .maybeSingle();

      expect(accountB.error).toBeNull();
      expect(accountB.data).toBeNull();
    });
  },
);
