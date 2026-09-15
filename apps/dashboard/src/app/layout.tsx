import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

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
    <html lang="en">
      <body className={`${font.className} bg-white flex h-screen text-black`}>
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 text-gray-900 flex flex-col">
          <div className="p-6 font-bold text-2xl border-b border-gray-200 text-blue-600">
            ReelNexus
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2">
            <a href="/" className="block px-4 py-2 rounded-md hover:bg-blue-50 hover:text-blue-600 transition-colors">Dashboard</a>
            <a href="/channels" className="block px-4 py-2 rounded-md hover:bg-blue-50 hover:text-blue-600 transition-colors">Channels</a>
            <a href="/queue" className="block px-4 py-2 rounded-md hover:bg-blue-50 hover:text-blue-600 transition-colors">Queue</a>
            <a href="/ingest" className="block px-4 py-2 rounded-md hover:bg-blue-50 hover:text-blue-600 transition-colors">Ingest</a>
          </nav>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
