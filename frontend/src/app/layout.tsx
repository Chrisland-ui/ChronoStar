import type { Metadata } from "next";
import "@/styles/globals.css";
import { WalletProvider } from "@/lib/store";
import { Navbar } from "@/components/Navbar";
import { initSentry } from "@/lib/sentry";

// Initialize Sentry client-side / server-side monitoring
initSentry();

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://chronostar.io"),
  title: "ChronoStar — Scheduled Payments on Stellar",
  description:
    "Time-based payment primitives for the Stellar ecosystem: ScheduleVault, RecurringStream, DCAPolicy.",
  keywords: ["stellar", "scheduled payments", "smart contracts", "chronostar"],
  icons: {
    icon: [
      { url: "/chronostar-logo-mark.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/chronostar-logo-mark.svg",
    apple: "/chronostar-logo-mark.svg",
  },
  openGraph: {
    title: "ChronoStar — Scheduled Payments on Stellar",
    description:
      "Time-based payment primitives for the Stellar ecosystem: ScheduleVault, RecurringStream, DCAPolicy.",
    url: "https://chronostar.io",
    siteName: "ChronoStar",
    images: [
      {
        url: "/chronostar-logo-mark.svg",
        width: 200,
        height: 200,
        alt: "ChronoStar Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChronoStar — Scheduled Payments on Stellar",
    description:
      "Time-based payment primitives for the Stellar ecosystem: ScheduleVault, RecurringStream, DCAPolicy.",
    images: ["/chronostar-logo-mark.svg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-black focus:shadow-lg"
        >
          Skip to content
        </a>
        <WalletProvider>
          <Navbar />
          <main
            id="main-content"
            tabIndex={-1}
            className="max-w-7xl mx-auto px-4 py-8 focus:outline-none"
          >
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  );
}
