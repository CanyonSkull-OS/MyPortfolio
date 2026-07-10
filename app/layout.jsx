import { Fraunces, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import FluidCursor from "@/components/FluidCursor";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
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
    "Omer Shahid builds automation that runs the repetitive half of a business — lead pipelines, attendance systems, calendar plumbing. CS at FAST-NUCES, Karachi.",
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
  themeColor: "#001524",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${instrument.variable} ${plexMono.variable}`}
    >
      <body className="bg-cream font-sans text-ink">
        <SmoothScroll>{children}</SmoothScroll>
        <FluidCursor />
      </body>
    </html>
  );
}
