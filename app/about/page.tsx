import Link from "next/link";
import Image from "next/image";
import { ContactForm } from "@/components/ContactForm";

export const metadata = {
  title: "About the Creator — fml labs",
  description: "About Shreyas Ramesh, creator of fml labs",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
        <Link
          href="/"
          className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground mb-8 inline-block"
        >
          ← Back to fml labs
        </Link>

        <h1 className="text-2xl md:text-3xl font-semibold mb-6">About the Creator</h1>

        <div className="mb-8">
          <Image
            src="/images/profilephoto.png"
            alt="Shreyas Ramesh"
            width={160}
            height={160}
            className="rounded-full object-cover aspect-square"
            priority
          />
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">Shreyas Ramesh</h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              AI Engineer | Research &amp; Infrastructure
              {" · "}
              <a
                href="https://www.linkedin.com/in/rshreyas2/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:no-underline"
              >
                LinkedIn
              </a>
            </p>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              Shreyas is a <strong>Lead Software Engineer at Salesforce AI</strong> in San Francisco, where he leads the development of mission-critical platforms for enterprise-grade Artificial Intelligence. Currently, he serves as a <strong>Lead Member of Technical Staff</strong> for the <strong>Agentforce Core Platform</strong>. His leadership on the <strong>Agent Versioning System</strong> was a defining contribution to the field, allowing enterprise customers to manage non-deterministic AI agents with the same rigor and security as traditional software.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium mt-8 mb-3">Technical Leadership &amp; Recognition</h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-3">
              Elected as a <strong>Fellow of the Institute of Analytics (FIoA)</strong> in 2026, Shreyas is recognized for his leadership in operationalizing <strong>Generative AI and Deep Learning</strong> at an industrial scale. His career highlights include:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300">
              <li><strong>Innovation:</strong> Integrating GPT-3 to automate complex email responses, resulting in multiple patent applications in both the USA and India.</li>
              <li><strong>Infrastructure:</strong> Previously serving as a Senior Software Engineer at <strong>Cisco Systems</strong>, designing critical integrations between Cisco&apos;s network fabric and the <strong>Microsoft Azure</strong> backbone.</li>
              <li><strong>Academic Rigor:</strong> Holding a <strong>Master of Science in Computer Science from Virginia Tech</strong>, where his research on deep learning for taxonomy prediction was supported by the <strong>Office of the Director of National Intelligence (ODNI)</strong> and <strong>IARPA</strong>.</li>
              <li><strong>Industry Presence:</strong> Presenting at premier conferences such as <strong>NVIDIA GTC</strong> and receiving the <strong>F1000 Poster Award</strong> at the International Systems of Molecular Biology (ISMB).</li>
            </ul>
          </section>
        </div>

        <ContactForm />

        <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-4">
          <Link href="/mission" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            The Mission of fml labs
          </Link>
          <Link href="/terms-of-service" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground">
            Terms of Service
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
