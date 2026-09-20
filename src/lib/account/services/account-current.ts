import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getAccount } from "@/lib/account/services/account-get";
import { createAuthenticatedServerSupabaseClient } from "@/lib/supabase/server";

export async function getCurrentAccount() {
  const user = await getAuthenticatedUser();
  const supabase = await createAuthenticatedServerSupabaseClient();

  const { data: accountHolder, error } = await supabase
    .from("account_holders")
    .select("account_id")
    .eq("user_id", user.id)
    .single<{ account_id: string }>();

  if (error || !accountHolder) {
    throw new Error("No account is associated with the authenticated user.");
  }

  return getAccount(accountHolder.account_id, supabase);
}
