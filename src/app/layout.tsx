import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Odudu — Treasury Control", description: "A policy-controlled treasury for AI-assisted business payments." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
