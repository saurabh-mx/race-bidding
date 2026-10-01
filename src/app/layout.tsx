import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RaceBid | Real-time Race Bidding Platform",
  description: "Bid on your favorite racing teams and individual racers in real-time. Secure, attribute-based access control.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
