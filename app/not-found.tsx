import Link from 'next/link';

export default function NotFound() {
  return <div className="container not-found"><h1>Página não encontrada</h1><p>Confira o endereço ou volte para o início.</p><Link href="/">Voltar ao início</Link></div>;
}
