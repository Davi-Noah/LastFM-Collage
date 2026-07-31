import { createApp } from "./createApp.js";

try {
  process.loadEnvFile?.(".env");
} catch {
  // Em produção, as variáveis são fornecidas pela plataforma de hospedagem.
}

const app = createApp();
const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Cartify disponível em http://localhost:${port}`);
});
