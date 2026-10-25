import { Suspense } from "react";
import { WeekPage } from "@/modules/week/pages/WeekPage";

export const metadata = { title: "This week" };

export default function Page() {
  // The week and the open post live in the URL (?week=next&item=…), read with useSearchParams
  return (
    <Suspense>
      <WeekPage />
    </Suspense>
  );
}
