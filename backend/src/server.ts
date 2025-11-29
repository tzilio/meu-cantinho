// backend/src/services/server.ts
import 'dotenv/config';
import app from './app.js'; // NodeNext: mantém .js mesmo no .ts

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
