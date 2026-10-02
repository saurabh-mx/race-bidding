import type { Metadata } from "next";
import "./globals.css";
import { ModalProvider } from "@/components/ModalProvider";
import { GlobalTimer } from "@/components/GlobalTimer";

export const metadata: Metadata = {
  title: "RaceBet | Real-time Race Betting Platform",
  description: "Bet on your favorite racing teams and individual racers in real-time. Secure, attribute-based access control.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ModalProvider>
          <GlobalTimer />
          {children}
        </ModalProvider>
      </body>
    </html>
  );
}
