import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Zona de Juegos Navideña",
  description: "Minijuegos para celebrar en grupo: Amigo Secreto y más.",
};

export const viewport: Viewport = { themeColor: "#faf7f2" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${montserrat.variable} antialiased`}>
        <div className="flex min-h-dvh flex-col">{children}</div>
      </body>
    </html>
  );
}
