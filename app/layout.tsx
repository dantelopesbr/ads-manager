import type { Metadata } from 'next'
import { Inter, Montserrat } from 'next/font/google'
import './globals.css'

// Fratelli House brand uses a custom font ("Brasley") not available to this
// app — Inter/Montserrat are its own documented fallback chain (body/display).
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'ADS Manager',
  description: 'Gestão de anúncios Meta Ads',
  // Internal tool with lead/revenue data — never indexed or crawlable.
  robots: { index: false, follow: false, nocache: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${montserrat.variable} font-sans`}>{children}</body>
    </html>
  )
}
