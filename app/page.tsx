import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardHome } from "@/components/DashboardHome";
import { PRODUCT_TAGLINE } from "@/lib/product-tagline";

export const metadata = {
  title: "FigureMyLife Labs",
  description: PRODUCT_TAGLINE,
};

export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/chat/new");
  }
  return <DashboardHome />;
}
