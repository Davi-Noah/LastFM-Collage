import express from 'express';
import { readFile } from 'node:fs/promises';
import { getResults } from '../back/script.js';
import path from 'node:path';

const app = express();
const frontDir = path.resolve(process.cwd(), 'front');

app.use(express.urlencoded({ extended: true }));
app.use(express.static(frontDir));

const sendHtmlFile = async (res, filePath) => {
    try {
        const html = await readFile(filePath, 'utf8');
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error(`Erro ao ler o arquivo ${filePath}:`, error);
        res.status(500).send('Erro ao carregar a página');
    }
};

app.get('/', (req, res) => {
    const htmlPath = path.join(frontDir, 'index.html');
    sendHtmlFile(res, htmlPath);
});

app.get('/consulta', (req, res) => {
    const consultaPath = path.join(frontDir, 'consulta.html');
    sendHtmlFile(res, consultaPath);
});

app.get('/inicial', (req, res) => {
    const htmlPath = path.join(frontDir, 'inicial.html');
    sendHtmlFile(res, htmlPath);
});

// 2. ROTA DE DADOS (API): Onde o front-end vai bater para buscar as músicas
app.get('/api/gerar', async (req, res) => {
    const user = String(req.query.user || '');
    const periodo = String(req.query.periodo || '6_meses');
    const tipo = String(req.query.tipo || 'albuns');

    try {
        const data = await getResults(user, periodo, tipo);
        console.log(`Enviando dados para o front-end: ${user} - ${tipo}`);
        
        // Devolve os dados empacotados em JSON para o navegador ler!
        res.json(data); 

    } catch (error) {
        console.error('Erro ao obter dados:', error);
        res.status(500).json({ erro: 'Erro ao obter dados do usuário' });
    }
});

app.post('/buscar_usuario', (req, res) => {
    const user = String(req.body.user || '').trim();

    res.redirect(`/inicial?user=${encodeURIComponent(user)}`);
});

export default app;
