import { SignedIn, SignedOut } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default function HomePage() {
  return (
    <>
      <SignedOut>
        <RedirectToChat />
      </SignedOut>
      <SignedIn>
        <SignedInRedirect />
      </SignedIn>
    </>
  );
}

function RedirectToChat() {
  redirect("/chat/new");
  return null;
}

function SignedInRedirect() {
  redirect("/chat/new");
  return null;
}
