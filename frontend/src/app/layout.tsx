import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/theme";
import { cn } from "@/lib/utils";
import { LanguageProvider } from "@/context/language-context";

const googleSans = localFont({
  src: [
    {
      path: "../../public/GoogleSans-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/GoogleSans-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/GoogleSans-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-google-sans",
  display: "swap",
  fallback: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
});

export const metadata: Metadata = {
  title: "unmai.ai - Verify Information with AI",
  description:
    "A tool that helps you verify the credibility of information using AI",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Suppress hydration warnings caused by browser extensions */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Remove browser extension attributes that cause hydration mismatches
              if (typeof window !== 'undefined') {
                const observer = new MutationObserver((mutations) => {
                  mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes') {
                      const attr = mutation.attributeName;
                      if (attr && (attr.startsWith('bis_') || attr.startsWith('data-grammarly') || attr.startsWith('data-lt-'))) {
                        mutation.target.removeAttribute(attr);
                      }
                    }
                  });
                });
                observer.observe(document.documentElement, { attributes: true, subtree: true });
              }
            `,
          }}
        />
      </head>
      <body
        className={cn(
          `${googleSans.variable} font-[var(--font-google-sans)] antialiased min-h-[100svh]`
        )}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <LanguageProvider>
            <div className="flex flex-col min-h-[100svh]" suppressHydrationWarning>
              <main className="flex-1 overflow-hidden" suppressHydrationWarning>{children}</main>
            </div>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
