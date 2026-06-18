# Sistema PDV

Sistema PDV web para restaurante, com controle de mesas, pedidos, delivery, cardapio proprio, integracoes simuladas, pagamentos online, fidelidade e relatorios.

## Recursos

- PDV para centralizar pedidos de salao, delivery e canais externos.
- Painel de mesas em mapa visual compacto.
- Cardapio proprio/MenuDino sem taxa por pedido.
- Integracoes simuladas com iFood, 99Food e WhatsApp Bot.
- Painel de delivery com endereco, forma de pagamento e status pago/pendente.
- App do entregador simulado com captura de pedido e rastreamento.
- Smart Delivery para agrupar pedidos em rota.
- Pagamentos online simulados com Cielo, PagSeguro e PIX.
- Fidelidade com pontos, cupons e cashback.
- Estoque operacional, recibos, relatorios e fiscal em modo dev.
- Servidor local com persistencia em JSON e atualizacao em tempo real via Server-Sent Events.

## Como Rodar

Requisitos:

- Node.js instalado.

Inicie na porta 8011:

```bat
start-server-8011.cmd
```

Ou pelo PowerShell:

```powershell
.\start-server-8011.ps1
```

Acesse:

```text
http://127.0.0.1:8011
```

## Login Padrao

```text
usuario: admin
senha: admin123
```

Outros usuarios de teste ficam definidos em `dev-server.cjs`.

## Estrutura

```text
css/              Estilos do sistema
img/              Imagens de produtos
js/               Logica do PDV
dev-server.cjs    Servidor local e API simples
pedidos.html      Tela principal do sistema
recibo.html       Impressao de recibo
relatorio.html    Relatorios
```

## Observacoes

As integracoes com iFood, 99Food, WhatsApp, Cielo, PagSeguro e PIX estao preparadas como fluxo operacional simulado. Para uso real, e necessario configurar credenciais e implementar as APIs oficiais de cada fornecedor.

O diretorio `data/` guarda estado local gerado em tempo de execucao e fica fora do Git.
