# Vela Virtual

MVP local para criar correntes de oração por link. O produto e as regras do piloto estão em [PLANO-DE-EXECUCAO.md](./PLANO-DE-EXECUCAO.md); os termos de domínio estão em [CONTEXT.md](./CONTEXT.md).

## Estado atual

- Interface responsiva com criação de vela grátis ou paga, página compartilhável, oração, mensagens, painel do criador, PIX, renovação, doação e fila de moderação.
- API em Firebase Functions; Firebase Auth por link de e-mail; Firestore fechado para acesso direto do navegador.
- AbacatePay v2 para PIX e webhook; Resend para e-mails do produto; tarefas agendadas para encerramento de ciclos e resumos.
- Prévia de demonstração no navegador sem serviços externos. Seus dados ficam no armazenamento local desse navegador e o PIX é simulado.

**Ainda não há deploy nem integração validada com contas reais.** Credenciais, conta recebedora, domínio de e-mail, textos jurídicos e responsável editorial precisam ser configurados e revisados antes de abrir o piloto.

## Prévia rápida

Requer Node.js 22 e npm.

```sh
npm install
VITE_DEMO_MODE=true npm run dev
```

Abra `http://127.0.0.1:5173`. A prévia permite percorrer os fluxos sem cadastro. O botão **Simular pagamento** atua somente nesse modo e não gera cobrança.

## Emuladores Firebase

1. Copie `web/.env.example` para `web/.env.local` e preencha a configuração pública do projeto Firebase. Para o projeto de emulação `demo-vela-virtual`, use valores locais de desenvolvimento e `VITE_USE_EMULATORS=true`; deixe `VITE_DEMO_MODE=false`.
2. Copie `functions/.env.example` para `functions/.env.local` e `functions/.secret.local.example` para `functions/.secret.local`. Para executar `npm run smoke`, habilite `ABACATE_API_BASE=http://127.0.0.1:6060/v2` em `functions/.env.local`. Essa URL é aceita pelo código apenas no emulador.
3. Inicie `npx firebase emulators:start --project demo-vela-virtual --only auth,firestore,functions,hosting`. O Hosting local usa a porta **5050**; o Vite usa **5173** e encaminha `/api` ao Hosting local.
4. Rode `npm run smoke` em outro terminal. O teste cria usuários e dados apenas no projeto `demo-vela-virtual`, sobe um gateway PIX falso na porta 6060 e verifica autenticação, acesso por link, oração única, mensagem, edição, exclusão, webhook PIX e renovação sequencial.

O link de autenticação enviado pelo Firebase Auth Emulator aparece na interface/log do emulador. As funções agendadas dependem do emulador Pub/Sub para execução local; o teste de fumaça cobre o fluxo HTTP, não o disparo do agendador.

## Configuração para um projeto Firebase real

1. Crie ou selecione um projeto Firebase e configure Authentication por **link de e-mail**, domínio autorizado, Firestore e Hosting. Copie a configuração pública do app Web para `web/.env.local` com `VITE_DEMO_MODE=false` e `VITE_USE_EMULATORS=false`.
2. Configure `PUBLIC_BASE_URL` e um `RATE_LIMIT_SALT` aleatório em `functions/.env.<project-id>`. Esses valores não entram no bundle Web.
3. Cadastre os segredos das Functions de forma interativa, sem colocá-los no repositório:

   ```sh
   npx firebase functions:secrets:set ABACATE_API_KEY --project <project-id>
   npx firebase functions:secrets:set ABACATE_WEBHOOK_SECRET --project <project-id>
   npx firebase functions:secrets:set EMAIL_API_KEY --project <project-id>
   npx firebase functions:secrets:set EMAIL_FROM --project <project-id>
   ```

4. Na AbacatePay, use uma chave com permissão para criar e consultar Checkout Transparente PIX. Cadastre um webhook HTTPS para `transparent.completed` e `transparent.refunded` no endereço `https://<domínio>/api/webhooks/abacate`, usando o mesmo secret cadastrado na Function. A integração cria a cobrança no servidor, confere o status na AbacatePay e trata entregas repetidas de forma idempotente. [Cobrança PIX](https://docs.abacatepay.com/pages/transparents/create) · [Webhook](https://docs.abacatepay.com/pages/webhooks) · [Modo de desenvolvimento](https://docs.abacatepay.com/pages/transparents/simulate-payment).
5. Configure um domínio de envio aprovado na Resend e informe a chave e o remetente nos segredos. Os e-mails do produto são enviados pela [API de e-mail da Resend](https://resend.com/features/email-api). O link de entrada continua sendo enviado pelo Firebase Auth.
6. Conceda a claim personalizada `admin: true` somente ao usuário responsável pela moderação. A API confere essa claim em todas as rotas `/api/admin/*`; a interface mostra o acesso após o próximo login.
7. Revise textos de termos, privacidade, reembolso, conteúdo religioso, canal de contato, prazos de retenção e parâmetros operacionais antes de abrir o piloto. A página “Sobre” contém aviso de piloto, não substitui essas políticas.
8. Valide o PIX no modo de desenvolvimento da AbacatePay, inclusive cobrança vencida, confirmação repetida, divergência e reembolso; depois execute `npm run build` e `npx firebase deploy --project <project-id>` quando o projeto estiver pronto para publicação.

## Regras e limites importantes

- `firestore.rules` nega toda leitura e escrita direta. As rotas de Functions aplicam autenticação, posse da vela e acesso pelo identificador secreto do link.
- Um registro de oração por navegador e por ciclo é um limite de uso, não uma prova de identidade única. O filtro de texto é básico e casos sinalizados exigem revisão humana.
- A vela paga só é publicada após confirmação do PIX. O gateway não recebe o texto da intenção. Uma cobrança confirmada para vela excluída ou oculta vai para a fila de pagamentos da moderação, para análise e eventual reembolso manual, em vez de ativação automática.
- As metas do piloto podem ser consultadas em `/api/admin/metrics`. A taxa de compartilhamento usa o botão de copiar link; não comprova envio no WhatsApp.
- Há limites simples por IP e por criador para reduzir abuso. Antes de tráfego público maior, revisar proteção automatizada, índices/consultas, retenção e capacidade de atendimento da moderação.
