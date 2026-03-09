import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — fml labs",
  description: "Privacy Policy for fml labs",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
        <Link
          href="/"
          className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground mb-8 inline-block"
        >
          ← Back to fml labs
        </Link>

        <h1 className="text-2xl md:text-3xl font-semibold mb-2">Privacy Policy</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-10">Last updated: March 5, 2025</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">1. Introduction</h2>
            <p>
              FML Labs (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates this website. fml labs is a decision-making coach where users can think in first principles and ask multi-order reasoning questions, chat with an AI language model, and use their own concepts and memories for better decision making and clearer thought processing.
            </p>
            <p>
              This Privacy Policy explains how we collect, use, and protect your information when you use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">2. Information We Collect</h2>
            <p>
              We collect the following types of information:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Personal information:</strong> Name, email address, and other relevant information you provide when creating an account or using the Service (such as your concepts, memories, and chat content).</li>
              <li><strong>Non-personal data:</strong> Web cookies and similar technologies that help us operate the Service, remember your preferences, and understand how you use our site.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">3. Purpose of Data Collection</h2>
            <p>
              We use your data to:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Provide, operate, and maintain the Service</li>
              <li>Authenticate your account and manage your session</li>
              <li>Store and retrieve your concepts, memories, and conversation history</li>
              <li>Personalize your experience and improve the Service</li>
              <li>Communicate with you about updates, security, or support</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">4. Data Sharing</h2>
            <p>
              We do not sell or share your personal data with any other parties for marketing or advertising purposes. We may use trusted third-party service providers (such as hosting and authentication services) solely to operate the Service. These providers are contractually required to protect your data and use it only for the purposes we specify.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">5. Data Security</h2>
            <p>
              We take reasonable measures to protect your personal information from unauthorized access, alteration, or destruction. However, no method of transmission over the internet or electronic storage is completely secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">6. Children&apos;s Privacy</h2>
            <p>
              We do not knowingly collect any data from children under 13 years of age. The Service is not intended for children. If you believe we have inadvertently collected information from a child, please contact us and we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">7. Updates to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email. Your continued use of the Service after such notification constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">8. Contact</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:shreyas.ramesh@gmail.com" className="underline underline-offset-2 hover:no-underline">
                shreyas.ramesh@gmail.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700 flex gap-4">
          <Link
            href="/terms-of-service"
            className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground"
          >
            Terms of Service
          </Link>
          <Link
            href="/"
            className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground"
          >
            ← Back to fml labs
          </Link>
        </div>
      </div>
    </div>
  );
}
