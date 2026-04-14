import Link from "next/link";
import Image from "next/image";
import { ContactForm } from "@/components/ContactForm";
import { PRODUCT_TAGLINE } from "@/lib/product-tagline";

export const metadata = {
  title: "About the Creator — fml labs",
  description: `${PRODUCT_TAGLINE} — About Shreyas Ramesh, creator of fml labs`,
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#f5f4ed] text-[#141413] dark:bg-[#141413] dark:text-[#faf9f5]">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
        <Link
          href="/chat/new"
          aria-label="Home"
          title="Home"
          className="mb-8 inline-flex items-center gap-2 rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-3 py-2 text-sm font-medium text-[#4d4c48] shadow-[#e8e6dc_0px_0px_0px_0px,#d1cfc5_0px_0px_0px_1px] transition-colors hover:bg-[#e8e6dc] dark:border-[#3d3d3a] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <path d="m3 10 9-7 9 7" />
            <path d="M5 9.5V20h14V9.5" />
          </svg>
          Home
        </Link>

        <h1 className="font-serif text-3xl font-medium leading-tight text-[#141413] dark:text-[#faf9f5] md:text-4xl mb-3">About the Creator</h1>
        <p className="text-[#5e5d59] dark:text-[#87867f] text-base leading-relaxed mb-8 max-w-prose">
          {PRODUCT_TAGLINE}
        </p>

        <div className="mb-10">
          <Image
            src="/images/profilephoto.png"
            alt="Shreyas Ramesh"
            width={160}
            height={160}
            className="rounded-[2rem] object-cover aspect-square shadow-[rgba(0,0,0,0.05)_0px_4px_24px]"
            priority
          />
        </div>

        <div className="space-y-6 text-base leading-relaxed">
          <p className="text-[#141413] dark:text-[#faf9f5] leading-[1.6] font-medium">
            In a world of cognitive surrender, start taking back control.
          </p>
          <p className="text-[#5e5d59] dark:text-[#87867f] leading-[1.6]">
            Design inspired by the penco calendar and claude.
          </p>
          <section>
            <h2 className="font-serif text-2xl font-medium mt-10 mb-3 text-[#141413] dark:text-[#faf9f5]">Shreyas Ramesh</h2>
            <p className="text-[#87867f] dark:text-[#87867f] mb-4 text-sm">
              AI Engineer | Research &amp; Infrastructure
              {" · "}
              <a
                href="https://www.linkedin.com/in/rshreyas2/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#c96442] underline underline-offset-2 hover:no-underline dark:text-[#d97757]"
              >
                LinkedIn
              </a>
            </p>
            <p className="text-[#4d4c48] dark:text-[#b0aea5] leading-[1.6]">
              Shreyas is a <strong className="text-[#141413] dark:text-[#faf9f5]">Lead Software Engineer at Salesforce AI</strong> in San Francisco, where he leads the development of mission-critical platforms for enterprise-grade Artificial Intelligence. Currently, he serves as a <strong className="text-[#141413] dark:text-[#faf9f5]">Lead Member of Technical Staff</strong> for the <strong className="text-[#141413] dark:text-[#faf9f5]">Agentforce Core Platform</strong>. His leadership on the <strong className="text-[#141413] dark:text-[#faf9f5]">Agent Versioning System</strong> was a defining contribution to the field, allowing enterprise customers to manage non-deterministic AI agents with the same rigor and security as traditional software.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-medium mt-10 mb-3 text-[#141413] dark:text-[#faf9f5]">Technical Leadership &amp; Recognition</h2>
            <p className="text-[#4d4c48] dark:text-[#b0aea5] leading-[1.6] mb-4">
              Elected as a <strong className="text-[#141413] dark:text-[#faf9f5]">Fellow of the Institute of Analytics (FIoA)</strong> in 2026, Shreyas is recognized for his leadership in operationalizing <strong className="text-[#141413] dark:text-[#faf9f5]">Generative AI and Deep Learning</strong> at an industrial scale. His career highlights include:
            </p>
            <ul className="list-disc pl-6 space-y-3 text-[#4d4c48] dark:text-[#b0aea5]">
              <li><strong className="text-[#141413] dark:text-[#faf9f5]">Innovation:</strong> Integrating GPT-3 to automate complex email responses, resulting in multiple patent applications in both the USA and India.</li>
              <li><strong className="text-[#141413] dark:text-[#faf9f5]">Infrastructure:</strong> Previously serving as a Senior Software Engineer at <strong className="text-[#141413] dark:text-[#faf9f5]">Cisco Systems</strong>, designing critical integrations between Cisco&apos;s network fabric and the <strong className="text-[#141413] dark:text-[#faf9f5]">Microsoft Azure</strong> backbone.</li>
              <li><strong className="text-[#141413] dark:text-[#faf9f5]">Academic Rigor:</strong> Holding a <strong className="text-[#141413] dark:text-[#faf9f5]">Master of Science in Computer Science from Virginia Tech</strong>, where his research on deep learning for taxonomy prediction was supported by the <strong className="text-[#141413] dark:text-[#faf9f5]">Office of the Director of National Intelligence (ODNI)</strong> and <strong className="text-[#141413] dark:text-[#faf9f5]">IARPA</strong>.</li>
              <li><strong className="text-[#141413] dark:text-[#faf9f5]">Industry Presence:</strong> Presenting at premier conferences such as <strong className="text-[#141413] dark:text-[#faf9f5]">NVIDIA GTC</strong> and receiving the <strong className="text-[#141413] dark:text-[#faf9f5]">F1000 Poster Award</strong> at the International Systems of Molecular Biology (ISMB).</li>
            </ul>
          </section>
        </div>

        <div className="mt-10 border-t border-[#e8e6dc] dark:border-[#30302e] pt-8">
          <ContactForm />
        </div>

        <div className="mt-12 pt-8 border-t border-[#e8e6dc] dark:border-[#30302e] flex flex-wrap gap-4">
          <Link href="/faq" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            FAQ
          </Link>
          <Link href="/leaderboard" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            Leaderboard
          </Link>
          <Link href="/mission" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            The Mission of fml labs
          </Link>
          <Link href="/terms-of-service" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            Terms of Service
          </Link>
          <Link href="/privacy-policy" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            Privacy Policy
          </Link>
          <Link href="/chat/new" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
