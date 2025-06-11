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

app.get('/inicial', async (req, res) => {
    const user = String(req.query.user || '');

    try {
        const data = await getResults(user);
        console.log(`Dados do usuário ${user}:`, data);

        const inicialPath = path.join(frontPath, 'inicial.html');
        sendHtml(res, inicialPath);
    } catch (error) {
        console.error('Erro ao processar inicial:', error);
        res.status(500).send('Erro ao processar inicial');
    }
});

app.post('/buscar_usuario', (req, res) => {
    const user = String(req.body.user || '');
    res.redirect(`/inicial?user=${encodeURIComponent(user)}`);
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
