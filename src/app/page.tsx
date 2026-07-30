import { getAccount } from "@/lib/account/services/account-get";

import { DebtorPortal } from "@/components/debtor-portal";

export const dynamic = "force-dynamic";

export default async function Home() {
  const accountContext = await getAccount("acc_standard_001");

  return <DebtorPortal accountContext={accountContext} />;
}
