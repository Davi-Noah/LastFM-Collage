import express from 'express';
import { readFile } from 'node:fs/promises';

const app = express();
const port = 3000;

app.get('/', async (req, res) => {
    try {
        const html = await readFile('../front/index.html', 'utf8');
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        res.status(500).send('Error reading file');
    }
});

app.use(express.static('../front'));

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
