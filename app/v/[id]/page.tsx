import type { Metadata } from 'next';
import { CandleRoute } from '../../../web/src/App';

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CandleRoute key={id} id={id} />;
}
