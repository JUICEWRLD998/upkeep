import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google'
import { Providers } from '@/components/Providers'
import { SiteHeader } from '@/components/SiteHeader'
import './globals.css'

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-bricolage', display: 'swap' })
const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Upkeep', template: '%s · Upkeep' },
  description: "Don't send money home. Send a key. A monthly limit, a list of payees, and the network refuses everything else.",
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4efe6' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1119' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  )
}
