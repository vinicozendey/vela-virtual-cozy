# E-mail: vela acesa

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
EMAIL_CANDLE_LIT_TEMPLATE_ID=ID_OU_ALIAS_DO_TEMPLATE_PUBLICADO
```

Mantenha `PUBLIC_BASE_URL` com a URL HTTPS real do site. `EMAIL_CANDLE_LIT_TEMPLATE_ID` não é segredo e aceita o ID ou o alias do template (o nome de exibição não substitui o alias). As credenciais `EMAIL_API_KEY` e `EMAIL_FROM` continuam no Secret Manager, conforme o README principal.

Publique com `npm run deploy:backend`. É necessário atualizar tanto `api`, que grava os dados das novas confirmações na fila, quanto `deliverEmail`, que envia pelo Resend. O entregador consulta a fila a cada cinco minutos.

A confirmação usa o template para velas gratuitas ativadas imediatamente, gratuitas aprovadas na moderação e novas velas pagas após confirmação do PIX. Os cinco valores são preenchidos automaticamente, com o fim do ciclo em `America/Sao_Paulo`. A confirmação de uma compra paga entra na mesma transação de ativação, preservando a idempotência do pedido.

Resumos, confirmações de renovação e trabalhos antigos da fila continuam como texto simples. Não há migração nem reenvio de e-mails anteriores. Se faltar o ID do template ou o Resend recusar o envio, o trabalho permanece pendente para nova tentativa e o erro aparece nos logs de `deliverEmail`.
