import Link from "next/link";
import { PRODUCT_TAGLINE } from "@/lib/product-tagline";

export const metadata = {
  title: "Privacy Policy — fml labs",
  description: `${PRODUCT_TAGLINE} — Privacy Policy for fml labs`,
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
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-10">Last updated: March 9, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">1. Introduction</h2>
            <p>
              fml labs is a personal, non-commercial research project operated by Shreyas Ramesh. This Privacy Policy explains how data is handled within this technical demonstration. Because this is a personal project, your data is never used for commercial gain.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">2. Information We Collect</h2>
            <p>
              We collect the following types of information:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Personal Information:</strong> Name and email address provided during account creation.</li>
              <li><strong>User Content:</strong> The concepts, memories, and chat content you provide to interact with the AI model.</li>
              <li><strong>Technical Data:</strong> Cookies used solely for session management (keeping you logged in).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">3. Purpose of Data Collection</h2>
            <p>
              As a non-commercial hobbyist project, the data collected is used strictly to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Facilitate the technical demonstration of AI reasoning.</li>
              <li>Allow for personal use of the tool&apos;s &quot;memory&quot; features.</li>
              <li><strong>Research &amp; Development:</strong> To help the owner refine AI engineering techniques for personal skill development.</li>
              <li><strong>No Commercial Use:</strong> Data is never used for advertising, marketing, or profiling for financial gain.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">4. Data Sharing &amp; Third Parties</h2>
            <p>
              We do not sell, rent, or trade your personal data. We use standard third-party infrastructure (e.g., Clerk for authentication or AI APIs for model inference) strictly to make the hobby project functional. These providers do not have permission to use your data for any purposes other than providing the necessary technical infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">5. Data Security</h2>
            <p>
              Reasonable measures are taken to protect your personal information from unauthorized access, alteration, or destruction. However, no method of transmission over the internet or electronic storage is completely secure, and absolute security cannot be guaranteed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">6. Children&apos;s Privacy</h2>
            <p>
              The Service does not knowingly collect any data from children under 13 years of age. The Service is not intended for children. If you believe information from a child has been inadvertently collected, please contact the owner and it will be deleted promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">7. Updates to This Policy</h2>
            <p>
              This Privacy Policy may be updated from time to time. When material changes are made, the &quot;Last updated&quot; date at the top will be revised. Your continued use of the Service after such changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">8. Contact</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact the owner at{" "}
              <a href="mailto:shreyas.ramesh@gmail.com" className="underline underline-offset-2 hover:no-underline">
                shreyas.ramesh@gmail.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-4">
          <Link href="/faq" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            FAQ
          </Link>
          <Link href="/about" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            About the Creator
          </Link>
          <Link href="/mission" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            Mission
          </Link>
          <Link href="/terms-of-service" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            ← Back to fml labs
          </Link>
        </div>
      </div>
    </div>
  );
}
