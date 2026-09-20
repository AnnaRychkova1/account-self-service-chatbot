import { DebtorPortal } from "@/components/debtor-portal";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getCurrentAccount } from "@/lib/account/services/account-current";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    await getAuthenticatedUser();
  } catch {
    return <LoginForm />;
  }
  const accountContext = await getCurrentAccount();

  return <DebtorPortal accountContext={accountContext} />;
}
