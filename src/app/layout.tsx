import type { Metadata, Viewport } from "next";
import { Fredoka, Mountains_of_Christmas } from "next/font/google";
import Snowfall from "@/components/Snowfall";
import "./globals.css";

const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] });
const mountains = Mountains_of_Christmas({ variable: "--font-mountains", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Zona de Juegos Navideña",
  description: "Minijuegos para celebrar en grupo: Amigo Secreto y más.",
};

export const viewport: Viewport = { themeColor: "#070b1f" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${fredoka.variable} ${mountains.variable} antialiased`}>
        <Snowfall />
        <div className="relative z-10 flex min-h-dvh flex-col">{children}</div>
      </body>
    </html>
  );
}
