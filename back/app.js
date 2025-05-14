import express from 'express';
import { readFile } from 'node:fs/promises';

const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
    try {
        const html = await readFile('../front/index.html', 'utf8');
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        res.status(500).send('Error reading file');
    }
});

app.post('/buscar_usuario', async (req, res) => {
    const { user } = req.body.user;
    
    

    try {
        const response = 'a'

        res.redirect('/');
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Error fetching data');
    }

});

app.use(express.static('../front'));

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
