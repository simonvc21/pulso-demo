import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulso · The portfolio OS for LATAM venture capital",
  description: "Automated data collection. Real-time, customizable dashboards. LP-ready in one click.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-paper text-ink">{children}</body>
    </html>
  );
}
