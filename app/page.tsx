import { redirect } from "next/navigation";

export const metadata = {
  title: "FigureMyLife Labs",
  description:
    "Improve your decisions through deeper thinking. Surface mental models and cognitive biases.",
};

export default function HomePage() {
  redirect("/chat/new");
  return null;
}
