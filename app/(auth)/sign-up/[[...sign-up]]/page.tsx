import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f5f4ed] dark:bg-[#141413]">
      <SignUp afterSignUpUrl="/chat/new" />
    </div>
  );
}
