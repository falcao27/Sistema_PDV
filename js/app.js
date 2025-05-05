import { produtos, renderProdutos } from './products.js';
import { 
    abrirMesa, 
    fecharMesa, 
    adicionarAoCarrinho, 
    calcularTotal, 
    renderTabs, 
    abaterValorParcial, 
    renderResumoPagamentoParcial, 
    finalizarPedido,
    setFecharMesaCallback
} from './table-management.js';
import { renderizarHistorico } from './history.js';

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('loggedIn') !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    let mesaAtual = null;

    const mesaInput = document.getElementById('mesaInput');
    const abrirMesaBtn = document.getElementById('abrirMesaBtn');
    const filtroSelect = document.getElementById('filtroSelect');
    const mesasContainer = document.getElementById('mesasContainer');
    const historicoContainer = document.getElementById('historicoContainer');
    const modal = document.getElementById('modal');
    const closeModal = document.getElementById('closeModal');
    const modalPagamento = document.getElementById('modalPagamento');
    const closeModalPagamento = document.getElementById('closeModalPagamento');
    const modalPagamentoParcial = document.getElementById('modalPagamentoParcial');
    const closeModalPagamentoParcial = document.getElementById('closeModalPagamentoParcial');
    const categoriaSelect = document.getElementById('categoriaSelect');
    const formPagamento = document.getElementById('formPagamento');
    const formPagamentoParcial = document.getElementById('formPagamentoParcial');

    modal.style.display = 'none';
    modalPagamento.style.display = 'none';
    modalPagamentoParcial.style.display = 'none';

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('loggedIn');
        window.location.href = 'login.html';
    });

    abrirMesaBtn.addEventListener('click', () => {
        const numeroMesa = parseInt(mesaInput.value, 10);
        if (!isNaN(numeroMesa) && numeroMesa > 0 && numeroMesa <= 99) {
            mesaAtual = abrirMesa(numeroMesa);
            filtroSelect.value = 'mesas';
            atualizarVisualizacao();
        } else {
            alert("Por favor, insira um número de mesa válido (1-99).");
        }
    });

    filtroSelect.addEventListener('change', atualizarVisualizacao);

    function atualizarVisualizacao() {
        if (filtroSelect.value === 'mesas') {
            mesasContainer.classList.remove('hidden');
            historicoContainer.classList.add('hidden');
            renderTabs();
        } else {
            mesasContainer.classList.add('hidden');
            historicoContainer.classList.remove('hidden');
            renderizarHistorico();
        }
    }

    closeModal.addEventListener('click', () => fecharModal());
    closeModalPagamento.addEventListener('click', () => fecharModalPagamento());
    closeModalPagamentoParcial.addEventListener('click', () => fecharModalPagamentoParcial());

    window.onclick = function(event) {
        if (event.target === modal) {
            fecharModal();
        }
        if (event.target === modalPagamento) {
            fecharModalPagamento();
        }
        if (event.target === modalPagamentoParcial) {
            fecharModalPagamentoParcial();
        }
    }

    categoriaSelect.addEventListener('change', () => {
        const categoria = categoriaSelect.value;
        renderProdutos(categoria, adicionarAoCarrinho, mesaAtual);
    });

    formPagamento.addEventListener('submit', (e) => {
        e.preventDefault();
        const metodoPagamento = document.getElementById('metodoPagamento').value;
        const observacoes = document.getElementById('observacoes').value;
        const incluirServico = document.getElementById('incluirServico').checked;
        finalizarPedido(mesaAtual, metodoPagamento, observacoes, incluirServico);
        mesaAtual = null;
        fecharModalPagamento();
        atualizarVisualizacao();
    });

    formPagamentoParcial.addEventListener('submit', (e) => {
        e.preventDefault();
        const valorPagamentoParcial = parseFloat(document.getElementById('valorPagamentoParcial').value);
        if (!isNaN(valorPagamentoParcial) && valorPagamentoParcial > 0) {
            abaterValorParcial(mesaAtual, valorPagamentoParcial);
            fecharModalPagamentoParcial();
        } else {
            alert("Por favor, insira um valor válido para o pagamento parcial.");
        }
    });

    function abrirModal(numeroMesa) {
        renderProdutos('Todas', adicionarAoCarrinho, numeroMesa);
        modal.style.display = 'flex';
    }

    function fecharModal() {
        modal.style.display = 'none';
    }

    function abrirModalPagamento(numeroMesa) {
        mesaAtual = numeroMesa;
        modalPagamento.style.display = 'flex';
    }

    function fecharModalPagamento() {
        modalPagamento.style.display = 'none';
    }

    function fecharModalPagamentoParcial() {
        modalPagamentoParcial.style.display = 'none';
    }

    function abrirModalPagamentoParcial(numeroMesa) {
        mesaAtual = numeroMesa;
        renderResumoPagamentoParcial(mesaAtual);
        modalPagamentoParcial.style.display = 'flex';
    }

    setFecharMesaCallback(abrirModalPagamento);

    window.abrirModal = abrirModal;
    window.abrirModalPagamentoParcial = abrirModalPagamentoParcial;

    atualizarVisualizacao();
});