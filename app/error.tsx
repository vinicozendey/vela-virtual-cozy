'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="container not-found"><h1>Não foi possível abrir esta página</h1><button className="button button--primary" onClick={reset}>Tentar novamente</button></div>;
}
