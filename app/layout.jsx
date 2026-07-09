import { Anton, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata = {
  title: "Omer Shahid — AI & Automation Engineer",
  description:
    "Computer Science student at FAST-NUCES building lead generation engines, n8n orchestrations and automation systems that work while you sleep.",
  keywords: [
    "Omer Shahid",
    "automation engineer",
    "n8n",
    "AI engineer",
    "lead generation",
    "FAST-NUCES",
  ],
};

export const viewport = {
  themeColor: "#050505",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${grotesk.variable} ${plexMono.variable}`}
    >
      <body className="bg-void font-sans text-ink">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
