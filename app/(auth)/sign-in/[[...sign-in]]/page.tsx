import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f5f4ed] dark:bg-[#141413]">
      <SignIn afterSignInUrl="/chat/new" />
    </div>
  );
}
