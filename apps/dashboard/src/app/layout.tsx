import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

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
      <body className={`${font.className} bg-white text-black transition-colors duration-200`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
