import { Suspense } from "react";
import { BrandPage } from "@/modules/brand/pages/BrandPage";

export default function Page() {
  // The tab lives in the URL (?tab=offers), read with useSearchParams
  return (
    <Suspense>
      <BrandPage />
    </Suspense>
  );
}
