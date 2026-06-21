import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Screen Recorder Hub",
  description: "Record your screen with remote timestamp controls",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
