const CATEGORIA_BEBIDAS = 'Bebidas';
const CATEGORIA_DOCES = 'Doces';
const CATEGORIA_LANCHES = 'Lanches';

export const produtos = [
    {
        id: 1,
        nome: 'Café Expresso',
        preco: 3.5,
        descricao: 'Café puro e forte',
        imagem: 'img/cafe-expresso.jpg',
        categoria: CATEGORIA_BEBIDAS
    },
    {
        id: 2,
        nome: 'Cappuccino',
        preco: 4.5,
        descricao: 'Café com leite e espuma',
        imagem: 'img/cappuccino.jpg',
        categoria: CATEGORIA_BEBIDAS
    },
    {
        id: 3,
        nome: 'Bolo de Chocolate',
        preco: 5.0,
        descricao: 'Bolo caseiro de chocolate',
        imagem: 'img/bolo-chocolate.jpg',
        categoria: CATEGORIA_DOCES
    },
    {
        id: 4,
        nome: 'Sanduíche Natural',
        preco: 6.5,
        descricao: 'Sanduíche leve e saudável',
        imagem: 'img/sanduiche-natural.jpg',
        categoria: CATEGORIA_LANCHES
    },
    {
        id: 5,
        nome: 'Suco de Laranja',
        preco: 4.0,
        descricao: 'Suco natural da fruta',
        imagem: 'img/suco-laranja.jpg',
        categoria: CATEGORIA_BEBIDAS
    },
    {
        id: 6,
        nome: 'Croissant',
        preco: 3.0,
        descricao: 'Croissant francês tradicional',
        imagem: 'img/croissant.jpg',
        categoria: CATEGORIA_LANCHES
    },
    {
        id: 7,
        nome: 'Chá Verde',
        preco: 3.0,
        descricao: 'Chá verde refrescante',
        imagem: 'img/cha-verde.jpg',
        categoria: CATEGORIA_BEBIDAS
    },
    {
        id: 8,
        nome: 'Muffin de Blueberry',
        preco: 4.0,
        descricao: 'Muffin recheado com blueberry',
        imagem: 'img/muffin-blueberry.jpg',
        categoria: CATEGORIA_DOCES
    },
    {
        id: 9,
        nome: 'Smoothie de Frutas',
        preco: 5.5,
        descricao: 'Smoothie de frutas variadas',
        imagem: 'img/smoothie-frutas.jpg',
        categoria: CATEGORIA_BEBIDAS
    },
    {
        id: 10,
        nome: 'Torta de Limão',
        preco: 4.5,
        descricao: 'Torta de limão cremosa',
        imagem: 'img/torta-limao.jpg',
        categoria: CATEGORIA_DOCES
    },
    {
        id: 11,
        nome: 'Café Gelado',
        preco: 4.0,
        descricao: 'Café gelado refrescante',
        imagem: 'img/cafe-gelado.jpg',
        categoria: CATEGORIA_BEBIDAS
    },
    {
        id: 12,
        nome: 'Brownie',
        preco: 3.5,
        descricao: 'Brownie de chocolate',
        imagem: 'img/brownie.jpg',
        categoria: CATEGORIA_DOCES
    }
];

export function renderProdutos(categoria = 'Todas', adicionarAoCarrinho, mesaAtual) {
    const produtosContainer = document.getElementById('produtosContainer');
    produtosContainer.innerHTML = '';

    const produtosFiltrados = categoria === 'Todas' ? produtos : produtos.filter(produto => produto.categoria === categoria);

    produtosFiltrados.forEach(produto => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-transform duration-300 hover:scale-105';

        const img = document.createElement('img');
        img.src = produto.imagem;
        img.alt = produto.nome;
        img.className = 'w-full h-48 object-cover';
        card.appendChild(img);

        const cardContent = document.createElement('div');
        cardContent.className = 'p-4';
        cardContent.innerHTML = `
            <h3 class="text-lg font-semibold mb-2 dark:text-white">${produto.nome}</h3>
            <p class="text-gray-600 dark:text-gray-300 mb-2">${produto.descricao}</p>
            <p class="text-blue-600 dark:text-blue-400 font-bold mb-4">R$ ${produto.preco.toFixed(2)}</p>
        `;

        const addForm = document.createElement('form');
        addForm.className = 'flex items-center';
        addForm.innerHTML = `
            <input type="number" value="1" min="1" class="w-16 mr-2 p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
            <button type="submit" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded flex-grow">
                <i class="fas fa-plus mr-2"></i>Adicionar
            </button>
        `;

        addForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const quantidade = parseInt(e.target.querySelector('input').value);
            if (!isNaN(quantidade) && quantidade > 0) {
                adicionarAoCarrinho(produto, quantidade, mesaAtual);
                // Feedback visual
                const addButton = e.target.querySelector('button');
                const originalText = addButton.innerHTML;
                addButton.innerHTML = '<i class="fas fa-check mr-2"></i>Adicionado!';
                addButton.classList.add('bg-blue-500');
                setTimeout(() => {
                    addButton.innerHTML = originalText;
                    addButton.classList.remove('bg-blue-500');
                }, 1000);
            }
        });

        cardContent.appendChild(addForm);
        card.appendChild(cardContent);
        produtosContainer.appendChild(card);
    });
}