# Templates de e-mail

## Ciclo de oração concluído

Arquivo para importar: [`ciclo-concluido.html`](ciclo-concluido.html). Alias publicado no Resend: `vela-concluda` (grafia exata). Assunto: **Seu ciclo de oração foi concluído 🕯️**.

Importe o HTML completo no Resend e cadastre as variáveis abaixo. A sintaxe `{{{VARIAVEL}}}` segue a [documentação de variáveis do Resend](https://resend.com/docs/dashboard/templates/template-variables).

| Variável | Tipo | Conteúdo / exemplo |
| --- | --- | --- |
| `TITULO_VELA` | string | Pela saúde da minha família |
| `DURACAO_DIAS` | number | Dias do ciclo concluído: 7, 9 ou 40 |
| `DATA_ENCERRAMENTO` | string | 3 de novembro de 2026, às 18h (Brasília) |
| `TOTAL_ORACOES` | number | Registros de oração do ciclo concluído, incluindo 0 |
| `TOTAL_MENSAGENS` | number | Mensagens de apoio do ciclo concluído, incluindo 0 |
| `URL_VELA` | string | URL HTTPS absoluta da vela: https://seu-dominio.com/v/ID_DA_VELA |
| `URL_MINHAS_VELAS` | string | URL HTTPS absoluta do painel: https://seu-dominio.com/minhas-velas |
| `URL_SITE` | string | URL HTTPS absoluta da página inicial: https://seu-dominio.com |

Forneça todas as variáveis no envio. Use a data de término e os totais do ciclo encerrado, antes de zerar os contadores de uma eventual renovação. O texto também atende ao caso em que um novo ciclo já começou e não afirma que a vela inteira ficou inativa. Os rótulos dos totais funcionam com zero, um ou vários registros.

O botão principal abre a página da vela. O link **Minhas velas** leva ao painel com as opções disponíveis e a doação é apresentada como voluntária. O layout mantém as tabelas, os estilos inline e os ajustes para celular e Outlook do template de ativação.

Antes de publicar, envie uma prévia com os links reais e confira no celular e no desktop, incluindo título longo e totais zerados. O envio automático usa este template tanto em `closeCycles` quanto no encerramento durante a confirmação de uma renovação paga. Os dados são gravados na mesma transação do encerramento, com um trabalho por vela e ciclo. No agendador, os totais vêm da leitura mais recente da transação.

## Vela acesa

Arquivo para importar: `vela-acesa.html`.

No Resend, crie um template e importe o HTML completo. Sugestão de nome/alias: `vela-acesa`. Use o assunto **Sua vela está acesa 🕯️** e configure um remetente do seu domínio verificado.

Cadastre estas cinco variáveis como **string**, com os nomes exatamente iguais aos do HTML:

| Variável | Conteúdo | Exemplo para teste |
| --- | --- | --- |
| `TITULO_VELA` | Título cadastrado pelo criador | Pela saúde da minha família |
| `DATA_ENCERRAMENTO` | Data e hora de encerramento, já formatadas no fuso desejado | 3 de novembro de 2026, às 18h (Brasília) |
| `URL_VELA` | URL absoluta da página compartilhável da vela | https://seu-dominio.com/v/ID_DA_VELA |
| `URL_MINHAS_VELAS` | URL absoluta do painel do criador | https://seu-dominio.com/minhas-velas |
| `URL_SITE` | URL absoluta da página inicial | https://seu-dominio.com |

Substitua os endereços de exemplo pelo domínio real. Forneça todas as variáveis em cada envio; não use um endereço genérico como fallback do link da vela. A data deve vir do fim do ciclo efetivamente ativado, para funcionar com todos os planos.

Envie uma prévia pelo Resend com as variáveis preenchidas, confira os links e publique o template antes de usá-lo na API. Documentação: [importação de templates](https://resend.com/docs/dashboard/templates/create-template) e [variáveis](https://resend.com/docs/dashboard/templates/template-variables).

O layout usa tabelas, estilos essenciais inline, fontes do sistema e largura máxima de 600 px, com ajustes para celular e Outlook. Não depende de imagens, fontes externas ou JavaScript. A aparência do emoji de vela varia conforme o cliente de e-mail. A renderização final deve ser conferida nas caixas de entrada usadas pelo público.

## Configuração das Functions

Em `functions/.env.vela-virtual-cozy`, configure:

```dotenv
ENABLE_PRODUCT_EMAILS=true
EMAIL_CANDLE_LIT_TEMPLATE_ID=vela-acesa-1
EMAIL_CANDLE_ENDED_TEMPLATE_ID=vela-concluda
```

Os templates são independentes: `EMAIL_CANDLE_LIT_TEMPLATE_ID` permanece destinado à ativação; `EMAIL_CANDLE_ENDED_TEMPLATE_ID` é usado somente ao concluir um ciclo. O ambiente local já está configurado com os aliases acima; publique as Functions para aplicar a integração.

Mantenha `PUBLIC_BASE_URL` com a URL HTTPS real do site. `EMAIL_CANDLE_LIT_TEMPLATE_ID` não é segredo e aceita o ID ou o alias do template (o nome de exibição não substitui o alias). As credenciais `EMAIL_API_KEY` e `EMAIL_FROM` continuam no Secret Manager, conforme o README principal.

Publique com `npm run deploy:backend`. É necessário atualizar `api`, que grava as confirmações e os encerramentos durante renovações, `closeCycles`, que encerra os ciclos a cada quinze minutos, e `deliverEmail`, que envia pelo Resend. O entregador consulta a fila a cada cinco minutos.

A confirmação usa o template para velas gratuitas ativadas imediatamente, gratuitas aprovadas na moderação e novas velas pagas após confirmação do PIX. Os cinco valores são preenchidos automaticamente, com o fim do ciclo em `America/Sao_Paulo`. A confirmação de uma compra paga entra na mesma transação de ativação, preservando a idempotência do pedido.

Resumos, confirmações de pagamento de renovação e trabalhos antigos da fila continuam como texto simples. Não há migração nem reenvio de e-mails anteriores. Se faltar o ID do template ou o Resend recusar o envio, o trabalho permanece pendente para nova tentativa e o erro aparece nos logs de `deliverEmail`.
