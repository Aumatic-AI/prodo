import { redirect } from "next/navigation";

// Costs became Credits: old links land on the new screen
export default function Page() {
  redirect("/credits");
}
