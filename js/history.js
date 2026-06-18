let historicoMesas = [];

export function adicionarAoHistorico(dadosMesa) {
    historicoMesas.push({
        ...dadosMesa,
        dataHora: new Date().toISOString()
    });
    salvarHistorico();
}

function salvarHistorico() {
    localStorage.setItem('historicoMesas', JSON.stringify(historicoMesas));
}

function carregarHistorico() {
    const historico = localStorage.getItem('historicoMesas');
    if (historico) {
        historicoMesas = JSON.parse(historico);
    }
}

export function renderizarHistorico() {
    carregarHistorico();
    const historicoContainer = document.getElementById('historicoContainer');
    if (!historicoContainer) return;

    historicoContainer.innerHTML = `
        <h2 class="text-2xl font-bold mb-4 dark:text-white">Histórico de Mesas</h2>
        <table class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <thead>
                <tr class="bg-gray-200 dark:bg-gray-700">
                    <th class="p-2 text-left dark:text-white">Mesa</th>
                    <th class="p-2 text-left dark:text-white">Data/Hora</th>
                    <th class="p-2 text-left dark:text-white">Total</th>
                    <th class="p-2 text-left dark:text-white">Método de Pagamento</th>
                    <th class="p-2 text-left dark:text-white">Itens</th>
                </tr>
            </thead>
            <tbody>
                ${historicoMesas.map(mesa => `
                    <tr class="border-b dark:border-gray-700">
                        <td class="p-2 dark:text-white">${mesa.numeroMesa}</td>
                        <td class="p-2 dark:text-white">${new Date(mesa.dataHora).toLocaleString()}</td>
                        <td class="p-2 dark:text-white">R$ ${mesa.total.toFixed(2)}</td>
                        <td class="p-2 dark:text-white">${mesa.metodoPagamento}</td>
                        <td class="p-2 dark:text-white">
                            <ul>
                                ${mesa.carrinho.map(item => `
                                    <li>${item.nome} (${item.quantidade}x)</li>
                                `).join('')}
                            </ul>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}