document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado. Iniciando processo de renderização do recibo.');

    const reciboContent = document.getElementById('reciboContent');
    console.log('Elemento reciboContent:', reciboContent);

    const dadosReciboString = localStorage.getItem('dadosRecibo');
    console.log('Dados do recibo (string):', dadosReciboString);

    if (dadosReciboString) {
        try {
            const reciboData = JSON.parse(dadosReciboString);
            console.log('Dados do recibo (objeto):', reciboData);

            const recibo = `
                <h1 class="text-2xl font-bold mb-4 text-gray-800">Recibo - Mesa ${reciboData.numeroMesa}</h1>
                <p class="mb-2 text-gray-600"><strong>Data e Hora:</strong> ${new Date().toLocaleString()}</p>
                <p class="mb-2 text-gray-600"><strong>Método de Pagamento:</strong> ${reciboData.metodoPagamento}</p>
                
                <h2 class="text-xl font-semibold mt-4 mb-2 text-gray-700">Itens Consumidos</h2>
                <table class="w-full mb-4 bg-gray-50 rounded-lg">
                    <thead>
                        <tr class="bg-gray-200 text-gray-600">
                            <th class="text-left p-2">Item</th>
                            <th class="text-right p-2">Qtd</th>
                            <th class="text-right p-2">Preço</th>
                            <th class="text-right p-2">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reciboData.carrinho.map(item => `
                            <tr class="border-b">
                                <td class="p-2 text-gray-700">${item.nome}</td>
                                <td class="text-right p-2 text-gray-700">${item.quantidade}</td>
                                <td class="text-right p-2 text-gray-700">R$ ${item.preco.toFixed(2)}</td>
                                <td class="text-right p-2 text-gray-700">R$ ${(item.preco * item.quantidade).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="mt-4">
                    <p class="text-gray-700"><strong>Subtotal:</strong> R$ ${reciboData.subtotal.toFixed(2)}</p>
                    ${reciboData.servico > 0 ? `<p class="text-gray-700"><strong>Serviço (10%):</strong> R$ ${reciboData.servico.toFixed(2)}</p>` : ''}
                    <p class="text-xl font-bold mt-2 text-gray-800"><strong>Total:</strong> R$ ${reciboData.total.toFixed(2)}</p>
                </div>

                ${reciboData.observacoes ? `
                    <h2 class="text-xl font-semibold mt-4 mb-2 text-gray-700">Observações</h2>
                    <p class="text-gray-600">${reciboData.observacoes}</p>
                ` : ''}
            `;

            console.log('HTML do recibo gerado:', recibo);
            reciboContent.innerHTML = recibo;
            console.log('HTML inserido no elemento reciboContent.');
        } catch (error) {
            console.error('Erro ao fazer parse dos dados do recibo:', error);
            reciboContent.innerHTML = '<p class="text-red-500">Erro: Dados do recibo não encontrados ou inválidos.</p>';
        }
    } else {
        console.error('Dados do recibo não encontrados.');
        reciboContent.innerHTML = '<p class="text-red-500">Erro: Dados do recibo não encontrados.</p>';
    }

    const imprimirReciboBtn = document.getElementById('imprimirRecibo');
    if (imprimirReciboBtn) {
        imprimirReciboBtn.addEventListener('click', () => {
            console.log('Botão de impressão clicado.');
            window.print();
        });
    } else {
        console.error('Botão de impressão não encontrado.');
    }

    // Limpar os dados do recibo do localStorage após a renderização
    localStorage.removeItem('dadosRecibo');
    console.log('Dados do recibo removidos do localStorage.');
});
