import express from 'express';
import { getResults } from './script.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontPath = path.join(__dirname, '../front');

app.use(express.urlencoded({ extended: true }));
app.use(express.static(frontPath));

const sendHtml = (res, filePath) => {
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Erro ao enviar ${filePath}:`, err);
            res.status(500).send('Erro ao carregar a página');
        }
    });
};

app.get('/', (req, res) => {
    const indexPath = path.join(frontPath, 'index.html');
    sendHtml(res, indexPath);
});

app.get('/consulta', (req, res) => {
    const consultaPath = path.join(frontPath, 'consulta.html');
    sendHtml(res, consultaPath);
});

app.get('/inicial', (req, res) => {
    const htmlPath = path.join(frontPath, 'inicial.html');
    sendHtml(res, htmlPath);
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
    const user = String(req.body.user || '');
    res.redirect(`/inicial?user=${encodeURIComponent(user)}`);
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
