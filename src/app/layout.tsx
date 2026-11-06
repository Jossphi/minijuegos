import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import Snowfall from "@/components/Snowfall";
import "./globals.css";

const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Zona de Juegos Navideña",
  description: "Minijuegos para celebrar en grupo: Amigo Secreto y más.",
};

export const viewport: Viewport = { themeColor: "#070b1f" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${montserrat.variable} antialiased`}>
        <Snowfall />
        <div className="relative z-10 flex min-h-dvh flex-col">{children}</div>
      </body>
    </html>
  );
}
