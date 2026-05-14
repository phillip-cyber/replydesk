import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Bloom — Your restaurant deserves five-star handling',
  description:
    'Paste your URL. Five AI agents read every Google review you get, draft replies, find the patterns, and report back. Free preview. $10 unlocks the dashboard.',
};

// Meta Pixel id(s) — comma-separated string allows dual-fire. Set in Vercel.
const META_PIXEL_IDS = (process.env.NEXT_PUBLIC_META_PIXEL_ID || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pixelInitCalls = META_PIXEL_IDS.map((id) => `fbq('init','${id}');`).join('');
  const pixelScript = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');${pixelInitCalls}fbq('track','PageView');`;
  return (
    <html lang="en">
      <head>
        {META_PIXEL_IDS.length > 0 && (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {pixelScript}
            </Script>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <noscript>
              {META_PIXEL_IDS.map((id) => (
                <img
                  key={id}
                  height="1"
                  width="1"
                  style={{ display: 'none' }}
                  src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`}
                  alt=""
                />
              ))}
            </noscript>
          </>
        )}
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
