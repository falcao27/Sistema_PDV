import { produtosIniciais, categorias } from './products.js';

const STORAGE_KEY = 'brasaFogoState';
const COVER_VALUE = 12;
const STATUS_FLUXO = ['aguardando', 'em preparo', 'pronto', 'entregue'];
const STATUS_LABELS = {
    aguardando: 'Aguardando',
    'em preparo': 'Em preparo',
    preparando: 'Em preparo',
    pronto: 'Pronto',
    entregue: 'Entregue',
    fechado: 'Fechado'
};
const CANAIS_INICIAIS = [
    { id: 'menudino', nome: 'MenuDino', status: 'ativo', taxa: 0, pedidosHoje: 0, descricao: 'Site proprio sem taxa por pedido' },
    { id: 'ifood', nome: 'iFood', status: 'conectado', taxa: 18, pedidosHoje: 0, descricao: 'Pedidos entram no mesmo PDV' },
    { id: '99food', nome: '99Food', status: 'conectado', taxa: 14, pedidosHoje: 0, descricao: 'Marketplace integrado ao painel' },
    { id: 'whatsapp', nome: 'WhatsApp Bot', status: 'ativo', taxa: 0, pedidosHoje: 0, descricao: 'Bot recebe pedidos e envia status' },
    { id: 'telefone', nome: 'Telefone', status: 'ativo', taxa: 0, pedidosHoje: 0, descricao: 'Lancamento manual no balcao' }
];
const ENTREGADORES_INICIAIS = [
    { id: 1, nome: 'Rafael', status: 'disponivel', latitude: -23.5505, longitude: -46.6333, pedidos: [] },
    { id: 2, nome: 'Marcos', status: 'em rota', latitude: -23.5558, longitude: -46.6396, pedidos: [] },
    { id: 3, nome: 'Julia', status: 'disponivel', latitude: -23.5489, longitude: -46.6251, pedidos: [] }
];
const CUPONS_PROMO_INICIAIS = [
    { id: 'BEMVINDO10', tipo: 'percentual', valor: 10, ativo: true, usos: 0 },
    { id: 'VOLTA15', tipo: 'cashback', valor: 15, ativo: true, usos: 0 }
];

let state = carregarEstado();
let viewAtual = 'painel';
let mesaAtual = state.mesas[0]?.id || null;
let carrinhoAtual = [];
let mesaFechamento = null;
let mesaPedidosDetalhe = null;
let serverOnline = false;
let eventSource = null;
let currentUser = JSON.parse(localStorage.getItem('usuarioLogado') || 'null');

const $ = (selector) => document.querySelector(selector);
const money = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

document.addEventListener('DOMContentLoaded', async () => {
    if (localStorage.getItem('loggedIn') !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    await carregarEstadoServidor();
    configurarEventos();
    aplicarTemaSalvo();
    renderTudo();
    iniciarTempoReal();
});

function carregarEstado() {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) return normalizarEstado(JSON.parse(salvo));

    return normalizarEstado({
        mesas: criarMesasIniciais(),
        produtos: produtosIniciais,
        pedidos: [],
        cupons: [],
        canais: CANAIS_INICIAIS,
        entregadores: ENTREGADORES_INICIAIS,
        clientes: [],
        cuponsPromocionais: CUPONS_PROMO_INICIAIS,
        pagamentosOnline: []
    });
}

function criarMesasIniciais() {
    return Array.from({ length: 12 }, (_, index) => ({
        id: index + 1,
        nome: `Mesa ${String(index + 1).padStart(2, '0')}`,
        status: index === 0 ? 'aberta' : 'livre'
    }));
}

function normalizarEstado(estado) {
    estado.mesas ||= [];
    estado.produtos ||= produtosIniciais;
    estado.pedidos ||= [];
    estado.cupons ||= [];
    estado.notas ||= [];
    estado.config ||= {};
    estado.canais ||= CANAIS_INICIAIS;
    estado.entregadores ||= ENTREGADORES_INICIAIS;
    estado.clientes ||= [];
    estado.cuponsPromocionais ||= CUPONS_PROMO_INICIAIS;
    estado.pagamentosOnline ||= [];
    estado.cardapio ||= {
        nome: 'Brasa & Fogo Delivery',
        dominio: 'brasaefogo.menudino.com',
        taxaPedido: 0,
        pedidosGratisMes: 30,
        cor: '#2563eb'
    };

    estado.canais = CANAIS_INICIAIS.map((canal) => ({ ...canal, ...(estado.canais.find((item) => item.id === canal.id) || {}) }));
    estado.entregadores = ENTREGADORES_INICIAIS.map((entregador) => ({ ...entregador, ...(estado.entregadores.find((item) => item.id === entregador.id) || {}) }));
    const cuponsExtras = estado.cuponsPromocionais.filter((cupom) => !CUPONS_PROMO_INICIAIS.some((item) => item.id === cupom.id));
    estado.cuponsPromocionais = [
        ...CUPONS_PROMO_INICIAIS.map((cupom) => ({ ...cupom, ...(estado.cuponsPromocionais.find((item) => item.id === cupom.id) || {}) })),
        ...cuponsExtras
    ];

    for (let id = 1; id <= 12; id += 1) {
        if (!estado.mesas.some((mesa) => mesa.id === id)) {
            estado.mesas.push({
                id,
                nome: `Mesa ${String(id).padStart(2, '0')}`,
                status: id === 1 ? 'aberta' : 'livre'
            });
        }
    }

    const mesaUm = estado.mesas.find((mesa) => mesa.id === 1);
    if (mesaUm && !estado.config.mesaUmAbertaInicialConfirmada) {
        mesaUm.status = 'aberta';
        estado.config.mesaUmAbertaInicialConfirmada = true;
    }

    estado.mesas.sort((a, b) => a.id - b.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    return estado;
}

function salvarEstado(action = 'Atualizacao de estado') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    salvarEstadoServidor(action);
}

async function carregarEstadoServidor() {
    try {
        const response = await fetch('/api/state', { cache: 'no-store' });
        if (!response.ok) throw new Error('Servidor indisponivel');
        state = normalizarEstado(await response.json());
        mesaAtual = state.mesas.some((mesa) => mesa.id === mesaAtual) ? mesaAtual : state.mesas[0]?.id || null;
        serverOnline = true;
    } catch (error) {
        serverOnline = false;
    }
}

async function salvarEstadoServidor(action) {
    if (!serverOnline) return;

    try {
        await fetch('/api/state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                state,
                actor: currentUser,
                action
            })
        });
    } catch (error) {
        serverOnline = false;
        showToast('Sem conexao com o servidor do balcao. Operando localmente.', 'warning');
    }
}

function iniciarTempoReal() {
    if (!serverOnline || typeof EventSource === 'undefined') return;

    eventSource = new EventSource('/api/events');
    eventSource.addEventListener('state', (event) => {
        const payload = JSON.parse(event.data);
        state = normalizarEstado(payload.state);
        mesaAtual = state.mesas.some((mesa) => mesa.id === mesaAtual) ? mesaAtual : state.mesas[0]?.id || null;
        renderTudo();

        if (payload.actor && payload.actor.id !== currentUser?.id) {
            showToast(`${payload.actor.nome} atualizou o painel.`, 'success');
        }
    });

    eventSource.onerror = () => {
        serverOnline = false;
        eventSource?.close();
        showToast('Conexao em tempo real perdida. Recarregue quando a rede voltar.', 'warning');
    };
}

function configurarEventos() {
    document.querySelectorAll('.nav-btn').forEach((button) => {
        button.addEventListener('click', () => trocarView(button.dataset.view));
    });

    $('#logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('usuarioLogado');
        window.location.href = 'login.html';
    });

    $('#toggleTheme')?.addEventListener('click', alternarTema);
    $('#toggleThemeDesktop')?.addEventListener('click', alternarTema);
    $('#mesaSelecionada').addEventListener('change', (event) => {
        mesaAtual = Number(event.target.value) || null;
        renderTudo();
    });
    $('#novoPedidoBtn').addEventListener('click', abrirNovoPedido);
    $('#closePedidoModal').addEventListener('click', fecharNovoPedido);
    $('#categoriaSelect').addEventListener('change', renderProdutosPedido);
    $('#buscaProduto').addEventListener('input', renderProdutosPedido);
    $('#confirmarPedidoBtn').addEventListener('click', confirmarPedido);
    $('#closeFecharMesaModal').addEventListener('click', fecharModalFechamento);
    $('#imprimirConferenciaBtn').addEventListener('click', imprimirConferenciaMesa);
    $('#formFecharMesa').addEventListener('submit', confirmarPagamentoMesa);
    $('#incluirCover').addEventListener('change', renderResumoFechamento);
    $('#incluirServico').addEventListener('change', renderResumoFechamento);
    $('#closePedidosMesaModal').addEventListener('click', fecharModalPedidosMesa);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            fecharNovoPedido();
            fecharModalFechamento();
            fecharModalPedidosMesa();
        }
    });
}

function aplicarTemaSalvo() {
    if (localStorage.getItem('darkMode') === 'true' ||
        (!('darkMode' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
}

function alternarTema() {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', document.documentElement.classList.contains('dark'));
}

function trocarView(view) {
    viewAtual = view;
    renderTudo();
}

function renderTudo() {
    renderUsuarioAtual();
    renderSelectMesas();
    renderNavegacao();
    renderContextoMesa();
    renderPainel();
    renderPedidos();
    renderMesas();
    renderDelivery();
    renderCardapio();
    renderIntegracoes();
    renderFidelidade();
    renderPagamentos();
    renderProdutos();
    renderEstoque();
    renderRelatorios();
    renderFiscal();
    vincularAcoesDePedido();
}

function renderUsuarioAtual() {
    const badge = $('#usuarioAtualBadge');
    if (!badge) return;

    badge.innerHTML = currentUser ? `
        <span class="block text-xs uppercase opacity-80">Usuario logado</span>
        <strong class="block text-white">${currentUser.nome}</strong>
        <span class="block opacity-80">${currentUser.perfil}</span>
    ` : '<span>Usuario nao identificado</span>';
}

function renderContextoMesa() {
    const mesa = state.mesas.find((item) => item.id === mesaAtual);
    const pedidos = mesa ? pedidosAbertosDaMesa(mesa.id) : [];
    const total = pedidos.reduce((soma, pedido) => soma + pedido.total, 0);
    const itens = pedidos.reduce((soma, pedido) => soma + pedido.itens.reduce((acc, item) => acc + item.quantidade, 0), 0);
    const ultimoPedido = pedidos.at(-1);

    $('#mesaContexto').innerHTML = mesa ? `
        <div class="context-stat">
            <span>Mesa selecionada</span>
            <strong>${mesa.nome}</strong>
        </div>
        <div class="context-stat">
            <span>Status</span>
            <strong class="${mesa.status === 'aberta' ? 'text-green-500' : 'text-blue-500'}">${mesa.status}</strong>
        </div>
        <div class="context-stat">
            <span>Consumo atual</span>
            <strong>${money(total)}</strong>
        </div>
        <div class="context-stat">
            <span>Itens / ultimo pedido</span>
            <strong>${itens} ${ultimoPedido ? `- #${String(ultimoPedido.id).slice(-4)}` : ''}</strong>
        </div>
    ` : `
        <div class="context-stat">
            <span>Mesa selecionada</span>
            <strong>Nenhuma</strong>
        </div>
        <div class="context-stat">
            <span>Status</span>
            <strong>aguardando</strong>
        </div>
        <div class="context-stat">
            <span>Consumo atual</span>
            <strong>${money(0)}</strong>
        </div>
        <div class="context-stat">
            <span>Acao</span>
            <strong>selecione mesa</strong>
        </div>
    `;
}

function renderNavegacao() {
    const titulos = {
        painel: 'Painel',
        pedidos: 'Pedidos',
        mesas: 'Mesas',
        delivery: 'Delivery',
        cardapio: 'MenuDino',
        integracoes: 'Integracoes',
        fidelidade: 'Fidelidade',
        pagamentos: 'Pagamentos online',
        produtos: 'Produtos',
        estoque: 'Estoque',
        relatorios: 'Relatorios',
        fiscal: 'Fiscal - Dev'
    };

    $('#viewTitle').textContent = titulos[viewAtual];
    document.querySelectorAll('.view-section').forEach((section) => section.classList.add('hidden'));
    $(`#${viewAtual}View`).classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach((button) => {
        button.classList.toggle('bg-white/20', button.dataset.view === viewAtual);
    });

    const podeCriarPedido = ['painel', 'pedidos', 'mesas', 'delivery', 'cardapio', 'integracoes'].includes(viewAtual);
    $('#novoPedidoBtn').classList.toggle('hidden', !podeCriarPedido);
    $('#mesaSelecionada').classList.toggle('hidden', !podeCriarPedido);
}

function renderSelectMesas() {
    $('#mesaSelecionada').innerHTML = [
        '<option value="">Selecione uma mesa</option>',
        ...state.mesas.map((mesa) => `<option value="${mesa.id}" ${mesa.id === mesaAtual ? 'selected' : ''}>${mesa.nome} - ${mesa.status}</option>`)
    ].join('');
}

function renderPainel() {
    const abertas = state.mesas.filter((mesa) => mesa.status === 'aberta').length;
    const ativos = state.pedidos.filter((pedido) => !['entregue', 'fechado'].includes(pedido.status)).length;
    const faturamento = state.cupons.reduce((total, cupom) => total + cupom.total, 0);
    const criticos = state.produtos.filter((produto) => produto.estoqueCozinha <= produto.minimo);
    const deliveryAtivos = state.pedidos.filter((pedido) => pedido.tipo === 'delivery' && !['entregue', 'fechado'].includes(pedido.status)).length;
    const canalProprio = state.pedidos.filter((pedido) => pedido.canal === 'MenuDino').length;

    $('#painelView').innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            ${metricCard('Faturamento hoje', money(faturamento), 'Cupons emitidos', 'bg-green-400')}
            ${metricCard('Mesas abertas', `${abertas}/${state.mesas.length}`, 'Salao em operacao', 'bg-white dark:bg-gray-800')}
            ${metricCard('Pedidos ativos', ativos, 'Todos os canais no PDV', 'bg-white dark:bg-gray-800')}
            ${metricCard('Delivery ativo', deliveryAtivos, 'Rotas e entregadores', 'bg-white dark:bg-gray-800')}
            ${metricCard('Canal proprio', canalProprio, 'MenuDino sem taxa', 'bg-yellow-200')}
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h3 class="text-lg font-bold mb-4 dark:text-white">Pedidos recentes</h3>
                ${renderListaPedidos(state.pedidos.slice(-5).reverse())}
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h3 class="text-lg font-bold mb-4 dark:text-white">Alertas operacionais</h3>
                ${criticos.length ? criticos.map((produto) => `<p class="border rounded p-3 mb-2 dark:text-white">${produto.nome}<br><span class="text-sm text-gray-500 dark:text-gray-300">Estoque ${produto.estoqueCozinha} ${produto.unidade} / minimo ${produto.minimo}</span></p>`).join('') : '<p class="text-gray-500 dark:text-gray-300">Nenhum item critico.</p>'}
            </div>
        </div>
    `;
}

function metricCard(label, value, detail, bgClass) {
    const textClass = bgClass.includes('white') ? 'text-gray-900 dark:text-white' : 'text-gray-900';
    return `
        <div class="${bgClass} floating-card rounded-lg shadow-md p-5">
            <p class="text-sm ${textClass}">${label}</p>
            <p class="text-3xl font-bold ${textClass} mt-2">${value}</p>
            <p class="text-sm ${textClass} mt-1">${detail}</p>
        </div>
    `;
}

function renderPedidos() {
    const pedidosPorStatus = STATUS_FLUXO.map((status) => ({
        status,
        pedidos: state.pedidos.filter((pedido) => normalizarStatus(pedido.status) === status)
    }));

    $('#pedidosView').innerHTML = `
        <div>
            <p class="text-sm font-semibold text-blue-600 dark:text-blue-300 uppercase mb-1">Fluxo de producao</p>
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                <h3 class="text-3xl font-bold text-gray-900 dark:text-white">Painel cozinha e salao</h3>
                <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded" data-action="novo-pedido">
                    <i class="fas fa-plus mr-2"></i>Novo pedido
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-h-[24rem]">
                ${pedidosPorStatus.map(({ status, pedidos }) => renderColunaPedidos(status, pedidos)).join('')}
            </div>
        </div>
    `;
    $('#pedidosView [data-action="novo-pedido"]').addEventListener('click', abrirNovoPedido);
}

function renderListaPedidos(pedidos) {
    if (!pedidos.length) return '<p class="text-gray-500 dark:text-gray-300">Nenhum pedido registrado.</p>';

    return `
        <div class="space-y-3">
            ${pedidos.map((pedido) => `
                <div class="floating-card border dark:border-gray-700 rounded p-4">
                    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div class="dark:text-white">
                            <p class="font-bold">Pedido #${pedido.id} - ${nomeMesa(pedido.mesaId)}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-300">${pedido.itens.map((item) => `${item.quantidade}x ${item.nome}`).join(', ')}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${pedido.canal || 'PDV'}${pedido.cliente ? ` - ${pedido.cliente}` : ''} - Lancado por: ${pedido.criadoPor?.nome || 'Nao informado'}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 dark:text-white">${STATUS_LABELS[pedido.status] || pedido.status}</span>
                            <strong class="dark:text-white">${money(pedido.total)}</strong>
                            ${!['entregue', 'fechado'].includes(normalizarStatus(pedido.status)) ? `<button class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded" data-avancar-status="${pedido.id}">Avancar status</button>` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderColunaPedidos(status, pedidos) {
    return `
        <section class="floating-card bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-md p-3 min-h-[24rem]">
            <div class="flex items-center justify-between mb-3">
                <h4 class="font-bold text-gray-900 dark:text-white">${STATUS_LABELS[status]}</h4>
                <span class="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-xs font-bold rounded-full min-w-6 h-6 px-2 flex items-center justify-center">${pedidos.length}</span>
            </div>
            <div class="space-y-3">
                ${pedidos.length ? pedidos.map(renderPedidoKanbanCard).join('') : '<p class="text-sm text-gray-500 dark:text-gray-300 border border-dashed dark:border-gray-700 rounded p-4">Sem pedidos nesta etapa.</p>'}
            </div>
        </section>
    `;
}

function renderPedidoKanbanCard(pedido) {
    const minutos = Math.max(1, Math.round((Date.now() - new Date(pedido.dataHora).getTime()) / 60000));
    const status = normalizarStatus(pedido.status);
    const proximoStatus = STATUS_FLUXO[STATUS_FLUXO.indexOf(status) + 1];

    return `
        <article class="floating-card bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-lg p-4">
            <div class="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h5 class="text-2xl font-bold text-gray-900 dark:text-white">#${String(pedido.id).slice(-4)}</h5>
                    <p class="text-sm text-gray-600 dark:text-gray-300">${nomeMesa(pedido.mesaId)}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${pedido.canal || 'PDV'}${pedido.cliente ? ` - ${pedido.cliente}` : ''}</p>
                </div>
                <span class="status-pill bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200">${minutos}min</span>
            </div>
            <ul class="list-disc list-inside text-sm text-gray-900 dark:text-white mb-3">
                ${pedido.itens.map((item) => `<li>${item.quantidade}x ${item.nome}</li>`).join('')}
            </ul>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">${pedido.observacao || 'Sem observacoes.'}</p>
            <div class="flex items-center justify-between gap-3">
                <strong class="text-gray-900 dark:text-white">${money(pedido.total)}</strong>
                ${proximoStatus ? `<button class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded flex-1" data-avancar-status="${pedido.id}">Avancar para ${STATUS_LABELS[proximoStatus]}</button>` : '<span class="bg-green-500 text-white px-3 py-2 rounded flex-1 text-center">Entregue</span>'}
            </div>
        </article>
    `;
}

function renderMesas() {
    const abertas = state.mesas.filter((mesa) => mesa.status === 'aberta').length;
    const livres = state.mesas.filter((mesa) => mesa.status !== 'aberta').length;
    const totalSalao = state.mesas.reduce((soma, mesa) => soma + pedidosAbertosDaMesa(mesa.id).reduce((total, pedido) => total + pedido.total, 0), 0);

    $('#mesasView').innerHTML = `
        <section class="table-board premium-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <div class="table-board-toolbar">
                <div>
                    <p class="text-sm font-semibold text-blue-600 dark:text-blue-300 uppercase">Mapa do salao</p>
                    <h3 class="text-2xl font-bold dark:text-white">Painel de mesas</h3>
                </div>
                <div class="table-board-actions">
                    <div class="table-board-stat"><span>Abertas</span><strong>${abertas}</strong></div>
                    <div class="table-board-stat"><span>Livres</span><strong>${livres}</strong></div>
                    <div class="table-board-stat"><span>Total</span><strong>${money(totalSalao)}</strong></div>
                    <button id="cadastrarMesaBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                        <i class="fas fa-plus mr-2"></i>Mesa
                    </button>
                </div>
            </div>

            <div class="table-board-legend">
                <span><i class="table-dot table-dot-free"></i>Livre</span>
                <span><i class="table-dot table-dot-open"></i>Aberta</span>
                <span><i class="table-dot table-dot-delivery"></i>Delivery</span>
            </div>

            <div class="table-tile-grid">
                ${state.mesas.map(renderMesaCard).join('')}
            </div>
        </section>
    `;

    $('#cadastrarMesaBtn').addEventListener('click', cadastrarMesa);
    document.querySelectorAll('[data-editar-mesa]').forEach((button) => button.addEventListener('click', () => editarMesa(Number(button.dataset.editarMesa))));
    document.querySelectorAll('[data-add-pedido]').forEach((button) => button.addEventListener('click', () => {
        mesaAtual = Number(button.dataset.addPedido);
        abrirNovoPedido();
    }));
    document.querySelectorAll('[data-ver-pedidos-mesa]').forEach((button) => button.addEventListener('click', () => abrirPedidosMesa(Number(button.dataset.verPedidosMesa))));
    document.querySelectorAll('[data-excluir-mesa]').forEach((button) => button.addEventListener('click', () => excluirMesa(Number(button.dataset.excluirMesa))));
    document.querySelectorAll('[data-fechar-mesa]').forEach((button) => button.addEventListener('click', () => abrirFechamento(Number(button.dataset.fecharMesa))));
}

function renderMesaCard(mesa) {
    const pedidosMesa = pedidosAbertosDaMesa(mesa.id);
    const total = pedidosMesa.reduce((soma, pedido) => soma + pedido.total, 0);
    const aberta = mesa.status === 'aberta';
    const delivery = mesa.tipo === 'delivery';
    const numero = String(mesa.id).padStart(2, '0');
    const tileClass = delivery ? 'table-tile-delivery' : aberta ? 'table-tile-open' : 'table-tile-free';

    return `
        <article class="table-tile ${tileClass}">
            <button class="table-tile-main" data-add-pedido="${mesa.id}" title="Adicionar pedido em ${mesa.nome}">
                <span class="table-tile-label">${delivery ? 'DEL' : numero}</span>
                <strong>${delivery ? 'Delivery' : mesa.nome.replace(/^Mesa\s*/i, '')}</strong>
                <small>${aberta ? `${pedidosMesa.length} ped. - ${money(total)}` : 'livre'}</small>
            </button>
            <div class="table-tile-actions">
                <button data-ver-pedidos-mesa="${mesa.id}" title="Ver pedidos"><i class="fas fa-list"></i></button>
                <button data-fechar-mesa="${mesa.id}" title="Fechar mesa" ${!aberta ? 'disabled' : ''}><i class="fas fa-receipt"></i></button>
                <button data-editar-mesa="${mesa.id}" title="Editar mesa"><i class="fas fa-edit"></i></button>
                <button data-excluir-mesa="${mesa.id}" title="Excluir mesa"><i class="fas fa-trash"></i></button>
            </div>
        </article>
    `;
}

function renderDelivery() {
    const pedidosDelivery = state.pedidos.filter((pedido) => pedido.tipo === 'delivery' && pedido.status !== 'fechado');
    const disponiveis = state.entregadores.filter((entregador) => entregador.status === 'disponivel').length;
    const tempoMedio = pedidosDelivery.length ? Math.max(18, 42 - pedidosDelivery.length * 3) : 0;
    const pedidosPagos = pedidosDelivery.filter((pedido) => normalizarStatusPagamento(pedido) === 'pago').length;
    const pedidosPendentes = pedidosDelivery.filter((pedido) => normalizarStatusPagamento(pedido) !== 'pago').length;

    $('#deliveryView').innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            ${metricCard('Pedidos delivery', pedidosDelivery.length, 'Abertos e em rota', 'bg-white dark:bg-gray-800')}
            ${metricCard('Pagos', pedidosPagos, 'Liberados financeiramente', 'bg-green-400')}
            ${metricCard('A receber', pedidosPendentes, 'Cobrar na entrega/online', 'bg-yellow-200')}
            ${metricCard('Entregadores livres', disponiveis, 'App do entregador', 'bg-white dark:bg-gray-800')}
        </div>
        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <section class="premium-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 xl:col-span-2">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div>
                        <h3 class="text-lg font-bold dark:text-white">Smart Delivery</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-300">Agrupe pedidos proximos, confira pagamento, atribua ao entregador e acompanhe o rastreio.</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <span class="status-pill bg-blue-100 text-blue-700">${tempoMedio || 0} min medio</span>
                        <button id="gerarRotaBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                            <i class="fas fa-route mr-2"></i>Gerar melhor rota
                        </button>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${pedidosDelivery.length ? pedidosDelivery.map(renderDeliveryPedidoCard).join('') : '<p class="text-gray-500 dark:text-gray-300 border border-dashed dark:border-gray-700 rounded p-4">Nenhum pedido delivery aberto.</p>'}
                </div>
            </section>
            <section class="premium-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h3 class="text-lg font-bold mb-4 dark:text-white">App do Entregador</h3>
                <div class="space-y-3">
                    ${state.entregadores.map((entregador) => `
                        <article class="border dark:border-gray-700 rounded p-3 dark:text-white">
                            <div class="flex items-center justify-between gap-3">
                                <strong>${entregador.nome}</strong>
                                <span class="status-pill ${entregador.status === 'disponivel' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}">${entregador.status}</span>
                            </div>
                            <p class="text-xs text-gray-500 dark:text-gray-300 mt-2">Mapa: ${entregador.latitude.toFixed(4)}, ${entregador.longitude.toFixed(4)}</p>
                            <p class="text-sm text-gray-600 dark:text-gray-300">Pedidos capturados: ${(entregador.pedidos || []).length}</p>
                        </article>
                    `).join('')}
                </div>
            </section>
        </div>
    `;

    $('#gerarRotaBtn').addEventListener('click', gerarRotaSmartDelivery);
    document.querySelectorAll('[data-atribuir-entrega]').forEach((button) => button.addEventListener('click', () => atribuirEntrega(Number(button.dataset.atribuirEntrega))));
    document.querySelectorAll('[data-marcar-pago]').forEach((button) => button.addEventListener('click', () => marcarPedidoPago(Number(button.dataset.marcarPago))));
}

function renderDeliveryPedidoCard(pedido) {
    const statusPagamento = normalizarStatusPagamento(pedido);
    const pago = statusPagamento === 'pago';
    const pagamentoClass = pago ? 'bg-green-100 text-green-700' : statusPagamento === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800';

    return `
        <article class="floating-card border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <h4 class="text-xl font-bold dark:text-white">#${String(pedido.id).slice(-4)} - ${pedido.canal || 'PDV'}</h4>
                    <p class="text-sm text-gray-500 dark:text-gray-300">${pedido.cliente || 'Cliente nao informado'}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-300">${pedido.endereco || 'Endereco nao informado'}</p>
                </div>
                <strong class="dark:text-white">${money(pedido.total)}</strong>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3">
                <div class="delivery-info-chip">
                    <span>Forma de pagamento</span>
                    <strong>${pedido.metodoPagamento || 'A pagar na entrega'}</strong>
                </div>
                <div class="delivery-info-chip">
                    <span>Status</span>
                    <strong class="${pago ? 'text-green-600' : 'text-yellow-700'}">${pago ? 'Pago' : statusPagamento === 'cancelado' ? 'Cancelado' : 'Pendente'}</strong>
                </div>
            </div>
            <p class="text-sm my-3 dark:text-white">${pedido.itens.map((item) => `${item.quantidade}x ${item.nome}`).join(', ')}</p>
            <div class="flex flex-wrap items-center gap-2">
                <span class="status-pill bg-blue-100 text-blue-700">${STATUS_LABELS[normalizarStatus(pedido.status)] || pedido.status}</span>
                <span class="status-pill ${pagamentoClass}">${pago ? 'pago' : statusPagamento}</span>
                ${!pago ? `<button class="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded flex-1" data-marcar-pago="${pedido.id}">
                    <i class="fas fa-check-circle mr-2"></i>Marcar pago
                </button>` : ''}
                <button class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded flex-1" data-atribuir-entrega="${pedido.id}">
                    <i class="fas fa-qrcode mr-2"></i>Capturar no app
                </button>
            </div>
        </article>
    `;
}

function renderCardapio() {
    const pedidosMenuDino = state.pedidos.filter((pedido) => pedido.canal === 'MenuDino');
    $('#cardapioView').innerHTML = `
        <section class="premium-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                <div>
                    <p class="text-sm font-semibold text-blue-600 dark:text-blue-300 uppercase">Site proprio sem taxa</p>
                    <h3 class="text-2xl font-bold dark:text-white">${state.cardapio.nome}</h3>
                    <p class="text-gray-500 dark:text-gray-300 mt-1">${state.cardapio.dominio}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-300 mt-3">Taxa por pedido: ${state.cardapio.taxaPedido}% - pedidos gratis no mes: ${state.cardapio.pedidosGratisMes}</p>
                </div>
                <button id="simularMenuDinoBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                    <i class="fas fa-store mr-2"></i>Simular pedido MenuDino
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                ${metricCard('Pedidos MenuDino', pedidosMenuDino.length, 'Sem comissao por pedido', 'bg-green-400')}
                ${metricCard('Taxa economizada', money(pedidosMenuDino.reduce((total, pedido) => total + pedido.total * 0.18, 0)), 'Comparado a 18% marketplace', 'bg-white dark:bg-gray-800')}
                ${metricCard('Produtos publicados', state.produtos.length, 'Cardapio sincronizado', 'bg-white dark:bg-gray-800')}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                ${state.produtos.map((produto) => `
                    <article class="floating-card border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                        <h4 class="font-bold dark:text-white">${produto.nome}</h4>
                        <p class="text-sm text-gray-500 dark:text-gray-300">${produto.categoria}</p>
                        <strong class="block mt-3 dark:text-white">${money(produto.preco)}</strong>
                        <span class="status-pill mt-3 ${produto.estoqueProdutos > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${produto.estoqueProdutos > 0 ? 'online' : 'indisponivel'}</span>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
    $('#simularMenuDinoBtn').addEventListener('click', () => simularPedidoCanal('MenuDino'));
}

function renderIntegracoes() {
    $('#integracoesView').innerHTML = `
        <section class="premium-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                <div>
                    <h3 class="text-lg font-bold dark:text-white">Central de integracoes</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-300">iFood, 99Food, WhatsApp Bot, telefone e MenuDino entrando no mesmo PDV.</p>
                </div>
                <button id="sincronizarCanaisBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                    <i class="fas fa-sync mr-2"></i>Sincronizar pedidos
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                ${state.canais.map((canal) => `
                    <article class="floating-card border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <h4 class="font-bold dark:text-white">${canal.nome}</h4>
                                <p class="text-sm text-gray-500 dark:text-gray-300">${canal.descricao}</p>
                            </div>
                            <span class="status-pill bg-green-100 text-green-700">${canal.status}</span>
                        </div>
                        <p class="text-sm mt-3 dark:text-white">Taxa estimada: <strong>${canal.taxa}%</strong></p>
                        <p class="text-sm dark:text-white">Pedidos hoje: <strong>${canal.pedidosHoje || state.pedidos.filter((pedido) => pedido.canal === canal.nome).length}</strong></p>
                        <button class="mt-4 w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white px-3 py-2 rounded" data-simular-canal="${canal.nome}">
                            <i class="fas fa-download mr-2"></i>Receber pedido
                        </button>
                    </article>
                `).join('')}
            </div>
        </section>
    `;

    $('#sincronizarCanaisBtn').addEventListener('click', sincronizarCanais);
    document.querySelectorAll('[data-simular-canal]').forEach((button) => button.addEventListener('click', () => simularPedidoCanal(button.dataset.simularCanal)));
}

function renderFidelidade() {
    const clientes = state.clientes.slice().sort((a, b) => (b.pontos || 0) - (a.pontos || 0));
    $('#fidelidadeView').innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            ${metricCard('Clientes fidelizados', clientes.length, 'Base propria do restaurante', 'bg-white dark:bg-gray-800')}
            ${metricCard('Pontos gerados', clientes.reduce((total, cliente) => total + (cliente.pontos || 0), 0), 'Fidelidade por pontos', 'bg-white dark:bg-gray-800')}
            ${metricCard('Cashback aberto', money(clientes.reduce((total, cliente) => total + (cliente.cashback || 0), 0)), 'Para proximos pedidos', 'bg-green-400')}
        </div>
        <section class="premium-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                <div>
                    <h3 class="text-lg font-bold dark:text-white">Cupons, pontos e cashback</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-300">Clientes dos canais proprios acumulam pontos e dinheiro para voltar.</p>
                </div>
                <button id="criarCupomBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                    <i class="fas fa-ticket-alt mr-2"></i>Criar cupom
                </button>
            </div>
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div>
                    <h4 class="font-bold mb-3 dark:text-white">Cupons ativos</h4>
                    ${state.cuponsPromocionais.map((cupom) => `
                        <article class="border dark:border-gray-700 rounded p-3 mb-2 dark:text-white">
                            <strong>${cupom.id}</strong> - ${cupom.tipo} ${cupom.valor}${cupom.tipo === 'percentual' ? '%' : '% cashback'}
                            <br><span class="text-sm text-gray-500 dark:text-gray-300">Usos: ${cupom.usos || 0} - ${cupom.ativo ? 'ativo' : 'pausado'}</span>
                        </article>
                    `).join('')}
                </div>
                <div>
                    <h4 class="font-bold mb-3 dark:text-white">Clientes</h4>
                    ${clientes.length ? clientes.map((cliente) => `
                        <article class="border dark:border-gray-700 rounded p-3 mb-2 dark:text-white">
                            <div class="flex justify-between gap-3">
                                <strong>${cliente.nome}</strong>
                                <span>${cliente.pontos || 0} pts</span>
                            </div>
                            <p class="text-sm text-gray-500 dark:text-gray-300">Cashback: ${money(cliente.cashback || 0)} - Pedidos: ${cliente.pedidos || 0}</p>
                        </article>
                    `).join('') : '<p class="text-gray-500 dark:text-gray-300">Nenhum cliente fidelizado ainda.</p>'}
                </div>
            </div>
        </section>
    `;
    $('#criarCupomBtn').addEventListener('click', criarCupomPromocional);
}

function renderPagamentos() {
    const online = state.pagamentosOnline.slice().reverse();
    $('#pagamentosView').innerHTML = `
        <section class="premium-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                <div>
                    <h3 class="text-lg font-bold dark:text-white">Pagamentos online</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-300">Cielo, PagSeguro e PIX integrados ao fluxo de fechamento.</p>
                </div>
                <button id="simularPagamentoOnlineBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                    <i class="fas fa-bolt mr-2"></i>Simular pagamento
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                ${metricCard('Cielo', 'ativo', 'Cartao de credito/debito', 'bg-white dark:bg-gray-800')}
                ${metricCard('PagSeguro', 'ativo', 'Checkout online', 'bg-white dark:bg-gray-800')}
                ${metricCard('PIX', 'ativo', 'Confirmacao instantanea', 'bg-green-400')}
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead>
                        <tr class="bg-gray-100 dark:bg-gray-700 dark:text-white">
                            <th class="p-3">Data</th><th class="p-3">Gateway</th><th class="p-3">Metodo</th><th class="p-3">Valor</th><th class="p-3">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${online.map((pagamento) => `
                            <tr class="border-b dark:border-gray-700 dark:text-white">
                                <td class="p-3">${new Date(pagamento.dataHora).toLocaleString()}</td>
                                <td class="p-3">${pagamento.gateway}</td>
                                <td class="p-3">${pagamento.metodo}</td>
                                <td class="p-3">${money(pagamento.valor)}</td>
                                <td class="p-3"><span class="status-pill bg-green-100 text-green-700">${pagamento.status}</span></td>
                            </tr>
                        `).join('') || '<tr><td class="p-3 text-gray-500 dark:text-gray-300" colspan="5">Nenhum pagamento online registrado.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </section>
    `;
    $('#simularPagamentoOnlineBtn').addEventListener('click', simularPagamentoOnline);
}

function simularPedidoCanal(canalNome) {
    const produto = state.produtos.find((item) => item.estoqueProdutos > 0) || state.produtos[0];
    if (!produto) return;

    produto.estoqueProdutos = Math.max(0, produto.estoqueProdutos - 1);
    const mesaDelivery = obterMesaDelivery();
    const pagamentoOnline = ['MenuDino', 'iFood', '99Food'].includes(canalNome);
    const metodoPagamento = pagamentoOnline ? (canalNome === 'MenuDino' ? 'PIX Online' : 'Cartao Online') : 'A pagar na entrega';
    const statusPagamento = pagamentoOnline ? 'pago' : 'pendente';
    const pedido = {
        id: Date.now(),
        mesaId: mesaDelivery.id,
        tipo: canalNome === 'Telefone' ? 'balcao' : 'delivery',
        canal: canalNome,
        cliente: `Cliente ${String(Date.now()).slice(-4)}`,
        endereco: canalNome === 'Telefone' ? 'Retirada no balcao' : `Rua das Brasas, ${100 + Math.floor(Math.random() * 80)}`,
        itens: [{ id: produto.id, nome: produto.nome, preco: produto.preco, quantidade: 1 }],
        total: produto.preco,
        metodoPagamento,
        statusPagamento,
        status: 'aguardando',
        dataHora: new Date().toISOString(),
        criadoPor: { nome: canalNome, perfil: 'integracao' }
    };

    state.pedidos.push(pedido);
    if (statusPagamento === 'pago') registrarPagamentoOnlineDoPedido(pedido, metodoPagamento);
    mesaDelivery.status = 'aberta';
    registrarCanal(canalNome);
    atualizarClienteFidelidade(pedido);
    salvarEstado(`Recebeu pedido via ${canalNome}`);
    showToast(`Pedido recebido via ${canalNome}.`, 'success');
    trocarView(canalNome === 'MenuDino' ? 'cardapio' : 'integracoes');
}

function sincronizarCanais() {
    const canaisExternos = ['iFood', '99Food', 'WhatsApp Bot'];
    simularPedidoCanal(canaisExternos[Math.floor(Math.random() * canaisExternos.length)]);
}

function obterMesaDelivery() {
    let mesa = state.mesas.find((item) => item.tipo === 'delivery');
    if (!mesa) {
        const id = state.mesas.length ? Math.max(...state.mesas.map((item) => item.id)) + 1 : 1;
        mesa = { id, nome: 'Delivery', status: 'livre', tipo: 'delivery' };
        state.mesas.push(mesa);
    }
    return mesa;
}

function registrarCanal(canalNome) {
    const canal = state.canais.find((item) => item.nome === canalNome);
    if (canal) canal.pedidosHoje = (canal.pedidosHoje || 0) + 1;
}

function atualizarClienteFidelidade(pedido) {
    if (!pedido.cliente) return;
    let cliente = state.clientes.find((item) => item.nome.toLowerCase() === pedido.cliente.toLowerCase());
    if (!cliente) {
        cliente = { id: Date.now(), nome: pedido.cliente, pontos: 0, cashback: 0, pedidos: 0 };
        state.clientes.push(cliente);
    }
    cliente.pedidos += 1;
    cliente.pontos += Math.floor(pedido.total);
    if (['MenuDino', 'WhatsApp Bot', 'Telefone'].includes(pedido.canal)) {
        cliente.cashback += pedido.total * 0.05;
    }
}

function normalizarStatusPagamento(pedido) {
    if (pedido.statusPagamento) return pedido.statusPagamento;
    if (['PIX Online', 'Cartao Online', 'Cielo Online', 'PagSeguro Online'].includes(pedido.metodoPagamento)) return 'pago';
    return 'pendente';
}

function marcarPedidoPago(pedidoId) {
    const pedido = state.pedidos.find((item) => item.id === pedidoId);
    if (!pedido) return;

    pedido.statusPagamento = 'pago';
    if (!pedido.metodoPagamento || pedido.metodoPagamento === 'A pagar na entrega') {
        pedido.metodoPagamento = 'Pago na entrega';
    }
    registrarPagamentoOnlineDoPedido(pedido, pedido.metodoPagamento);
    salvarEstado(`Marcou pedido #${String(pedido.id).slice(-4)} como pago`);
    showToast(`Pedido #${String(pedido.id).slice(-4)} marcado como pago.`, 'success');
    renderTudo();
}

function registrarPagamentoOnlineDoPedido(pedido, metodoPagamento) {
    const jaRegistrado = state.pagamentosOnline.some((pagamento) => pagamento.pedidoId === pedido.id);
    if (jaRegistrado) return;

    const gateway = metodoPagamento.includes('PagSeguro') ? 'PagSeguro' : metodoPagamento.includes('Cielo') ? 'Cielo' : metodoPagamento.includes('PIX') ? 'PIX' : 'Delivery';
    state.pagamentosOnline.push({
        id: Date.now(),
        pedidoId: pedido.id,
        gateway,
        metodo: metodoPagamento,
        valor: pedido.total,
        status: 'aprovado',
        dataHora: new Date().toISOString()
    });
}

function gerarRotaSmartDelivery() {
    const pedidos = state.pedidos.filter((pedido) => pedido.tipo === 'delivery' && !['entregue', 'fechado'].includes(pedido.status));
    if (!pedidos.length) {
        showToast('Nao ha pedidos delivery para montar rota.', 'warning');
        return;
    }

    const entregador = state.entregadores.find((item) => item.status === 'disponivel') || state.entregadores[0];
    entregador.status = 'em rota';
    entregador.pedidos = pedidos.slice(0, 4).map((pedido) => pedido.id);
    pedidos.slice(0, 4).forEach((pedido, index) => {
        pedido.entregadorId = entregador.id;
        pedido.rota = `${index + 1}a parada - rota otimizada`;
    });
    salvarEstado(`Gerou rota Smart Delivery para ${entregador.nome}`);
    showToast(`Rota criada para ${entregador.nome} com ${entregador.pedidos.length} pedido(s).`, 'success');
    renderTudo();
}

function atribuirEntrega(pedidoId) {
    const pedido = state.pedidos.find((item) => item.id === pedidoId);
    const entregador = state.entregadores.find((item) => item.status === 'disponivel') || state.entregadores[0];
    if (!pedido || !entregador) return;

    entregador.status = 'em rota';
    entregador.pedidos ||= [];
    if (!entregador.pedidos.includes(pedido.id)) entregador.pedidos.push(pedido.id);
    pedido.entregadorId = entregador.id;
    pedido.status = normalizarStatus(pedido.status) === 'aguardando' ? 'em preparo' : pedido.status;
    salvarEstado(`Entregador ${entregador.nome} capturou pedido #${String(pedido.id).slice(-4)}`);
    showToast(`${entregador.nome} capturou o pedido pelo app.`, 'success');
    renderTudo();
}

function criarCupomPromocional() {
    const codigo = prompt('Codigo do cupom:', `CUPOM${state.cuponsPromocionais.length + 1}`);
    if (!codigo) return;
    const valor = Number(prompt('Percentual de desconto:', '10')) || 10;
    state.cuponsPromocionais.push({
        id: codigo.trim().toUpperCase(),
        tipo: 'percentual',
        valor,
        ativo: true,
        usos: 0
    });
    salvarEstado(`Criou cupom ${codigo}`);
    showToast('Cupom promocional criado.', 'success');
    renderFidelidade();
}

function simularPagamentoOnline() {
    const gateways = ['Cielo', 'PagSeguro', 'PIX'];
    const gateway = gateways[Math.floor(Math.random() * gateways.length)];
    const valor = state.pedidos.find((pedido) => pedido.status !== 'fechado')?.total || 49.9;
    state.pagamentosOnline.push({
        id: Date.now(),
        gateway,
        metodo: gateway === 'PIX' ? 'PIX' : 'Cartao online',
        valor,
        status: 'aprovado',
        dataHora: new Date().toISOString()
    });
    salvarEstado(`Pagamento online aprovado via ${gateway}`);
    showToast(`Pagamento aprovado via ${gateway}.`, 'success');
    renderPagamentos();
}

function renderProdutos() {
    $('#produtosView').innerHTML = `
        <div class="premium-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 overflow-x-auto">
            <h3 class="text-lg font-bold mb-4 dark:text-white">Produtos</h3>
            <table class="w-full text-left">
                <thead>
                    <tr class="bg-gray-100 dark:bg-gray-700 dark:text-white">
                        <th class="p-3">Produto</th><th class="p-3">Categoria</th><th class="p-3">Preco</th><th class="p-3">Disponivel para pedidos</th>
                    </tr>
                </thead>
                <tbody>
                    ${state.produtos.map((produto) => `
                        <tr class="border-b dark:border-gray-700 dark:text-white">
                            <td class="p-3">${produto.nome}</td>
                            <td class="p-3">${produto.categoria}</td>
                            <td class="p-3">${money(produto.preco)}</td>
                            <td class="p-3">${produto.estoqueProdutos} ${produto.unidade}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderEstoque() {
    $('#estoqueView').innerHTML = `
        <div class="premium-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 overflow-x-auto">
            <h3 class="text-lg font-bold mb-4 dark:text-white">Estoque operacional</h3>
            <table class="w-full text-left">
                <thead>
                    <tr class="bg-gray-100 dark:bg-gray-700 dark:text-white">
                        <th class="p-3">Item</th><th class="p-3">Estoque</th><th class="p-3">Minimo</th><th class="p-3">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${state.produtos.map((produto) => `
                        <tr class="border-b dark:border-gray-700 dark:text-white">
                            <td class="p-3">${produto.nome}</td>
                            <td class="p-3">${produto.estoqueCozinha} ${produto.unidade}</td>
                            <td class="p-3">${produto.minimo}</td>
                            <td class="p-3">${produto.estoqueCozinha <= produto.minimo ? '<span class="text-red-500 font-bold">baixo</span>' : 'ok'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderFiscal() {
    $('#fiscalView').innerHTML = `
        <div class="premium-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div>
                    <h3 class="text-lg font-bold mb-2 dark:text-white">Fiscal - Dev</h3>
                    <p class="text-gray-600 dark:text-gray-300">Modulo fiscal em desenvolvimento.</p>
                </div>
                <button id="emitirNotaBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                    <i class="fas fa-file-invoice mr-2"></i>Emitir nota
                </button>
            </div>
            <h4 class="font-bold mb-3 dark:text-white">Cupons emitidos</h4>
            ${state.cupons.length ? state.cupons.map((cupom) => `
                <div class="border dark:border-gray-700 rounded p-3 mb-2 dark:text-white">
                    Cupom #${cupom.id} - ${nomeMesa(cupom.mesaId)} - ${money(cupom.total)} - ${new Date(cupom.dataHora).toLocaleString()}
                    <br><span class="text-sm text-gray-500 dark:text-gray-300">Recebido por: ${cupom.recebidoPor?.nome || 'Nao informado'}</span>
                </div>
            `).join('') : '<p class="text-gray-500 dark:text-gray-300">Nenhum cupom emitido.</p>'}
            <h4 class="font-bold mt-6 mb-3 dark:text-white">Notas DEV</h4>
            ${state.notas.length ? state.notas.slice().reverse().map((nota) => `
                <div class="border dark:border-gray-700 rounded p-3 mb-2 dark:text-white">
                    Nota #${nota.id} - ${nomeMesa(nota.mesaId)} - ${money(nota.total)} - ${new Date(nota.dataHora).toLocaleString()}
                    <br><span class="text-sm text-gray-500 dark:text-gray-300">Emitida por: ${nota.emitidaPor?.nome || 'Nao informado'} - status ${nota.status}</span>
                </div>
            `).join('') : '<p class="text-gray-500 dark:text-gray-300">Nenhuma nota DEV emitida.</p>'}
        </div>
    `;

    $('#emitirNotaBtn').addEventListener('click', emitirNotaFiscal);
}

function renderRelatorios() {
    const periodo = getPeriodoRelatorio();
    const pagamentos = state.cupons
        .filter((pagamento) => pagamentoDentroDoPeriodo(pagamento, periodo.inicio, periodo.fim))
        .slice()
        .reverse();
    const totalPagamentos = pagamentos.reduce((total, pagamento) => total + pagamento.total, 0);

    $('#relatoriosView').innerHTML = `
        <section class="premium-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 overflow-x-auto">
            <div class="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-4">
                <div>
                    <h3 class="text-lg font-bold dark:text-white">Relatorio de pagamentos</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-300">Filtre por periodo e baixe o PDF pelo dialogo de impressao.</p>
                </div>
                <div class="flex flex-wrap items-end gap-3">
                    <label class="text-sm dark:text-white">Inicio
                        <input id="relatorioInicio" type="date" value="${periodo.inicio}" class="block mt-1 border rounded px-3 py-2 dark:bg-gray-700 dark:text-white dark:border-gray-600">
                    </label>
                    <label class="text-sm dark:text-white">Fim
                        <input id="relatorioFim" type="date" value="${periodo.fim}" class="block mt-1 border rounded px-3 py-2 dark:bg-gray-700 dark:text-white dark:border-gray-600">
                    </label>
                    <button id="aplicarPeriodoBtn" class="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white px-4 py-2 rounded">
                        <i class="fas fa-filter mr-2"></i>Aplicar
                    </button>
                    <button id="baixarRelatorioPdfBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                        <i class="fas fa-file-pdf mr-2"></i>Baixar PDF
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                ${metricCard('Total recebido', money(totalPagamentos), 'Periodo selecionado', 'bg-white dark:bg-gray-800')}
                ${metricCard('Pagamentos', pagamentos.length, 'Registros encontrados', 'bg-white dark:bg-gray-800')}
                ${metricCard('Ticket medio', money(pagamentos.length ? totalPagamentos / pagamentos.length : 0), 'Media por mesa', 'bg-white dark:bg-gray-800')}
            </div>
            <table id="tabelaRelatorioPagamentos" class="w-full text-left">
                <thead>
                    <tr class="bg-gray-100 dark:bg-gray-700 dark:text-white">
                        <th class="p-3">Mesa</th>
                        <th class="p-3">Data/Hora</th>
                        <th class="p-3">Metodo</th>
                        <th class="p-3">Total</th>
                        <th class="p-3">Produtos</th>
                    </tr>
                </thead>
                <tbody>
                    ${pagamentos.map(renderLinhaPagamento).join('') || '<tr><td class="p-3 text-gray-500 dark:text-gray-300" colspan="5">Nenhum pagamento registrado.</td></tr>'}
                </tbody>
            </table>
        </section>
    `;

    $('#aplicarPeriodoBtn').addEventListener('click', aplicarPeriodoRelatorio);
    $('#baixarRelatorioPdfBtn').addEventListener('click', baixarRelatorioPdf);
}

function renderLinhaRelatorioMesaAberta(mesa) {
    const pedidos = pedidosAbertosDaMesa(mesa.id);
    const primeiroPedido = pedidos[0];
    const data = primeiroPedido ? new Date(primeiroPedido.dataHora) : null;
    const total = pedidos.reduce((soma, pedido) => soma + pedido.total, 0);
    const produtos = agruparItens(pedidos.flatMap((pedido) => pedido.itens));

    return `
        <tr class="border-b dark:border-gray-700 dark:text-white align-top">
            <td class="p-3 font-bold">${mesa.nome}</td>
            <td class="p-3">${data ? data.toLocaleTimeString() : '-'}</td>
            <td class="p-3">${data ? data.toLocaleDateString() : '-'}</td>
            <td class="p-3">${money(total)}</td>
            <td class="p-3 text-sm">${produtos || 'Sem produtos'}</td>
        </tr>
    `;
}

function renderLinhaPagamento(pagamento) {
    return `
        <tr class="border-b dark:border-gray-700 dark:text-white align-top">
            <td class="p-3 font-bold">${nomeMesa(pagamento.mesaId)}</td>
            <td class="p-3">${new Date(pagamento.dataHora).toLocaleString()}</td>
            <td class="p-3">${pagamento.metodoPagamento}</td>
            <td class="p-3">${money(pagamento.total)}</td>
            <td class="p-3 text-sm">${agruparItens(pagamento.pedidos.flatMap((pedido) => pedido.itens))}</td>
        </tr>
    `;
}

function getPeriodoRelatorio() {
    const hoje = new Date().toISOString().slice(0, 10);
    return {
        inicio: state.config.relatorioInicio || hoje,
        fim: state.config.relatorioFim || hoje
    };
}

function pagamentoDentroDoPeriodo(pagamento, inicio, fim) {
    const data = new Date(pagamento.dataHora).toISOString().slice(0, 10);
    return data >= inicio && data <= fim;
}

function aplicarPeriodoRelatorio() {
    state.config.relatorioInicio = $('#relatorioInicio').value;
    state.config.relatorioFim = $('#relatorioFim').value;
    salvarEstado('Alterou periodo do relatorio');
    renderRelatorios();
    showToast('Periodo do relatorio atualizado.', 'success');
}

function baixarRelatorioPdf() {
    const periodo = getPeriodoRelatorio();
    const pagamentos = state.cupons
        .filter((pagamento) => pagamentoDentroDoPeriodo(pagamento, periodo.inicio, periodo.fim))
        .slice()
        .reverse();
    const totalPagamentos = pagamentos.reduce((total, pagamento) => total + pagamento.total, 0);

    const janela = window.open('', '_blank');
    if (!janela) {
        showToast('Permita pop-ups para baixar o PDF.', 'warning');
        return;
    }

    janela.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Relatorio de pagamentos</title>
            <style>
                body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
                h1 { margin: 0 0 6px; }
                p { margin: 0 0 18px; color: #475569; }
                table { width: 100%; border-collapse: collapse; margin-top: 18px; }
                th, td { border-bottom: 1px solid #d1d5db; padding: 10px; text-align: left; vertical-align: top; }
                th { background: #eff6ff; color: #1e40af; }
                .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 18px; }
                .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; }
                .card span { display: block; color: #64748b; font-size: 12px; }
                .card strong { display: block; font-size: 20px; margin-top: 6px; }
            </style>
        </head>
        <body>
            <h1>Relatorio de pagamentos</h1>
            <p>Periodo: ${periodo.inicio} ate ${periodo.fim}</p>
            <div class="summary">
                <div class="card"><span>Total recebido</span><strong>${money(totalPagamentos)}</strong></div>
                <div class="card"><span>Pagamentos</span><strong>${pagamentos.length}</strong></div>
                <div class="card"><span>Ticket medio</span><strong>${money(pagamentos.length ? totalPagamentos / pagamentos.length : 0)}</strong></div>
            </div>
            <table>
                <thead>
                    <tr><th>Mesa</th><th>Data/Hora</th><th>Metodo</th><th>Total</th><th>Produtos</th></tr>
                </thead>
                <tbody>
                    ${pagamentos.map((pagamento) => `
                        <tr>
                            <td>${nomeMesa(pagamento.mesaId)}</td>
                            <td>${new Date(pagamento.dataHora).toLocaleString()}</td>
                            <td>${pagamento.metodoPagamento}</td>
                            <td>${money(pagamento.total)}</td>
                            <td>${agruparItens(pagamento.pedidos.flatMap((pedido) => pedido.itens))}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="5">Nenhum pagamento registrado.</td></tr>'}
                </tbody>
            </table>
            <script>
                window.addEventListener('load', () => {
                    window.print();
                });
            <\/script>
        </body>
        </html>
    `);
    janela.document.close();
    showToast('Relatorio aberto para salvar em PDF.', 'success');
}

function abrirPedidosMesa(id) {
    mesaPedidosDetalhe = id;
    const mesa = state.mesas.find((item) => item.id === id);
    const pedidos = pedidosAbertosDaMesa(id);

    $('#tituloPedidosMesa').textContent = mesa?.nome || `Mesa ${id}`;
    $('#conteudoPedidosMesa').innerHTML = pedidos.length ? pedidos.slice().reverse().map((pedido) => `
        <article class="floating-card border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-3">
                <div>
                    <h4 class="text-lg font-bold dark:text-white">Pedido #${String(pedido.id).slice(-4)}</h4>
                    <p class="text-sm text-gray-500 dark:text-gray-300">${new Date(pedido.dataHora).toLocaleString()}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Lancado por: ${pedido.criadoPor?.nome || 'Nao informado'}</p>
                </div>
                <div class="flex items-center gap-2">
                    <span class="status-pill bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200">${STATUS_LABELS[normalizarStatus(pedido.status)] || pedido.status}</span>
                    <strong class="dark:text-white">${money(pedido.total)}</strong>
                </div>
            </div>
            <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm dark:text-white">
                ${pedido.itens.map((item) => `<li class="border dark:border-gray-700 rounded p-2">${item.quantidade}x ${item.nome}<br><span class="text-gray-500 dark:text-gray-300">${money(item.preco * item.quantidade)}</span></li>`).join('')}
            </ul>
        </article>
    `).join('') : '<p class="text-gray-500 dark:text-gray-300">Nenhum pedido aberto para esta mesa.</p>';

    $('#modalPedidosMesa').classList.remove('hidden');
    $('#modalPedidosMesa').classList.add('flex');
}

function fecharModalPedidosMesa() {
    mesaPedidosDetalhe = null;
    $('#modalPedidosMesa').classList.add('hidden');
    $('#modalPedidosMesa').classList.remove('flex');
}

function abrirNovoPedido() {
    if (!mesaAtual) {
        showToast('Selecione uma mesa antes de criar um novo pedido.', 'warning');
        trocarView('mesas');
        return;
    }

    const mesa = state.mesas.find((item) => item.id === mesaAtual);
    if (!mesa) {
        showToast('Mesa selecionada nao encontrada.', 'danger');
        return;
    }

    mesa.status = 'aberta';
    carrinhoAtual = [];
    $('#categoriaSelect').innerHTML = categorias.map((categoria) => `<option value="${categoria}">${categoria}</option>`).join('');
    $('#buscaProduto').value = '';
    $('#canalPedido').value = viewAtual === 'cardapio' ? 'MenuDino' : viewAtual === 'integracoes' ? 'iFood' : 'PDV';
    $('#clientePedido').value = '';
    $('#enderecoPedido').value = mesa.nome;
    $('#pagamentoPedido').value = viewAtual === 'cardapio' ? 'PIX Online' : 'A pagar na entrega';
    $('#statusPagamentoPedido').value = viewAtual === 'cardapio' ? 'pago' : 'pendente';
    $('#modalPedido').classList.remove('hidden');
    $('#modalPedido').classList.add('flex');
    renderProdutosPedido();
    renderCarrinho();
}

function fecharNovoPedido() {
    $('#modalPedido').classList.add('hidden');
    $('#modalPedido').classList.remove('flex');
}

function renderProdutosPedido() {
    const categoria = $('#categoriaSelect').value || 'Todas';
    const busca = $('#buscaProduto').value.trim().toLowerCase();
    const produtos = (categoria === 'Todas' ? state.produtos : state.produtos.filter((produto) => produto.categoria === categoria))
        .filter((produto) => !busca || produto.nome.toLowerCase().includes(busca) || produto.categoria.toLowerCase().includes(busca));

    $('#produtosPedidoContainer').innerHTML = produtos.map((produto) => `
        <article class="floating-card border dark:border-gray-700 rounded p-4">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <h4 class="font-bold dark:text-white">${produto.nome}</h4>
                    <p class="text-sm text-gray-500 dark:text-gray-300">${produto.categoria}</p>
                </div>
                <span class="status-pill bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200">${produto.estoqueProdutos}</span>
            </div>
            <div class="stock-meter my-3"><span style="width: ${Math.min(100, (produto.estoqueProdutos / Math.max(produto.minimo * 3, 1)) * 100)}%"></span></div>
            <p class="font-bold my-2 dark:text-white">${money(produto.preco)}</p>
            <button class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded w-full" data-produto="${produto.id}" ${produto.estoqueProdutos <= 0 ? 'disabled' : ''}>
                <i class="fas fa-plus mr-2"></i>Adicionar
            </button>
        </article>
    `).join('') || '<p class="text-gray-500 dark:text-gray-300">Nenhum produto encontrado.</p>';

    document.querySelectorAll('[data-produto]').forEach((button) => button.addEventListener('click', () => adicionarProduto(Number(button.dataset.produto))));
}

function adicionarProduto(produtoId) {
    const produto = state.produtos.find((item) => item.id === produtoId);
    const item = carrinhoAtual.find((linha) => linha.id === produtoId);
    const quantidadeAtual = item?.quantidade || 0;

    if (quantidadeAtual + 1 > produto.estoqueProdutos) {
        showToast('Quantidade indisponivel para pedido.', 'warning');
        return;
    }

    if (item) item.quantidade += 1;
    else carrinhoAtual.push({ id: produto.id, nome: produto.nome, preco: produto.preco, quantidade: 1 });

    renderCarrinho();
    showToast(`${produto.nome} adicionado ao pedido.`, 'success');
}

function renderCarrinho() {
    $('#carrinhoPedido').innerHTML = carrinhoAtual.length ? carrinhoAtual.map((item) => `
        <div class="flex justify-between gap-3 text-sm dark:text-white">
            <span>${item.quantidade}x ${item.nome}</span>
            <button class="text-red-500" data-remover="${item.id}">remover</button>
        </div>
    `).join('') : '<p class="text-gray-500 dark:text-gray-300">Nenhum item.</p>';

    $('#totalPedido').textContent = money(carrinhoAtual.reduce((soma, item) => soma + item.preco * item.quantidade, 0));
    document.querySelectorAll('[data-remover]').forEach((button) => button.addEventListener('click', () => removerProduto(Number(button.dataset.remover))));
}

function removerProduto(produtoId) {
    const item = carrinhoAtual.find((linha) => linha.id === produtoId);
    if (!item) return;
    item.quantidade -= 1;
    if (item.quantidade <= 0) carrinhoAtual = carrinhoAtual.filter((linha) => linha.id !== produtoId);
    renderCarrinho();
}

function confirmarPedido() {
    if (!carrinhoAtual.length) {
        showToast('Adicione itens ao pedido.', 'warning');
        return;
    }

    carrinhoAtual.forEach((item) => {
        const produto = state.produtos.find((linha) => linha.id === item.id);
        produto.estoqueProdutos -= item.quantidade;
    });

    const canal = $('#canalPedido').value || 'PDV';
    const cliente = $('#clientePedido').value.trim();
    const endereco = $('#enderecoPedido').value.trim();
    const metodoPagamento = $('#pagamentoPedido').value || 'A pagar na entrega';
    const statusPagamento = $('#statusPagamentoPedido').value || normalizarStatusPagamento({ metodoPagamento });
    const total = carrinhoAtual.reduce((soma, item) => soma + item.preco * item.quantidade, 0);
    const pedido = {
        id: Date.now(),
        mesaId: mesaAtual,
        itens: carrinhoAtual,
        total,
        canal,
        cliente,
        endereco,
        metodoPagamento,
        statusPagamento,
        tipo: ['MenuDino', 'iFood', '99Food', 'WhatsApp Bot'].includes(canal) ? 'delivery' : 'salao',
        status: 'aguardando',
        dataHora: new Date().toISOString(),
        criadoPor: currentUser
    };

    state.pedidos.push(pedido);
    if (statusPagamento === 'pago') registrarPagamentoOnlineDoPedido(pedido, metodoPagamento);
    registrarCanal(canal);
    atualizarClienteFidelidade(pedido);

    salvarEstado(`Criou pedido na ${nomeMesa(mesaAtual)}`);
    fecharNovoPedido();
    showToast('Pedido enviado para a cozinha.', 'success');
    trocarView('pedidos');
}

function avancarStatusPedido(pedidoId) {
    const pedido = state.pedidos.find((item) => item.id === pedidoId);
    if (!pedido || ['entregue', 'fechado'].includes(normalizarStatus(pedido.status))) return;

    const statusAtual = normalizarStatus(pedido.status);
    const proximoStatus = STATUS_FLUXO[STATUS_FLUXO.indexOf(statusAtual) + 1] || 'entregue';
    pedido.status = proximoStatus;

    if (proximoStatus === 'entregue' && !pedido.estoqueBaixado) {
        pedido.itens.forEach((item) => {
            const produto = state.produtos.find((linha) => linha.id === item.id);
            produto.estoqueCozinha = Math.max(0, produto.estoqueCozinha - item.quantidade);
        });
        pedido.estoqueBaixado = true;
    }

    salvarEstado(`Avancou pedido #${String(pedido.id).slice(-4)} para ${STATUS_LABELS[proximoStatus]}`);
    showToast(`Pedido #${String(pedido.id).slice(-4)} agora esta ${STATUS_LABELS[proximoStatus]}.`, 'success');
    renderTudo();
}

function cadastrarMesa() {
    const numero = state.mesas.length ? Math.max(...state.mesas.map((mesa) => mesa.id)) + 1 : 1;
    state.mesas.push({ id: numero, nome: `Mesa ${String(numero).padStart(2, '0')}`, status: 'livre' });
    mesaAtual = numero;
    salvarEstado(`Cadastrou ${nomeMesa(numero)}`);
    showToast(`Mesa ${String(numero).padStart(2, '0')} cadastrada.`, 'success');
    renderTudo();
}

function editarMesa(id) {
    const mesa = state.mesas.find((item) => item.id === id);
    const nome = prompt('Nome da mesa:', mesa.nome);
    if (!nome) return;
    mesa.nome = nome.trim();
    salvarEstado(`Editou ${mesa.nome}`);
    showToast('Mesa atualizada.', 'success');
    renderTudo();
}

function excluirMesa(id) {
    const temPedidos = state.pedidos.some((pedido) => pedido.mesaId === id);
    if (temPedidos) {
        showToast('Nao e possivel excluir mesa com pedidos registrados.', 'warning');
        return;
    }

    state.mesas = state.mesas.filter((mesa) => mesa.id !== id);
    if (mesaAtual === id) mesaAtual = state.mesas[0]?.id || null;
    salvarEstado(`Excluiu mesa ${id}`);
    showToast('Mesa excluida.', 'success');
    renderTudo();
}

function abrirFechamento(id) {
    mesaFechamento = id;
    renderResumoFechamento();
    $('#modalFecharMesa').classList.remove('hidden');
    $('#modalFecharMesa').classList.add('flex');
}

function fecharModalFechamento() {
    $('#modalFecharMesa').classList.add('hidden');
    $('#modalFecharMesa').classList.remove('flex');
}

function calcularFechamento() {
    const pedidos = pedidosAbertosDaMesa(mesaFechamento);
    const subtotal = pedidos.reduce((soma, pedido) => soma + pedido.total, 0);
    const cover = $('#incluirCover').checked ? COVER_VALUE : 0;
    const servico = $('#incluirServico').checked ? subtotal * 0.1 : 0;
    return { pedidos, subtotal, cover, servico, total: subtotal + cover + servico };
}

function renderResumoFechamento() {
    if (!mesaFechamento) return;
    const fechamento = calcularFechamento();
    $('#resumoFechamento').innerHTML = `
        <p>Subtotal: <strong>${money(fechamento.subtotal)}</strong></p>
        <p>Taxa de cover: <strong>${fechamento.cover ? 'sim' : 'nao'} (${money(fechamento.cover)})</strong></p>
        <p>10%: <strong>${fechamento.servico ? 'sim' : 'nao'} (${money(fechamento.servico)})</strong></p>
        <p class="text-lg mt-2">Total: <strong>${money(fechamento.total)}</strong></p>
    `;
}

function imprimirConferenciaMesa() {
    const fechamento = calcularFechamento();

    if (!fechamento.pedidos.length) {
        showToast('Nao ha pedidos para imprimir nesta mesa.', 'warning');
        return;
    }

    gravarDadosRecibo(fechamento, {
        metodoPagamento: 'A definir',
        observacoes: $('#observacoes').value,
        tipo: 'conferencia'
    });

    window.open('recibo.html', '_blank');
    showToast('Recibo de conferencia gerado. A mesa continua aberta.', 'success');
}

function confirmarPagamentoMesa(event) {
    event.preventDefault();
    const fechamento = calcularFechamento();

    if (!fechamento.pedidos.length) {
        showToast('Nao ha pedidos para fechar esta mesa.', 'warning');
        return;
    }

    const cupom = {
        id: Date.now(),
        mesaId: mesaFechamento,
        pedidos: fechamento.pedidos,
        subtotal: fechamento.subtotal,
        cover: fechamento.cover,
        servico: fechamento.servico,
        total: fechamento.total,
        metodoPagamento: $('#metodoPagamento').value,
        observacoes: $('#observacoes').value,
        dataHora: new Date().toISOString(),
        recebidoPor: currentUser
    };

    state.cupons.push(cupom);
    if (['Cielo Online', 'PagSeguro Online', 'PIX Online'].includes(cupom.metodoPagamento)) {
        state.pagamentosOnline.push({
            id: cupom.id,
            cupomId: cupom.id,
            gateway: cupom.metodoPagamento.replace(' Online', ''),
            metodo: cupom.metodoPagamento.includes('PIX') ? 'PIX' : 'Cartao online',
            valor: cupom.total,
            status: 'aprovado',
            dataHora: cupom.dataHora
        });
    }
    fechamento.pedidos.forEach((pedido) => {
        pedido.status = 'fechado';
        pedido.cupomId = cupom.id;
    });
    const mesa = state.mesas.find((item) => item.id === mesaFechamento);
    mesa.status = 'livre';
    salvarEstado(`Registrou pagamento e fechou ${nomeMesa(mesaFechamento)}`);

    fecharModalFechamento();
    showToast('Pagamento registrado. Mesa fechada.', 'success');
    trocarView('relatorios');
}

function gravarDadosRecibo(fechamento, extras = {}) {
    localStorage.setItem('dadosRecibo', JSON.stringify({
        numeroMesa: nomeMesa(mesaFechamento),
        metodoPagamento: extras.metodoPagamento || $('#metodoPagamento').value,
        observacoes: extras.observacoes || '',
        tipo: extras.tipo || 'pagamento',
        carrinho: fechamento.pedidos.flatMap((pedido) => pedido.itens),
        subtotal: fechamento.subtotal,
        servico: fechamento.servico,
        cover: fechamento.cover,
        total: fechamento.total,
        pagamentosParciais: []
    }));
}

function emitirNotaFiscal() {
    const ultimoCupom = state.cupons.at(-1);
    if (!ultimoCupom) {
        showToast('Nao ha pagamento registrado para emitir nota.', 'warning');
        return;
    }

    const nota = {
        id: Date.now(),
        cupomId: ultimoCupom.id,
        mesaId: ultimoCupom.mesaId,
        total: ultimoCupom.total,
        status: 'dev',
        emitidaPor: currentUser,
        dataHora: new Date().toISOString()
    };

    state.notas.push(nota);
    salvarEstado(`Emitiu nota DEV do cupom #${ultimoCupom.id}`);
    showToast('Nota DEV emitida e sincronizada no painel.', 'success');
    renderFiscal();
}

function nomeMesa(id) {
    return state.mesas.find((mesa) => mesa.id === id)?.nome || `Mesa ${id}`;
}

function agruparItens(itens) {
    const grupos = new Map();
    itens.forEach((item) => {
        const atual = grupos.get(item.nome) || 0;
        grupos.set(item.nome, atual + item.quantidade);
    });

    return [...grupos.entries()].map(([nome, quantidade]) => `${quantidade}x ${nome}`).join(', ');
}

function pedidosAbertosDaMesa(mesaId) {
    return state.pedidos.filter((pedido) => pedido.mesaId === mesaId && pedido.status !== 'fechado');
}

function vincularAcoesDePedido() {
    document.querySelectorAll('[data-avancar-status]').forEach((button) => {
        button.addEventListener('click', () => avancarStatusPedido(Number(button.dataset.avancarStatus)));
    });
}

function normalizarStatus(status) {
    if (status === 'preparando') return 'em preparo';
    return status;
}

function showToast(message, type = 'success') {
    const stack = $('#toastStack');
    if (!stack) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    stack.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 180);
    }, 2600);
}
