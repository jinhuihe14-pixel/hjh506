import { Router } from 'express';
import db from '../db.js';
import { success } from '../utils.js';

const router = Router();

router.get('/', (req, res) => {
  const { page = 1, pageSize = 20, keyword = '', category_id, low_stock, sort_by = 'id', sort_order = 'desc' } = req.query;
  const offset = (page - 1) * pageSize;
  
  let where = ['p.status = 1'];
  let params = [];
  
  if (keyword) {
    where.push('(p.name LIKE ? OR p.sku LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  if (category_id) {
    where.push('p.category_id = ?');
    params.push(category_id);
  }
  
  if (low_stock === 'true') {
    where.push('i.quantity <= p.safety_stock');
  }
  
  const whereSql = 'WHERE ' + where.join(' AND ');
  
  const total = db.prepare(`
    SELECT COUNT(*) as cnt 
    FROM inventory i
    LEFT JOIN products p ON i.product_id = p.id
    ${whereSql}
  `).get(...params).cnt;
  
  const validSortFields = ['id', 'name', 'sku', 'quantity', 'safety_stock'];
  const sortField = validSortFields.includes(sort_by) ? sort_by : 'i.id';
  const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';
  
  const list = db.prepare(`
    SELECT i.*, p.sku, p.name, p.unit, p.safety_stock, p.shelf_life_days, 
           c.name as category_name,
           CASE WHEN i.quantity <= p.safety_stock THEN 1 ELSE 0 END as is_low_stock
    FROM inventory i
    LEFT JOIN products p ON i.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereSql}
    ORDER BY ${sortField} ${sortDir}
    LIMIT ? OFFSET ?
  `).all(...params, Number(pageSize), offset);
  
  res.json(success({ list, total, page: Number(page), pageSize: Number(pageSize) }));
});

router.get('/logs', (req, res) => {
  const { page = 1, pageSize = 20, product_id, change_type, start_date, end_date } = req.query;
  const offset = (page - 1) * pageSize;
  
  let where = [];
  let params = [];
  
  if (product_id) {
    where.push('product_id = ?');
    params.push(product_id);
  }
  
  if (change_type) {
    where.push('change_type = ?');
    params.push(change_type);
  }
  
  if (start_date) {
    where.push('created_at >= ?');
    params.push(start_date);
  }
  
  if (end_date) {
    where.push('created_at <= ?');
    params.push(end_date + ' 23:59:59');
  }
  
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM inventory_logs ${whereSql}`).get(...params).cnt;
  
  const list = db.prepare(`
    SELECT il.*, p.sku, p.name, p.unit
    FROM inventory_logs il
    LEFT JOIN products p ON il.product_id = p.id
    ${whereSql}
    ORDER BY il.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(pageSize), offset);
  
  res.json(success({ list, total, page: Number(page), pageSize: Number(pageSize) }));
});

router.get('/overview', (req, res) => {
  const totalProducts = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE status = 1').get().cnt;
  const totalStock = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM inventory').get().total;
  const lowStockCount = db.prepare(`
    SELECT COUNT(*) as cnt 
    FROM inventory i
    LEFT JOIN products p ON i.product_id = p.id
    WHERE i.quantity <= p.safety_stock AND p.status = 1
  `).get().cnt;
  const totalValue = db.prepare('SELECT COALESCE(SUM(quantity * avg_cost), 0) as total FROM inventory').get().total;
  
  res.json(success({
    totalProducts,
    totalStock,
    lowStockCount,
    totalValue: Math.round(totalValue * 100) / 100
  }));
});

export default router;
