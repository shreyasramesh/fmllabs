import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/product-tagline";

export const metadata = {
  title: PRODUCT_NAME,
  description: PRODUCT_TAGLINE,
};

export default async function HomePage() {
  await auth();
  redirect("/chat/new");
}
