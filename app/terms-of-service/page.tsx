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
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-10">Last updated: March 9, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">1. Personal Research Project</h2>
            <p>
              fml labs is a personal, non-commercial research project created by Shreyas Ramesh to demonstrate AI engineering capabilities. By accessing or using the Service, you acknowledge that this is a hobbyist portfolio project and agree to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">2. Description of Service</h2>
            <p>
              fml labs is a decision-making coach where users can explore first-principles thinking and multi-order reasoning. This tool is provided solely for educational and demonstration purposes and is not a commercial product or service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">3. Non-Commercial Use & No Monetization</h2>
            <p>
              This Service is provided to the public for free.
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>No Fees:</strong> There are no subscriptions, fees, or charges associated with any part of the Service.</li>
              <li><strong>No Advertising:</strong> The Service does not host third-party advertisements or generate revenue through affiliate links or data monetization.</li>
              <li><strong>No Business Entity:</strong> fml labs is not a legal business entity or corporation; it is a private technical experiment.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">4. Ownership</h2>
            <p>
              The Service, including its design, content, and software, is the personal intellectual property of Shreyas Ramesh. You may not copy, modify, or distribute the code for commercial purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">5. User Data and Privacy</h2>
            <p>
              We collect minimal personal information to facilitate the AI interaction. For details, please read our{" "}
              <Link href="/privacy-policy" className="underline underline-offset-2 hover:no-underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">6. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &quot;as is&quot; for demonstration purposes only. The owner makes no guarantees regarding the accuracy of the AI-generated responses or the continuous availability of the site.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">7. Acceptable Use</h2>
            <p>
              You agree to use the Service only for lawful purposes and in accordance with these Terms. You must not use the Service in any way that could harm, disable, or impair the Service or interfere with any other user&apos;s access or use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">8. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, the owner shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">9. Changes to Terms</h2>
            <p>
              The owner may update these Terms of Service from time to time. When material changes are made, the &quot;Last updated&quot; date at the top will be revised. Your continued use of the Service after such changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">10. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">11. Contact</h2>
            <p>
              If you have any questions about these Terms of Service, please contact the owner at{" "}
              <a href="mailto:shreyas.ramesh@gmail.com" className="underline underline-offset-2 hover:no-underline">
                shreyas.ramesh@gmail.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-4">
          <Link href="/about" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            About the Creator
          </Link>
          <Link href="/mission" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            Mission
          </Link>
          <Link href="/privacy-policy" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            ← Back to fml labs
          </Link>
        </div>
      </div>
    </div>
  );
}
