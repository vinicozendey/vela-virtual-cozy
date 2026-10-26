'use client';

import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isSignInWithEmailLink, onAuthStateChanged, sendSignInLinkToEmail, signInWithEmailLink, signOut, type User } from 'firebase/auth';
import { api, browserId } from './api';
import { auth, configured, demoMode } from './firebase';
import type { Candle, Order, PlanId, UserProfile } from './types';
import { ShareCandle } from './ShareCandle';

const saints = [
  { id: 'maria', name: 'Nossa Senhora' }, { id: 'jose', name: 'São José' },
  { id: 'francisco', name: 'São Francisco de Assis' }, { id: 'terezinha', name: 'Santa Teresinha' },
  { id: 'rita_cassia', name: 'Santa Rita de Cássia' }, { id: 'antonio', name: 'Santo Antônio' },
  { id: 'aparecida', name: 'Nossa Senhora Aparecida' }, { id: 'guadalupe', name: 'Nossa Senhora de Guadalupe' },
  { id: 'judas_tadeu', name: 'São Judas Tadeu' }, { id: 'jorge', name: 'São Jorge' },
  { id: 'padre_pio', name: 'Padre Pio' }, { id: 'acutis', name: 'São Carlo Acutis' },
];
const plans: { id: PlanId; name: string; days: number; price: string; note: string; feature: string }[] = [
  { id: 'free', name: 'Vela de intenção', days: 7, price: 'Grátis', note: 'Um gesto para começar', feature: 'Intenção e corrente por link' },
  { id: 'novena', name: 'Novena', days: 9, price: 'R$ 4,90', note: 'Nove dias de oração', feature: 'Santo e aparência à sua escolha' },
  { id: 'quaresma', name: 'Quaresma / Graça', days: 40, price: 'R$ 12,90', note: 'Uma jornada mais longa', feature: 'Personalização e moldura dourada' },
];

function fmtDate(time: number | null | undefined) { return time ? new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(time) : '—'; }
function fmtMoney(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100); }
function statusLabel(status: Candle['status']) { return ({ active: 'Acesa', ended: 'Encerrada', pending_payment: 'Aguardando PIX', pending_review: 'Em revisão', hidden: 'Oculta', deleted: 'Excluída' })[status]; }
function saintName(id: string | null) { return saints.find(s => s.id === id)?.name; }

function Flame({ small = false, theme = 'classic' }: { small?: boolean; theme?: string }) {
  return <div className={`candle-art ${small ? 'candle-art--small' : ''} candle-art--${theme}`} aria-hidden="true">
    <div className="flame-glow" /><div className="flame-outer"><div className="flame-inner" /></div>
    <div className="wick" /><div className="wax"><span className="wax-drip wax-drip-a" /><span className="wax-drip wax-drip-b" /></div>
    <div className="candle-shadow" />
  </div>;
}

function ErrorNote({ error }: { error: string }) { return error ? <div role="alert" className="error-note">{error}</div> : null; }
function Notice({ children }: { children: ReactNode }) { return <div className="notice">{children}</div>; }
function PixQrCode({ pixCode, providerImage }: { pixCode?: string; providerImage?: string }) {
  const [generatedImage, setGeneratedImage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setGeneratedImage('');
    if (pixCode) {
      import('qrcode')
        .then(({ default: QRCode }) => QRCode.toDataURL(pixCode, { errorCorrectionLevel: 'M', margin: 2, width: 320 }))
        .then(image => { if (!cancelled) setGeneratedImage(image); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [pixCode]);

  const image = generatedImage || (providerImage?.startsWith('data:image/png;base64,') ? providerImage : '');
  if (!image) return null;
  return <figure className="pix-qr"><img className="qr-code" src={image} alt={demoMode ? 'QR Code demonstrativo, sem cobrança' : 'QR Code PIX para escanear no aplicativo do banco'} /><figcaption>{demoMode ? 'QR demonstrativo. Nenhuma cobrança será criada nesta prévia.' : 'Abra o app do seu banco no celular e escaneie este código.'}</figcaption></figure>;
}
function Button({ children, onClick, disabled, type = 'button', variant = 'primary', className = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'; variant?: 'primary' | 'secondary' | 'ghost'; className?: string }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`button button--${variant} ${className}`}>{children}</button>;
}

type AppUser = User | { email: string; uid: string } | null;
type AppContextValue = { user: AppUser; authReady: boolean; navigate: (path: string) => void; setPageTitle: (title: string) => void };
const AppContext = createContext<AppContextValue | null>(null);
function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('AppShell is required.');
  return context;
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pageTitle, setTitle] = useState<{ pathname: string; value: string } | null>(null);
  const title = pageTitle?.pathname === pathname ? pageTitle.value : 'Vela Virtual · Uma intenção, muitas orações';
  const [user, setUser] = useState<AppUser>(demoMode ? { email: 'criador@exemplo.com', uid: 'demo' } : null);
  const [authReady, setAuthReady] = useState(demoMode);

  useEffect(() => {
    if (!auth) { setAuthReady(true); return; }
    return onAuthStateChanged(auth, current => { setUser(current); setAuthReady(true); });
  }, []);

  function navigate(next: string) {
    // Only internal paths are accepted, including the email-link return URL.
    router.push(next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/minhas-velas');
  }
  const go = (next: string) => () => navigate(next);

  return <AppContext.Provider value={{ user, authReady, navigate, setPageTitle: value => setTitle({ pathname, value }) }}>
    <title>{title}</title>
    <header className="site-header"><div className="container nav-inner">
      <button className="brand" onClick={go('/')} aria-label="Vela Virtual, página inicial"><span className="brand-mark">✦</span><span>Vela <em>Virtual</em></span></button>
      <nav aria-label="Navegação principal"><button onClick={go('/#como-funciona')}>Como funciona</button><button onClick={go('/#planos')}>Planos</button>{user ? <button onClick={go('/minhas-velas')}>Minhas velas</button> : <button onClick={go('/entrar')}>Entrar</button>}</nav>
      <Button onClick={go(user ? '/criar' : '/entrar?next=/criar')} className="nav-cta">Acender uma vela <span aria-hidden>↗</span></Button>
    </div></header>
    {demoMode && <div className="demo-banner">Prévia local: dados ficam neste navegador e pagamentos são simulados.</div>}
    {!configured && <div className="setup-banner">Não foi possível conectar ao aplicativo. Tente novamente mais tarde.</div>}
    <main>{children}</main>
    <footer className="site-footer"><div className="container footer-grid"><div><div className="brand footer-brand"><span className="brand-mark">✦</span><span>Vela <em>Virtual</em></span></div><p>Uma intenção compartilhada pode reunir muitas orações.</p></div><div><strong>Explore</strong><button onClick={go('/#como-funciona')}>Como funciona</button><button onClick={go('/#planos')}>Planos</button><button onClick={go('/sobre')}>Sobre o projeto</button></div><div><strong>Um gesto simbólico</strong><p>A vela virtual é uma expressão de fé e acolhimento. Não representa sacramento nem promessa de graça.</p></div></div><div className="container footer-bottom">© {new Date().getFullYear()} Vela Virtual · Nome provisório</div></footer>
  </AppContext.Provider>;
}

function ProtectedPage({ children }: { children: ReactNode }) {
  const { user, authReady } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    if (authReady && !user) router.replace(`/entrar?next=${encodeURIComponent(pathname + (search ? `?${search}` : ''))}`);
  }, [authReady, user, pathname, search, router]);
  if (!authReady || !user) return <div className="container loading-screen">Preparando sua experiência…</div>;
  return children;
}

export function HomeRoute() {
  const { navigate, user } = useApp();
  return <Home navigate={navigate} user={Boolean(user)} />;
}
export function AuthRoute() {
  const { navigate } = useApp();
  return <AuthScreen navigate={navigate} />;
}
export function CreateRoute() {
  const { navigate } = useApp();
  return <ProtectedPage><CreatePage navigate={navigate} /></ProtectedPage>;
}
export function DashboardRoute() {
  const { navigate, user } = useApp();
  return <ProtectedPage><Dashboard navigate={navigate} userEmail={user?.email || ''} /></ProtectedPage>;
}
export function CandleRoute({ id }: { id: string }) {
  const { navigate, user } = useApp();
  return <CandlePage id={id} navigate={navigate} isOwner={Boolean(user)} />;
}
export function PaymentRoute({ id }: { id: string }) {
  const { navigate } = useApp();
  return <ProtectedPage><PaymentPage id={id} navigate={navigate} /></ProtectedPage>;
}
export function ModerationRoute() { return <ProtectedPage><ModerationPage /></ProtectedPage>; }
export function AboutRoute() { return <AboutPage />; }

function Home({ navigate, user }: { navigate: (path: string) => void; user: boolean }) {
  useEffect(() => { if (location.hash) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 50); }, []);
  const create = () => navigate(user ? '/criar' : '/entrar?next=/criar');
  return <>
    <section className="hero"><div className="container hero-grid"><div className="hero-copy"><span className="eyebrow"><span className="eyebrow-dot" /> Fé que aproxima, oração que acolhe</span><h1>Uma intenção.<br /><em>Muitas orações.</em></h1><p>Acenda uma vela virtual por quem você ama e convide sua família e seus amigos a rezarem com você. Um lugar simples para transformar uma intenção em corrente de oração.</p><div className="hero-actions"><Button onClick={create}>Acender minha vela <span aria-hidden>↗</span></Button><button className="text-link" onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}>Entenda como funciona <span aria-hidden>→</span></button></div><div className="hero-trust"><span>✧</span> Gratuita para começar <span className="trust-sep">·</span> Compartilhada só por link</div></div><div className="hero-visual"><div className="halo halo-one" /><div className="halo halo-two" /><div className="hero-card"><span className="hero-card-top">Vela de intenção <span>✦</span></span><Flame /><div className="hero-card-bottom"><strong>Por quem mora em nosso coração</strong><span>Uma intenção que reúne esperança.</span><div className="tiny-avatars"><i>M</i><i>R</i><i>A</i><span>24 registros de oração</span></div></div></div><div className="floating-note note-top">✧ &nbsp; A oração nos une</div><div className="floating-note note-bottom">🙏 &nbsp; Rezei por você</div></div></div><div className="hero-curve" /></section>
    <section className="intro-strip"><div className="container intro-inner"><span className="ornament">✦</span><p>Não importa a distância. Quando uma intenção é compartilhada, ninguém precisa rezar sozinho.</p><span className="ornament">✦</span></div></section>
    <section className="how-section section" id="como-funciona"><div className="container"><div className="section-heading"><span className="eyebrow">Simples como uma oração</span><h2>Um gesto de fé em <em>três passos</em></h2><p>Crie um espaço para sua intenção e acolha cada pessoa que chegar pelo link.</p></div><div className="steps-grid"><article className="step-card"><span className="step-icon">✍</span><span className="step-number">01</span><h3>Escreva sua intenção</h3><p>Conte por quem ou pelo que você deseja rezar. Use palavras simples e respeite a privacidade de outras pessoas.</p></article><article className="step-card"><span className="step-icon">↗</span><span className="step-number">02</span><h3>Compartilhe o link</h3><p>Envie pelo WhatsApp para familiares e amigos. Sua vela não aparece em mural público nem em buscas.</p></article><article className="step-card"><span className="step-icon">♡</span><span className="step-number">03</span><h3>Rezem juntos</h3><p>Quem recebe o link pode marcar que rezou e deixar uma mensagem de apoio, sem precisar criar conta.</p></article></div></div></section>
    <section className="quote-band"><div className="container quote-inner"><span className="quote-mark">“</span><p>Onde dois ou três estiverem reunidos em meu nome, ali estou eu no meio deles.</p><span>Mateus 18,20</span></div></section>
    <section className="plans-section section" id="planos"><div className="container"><div className="section-heading"><span className="eyebrow">Escolha sua jornada</span><h2>Uma vela para cada <em>momento</em></h2><p>Toda oração tem o mesmo valor. Os planos pagos oferecem mais tempo e personalização para a sua página.</p></div><div className="plans-grid">{plans.map(plan => <article key={plan.id} className={`plan-card ${plan.id === 'novena' ? 'plan-card--featured' : ''}`}><div className="plan-upper">{plan.id === 'novena' && <span className="plan-badge">Mais escolhida</span>}<span className="plan-symbol">{plan.id === 'free' ? '✦' : plan.id === 'novena' ? '✧' : '✺'}</span><h3>{plan.name}</h3><p>{plan.note}</p></div><div className="plan-price">{plan.price}<span>{plan.id !== 'free' && ' / ciclo'}</span></div><div className="plan-duration"><strong>{plan.days} dias</strong> de vela acesa</div><ul><li>Intenção compartilhada por link</li><li>Registros de oração e apoio</li><li>{plan.feature}</li></ul><Button variant={plan.id === 'novena' ? 'primary' : 'secondary'} onClick={() => navigate(user ? `/criar?plan=${plan.id}` : `/entrar?next=${encodeURIComponent(`/criar?plan=${plan.id}`)}`)}>{plan.id === 'free' ? 'Começar gratuitamente' : 'Escolher esta vela'} <span aria-hidden>→</span></Button></article>)}</div><p className="plans-footnote">Pagamento único por ciclo via PIX. Sem renovação automática. A doação ao fim é sempre opcional.</p></div></section>
    <section className="closing-section"><div className="container closing-inner"><div><span className="eyebrow">Acenda uma luz</span><h2>Uma pequena chama pode reunir <em>muitos corações.</em></h2><p>Comece gratuitamente e convide quem caminha com você.</p><Button onClick={create}>Criar minha vela <span aria-hidden>↗</span></Button></div><Flame small /></div></section>
  </>;
}

function AuthScreen({ navigate }: { navigate: (path: string) => void }) {
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const completingSignIn = useRef(false);
  const requestedNext = useSearchParams().get('next') || '/minhas-velas';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') && !requestedNext.includes('\\') ? requestedNext : '/minhas-velas';
  useEffect(() => {
    if (!auth || completingSignIn.current || !isSignInWithEmailLink(auth, location.href)) return;
    const stored = localStorage.getItem('vela-email') || prompt('Confirme seu e-mail para concluir a entrada:') || '';
    if (!stored) return;
    completingSignIn.current = true;
    setBusy(true);
    signInWithEmailLink(auth, stored, location.href).then(() => { localStorage.removeItem('vela-email'); navigate(next); }).catch(err => setError(err.message)).finally(() => setBusy(false));
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (demoMode) { navigate(next); return; }
    if (!auth) { setError('Configure o Firebase para entrar.'); return; }
    setBusy(true);
    try {
      const url = new URL(location.href); url.pathname = '/entrar'; url.search = `?next=${encodeURIComponent(next)}`;
      await sendSignInLinkToEmail(auth, email, { url: url.toString(), handleCodeInApp: true });
      localStorage.setItem('vela-email', email); setSent(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao enviar link.'); }
    finally { setBusy(false); }
  }
  return <section className="form-section"><div className="container narrow"><div className="form-card auth-card"><span className="eyebrow">Seu espaço de oração</span><h1>Entre com seu <em>e-mail</em></h1><p>Enviaremos um link seguro para você criar e acompanhar suas velas. Sem senha para lembrar.</p>{sent ? <Notice>Enviamos um link para <strong>{email}</strong>. Abra o e-mail neste dispositivo para continuar.</Notice> : <form onSubmit={submit}><label>E-mail<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@exemplo.com" autoComplete="email" /></label><ErrorNote error={error} /><Button type="submit" disabled={busy}>{busy ? 'Enviando…' : demoMode ? 'Entrar na prévia' : 'Enviar link de acesso'} <span aria-hidden>→</span></Button></form>}<p className="micro-copy">Usaremos seu e-mail para acesso e mensagens necessárias sobre suas velas. Resumos diários são opcionais.</p></div></div></section>;
}

function CreatePage({ navigate }: { navigate: (path: string) => void }) {
  const queryPlan = useSearchParams().get('plan') as PlanId | null;
  const [plan, setPlan] = useState<PlanId>(plans.some(item => item.id === queryPlan) ? queryPlan! : 'free');
  const [title, setTitle] = useState(''); const [intention, setIntention] = useState('');
  const [saintId, setSaintId] = useState('maria'); const [theme, setTheme] = useState('classic');
  const [ack, setAck] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!ack) { setError('Confirme que compreendeu como o link funciona.'); return; }
    setBusy(true);
    try {
      const result = await api<{ candle: Candle; order?: Order }>('/candles', 'POST', { plan, title, intention, saintId, theme });
      navigate(result.order ? `/pagamento/${result.order.id}` : '/minhas-velas');
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível criar a vela.'); }
    finally { setBusy(false); }
  }
  return <section className="form-section"><div className="container creation-layout"><div className="creation-main"><span className="eyebrow">Um gesto de fé</span><h1>Acenda uma vela <em>por sua intenção</em></h1><p className="lead">Escolha o tempo de sua vela, escreva com carinho e compartilhe apenas com quem você desejar.</p><form className="create-form" onSubmit={submit}><fieldset><legend>1. Escolha uma vela</legend><div className="plan-options">{plans.map(item => <label key={item.id} className={`plan-option ${plan === item.id ? 'is-selected' : ''}`}><input type="radio" name="plan" value={item.id} checked={plan === item.id} onChange={() => setPlan(item.id)} /><span><strong>{item.name}</strong><small>{item.days} dias · {item.price}</small></span><span className="radio-dot" /></label>)}</div></fieldset><fieldset><legend>2. Sua intenção</legend><label>Título da vela<input required minLength={3} maxLength={80} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: Pela saúde da minha mãe" /></label><label>Mensagem da intenção<textarea required minLength={3} maxLength={500} rows={5} value={intention} onChange={event => setIntention(event.target.value)} placeholder="Escreva sua intenção com suas próprias palavras…" /><span className="field-hint">{intention.length}/500 caracteres</span></label><Notice>Evite nomes completos, diagnósticos e informações íntimas de outras pessoas. Quem receber o link poderá repassá-lo.</Notice></fieldset>{plan !== 'free' && <fieldset><legend>3. Personalize sua vela</legend><label>Santo de devoção<select value={saintId} onChange={event => setSaintId(event.target.value)}>{saints.map(saint => <option key={saint.id} value={saint.id}>{saint.name}</option>)}</select></label><div className="theme-label">Aparência da vela</div><div className="theme-options">{[{ id: 'classic', name: 'Marfim' }, { id: 'rose', name: 'Rosé' }, { id: 'blue', name: 'Azul' }].map(item => <label key={item.id} className={`theme-swatch theme-swatch--${item.id} ${theme === item.id ? 'selected' : ''}`}><input type="radio" name="theme" value={item.id} checked={theme === item.id} onChange={() => setTheme(item.id)} /><span /><small>{item.name}</small></label>)}</div></fieldset>}<label className="check-row"><input type="checkbox" checked={ack} onChange={event => setAck(event.target.checked)} /><span>Entendo que a vela é um gesto simbólico e que pessoas com o link poderão ler minha intenção.</span></label><ErrorNote error={error} /><Button type="submit" disabled={busy}>{busy ? 'Preparando…' : plan === 'free' ? 'Acender vela gratuita' : `Continuar para o PIX · ${plans.find(item => item.id === plan)?.price}`} <span aria-hidden>→</span></Button></form></div><aside className="creation-aside"><div className="preview-card"><span className="eyebrow">Prévia da sua vela</span><Flame small theme={plan === 'free' ? 'classic' : theme} /><strong>{title || 'Sua intenção aqui'}</strong><p>{intention || 'Um espaço para reunir sua corrente de oração.'}</p>{plan !== 'free' && <span className="preview-saint">✦ {saintName(saintId)}</span>}</div><p>Velas pagas são ativadas após a confirmação do PIX. A oração tem o mesmo valor em todos os planos.</p></aside></div></section>;
}

function Dashboard({ navigate, userEmail }: { navigate: (path: string) => void; userEmail: string }) {
  const [candles, setCandles] = useState<Candle[]>([]); const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Candle | null>(null); const [title, setTitle] = useState(''); const [intention, setIntention] = useState('');
  const [sharing, setSharing] = useState<Candle | null>(null);
  const [donating, setDonating] = useState<Candle | null>(null); const [donationValue, setDonationValue] = useState('5,00');
  async function load() { try { const [list, me] = await Promise.all([api<{ candles: Candle[] }>('/me/candles'), api<UserProfile>('/me')]); setCandles(list.candles); setProfile(me); } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao carregar.'); } }
  useEffect(() => { load(); }, []);
  async function act(path: string, method = 'POST', body?: Record<string, unknown>) { setBusy(true); setError(''); try { const result = await api<{ order?: Order }>(path, method, body); await load(); if (result.order) navigate(`/pagamento/${result.order.id}`); } catch (err) { setError(err instanceof Error ? err.message : 'Falha na operação.'); } finally { setBusy(false); } }
  function startEdit(candle: Candle) { setEdit(candle); setTitle(candle.title); setIntention(candle.intention); }
  async function saveEdit(event: FormEvent) { event.preventDefault(); if (!edit) return; await act(`/candles/${edit.id}`, 'PATCH', { title, intention }); setEdit(null); }
  async function remove(id: string) { if (confirm('Apagar esta vela e retirar sua página do ar? Essa ação não pode ser desfeita.')) await act(`/candles/${id}`, 'DELETE'); }
  function donate(candle: Candle) { setDonating(candle); setDonationValue('5,00'); }
  async function submitDonation(event: FormEvent) {
    event.preventDefault(); if (!donating) return;
    const amount = Math.round(Number(donationValue.replace(',', '.')) * 100);
    if (!Number.isFinite(amount) || amount < 200) { setError('A doação mínima é R$ 2,00.'); return; }
    setBusy(true); setError('');
    try { const result = await api<{ order: Order }>(`/candles/${donating.id}/donate`, 'POST', { amount }); setDonating(null); navigate(`/pagamento/${result.order.id}`); }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao gerar doação.'); }
    finally { setBusy(false); }
  }
  return <section className="dashboard-section"><div className="container"><div className="dashboard-header"><div><span className="eyebrow">Seu espaço</span><h1>Minhas <em>velas</em></h1><p>Bem-vindo, {userEmail}. Acompanhe suas intenções e as pessoas que se unem a elas.</p></div><Button onClick={() => navigate('/criar')}>Acender nova vela <span aria-hidden>↗</span></Button></div><ErrorNote error={error} /><div className="dashboard-layout"><div className="dashboard-list">{candles.length === 0 ? <div className="empty-card"><span>✦</span><h2>Sua primeira vela começa aqui</h2><p>Escreva uma intenção e convide pessoas queridas para rezar com você.</p><Button onClick={() => navigate('/criar')}>Criar minha primeira vela</Button></div> : candles.map(candle => <article className="dashboard-card" key={candle.id}><div className="dashboard-flame"><Flame small theme={candle.theme} /></div><div className="dashboard-card-body"><span className={`status-pill status-pill--${candle.status}`}>{statusLabel(candle.status)}</span><h2>{candle.title}</h2><p>{candle.intention}</p><div className="dashboard-meta"><span>🙏 {candle.prayerCount} registros</span><span>✉ {candle.messageCount ?? candle.messages?.length ?? 0} mensagens</span><span>Até {fmtDate(candle.endsAt)}</span></div><div className="dashboard-actions">{['active', 'ended'].includes(candle.status) && <><button onClick={() => navigate(`/v/${candle.id}`)}>Ver página ↗</button><button onClick={() => setSharing(candle)}>Compartilhar ↗</button></>}{['active', 'ended', 'pending_review'].includes(candle.status) && <button onClick={() => startEdit(candle)}>Editar</button>}<button className="danger-text" onClick={() => remove(candle.id)}>Apagar</button></div>{candle.status === 'pending_review' && <div className="quiet-note">Nossa equipe está revisando esta intenção antes da publicação.</div>}{candle.status === 'pending_payment' && <div className="dashboard-offer"><strong>Conclua o pagamento</strong><span>Esta vela só será publicada após a confirmação do PIX.</span><Button variant="secondary" disabled={busy} onClick={() => act(`/candles/${candle.id}/pay`)}>Abrir cobrança PIX</Button></div>}{candle.status === 'ended' && candle.plan !== 'free' && <div className="dashboard-offer"><strong>Continue sua corrente</strong><span>Escolha um novo ciclo, sem cobrança automática.</span><div><button disabled={busy} onClick={() => act(`/candles/${candle.id}/renew`, 'POST', { plan: 'novena' })}>9 dias · R$ 4,90</button><button disabled={busy} onClick={() => act(`/candles/${candle.id}/renew`, 'POST', { plan: 'quaresma' })}>40 dias · R$ 12,90</button></div></div>}{candle.status === 'active' && candle.plan !== 'free' && !candle.scheduledCycle && <div className="early-renew"><button disabled={busy} onClick={() => act(`/candles/${candle.id}/renew`, 'POST', { plan: 'novena' })}>Agendar mais 9 dias</button><button disabled={busy} onClick={() => act(`/candles/${candle.id}/renew`, 'POST', { plan: 'quaresma' })}>Agendar mais 40 dias</button></div>}{candle.scheduledCycle && <div className="quiet-note">Próximo ciclo de {candle.scheduledCycle.plan === 'novena' ? '9' : '40'} dias agendado.</div>}{(candle.status === 'ended' || candle.lastCycleEndedAt) && <button className="donation-link" onClick={() => donate(candle)}>♡ Fazer uma doação voluntária para manter a plataforma</button>}</div></article>)}</div><aside className="dashboard-side"><div className="side-card"><span className="side-icon">✉</span><h3>Seus e-mails</h3><p>Você sempre recebe o resumo ao fim de cada ciclo.</p><label className="toggle-row"><span>Resumo diário opcional</span><input type="checkbox" checked={Boolean(profile?.dailySummary)} onChange={async event => { const dailySummary = event.target.checked; setProfile(profile ? { ...profile, dailySummary } : null); await api('/me', 'PATCH', { dailySummary }); }} /></label></div><div className="side-card side-card--soft"><span className="side-icon">♡</span><h3>Uma corrente discreta</h3><p>Suas velas não aparecem em um mural. Só quem recebe o link pode vê-las, e essa pessoa pode repassá-lo.</p></div><button className="logout-button" onClick={async () => { if (auth) await signOut(auth); navigate('/'); }}>Sair da conta</button>{profile?.admin && <button className="admin-link" onClick={() => navigate('/moderacao')}>Abrir moderação →</button>}</aside></div></div>{sharing && <ShareCandle candle={sharing} saint={saintName(sharing.saintId)} onClose={() => setSharing(null)} onShared={() => { void api(`/candles/${sharing.id}/share`, 'POST').catch(() => {}); }} />}{edit && <div className="modal-backdrop" role="presentation" onClick={() => setEdit(null)}><div className="modal" role="dialog" aria-modal="true" aria-label="Editar vela" onClick={event => event.stopPropagation()}><button className="modal-close" onClick={() => setEdit(null)} aria-label="Fechar">×</button><h2>Editar intenção</h2><p>A página mostrará que o texto foi editado.</p><form onSubmit={saveEdit}><label>Título<input value={title} maxLength={80} minLength={3} required onChange={event => setTitle(event.target.value)} /></label><label>Intenção<textarea value={intention} maxLength={500} minLength={3} required rows={5} onChange={event => setIntention(event.target.value)} /></label><Button type="submit" disabled={busy}>Salvar alterações</Button></form></div></div>}{donating && <div className="modal-backdrop" role="presentation" onClick={() => setDonating(null)}><div className="modal" role="dialog" aria-modal="true" aria-label="Doação voluntária" onClick={event => event.stopPropagation()}><button className="modal-close" onClick={() => setDonating(null)} aria-label="Fechar">×</button><span className="eyebrow">Contribuição opcional</span><h2>Ajude a manter esta luz acesa para todos</h2><p>A doação mantém a plataforma. Ela não renova nem destaca sua vela.</p><form onSubmit={submitDonation}><div className="donation-presets">{['5,00', '10,00', '20,00'].map(value => <button key={value} type="button" onClick={() => setDonationValue(value)} className={donationValue === value ? 'selected' : ''}>R$ {value}</button>)}</div><label>Outro valor em reais<input inputMode="decimal" value={donationValue} onChange={event => setDonationValue(event.target.value)} required /></label><p className="micro-copy">Mínimo R$ 2,00. Pagamento único via PIX.</p><ErrorNote error={error} /><Button type="submit" disabled={busy}>Continuar para o PIX</Button></form></div></div>}</section>;
}

function CandlePage({ id, navigate, isOwner }: { id: string; navigate: (path: string) => void; isOwner: boolean }) {
  const { setPageTitle } = useApp();
  const [candle, setCandle] = useState<Candle | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [name, setName] = useState(''); const [message, setMessage] = useState(''); const [feedback, setFeedback] = useState('');
  async function load() { try { const result = await api<{ candle: Candle }>(`/v/${id}`); setCandle(result.candle); setPageTitle(`${result.candle.title} · Vela Virtual`); } catch (err) { setError(err instanceof Error ? err.message : 'Vela não encontrada.'); } }
  useEffect(() => { load(); }, [id]);
  async function pray() { setBusy(true); setFeedback(''); try { const result = await api<{ counted: boolean }>(`/v/${id}/pray`, 'POST', { browserId: browserId() }); setFeedback(result.counted ? 'Seu gesto de oração foi registrado. Obrigado por estar aqui.' : 'Sua oração já foi registrada neste ciclo.'); await load(); } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao registrar.'); } finally { setBusy(false); } }
  async function sendMessage(event: FormEvent) { event.preventDefault(); setBusy(true); setFeedback(''); try { const result = await api<{ message: string }>(`/v/${id}/messages`, 'POST', { browserId: browserId(), name: name || 'Alguém que rezou', text: message }); setFeedback(result.message); setMessage(''); await load(); } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao enviar.'); } finally { setBusy(false); } }
  async function report() { const reason = prompt('Conte brevemente por que esta vela precisa de revisão:'); if (!reason) return; try { await api(`/v/${id}/reports`, 'POST', { browserId: browserId(), reason }); setFeedback('Denúncia recebida. Nossa equipe fará a revisão.'); } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao denunciar.'); } }

  if (error && !candle) return <div className="container not-found"><span>✦</span><h1>Esta vela não está disponível</h1><p>{error}</p><Button onClick={() => navigate('/')}>Voltar ao início</Button></div>;
  if (!candle) return <div className="container loading-screen">Acendendo a página…</div>;
  return <section className={`candle-page candle-page--${candle.theme}`}><div className="container candle-layout"><div className="candle-main"><div className="candle-breadcrumb"><button onClick={() => navigate('/')}>Início</button><span>›</span><span>Vela de intenção</span></div><div className="candle-display"><div className="candle-display-top"><span className={`status-pill status-pill--${candle.status}`}>{statusLabel(candle.status)}</span><span>{plans.find(plan => plan.id === candle.plan)?.days} dias de oração</span></div><Flame theme={candle.theme} /><div className="candle-display-bottom"><span className="eyebrow">Uma intenção de oração</span><h1>{candle.title}</h1><p>{candle.intention}</p>{candle.editedAt && <small>Texto editado em {fmtDate(candle.editedAt)}</small>}{candle.saintId && <div className="saint-label">✦ Sob a intercessão de {saintName(candle.saintId)}</div>}</div></div><div className="candle-share"><p>Convide mais pessoas para rezar por esta intenção.</p><Button variant="secondary" onClick={() => setSharing(true)}>Compartilhar esta vela <span aria-hidden>↗</span></Button></div></div><aside className="candle-side"><div className="prayer-panel"><span className="eyebrow">Juntos em oração</span><div className="prayer-number">{candle.prayerCount}<span>registros de oração</span></div><p>Um gesto simples para mostrar que esta intenção não está sozinha.</p>{candle.status === 'active' ? <Button disabled={busy} onClick={pray} className="pray-button">🙏 &nbsp; Rezei por você</Button> : <Notice>Este ciclo de oração foi encerrado. A página permanece aqui para recordar a corrente.</Notice>}<small>Um registro por navegador em cada ciclo.</small></div><div className="messages-panel"><h2>Palavras de apoio</h2><p>Mensagens de quem caminhou junto nesta intenção.</p><div className="message-list">{candle.messages?.length ? candle.messages.map(item => <article key={item.id} className="message-item"><strong>{item.name}</strong><p>{item.text}</p></article>) : <div className="no-messages">Ainda não há mensagens. Sua palavra pode ser a primeira.</div>}</div>{candle.status === 'active' && <form onSubmit={sendMessage}><label>Seu nome (opcional)<input value={name} maxLength={40} onChange={event => setName(event.target.value)} placeholder="Como deseja aparecer" /></label><label>Deixe uma mensagem<textarea value={message} minLength={3} maxLength={280} rows={3} required onChange={event => setMessage(event.target.value)} placeholder="Escreva uma palavra de carinho…" /></label><Button type="submit" variant="secondary" disabled={busy}>Enviar apoio <span aria-hidden>→</span></Button></form>}</div>{feedback && <Notice>{feedback}</Notice>}<ErrorNote error={error} /><div className="candle-side-links">{isOwner && <button onClick={() => navigate('/minhas-velas')}>Gerenciar minhas velas</button>}<button onClick={report}>Denunciar esta vela</button></div></aside></div>{sharing && <ShareCandle candle={candle} saint={saintName(candle.saintId)} onClose={() => setSharing(false)} />}</section>;
}

function PaymentPage({ id, navigate }: { id: string; navigate: (path: string) => void }) {
  const [order, setOrder] = useState<Order | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(false);
  async function load() { try { const result = await api<{ order: Order }>(`/me/orders/${id}`); setOrder(result.order); } catch (err) { setError(err instanceof Error ? err.message : 'Pedido não encontrado.'); } }
  useEffect(() => { load(); const interval = setInterval(load, 5000); return () => clearInterval(interval); }, [id]);
  async function check() { setBusy(true); try { const result = await api<{ order: Order }>(`/me/orders/${id}/reconcile`, 'POST'); setOrder(result.order); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível verificar.'); } finally { setBusy(false); } }
  return <section className="payment-section"><div className="container narrow"><div className="payment-card"><span className="eyebrow">Pagamento seguro via PIX</span><h1>{order?.status === 'paid' ? order.type === 'donation' ? 'Obrigado por sua doação' : 'Sua vela está pronta' : order?.type === 'donation' ? 'Sua doação voluntária' : 'Falta pouco para acender sua vela'}</h1><p>{order?.type === 'donation' ? 'Sua doação ajuda a manter a plataforma e não altera sua vela.' : 'Sua vela será ativada após a confirmação do pagamento.'}</p><ErrorNote error={error} />{!order ? <div>Carregando pedido…</div> : order.status === 'paid' ? <div className="payment-success"><span>✦</span><h2>PIX confirmado</h2><p>{order.type === 'donation' ? 'Sua contribuição foi registrada.' : 'Você já pode compartilhar sua vela.'}</p><Button onClick={() => navigate(`/v/${order.candleId}`)}>Ver minha vela <span aria-hidden>→</span></Button></div> : order.status === 'pending' ? <><div className="payment-amount">{fmtMoney(order.amount)}</div><PixQrCode pixCode={order.pixCode} providerImage={order.qrCode} /><label>Código PIX copia e cola<textarea readOnly value={order.pixCode || ''} rows={3} /></label><div className="payment-actions"><Button onClick={async () => { await navigator.clipboard.writeText(order.pixCode || ''); setCopied(true); }} variant="secondary">{copied ? 'Código copiado' : 'Copiar código PIX'}</Button><Button onClick={check} disabled={busy}>{busy ? 'Verificando…' : demoMode ? 'Simular pagamento' : 'Já paguei · verificar'}</Button></div><p className="micro-copy">Cobrança válida até {order.expiresAt ? new Date(order.expiresAt).toLocaleString('pt-BR') : 'o horário indicado no PIX'}. Você pode fechar esta tela e voltar depois.</p></> : order.status === 'review_required' ? <Notice>Seu PIX foi confirmado, mas este pedido precisa de análise da equipe antes da ativação ou de eventual reembolso. Acompanhe suas velas e entre em contato com o suporte quando o canal estiver disponível.</Notice> : <Notice>Esta cobrança está {order.status === 'expired' ? 'vencida' : 'indisponível'}. Volte às suas velas para tentar novamente.</Notice>}</div></div></section>;
}

function ModerationPage() {
  const [metrics, setMetrics] = useState<{ activated: number; shareRate: number; medianPrayers: number; returnRate: number; grossCents: number } | null>(null);
  const [queue, setQueue] = useState<{ candles: { id: string; title: string; intention: string }[]; messages: { id: string; candleId: string; text: string }[]; reports: { id: string; candleId: string; reason: string }[]; paymentCases: { id: string; orderId: string; candleId: string; createdAt: number }[] } | null>(null);
  const [error, setError] = useState('');
  async function load() { try { setQueue(await api('/admin/queue')); } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao carregar.'); } }
  useEffect(() => { load(); api<typeof metrics>('/admin/metrics').then(setMetrics).catch(() => {}); }, []);
  async function act(path: string) { try { await api(path, 'POST'); await load(); } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao moderar.'); } }
  return <section className="dashboard-section"><div className="container"><span className="eyebrow">Equipe de cuidado</span><h1>Moderação</h1><ErrorNote error={error} />{metrics && <div className="metrics-strip"><span><strong>{metrics.activated}</strong> velas ativadas</span><span><strong>{Math.round(metrics.shareRate * 100)}%</strong> compartilhadas</span><span><strong>{metrics.medianPrayers}</strong> orações medianas</span><span><strong>{Math.round(metrics.returnRate * 100)}%</strong> retorno</span><span><strong>{fmtMoney(metrics.grossCents)}</strong> receita bruta</span></div>}<div className="moderation-grid"><div className="side-card"><h2>Velas em revisão</h2>{queue?.candles.length ? queue.candles.map(item => <article key={item.id} className="moderation-item"><strong>{item.title}</strong><p>{item.intention}</p><Button onClick={() => act(`/admin/candles/${item.id}/approve`)}>Aprovar</Button><Button variant="secondary" onClick={() => act(`/admin/candles/${item.id}/hide`)}>Ocultar</Button></article>) : <p>Nenhuma vela pendente.</p>}</div><div className="side-card"><h2>Mensagens em revisão</h2>{queue?.messages.length ? queue.messages.map(item => <article key={item.id} className="moderation-item"><p>{item.text}</p><Button onClick={() => act(`/admin/candles/${item.candleId}/messages/${item.id}/approve`)}>Aprovar</Button><Button variant="secondary" onClick={() => act(`/admin/candles/${item.candleId}/messages/${item.id}/remove`)}>Remover</Button></article>) : <p>Nenhuma mensagem pendente.</p>}</div><div className="side-card"><h2>Denúncias</h2>{queue?.reports.length ? queue.reports.map(item => <article key={item.id} className="moderation-item"><p>{item.reason}</p><Button variant="secondary" onClick={() => act(`/admin/candles/${item.candleId}/hide`)}>Ocultar vela</Button><Button variant="secondary" onClick={() => act(`/admin/candles/${item.candleId}/reports/${item.id}/resolve`)}>Resolver denúncia</Button></article>) : <p>Nenhuma denúncia aberta.</p>}</div><div className="side-card"><h2>Pagamentos para análise</h2>{queue?.paymentCases?.length ? queue.paymentCases.map(item => <article key={item.id} className="moderation-item"><strong>Pedido {item.orderId}</strong><p>Vela {item.candleId}</p><p>PIX confirmado sem ativação automática. Confira o pedido e decida sobre reembolso manual na AbacatePay.</p></article>) : <p>Nenhum pagamento pendente de análise.</p>}</div></div></div></section>;
}

function AboutPage() { return <section className="form-section"><div className="container narrow"><div className="form-card"><span className="eyebrow">Sobre a Vela Virtual</span><h1>Fé que <em>aproxima</em></h1><p>A Vela Virtual é uma iniciativa católica independente para compartilhar intenções com pessoas queridas. A chama digital é um símbolo de lembrança e oração, sem representar sacramento ou promessa de graça.</p><p>Os planos pagos oferecem duração e personalização da página. A doação opcional contribui para a manutenção da plataforma. Nenhum pagamento altera o valor espiritual de uma oração.</p><Notice>Este produto está em fase de piloto. Informações de suporte, políticas e responsável editorial serão publicadas antes da abertura ao público.</Notice></div></div></section>; }
