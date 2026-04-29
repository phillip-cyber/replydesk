import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Bloom — Your restaurant deserves five-star handling',
  description:
    'Paste your URL. Five AI agents read every Google review you get, draft replies, find the patterns, and report back. Free preview. $10 unlocks the dashboard.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
