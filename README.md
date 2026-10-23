# Vela Virtual

MVP local para criar correntes de oração por link. O produto e as regras do piloto estão em [PLANO-DE-EXECUCAO.md](./PLANO-DE-EXECUCAO.md); os termos de domínio estão em [CONTEXT.md](./CONTEXT.md).

## Estado atual

- Frontend em Next.js App Router e React 19, com deploy no Firebase App Hosting.

- Interface responsiva com criação de vela grátis ou paga, página compartilhável, oração, mensagens, painel do criador, PIX, renovação, doação e fila de moderação.
- API em Firebase Functions; Firebase Auth por link de e-mail; Firestore fechado para acesso direto do navegador.
- AbacatePay v2 para PIX e webhook; Resend para e-mails do produto; tarefas agendadas para encerramento de ciclos e resumos.
- Prévia de demonstração no navegador sem serviços externos. Seus dados ficam no armazenamento local desse navegador e o PIX é simulado.

**Ainda não há deploy nem integração validada com contas reais.** Credenciais, conta recebedora, domínio de e-mail, textos jurídicos e responsável editorial precisam ser configurados e revisados antes de abrir o piloto.

## Prévia rápida

Requer Node.js 22 e npm.

```sh
npm install
NEXT_PUBLIC_DEMO_MODE=true npm run dev
```

Abra `http://127.0.0.1:3000`. A prévia permite percorrer os fluxos sem cadastro. O botão **Simular pagamento** atua somente nesse modo e não gera cobrança.

## Emuladores Firebase

1. Copie `.env.example` para `.env.local` e preencha a configuração pública do projeto Firebase. Para o projeto de emulação `demo-vela-virtual`, use valores locais de desenvolvimento e `NEXT_PUBLIC_USE_EMULATORS=true`; deixe `NEXT_PUBLIC_DEMO_MODE=false`.
2. Copie `functions/.env.example` para `functions/.env.local` e `functions/.secret.local.example` para `functions/.secret.local`. Para executar `npm run smoke`, habilite `ABACATE_API_BASE=http://127.0.0.1:6060/v2` em `functions/.env.local`. Essa URL é aceita pelo código apenas no emulador.
3. Inicie `npx firebase emulators:start --project demo-vela-virtual --only auth,firestore,functions,hosting`. O Next.js usa a porta **3000** e encaminha `/api` diretamente ao emulador de Functions na porta **5001**. Execute `npm run dev` em outro terminal. O Hosting clássico é opcional e usa a porta **5050**.
4. Rode `npm run smoke` em outro terminal. O teste cria usuários e dados apenas no projeto `demo-vela-virtual`, sobe um gateway PIX falso na porta 6060 e verifica autenticação, acesso por link, oração única, mensagem, edição, exclusão, webhook PIX e renovação sequencial.

O link de autenticação enviado pelo Firebase Auth Emulator aparece na interface/log do emulador. As funções agendadas dependem do emulador Pub/Sub para execução local; o teste de fumaça cobre o fluxo HTTP, não o disparo do agendador.

## Configuração para um projeto Firebase real

### Projeto `vela-virtual-cozy` — App Hosting

O projeto padrão da CLI está em `.firebaserc`. O backend `vela-virtual-cozy-web-app` está vinculado em `firebase.json`. A configuração consultada no Firebase em 22/10/2026 usa raiz `/`, região `us-central1`, runtime Node.js 24 e app Web `1:860083079598:web:88c36afa5620101149a03f`. As Functions usam Node.js 22 em `southamerica-east1`. O `apphosting.yaml` define variáveis e limites de instâncias. O adaptador nativo do Firebase detecta o Next.js na raiz, executa `next build` e configura o servidor. As páginas ficam em `app/`, a interface reutilizada em `web/src/`, e `app/api/[[...path]]/route.ts` encaminha `/api/*` para a Function `api`, preservando autenticação, corpo e query string sem cache.

URL do backend: `https://vela-virtual-cozy-web-app--vela-virtual-cozy.us-central1.hosted.app`.

Para testes sem os e-mails do produto, use `ENABLE_PRODUCT_EMAILS=false` no ambiente das Functions e `npm run deploy:core`: publica a API, o encerramento de ciclos, a geração de resumos e o Firestore. A função `deliverEmail` fica para depois: cadastre `EMAIL_API_KEY` e `EMAIL_FROM`, altere `ENABLE_PRODUCT_EMAILS=true` e rode `npm run deploy:backend`. O login por link de e-mail continua sendo enviado pelo Firebase Authentication. Os e-mails do produto ficam na fila até a publicação do entregador; use endereços controlados nos testes.

Com `NEXT_PUBLIC_USE_EMULATORS=false`, `npm run dev` encaminha `/api` à Function do projeto configurado. Com `true`, usa diretamente o emulador de Functions na porta 5001. `API_UPSTREAM` permite substituir o destino no servidor.

1. Execute `npx firebase login` e confira o acesso com `npx firebase apphosting:backends:get vela-virtual-cozy-web-app --project vela-virtual-cozy`.
2. Vincule um **app Web Firebase** do projeto ao backend no console. O `next.config.mjs` lê `FIREBASE_WEBAPP_CONFIG`, fornecido pelo App Hosting, e expõe apenas os quatro campos públicos necessários ao navegador. Como alternativa, configure `NEXT_PUBLIC_FIREBASE_API_KEY` e `NEXT_PUBLIC_FIREBASE_APP_ID` como variáveis disponíveis no **BUILD** do backend. São valores públicos de configuração, disponíveis em Configurações do projeto → Seus aplicativos. Projeto e domínio de Auth já estão no YAML; demonstração e emuladores ficam desativados. O build interrompe a publicação se a configuração obrigatória estiver ausente.
3. Para desenvolvimento local com o Firebase real, preencha também a chave pública e o app ID em `.env.local`. Esse arquivo não é enviado ao App Hosting. A configuração do frontend fica na raiz; `functions/.env.local` continua exclusivo dos emuladores de Functions. As variáveis `NEXT_PUBLIC_*` entram no build e exigem novo build após alterações.
4. Ative o plano Blaze, crie o Firestore e habilite Authentication → E-mail/senha → **Link de e-mail**. Adicione o hostname real do App Hosting aos domínios autorizados do Authentication. Adicione `127.0.0.1`/`localhost` se for testar login local.
5. Copie `functions/.env.example` para `functions/.env.vela-virtual-cozy` (ignorado pelo Git). Use a URL HTTPS **exata** mostrada no backend como `PUBLIC_BASE_URL`; gere `RATE_LIMIT_SALT` com `openssl rand -hex 32`. Não inclua `ABACATE_API_BASE` de emulação nesse arquivo. `functions/.env.local` é específico dos emuladores.
6. Cadastre os quatro segredos descritos abaixo usando `--project vela-virtual-cozy`. Configure Resend e AbacatePay com o domínio real antes de validar os fluxos.
7. Publique primeiro as Functions e as regras/índices, depois o frontend:

   ```sh
   npm run deploy:backend
   npm run deploy:web
   ```

   `deploy:web` envia o código ao App Hosting, que executa o build remoto. O Hosting clássico de `firebase.json` continua disponível para os emuladores; esses comandos não o publicam. O App Hosting usa o adaptador Next.js e a rota de proxy da aplicação, sem servidor customizado. Não adicione `scripts.buildCommand` ao YAML: esse override desativa o adaptador do framework.

8. Confira login por e-mail, criação gratuita, links diretos `/v/...`, PIX e webhook na URL publicada. A configuração local, por si só, não comprova deploy ou integrações reais.

Referências: [configuração do App Hosting](https://firebase.google.com/docs/app-hosting/configure) e [frameworks suportados pelo App Hosting](https://firebase.google.com/docs/app-hosting/frameworks-tooling).

### Serviços externos e preparação do piloto

1. Crie ou selecione um projeto Firebase e configure Authentication por **link de e-mail**, domínio autorizado, Firestore e Hosting. Copie a configuração pública do app Web para `.env.local` com `NEXT_PUBLIC_DEMO_MODE=false` e `NEXT_PUBLIC_USE_EMULATORS=false`.
2. Configure `PUBLIC_BASE_URL` e um `RATE_LIMIT_SALT` aleatório em `functions/.env.<project-id>`. Esses valores não entram no bundle Web.
3. Cadastre os segredos das Functions de forma interativa, sem colocá-los no repositório:

   ```sh
   npx firebase functions:secrets:set ABACATE_API_KEY --project <project-id>
   npx firebase functions:secrets:set ABACATE_WEBHOOK_SECRET --project <project-id>
   npx firebase functions:secrets:set EMAIL_API_KEY --project <project-id>
   npx firebase functions:secrets:set EMAIL_FROM --project <project-id>
   ```

4. Na AbacatePay, use uma chave com permissão para criar e consultar Checkout Transparente PIX. Cadastre um webhook HTTPS para `transparent.completed` e `transparent.refunded` no endereço `https://<domínio>/api/webhooks/abacate?webhookSecret=<segredo>`, substituindo `<segredo>` pelo valor de `ABACATE_WEBHOOK_SECRET` cadastrado na Function. O código confere esse parâmetro de consulta. A integração cria a cobrança no servidor, confere o status na AbacatePay e trata entregas repetidas de forma idempotente. [Cobrança PIX](https://docs.abacatepay.com/pages/transparents/create) · [Webhook](https://docs.abacatepay.com/pages/webhooks) · [Modo de desenvolvimento](https://docs.abacatepay.com/pages/transparents/simulate-payment).
5. Configure um domínio de envio aprovado na Resend e informe a chave e o remetente nos segredos. Os e-mails do produto são enviados pela [API de e-mail da Resend](https://resend.com/features/email-api). O link de entrada continua sendo enviado pelo Firebase Auth.
6. Conceda a claim personalizada `admin: true` somente ao usuário responsável pela moderação. A API confere essa claim em todas as rotas `/api/admin/*`; a interface mostra o acesso após o próximo login.
7. Revise textos de termos, privacidade, reembolso, conteúdo religioso, canal de contato, prazos de retenção e parâmetros operacionais antes de abrir o piloto. A página “Sobre” contém aviso de piloto, não substitui essas políticas.
8. Valide o PIX no modo de desenvolvimento da AbacatePay, inclusive cobrança vencida, confirmação repetida, divergência e reembolso; depois execute os comandos de deploy acima quando o projeto estiver pronto para publicação.

## Regras e limites importantes

- `firestore.rules` nega toda leitura e escrita direta. As rotas de Functions aplicam autenticação, posse da vela e acesso pelo identificador secreto do link.
- Um registro de oração por navegador e por ciclo é um limite de uso, não uma prova de identidade única. O filtro de texto é básico e casos sinalizados exigem revisão humana.
- A vela paga só é publicada após confirmação do PIX. O gateway não recebe o texto da intenção. Uma cobrança confirmada para vela excluída ou oculta vai para a fila de pagamentos da moderação, para análise e eventual reembolso manual, em vez de ativação automática.
- As metas do piloto podem ser consultadas em `/api/admin/metrics`. A taxa de compartilhamento usa o botão de copiar link; não comprova envio no WhatsApp.
- Há limites simples por IP e por criador para reduzir abuso. Antes de tráfego público maior, revisar proteção automatizada, índices/consultas, retenção e capacidade de atendimento da moderação.

## Verificação da migração Next.js

```sh
npm run check
npm test
npm run build
npm run smoke:web
npm start
```

`npm run smoke:web` sobe temporariamente o servidor de produção com um upstream local simulado e verifica as oito rotas, 404, privacidade das velas e encaminhamento de webhook sem chamar APIs reais.

Confira a página inicial e `/sobre`, links diretos e voltar/avançar, o retorno do login em `/entrar?next=...`, criação com `?plan=novena`, painel, PIX e moderação. As rotas `/v/*` enviam `X-Robots-Tag: noindex, nofollow, noarchive` e metadados equivalentes. Rotas inexistentes retornam 404. As permissões continuam sendo verificadas nas Functions; o guard do navegador só controla a navegação.

Para staging, use um backend App Hosting separado com raiz `/`, um app Web vinculado e configuração explícita de projeto/API. Cadastre o hostname no Firebase Auth e configure `PUBLIC_BASE_URL` das Functions para o ambiente correspondente. Valide sem cobranças reais antes do rollout de produção. Para rollback, selecione um rollout anterior no console do App Hosting; Functions e Firestore têm deploy separado.
