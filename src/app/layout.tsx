import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
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
          <Suspense fallback={null}>
            <GlobalTimer />
          </Suspense>
          {children}
        </ModalProvider>
      </body>
    </html>
  );
}
