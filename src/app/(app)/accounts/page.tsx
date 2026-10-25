import { redirect } from "next/navigation";

// Connected accounts live in Settings now
export default function Page() {
  redirect("/settings?tab=accounts");
}
