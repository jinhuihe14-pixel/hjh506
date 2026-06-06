import express from 'express';
import cors from 'cors';
import { startCronJobs } from './cron.js';

import categoriesRouter from './routes/categories.js';
import productsRouter from './routes/products.js';
import inventoryRouter from './routes/inventory.js';
import purchaseRouter from './routes/purchase.js';
import salesRouter from './routes/sales.js';
import membersRouter from './routes/members.js';
import reportsRouter from './routes/reports.js';
import stocktakeRouter from './routes/stocktake.js';
import exportRouter from './routes/export.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ code: 0, message: 'ok', data: { status: 'running' } });
});

app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/purchase', purchaseRouter);
app.use('/api/sales', salesRouter);
app.use('/api/members', membersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/stocktake', stocktakeRouter);
app.use('/api/export', exportRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  startCronJobs();
});
