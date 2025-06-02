import express from 'express';
import { readFile } from 'node:fs/promises';
import { getResults } from '../back/script.js';
import path from 'node:path';

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(process.cwd(), 'front'))); 

app.get('/', async (req, res) => {
    try {
        const htmlPath = path.resolve(process.cwd(), 'front/index.html');
        let html = await readFile(htmlPath, 'utf8');
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        res.status(500).send('Error reading file');
    }
});

app.get('/inicial', async (req, res) => {
    const user = req.query.user;
    const data = await getResults(user);

    try {
        const htmlPath = path.resolve(process.cwd(), 'front/inicial.html');
        let html = await readFile(htmlPath, 'utf8');
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        res.status(500).send('Error reading file');
    }
});

app.post('/buscar_usuario', async (req, res) => {
    const { user } = req.body;

    try {
        res.redirect(`/inicial?user=${user}`);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Error fetching data');
    }
});

export default app;
