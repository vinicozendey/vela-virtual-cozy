import { PaymentRoute } from '../../../web/src/App';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentRoute key={id} id={id} />;
}
