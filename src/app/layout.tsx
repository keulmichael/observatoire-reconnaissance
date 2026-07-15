import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Observatoire de la Reconnaissance",
  description:
    "Instrument local d'observation des transitions de compréhension selon la Théorie de la Réflexivité.",
  applicationName: "Observatoire de la Reconnaissance"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
