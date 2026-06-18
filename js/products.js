export const produtosIniciais = [
    { id: 1, nome: 'Picanha na Brasa', categoria: 'Carnes', preco: 89.9, unidade: 'porcao', estoqueProdutos: 22, estoqueCozinha: 22, minimo: 6 },
    { id: 2, nome: 'Fraldinha Acebolada', categoria: 'Carnes', preco: 64.9, unidade: 'porcao', estoqueProdutos: 18, estoqueCozinha: 18, minimo: 8 },
    { id: 3, nome: 'Costela Defumada', categoria: 'Carnes', preco: 74.9, unidade: 'porcao', estoqueProdutos: 14, estoqueCozinha: 14, minimo: 5 },
    { id: 4, nome: 'Asinha Picante', categoria: 'Carnes', preco: 39.9, unidade: 'porcao', estoqueProdutos: 30, estoqueCozinha: 30, minimo: 10 },
    { id: 5, nome: 'Farofa de Bacon', categoria: 'Acompanhamentos', preco: 18.9, unidade: 'porcao', estoqueProdutos: 20, estoqueCozinha: 20, minimo: 8 },
    { id: 6, nome: 'Arroz Carreteiro', categoria: 'Acompanhamentos', preco: 24.9, unidade: 'porcao', estoqueProdutos: 18, estoqueCozinha: 18, minimo: 6 },
    { id: 7, nome: 'Vinagrete da Casa', categoria: 'Acompanhamentos', preco: 12.9, unidade: 'porcao', estoqueProdutos: 25, estoqueCozinha: 25, minimo: 8 },
    { id: 8, nome: 'Mandioca Frita', categoria: 'Acompanhamentos', preco: 21.9, unidade: 'porcao', estoqueProdutos: 16, estoqueCozinha: 16, minimo: 6 },
    { id: 9, nome: 'Refrigerante Lata', categoria: 'Bebidas', preco: 7.5, unidade: 'un', estoqueProdutos: 60, estoqueCozinha: 60, minimo: 20 },
    { id: 10, nome: 'Suco Natural', categoria: 'Bebidas', preco: 12.0, unidade: 'un', estoqueProdutos: 35, estoqueCozinha: 35, minimo: 12 },
    { id: 11, nome: 'Agua Mineral', categoria: 'Bebidas', preco: 5.0, unidade: 'un', estoqueProdutos: 80, estoqueCozinha: 80, minimo: 20 },
    { id: 12, nome: 'Pudim da Casa', categoria: 'Sobremesas', preco: 16.9, unidade: 'un', estoqueProdutos: 12, estoqueCozinha: 12, minimo: 4 }
];

export const categorias = ['Todas', ...new Set(produtosIniciais.map((produto) => produto.categoria))];
