import { Suspense } from "react";
import { SettingsPage } from "@/modules/settings/pages/SettingsPage";

export default function Page() {
  // The section lives in the URL (?tab=accounts), read with useSearchParams
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  );
}
