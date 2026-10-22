# Vela Virtual — plano de execução do piloto

**Estado:** pronto para planejamento técnico. **Nome:** provisório. **Base:** PRD recebido em 20/10/2026 e decisões confirmadas na entrevista de refinamento. Quando houver divergência, as decisões abaixo prevalecem sobre o PRD.

## 1. Objetivo e teste de produto

Criar uma experiência católica independente para uma pessoa registrar uma intenção e convidar conhecidos, por link, a participar de uma corrente de oração. A vela digital é um gesto devocional simbólico. A interface não deve sugerir que a plataforma oferece sacramentos, garante graças ou vende orações.

O primeiro lançamento é um piloto de 30 dias. O sinal de valor procurado é o criador compartilhar a vela, receber participação e voltar à plataforma. A cobrança de planos e a doação serão operacionais já no piloto.

### Metas exploratórias

| Métrica | Definição para o piloto | Meta |
| --- | --- | ---: |
| Velas criadas | Velas ativadas, gratuitas ou com PIX confirmado | 100 |
| Compartilhamento | Fração das velas ativadas cujo criador aciona o botão de compartilhar/copiar link | 50% |
| Participação | Mediana de registros de oração por vela cujo criador compartilhou o link | 2 |
| Retorno do criador | Fração dos criadores que volta em outra sessão até 7 dias após sua primeira vela | 20% |

O evento de compartilhar mede a ação no produto, não comprova que o link foi enviado. Para a métrica de retorno, considerar apenas criadores cuja primeira vela foi ativada até o dia 23 do piloto, para haver janela completa de sete dias. Relatar também número de pagamentos confirmados, receita bruta, reembolsos, denúncias e exclusões, sem usá-los como metas de continuidade neste piloto.

## 2. Público e fronteiras do piloto

- **Criador:** entra com e-mail verificado, cria, acompanha, edita, encerra ou apaga suas velas e escolhe se recebe resumo diário.
- **Participante:** recebe o link, lê a intenção, registra que rezou e pode deixar mensagem curta sem criar conta.
- **Responsável editorial e de moderação:** pessoa já disponível para revisar textos devocionais, denúncias, bloqueios e pedidos de exclusão. Identificar sua função e canal de contato antes da abertura do piloto.
- **Acesso:** cada vela tem endereço difícil de adivinhar, acessível a qualquer pessoa com o link. Não há mural público, busca, indexação intencional nem promessa de sigilo absoluto: destinatários podem repassar o link.

Não entram no piloto: foto anexada, upload de arquivos, destaque em mural, assinatura recorrente, comentários de redes sociais, compra da vela por visitante sem e-mail verificado e notificação a cada interação.

## 3. Oferta e linguagem comercial

| Plano | Duração de cada ciclo | Preço por ciclo | Personalização |
| --- | ---: | ---: | --- |
| Gratuito | 7 dias | R$ 0,00 | Texto da intenção e aparência básica; sem escolha de santo |
| Novena | 9 dias | R$ 4,90 | Escolha de santo entre opções revisadas e aparência da vela |
| Quaresma/Graça | 40 dias | R$ 12,90 | Escolha de santo, aparência da vela e moldura dourada |

Os preços são hipótese do piloto, não preço otimizado. Validar custos do gateway e margem antes de publicar. O pagamento compra duração e personalização da página. Não altera prioridade da oração, contagem de participantes ou atenção editorial.

Uma vela gratuita termina após seu primeiro ciclo e não tem botão de renovação. O criador pode registrar uma nova intenção gratuita, inclusive semelhante, sujeito a limites razoáveis contra abuso. Uma vela paga pode receber outro ciclo pago de 9 ou 40 dias; o criador pode comprá-lo antes do fim do ciclo atual, e o próximo começa somente quando o atual termina. Não há cobrança automática nem conversão de renovação paga para plano gratuito.

Ao encerrar cada ciclo, oferecer ao criador uma doação PIX opcional para **manutenção da plataforma**. Mostrar valores sugeridos e campo de valor livre, com mínimo e custos informados antes de gerar cobrança. Doação não renova, publica ou destaca a vela, não muda a contagem de orações e não é recorrente. Sem próximo ciclo agendado, a página encerrada continua acessível pelo link e não recebe novas orações ou mensagens. Com próximo ciclo pago agendado, a vela segue ativa a partir da virada entre ciclos; o resumo e o convite à doação chegam ao criador por e-mail.

## 4. Jornadas e estados

### Criação gratuita

1. Criador informa e verifica e-mail; recebe acesso às próprias velas por autenticação ou link de gestão seguro.
2. Escolhe plano gratuito, escreve intenção curta e revisa aviso sobre dados de terceiros e compartilhamento do link.
3. A intenção passa por validação antes da publicação. Se aprovada, começa um ciclo de sete dias e a página compartilhável é criada.
4. Criador copia ou compartilha o link pelo recurso nativo do dispositivo/WhatsApp e pode consultar registros de oração e mensagens.
5. Ao final do prazo, recebe resumo por e-mail, vê a página encerrada e pode optar por doar. Pode criar uma nova vela, mas não renovar aquela gratuita.

### Compra de vela paga

1. Criador com e-mail verificado escolhe plano e personalização, e a intenção passa pela validação de conteúdo.
2. Servidor cria pedido interno com preço em centavos e identificador próprio; só então cria cobrança PIX na AbacatePay. Exibe QR Code, código copia e cola, valor e prazo da cobrança.
3. Pedido pendente não publica a vela. Se a cobrança vencer ou falhar, mostrar estado claro e permitir nova cobrança sem duplicar vela ou ciclo.
4. Webhook validado informa pagamento confirmado; servidor confere pedido, valor e estado e ativa exatamente um ciclo. A tela também consulta o estado do pedido para quem voltar depois de fechar o navegador.
5. Compra de renovação segue o mesmo fluxo; o ciclo pago fica agendado após o vigente, sem perder dias nem cobrar automaticamente.

### Participação e moderação

1. Pessoa com o link vê apenas o conteúdo da vela e as mensagens aprovadas. Pode registrar uma oração por navegador **por ciclo** e deixar mensagem curta opcional.
2. Mostrar o número como **registros de oração**, não como pessoas únicas. Limite por navegador não prova identidade; aplicar limite de frequência e medidas contra automação.
3. Texto da intenção e mensagens passam por filtro antes de aparecer. Conteúdo suspeito vai para revisão humana. Denúncia cria caso de moderação; casos graves podem ocultar de imediato, e os demais são revisados sem bloqueio automático por simples número de denúncias.
4. Criador pode corrigir a intenção com indicação visível de edição. Pode apagar a página e suas mensagens da experiência pública; preservar somente registros de pagamento estritamente necessários, com prazo e finalidade definidos na política de dados.

### Estados mínimos

- **Vela:** `draft` → `active` → `ended`; `hidden` durante revisão ou bloqueio; `deleted` quando retirada pelo criador. Uma vela paga pode ter ciclos futuros `scheduled`.
- **Pedido:** `pending` → `paid`, `expired`, `failed` ou `refunded`. Pedido de plano, renovação e doação têm tipos distintos.
- **Mensagem:** `pending_review`, `published`, `rejected`, `removed`.

Transições são feitas no servidor, com registro de quem ou qual evento as provocou. Expiração deve usar horário persistido e processamento idempotente: execução repetida não envia e-mail duplicado nem cria ciclo extra. A página encerrada mostra estado e duração já concluída, sem aparência de vela ainda ativa.

## 5. Dados e limites de acesso

Entidades mínimas: `creators` (identidade verificada e preferências de e-mail), `candles` (criador, intenção, token de link, plano, conteúdo visível, estado), `cycles` (início, fim, plano e estado), `prayer_records` (ciclo e identificador pseudônimo do navegador), `support_messages` (texto e estado de moderação), `orders` (tipo, valor, estado, ID da cobrança, criador, ciclo associado), `moderation_cases` e `email_jobs`.

Guardar o mínimo necessário de dados pessoais. Não permitir fotos no piloto. Alertar contra nome completo, diagnóstico e detalhes íntimos de terceiros na intenção. Não inserir texto de intenção ou mensagens nos metadados do gateway, URLs de pagamento ou ferramentas de análise. Definir prazo de retenção dos dados e procedimento de exclusão antes de abrir o piloto.

O acesso por link deve passar por endpoint que valida o token e entrega somente os campos públicos da vela. Acesso de criador usa identidade verificada; recursos de administração exigem permissão própria. Escritas de contador, estados, pedidos, ciclos e moderação são exclusivas do servidor. Regras do Firestore devem negar leitura/escrita por padrão e ser testadas para visitante, participante, criador de outra vela e administrador. **Não copiar as regras exemplificativas do PRD**: `allow update: if true` e leitura de toda vela por qualquer pessoa autenticada contrariam as decisões de privacidade e integridade.

## 6. Integração e operação

Usar Firebase Authentication, Firestore, Cloud Functions e Hosting como base do MVP. Storage de fotos fica fora do piloto. Segredos do gateway e e-mail permanecem apenas no ambiente do servidor. A integração PIX usa a API v2 da AbacatePay com cobrança criada no backend, valores em centavos e referência interna do pedido. A [documentação oficial de cobrança PIX](https://docs.abacatepay.com/pages/transparents/create) descreve o QR Code/copia e cola; a [documentação de webhooks](https://docs.abacatepay.com/pages/webhooks/reference) descreve o recebimento de eventos. Confirmar durante a implementação a validação de origem conforme a versão vigente da documentação, e testar entrega repetida, atrasada e fora de ordem. O [modo de desenvolvimento](https://docs.abacatepay.com/pages/transparents/simulate-payment) permite simular pagamento antes de usar chave de produção.

E-mails: confirmação de criação ou compra, resumo no encerramento e resumo diário opcional. Não enviar aviso por cada oração. Separar e-mails necessários ao serviço de consentimento para mensagens comerciais. Cada envio deve ter chave de idempotência e alternativa operacional para falhas.

Antes de abrir o piloto, publicar termos de uso, política de dados, contato para suporte e moderação, política de reembolso e explicação dos planos/doações; submeter esses textos a revisão jurídica apropriada. Regra de produto aprovada: exclusão voluntária não gera reembolso automático; bloqueio equivocado exige revisão e pode gerar reembolso manual; pedido pago antes de ativar a vela pode ser reembolsado. A aplicação precisa registrar decisões de revisão e reembolso. Esta regra não substitui direitos aplicáveis ao consumidor.

## 7. Ordem de execução

### Etapa 0 — Preparar piloto

- [ ] Confirmar conta AbacatePay apta a receber pagamentos reais, taxas atuais, chave de desenvolvimento e produção, e identidade do recebedor das doações.
- [ ] Nomear responsável editorial e de moderação, janela de atendimento e canal para denúncias/exclusão.
- [ ] Revisar conteúdo católico inicial, aviso de gesto simbólico, termos, política de dados e reembolso.
- [ ] Definir limites operacionais de texto, frequência, valor mínimo de doação e retenção de dados; registrá-los como configuração e política pública antes do lançamento.

### Etapa 1 — Núcleo gratuito e compartilhamento

- [ ] Criar app responsivo para celular, com texto legível, contraste adequado, ações grandes e compartilhamento simples.
- [ ] Implementar verificação de e-mail, painel do criador, criação/edição/exclusão, página por link com orientação `noindex`, ciclo gratuito de sete dias e estado encerrado.
- [ ] Implementar animação da vela sem impedir leitura nem desrespeitar preferência por movimento reduzido.
- [ ] Registrar eventos de criação, compartilhamento, retorno e abertura do link sem incluir texto sensível.

### Etapa 2 — Comunidade e confiança

- [ ] Implementar registro único de oração por navegador/ciclo, mensagem de apoio, filtro pré-publicação, denúncia e fila administrativa.
- [ ] Implementar limites contra abuso e testes de acesso para todas as entidades.
- [ ] Implementar resumo de encerramento e resumo diário opcional.

### Etapa 3 — Pagamento e renovação

- [ ] Implementar catálogo, pedido interno, PIX real via AbacatePay, webhook validado, conciliação de pedido e telas pendente/pago/vencido.
- [ ] Ativar vela paga só após confirmação; implementar renovação comprada antecipadamente e agendamento sequencial.
- [ ] Implementar doação de encerramento como pedido separado, sem alterar estado da vela; implementar revisão de reembolso.
- [ ] Testar fluxo em modo de desenvolvimento, inclusive webhook duplicado, atraso, falha de rede, cobrança vencida, valor divergente e reembolso.

### Etapa 4 — Piloto e leitura de resultados

- [ ] Fazer teste interno completo em celular, incluindo criador, participante, moderador e pagamento de teste.
- [ ] Abrir piloto de 30 dias com acompanhamento de erros, pagamentos pendentes, e-mails e denúncias.
- [ ] Ao final, comparar métricas com as metas, analisar motivos de abandono e decidir manter, alterar ou retirar planos e recursos.

## 8. Critérios de aceite do MVP

1. Criador com e-mail não verificado não ativa vela; criador verificado ativa vela grátis de sete dias e obtém link compartilhável.
2. Visitante sem conta abre o link, registra no máximo uma oração por navegador no ciclo e envia mensagem curta; outro usuário autenticado não ganha acesso ao painel do criador por conhecer o link.
3. Intenção e mensagem sinalizadas pelo filtro não aparecem antes de aprovação; denúncia grave pode ocultar a página até revisão; responsável consegue registrar decisão.
4. Vela grátis termina em sete dias, preserva página encerrada e não oferece renovação; uma nova intenção pode ser criada sujeita a limites contra abuso.
5. Cobrança de R$ 4,90 ou R$ 12,90 fica pendente até confirmação válida da AbacatePay; webhook repetido ativa um único ciclo com a duração correta.
6. Renovação paga adquirida antes do fim não encurta o ciclo atual e começa após ele; plano do ciclo seguinte pode ser 9 ou 40 dias.
7. No encerramento de qualquer plano, o criador recebe um único resumo e vê opção de doação; doação confirmada não reabre a vela.
8. Criador pode editar com aviso e apagar a página; quem abre o link de vela apagada não vê intenção nem mensagens.
9. Em celular, criação, pagamento PIX, compartilhamento e participação são utilizáveis sem zoom horizontal; animação respeita movimento reduzido.
10. As métricas do piloto podem ser calculadas com as definições da seção 1 sem expor o texto das intenções.

## 9. Decisões que substituem o PRD original

- Corrente por link em lugar de mural público e destaque dourado.
- E-mail verificado para todos os criadores em lugar de compra paga anônima.
- Sem fotos no piloto; personalização paga restrita a santo e aparência.
- Vela gratuita sem renovação; vela paga com novo ciclo pago e escolha de plano.
- Doação para manutenção da plataforma no encerramento de todos os planos; ela não mantém a vela ativa.
- Contagem de registros por navegador/ciclo em lugar de alegação de participantes únicos.
- Moderação antes da publicação e denúncia por gravidade em lugar de bloqueio automático por N denúncias.
- PIX real via AbacatePay em lugar da opção indefinida entre simulação e produção.

O vocabulário do domínio está em [CONTEXT.md](./CONTEXT.md). O PRD original é insumo de descoberta, não uma especificação executável onde conflita com este plano.
