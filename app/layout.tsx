import type { ReactNode } from 'react'

export const metadata = {
  title: 'Upkeep',
  description: "Don't send money home. Send a key.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
