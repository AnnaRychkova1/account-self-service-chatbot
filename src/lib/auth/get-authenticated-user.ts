import { createAuthenticatedServerSupabaseClient } from "@/lib/supabase/server";

export async function getAuthenticatedUser() {
  const supabase = await createAuthenticatedServerSupabaseClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error("Unable to retrieve authenticated user.");
  }

  if (!user) {
    throw new Error("User is not authenticated.");
  }

  return user;
}
