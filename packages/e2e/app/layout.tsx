import type { Metadata } from "next";
import "@flowpanel/react/theme.css";

export const metadata: Metadata = {
  title: "FlowPanel E2E Fixture",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
