import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Africinnovate | Technology Career Aptitude Assessment",
    template: "%s | Africinnovate",
  },
  description:
    "Discover the technology learning pathway where you are most likely to perform well - a beginner-friendly aptitude assessment from Africinnovate.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
