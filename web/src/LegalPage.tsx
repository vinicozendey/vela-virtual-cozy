import type { ReactNode } from 'react';

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return <section className="section legal-section">
    <article className="container legal-document">
      <h1>{title}</h1>
      <div className="legal-content">{children}</div>
    </article>
  </section>;
}
