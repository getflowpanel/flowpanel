import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "freelance-radar — FlowPanel demo",
  description: "Real-data admin for a freelance job radar SaaS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
