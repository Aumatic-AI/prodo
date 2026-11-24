import { BusinessPage } from "@/modules/admin/pages/BusinessPage";

export const metadata = { title: "Business" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <BusinessPage id={(await params).id} />;
}
