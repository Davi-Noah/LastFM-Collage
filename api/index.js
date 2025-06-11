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

app.get('/inicial', async (req, res) => {
    const user = String(req.query.user || '');

    try {
        const data = await getResults(user);
        console.log(`Dados obtidos para o usuário ${user}:`, data);
    } catch (error) {
        console.error('Erro ao obter dados:', error);
        return res.status(500).send('Erro ao obter dados do usuário');
    }

    const htmlPath = path.join(frontDir, 'inicial.html');
    sendHtmlFile(res, htmlPath);
});

app.post('/buscar_usuario', (req, res) => {
    const user = String(req.body.user || '').trim();

    res.redirect(`/inicial?user=${encodeURIComponent(user)}`);
});

export default app;
