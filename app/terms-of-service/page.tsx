import Link from "next/link";

export const metadata = {
  title: "Terms of Service — fml labs",
  description: "Terms of Service for fml labs",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
        <Link
          href="/"
          className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground mb-8 inline-block"
        >
          ← Back to fml labs
        </Link>

        <h1 className="text-2xl md:text-3xl font-semibold mb-2">Terms of Service</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-10">Last updated: March 5, 2025</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">1. Agreement to Terms</h2>
            <p>
              By accessing or using fml labs (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">2. Description of Service</h2>
            <p>
              fml labs is a decision-making coach where users can think in first principles and ask multi-order reasoning questions, chat with an AI language model, and use their own concepts and memories for better decision making and clearer thought processing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">3. Ownership</h2>
            <p>
              The Service, including its design, content, software, and all intellectual property rights, is owned and operated by the owner of fml labs. You may not copy, modify, distribute, or create derivative works without express permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">4. User Data and Privacy</h2>
            <p>
              We collect personal information such as your name, email address, and other relevant information you provide when using the Service. We also collect non-personal data through web cookies. For details on how we collect, use, and protect your data, please read our{" "}
              <Link href="/privacy-policy" className="underline underline-offset-2 hover:no-underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">5. Acceptable Use</h2>
            <p>
              You agree to use the Service only for lawful purposes and in accordance with these Terms. You must not use the Service in any way that could harm, disable, or impair the Service or interfere with any other user&apos;s access or use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">6. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied. We do not warrant that the Service will be uninterrupted, error-free, or free of harmful components.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">7. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, fml labs and its owner shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">8. Changes to Terms</h2>
            <p>
              We may update these Terms of Service from time to time. When we make material changes, we will notify you by email. Your continued use of the Service after such notification constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">9. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">10. Contact</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at{" "}
              <a href="mailto:shreyas.ramesh@gmail.com" className="underline underline-offset-2 hover:no-underline">
                shreyas.ramesh@gmail.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700">
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
