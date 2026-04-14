import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { UserTypeProvider } from "@/components/UserTypeProvider";
import { TtsSpeedProvider } from "@/components/TtsSpeedProvider";
import { BackgroundProvider } from "@/components/BackgroundProvider";
import { NativeHaptics } from "@/components/NativeHaptics";
import { NativeAppUrlHandler } from "@/components/NativeAppUrlHandler";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/product-tagline";
import "./globals.css";
import "../src/bones/registry";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: PRODUCT_TAGLINE,
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: PRODUCT_NAME,
  },
  openGraph: {
    title: PRODUCT_NAME,
    description: PRODUCT_TAGLINE,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: PRODUCT_NAME,
    description: PRODUCT_TAGLINE,
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f4ed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      localization={{
        signIn: {
          start: {
            title: `Sign In — ${PRODUCT_NAME}`,
          },
        },
        signUp: {
          start: {
            title: `Sign Up — ${PRODUCT_NAME}`,
          },
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Pinyon+Script&display=swap" rel="stylesheet" />
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var t=localStorage.getItem('theme')||'light';document.documentElement.classList.toggle('dark',t==='dark');var b=localStorage.getItem('fmllabs-background');if(b==='default'||b==='air'||b==='water'||b==='earth'||b==='fire')document.documentElement.setAttribute('data-background',b);else document.documentElement.setAttribute('data-background','default');})();`,
            }}
          />
        </head>
        <body className="antialiased min-h-screen">
          <NativeAppUrlHandler />
          <NativeHaptics />
          <Script
            src="https://datafa.st/js/script.js"
            data-website-id="dfid_iRebNC9FUtKBFZ9BdJHom"
            data-domain="fmllabs.ai"
            strategy="afterInteractive"
          />
          <ThemeProvider>
            <LanguageProvider>
              <UserTypeProvider>
                <TtsSpeedProvider>
                  <BackgroundProvider>
                    {children}
                  </BackgroundProvider>
                </TtsSpeedProvider>
              </UserTypeProvider>
            </LanguageProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
