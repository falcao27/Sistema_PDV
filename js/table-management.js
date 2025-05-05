import { adicionarAoHistorico } from './history.js';

let mesas = {};
let fecharMesaCallback = null;

export function setFecharMesaCallback(callback) {
    fecharMesaCallback = callback;
}

export function abrirMesa(numeroMesa) {
    if (!mesas[numeroMesa]) {
        mesas[numeroMesa] = { carrinho: [], totalAbatido: 0, pagamentosParciais: [] };
    }
    renderTabs();
    return numeroMesa;
}

export function fecharMesa(numeroMesa) {
    if (fecharMesaCallback) {
        fecharMesaCallback(numeroMesa);
    }
}

export function adicionarAoCarrinho(produto, quantidade, numeroMesa) {
    const mesa = mesas[numeroMesa];
    const itemExistente = mesa.carrinho.find(item => item.id === produto.id);
    if (itemExistente) {
        itemExistente.quantidade += quantidade;
    } else {
        mesa.carrinho.push({ ...produto, quantidade: quantidade });
    }
    renderTabs();
}

export function calcularTotal(carrinho) {
    return carrinho.reduce((total, item) => total + item.preco * item.quantidade, 0).toFixed(2);
}

export function renderTabs() {
    const tabsList = document.getElementById('tabsList');
    const tabsContent = document.getElementById('tabsContent');
    tabsList.innerHTML = '';
    tabsContent.innerHTML = '';

    if (Object.keys(mesas).length === 0) {
        tabsContent.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Nenhuma mesa aberta. Abra uma mesa para começar.</p>';
        return;
    }

    Object.keys(mesas).forEach(numeroMesa => {
        const tabButton = document.createElement('button');
        tabButton.textContent = `Mesa ${numeroMesa}`;
        tabButton.className = 'px-4 py-2 rounded-t-lg focus:outline-none';
        tabButton.classList.add('bg-gray-200', 'hover:bg-gray-300', 'dark:bg-gray-700', 'dark:hover:bg-gray-600', 'dark:text-white');
        tabButton.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('bg-white', 'dark:bg-gray-800'));
            tabButton.classList.remove('bg-gray-200', 'dark:bg-gray-700');
            tabButton.classList.add('bg-white', 'dark:bg-gray-800');
            renderMesaContent(numeroMesa);
        });            
        tabsList.appendChild(tabButton);
    });

    const firstMesaButton = tabsList.firstChild;
    if (firstMesaButton) {
        firstMesaButton.click();
    }
}

export function renderMesaContent(numeroMesa) {
    const tabsContent = document.getElementById('tabsContent');
    tabsContent.innerHTML = '';

    const mesa = mesas[numeroMesa];
    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-6';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'flex justify-between items-center mb-4';
    cardHeader.innerHTML = `
        <h3 class="text-xl font-semibold dark:text-white">Mesa ${numeroMesa}</h3>
        <button id="verCatalogoBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
            <i class="fas fa-book-open mr-2"></i>Ver Catálogo
        </button>
    `;
    card.appendChild(cardHeader);

    const table = document.createElement('table');
    table.className = 'w-full mb-4';
    table.innerHTML = `
        <thead>
            <tr class="bg-gray-100 dark:bg-gray-700">
                <th class="text-left py-2 px-4 dark:text-white">Item</th>
                <th class="text-right py-2 px-4 dark:text-white">Qtd</th>
                <th class="text-right py-2 px-4 dark:text-white">Preço</th>
                <th class="text-right py-2 px-4 dark:text-white">Subtotal</th>
            </tr>
        </thead>
    `;
    const tbody = document.createElement('tbody');
    mesa.carrinho.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'border-b dark:border-gray-700';
        tr.innerHTML = `
            <td class="py-2 px-4 dark:text-white">${item.nome}</td>
            <td class="text-right py-2 px-4 dark:text-white">${item.quantidade}</td>
            <td class="text-right py-2 px-4 dark:text-white">R$ ${item.preco.toFixed(2)}</td>
            <td class="text-right py-2 px-4 dark:text-white">R$ ${(item.preco * item.quantidade).toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    card.appendChild(table);

    const totalDiv = document.createElement('div');
    totalDiv.className = 'font-bold mt-4 text-right dark:text-white';
    totalDiv.innerHTML = `
        <p>Total: R$ ${calcularTotal(mesa.carrinho)}</p>
        <p>Total Abatido: R$ ${mesa.totalAbatido.toFixed(2)}</p>
        <p>Pendente: R$ ${(parseFloat(calcularTotal(mesa.carrinho)) - mesa.totalAbatido).toFixed(2)}</p>
    `;
    card.appendChild(totalDiv);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-between mt-6';

    const pagamentoParcialBtn = document.createElement('button');
    pagamentoParcialBtn.textContent = 'Pagamento Parcial';
    pagamentoParcialBtn.className = 'bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded';
    pagamentoParcialBtn.innerHTML = '<i class="fas fa-money-bill-wave mr-2"></i>Pagamento Parcial';
    pagamentoParcialBtn.addEventListener('click', () => window.abrirModalPagamentoParcial(numeroMesa));

    const fecharMesaBtn = document.createElement('button');
    fecharMesaBtn.textContent = `Fechar Mesa ${numeroMesa}`;
    fecharMesaBtn.className = 'bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded';
    fecharMesaBtn.innerHTML = `<i class="fas fa-door-closed mr-2"></i>Fechar Mesa ${numeroMesa}`;
    fecharMesaBtn.addEventListener('click', () => fecharMesa(numeroMesa));

    buttonContainer.appendChild(pagamentoParcialBtn);
    buttonContainer.appendChild(fecharMesaBtn);
    card.appendChild(buttonContainer);

    tabsContent.appendChild(card);

    document.getElementById('verCatalogoBtn').addEventListener('click', () => window.abrirModal(numeroMesa));
}

export function abaterValorParcial(numeroMesa, valor) {
    const mesa = mesas[numeroMesa];
    mesa.pagamentosParciais.push(valor);
    mesa.totalAbatido = (mesa.totalAbatido || 0) + valor;
    renderTabs();
    renderResumoPagamentoParcial(numeroMesa);
}

export function renderResumoPagamentoParcial(numeroMesa) {
    const mesa = mesas[numeroMesa];
    const resumoPagamentoParcial = document.getElementById('resumoPagamentoParcial');
    const totalInicial = calcularTotal(mesa.carrinho);
    const totalAbatido = mesa.totalAbatido.toFixed(2);
    const totalRestante = (parseFloat(totalInicial) - mesa.totalAbatido).toFixed(2);
    const pagamentosDetalhes = mesa.pagamentosParciais.map((valor, index) => `Pagamento ${index + 1}: R$ ${valor.toFixed(2)}`).join('<br>');

    resumoPagamentoParcial.innerHTML = `
    <h3>Resumo do Pagamento Parcial</h3>
    <p>Total Inicial: R$ ${totalInicial}</p>
    <p>${pagamentosDetalhes}</p>
    <p>Total Abatido: R$ ${totalAbatido}</p>
    <p>Total Pendente: R$ ${totalRestante}</p>
    `;
}

export function finalizarPedido(numeroMesa, metodoPagamento, observacoes, incluirServico) {
    const mesa = mesas[numeroMesa];
    let total = parseFloat(calcularTotal(mesa.carrinho));
    let servico = 0;

    if (incluirServico) {
        servico = total * 0.10;
        total += servico;
    }

    const dadosRecibo = {
        numeroMesa,
        metodoPagamento,
        observacoes,
        carrinho: mesa.carrinho,
        subtotal: parseFloat(calcularTotal(mesa.carrinho)),
        total,
        servico,
        pagamentosParciais: mesa.pagamentosParciais
    };

    adicionarAoHistorico(dadosRecibo);

    localStorage.setItem('dadosRecibo', JSON.stringify(dadosRecibo));
    sessionStorage.setItem('dadosRecibo', JSON.stringify(dadosRecibo));

    window.open('recibo.html', '_blank');
    delete mesas[numeroMesa];
    renderTabs();
}