import { redirect } from "next/navigation";
import { PRODUCT_TAGLINE } from "@/lib/product-tagline";

export const metadata = {
  title: "FigureMyLife Labs",
  description: PRODUCT_TAGLINE,
};

export default function HomePage() {
  redirect("/chat/new");
  return null;
}
