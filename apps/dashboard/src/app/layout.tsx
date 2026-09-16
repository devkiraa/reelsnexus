import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { HeaderNav, BackToTop, SidebarNav } from "./LayoutClient";

const font = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ReelNexus Dashboard",
  description: "Autonomous Multi-Channel YouTube Shorts Pipeline",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${font.className} bg-white flex h-screen text-black transition-colors duration-200`}>
        <Providers>
          {/* Skip Link for Accessibility */}
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 z-50 rounded-md focus-visible:ring-2 focus-visible:ring-white">
            Skip to main content
          </a>

          {/* Sticky Sidebar */}
          <SidebarNav />
          
          {/* Main Content Area */}
          <div id="main-scroll-container" className="flex-1 overflow-auto relative">
            <HeaderNav />
            <main id="main-content" className="outline-none" tabIndex={-1}>
              {children}
            </main>
            <BackToTop />
          </div>
        </Providers>
      </body>
    </html>
  );
}
