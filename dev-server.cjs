const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = process.cwd();
const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || '0.0.0.0';
const dataDir = path.join(root, 'data');
const stateFile = path.join(dataDir, 'state.json');

const users = [
    { id: 1, usuario: 'admin', senha: 'admin123', nome: 'Administrador', perfil: 'admin' },
    { id: 2, usuario: 'balcao', senha: 'balcao123', nome: 'Balcao', perfil: 'balcao' },
    { id: 3, usuario: 'garconete1', senha: 'mesa123', nome: 'Ana Souza', perfil: 'garconete' },
    { id: 4, usuario: 'garconete2', senha: 'mesa123', nome: 'Bianca Lima', perfil: 'garconete' },
    { id: 5, usuario: 'garconete3', senha: 'mesa123', nome: 'Carla Rocha', perfil: 'garconete' },
    { id: 6, usuario: 'garconete4', senha: 'mesa123', nome: 'Daniela Alves', perfil: 'garconete' },
    { id: 7, usuario: 'garconete5', senha: 'mesa123', nome: 'Elisa Martins', perfil: 'garconete' }
];

const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8'
};

const clients = new Set();

function initialState() {
    return {
        mesas: Array.from({ length: 12 }, (_, index) => ({
            id: index + 1,
            nome: `Mesa ${String(index + 1).padStart(2, '0')}`,
            status: index === 0 ? 'aberta' : 'livre'
        })),
        produtos: [
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
        ],
        pedidos: [],
        cupons: [],
        notas: [],
        config: { mesaUmAbertaInicialConfirmada: true },
        auditoria: []
    };
}

function ensureDataFile() {
    fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(stateFile)) {
        fs.writeFileSync(stateFile, JSON.stringify(initialState(), null, 2));
    }
}

function readState() {
    ensureDataFile();
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
}

function writeState(state) {
    ensureDataFile();
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function sendJson(res, status, body) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(body));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 1_000_000) {
                req.destroy();
                reject(new Error('Payload muito grande'));
            }
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(error);
            }
        });
    });
}

function publicUser(user) {
    return {
        id: user.id,
        usuario: user.usuario,
        nome: user.nome,
        perfil: user.perfil
    };
}

function broadcastState(actor = null) {
    const payload = JSON.stringify({
        type: 'state',
        actor,
        state: readState()
    });

    for (const client of clients) {
        client.write(`event: state\n`);
        client.write(`data: ${payload}\n\n`);
    }
}

function getLanUrls() {
    const urls = [`http://127.0.0.1:${port}`];
    const interfaces = os.networkInterfaces();
    for (const items of Object.values(interfaces)) {
        for (const item of items || []) {
            if (item.family === 'IPv4' && !item.internal) {
                urls.push(`http://${item.address}:${port}`);
            }
        }
    }
    return urls;
}

async function handleApi(req, res, requestPath) {
    if (requestPath === '/api/login' && req.method === 'POST') {
        const body = await readBody(req);
        const user = users.find((item) => item.usuario === body.usuario && item.senha === body.senha);
        if (!user) {
            sendJson(res, 401, { error: 'Credenciais invalidas' });
            return true;
        }
        sendJson(res, 200, { user: publicUser(user) });
        return true;
    }

    if (requestPath === '/api/users' && req.method === 'GET') {
        sendJson(res, 200, { users: users.map(publicUser) });
        return true;
    }

    if (requestPath === '/api/state' && req.method === 'GET') {
        sendJson(res, 200, readState());
        return true;
    }

    if (requestPath === '/api/state' && req.method === 'PUT') {
        const body = await readBody(req);
        const state = body.state || body;
        state.auditoria ||= [];
        state.auditoria.push({
            id: Date.now(),
            usuario: body.actor?.nome || body.actor?.usuario || 'Sistema',
            acao: body.action || 'Atualizacao de estado',
            dataHora: new Date().toISOString()
        });
        writeState(state);
        sendJson(res, 200, { ok: true });
        broadcastState(body.actor || null);
        return true;
    }

    if (requestPath === '/api/events' && req.method === 'GET') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        res.write(`event: state\n`);
        res.write(`data: ${JSON.stringify({ type: 'state', actor: null, state: readState() })}\n\n`);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return true;
    }

    if (requestPath === '/api/network' && req.method === 'GET') {
        sendJson(res, 200, { urls: getLanUrls() });
        return true;
    }

    return false;
}

const server = http.createServer(async (req, res) => {
    const requestPath = decodeURIComponent(req.url.split('?')[0]);

    try {
        if (requestPath.startsWith('/api/')) {
            const handled = await handleApi(req, res, requestPath);
            if (!handled) sendJson(res, 404, { error: 'API nao encontrada' });
            return;
        }

        let staticPath = requestPath;
        if (staticPath === '/') staticPath = '/index.html';

        const filePath = path.resolve(root, `.${staticPath}`);
        if (!filePath.startsWith(root)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        fs.readFile(filePath, (error, data) => {
            if (error) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }

            res.writeHead(200, {
                'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
                'Cache-Control': 'no-store'
            });
            res.end(data);
        });
    } catch (error) {
        sendJson(res, 500, { error: error.message });
    }
});

server.listen(port, host, () => {
    console.log('Sistema PDV rodando em:');
    for (const url of getLanUrls()) {
        console.log(`- ${url}`);
    }
});
