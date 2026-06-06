import { Router } from 'express';
import db from '../db.js';
import { success, fail } from '../utils.js';

const router = Router();

router.get('/', (req, res) => {
  const { page = 1, pageSize = 20, keyword = '', category_id, status } = req.query;
  const offset = (page - 1) * pageSize;
  
  let where = [];
  let params = [];
  
  if (keyword) {
    where.push('(p.name LIKE ? OR p.sku LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  if (category_id) {
    where.push('p.category_id = ?');
    params.push(category_id);
  }
  
  if (status !== undefined && status !== '') {
    where.push('p.status = ?');
    params.push(status);
  }
  
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  
  const total = db.prepare(`
    SELECT COUNT(*) as cnt FROM products p ${whereSql}
  `).get(...params).cnt;
  
  const list = db.prepare(`
    SELECT p.*, c.name as category_name, i.quantity as stock_quantity, i.avg_cost
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN inventory i ON p.id = i.product_id
    ${whereSql}
    ORDER BY p.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(pageSize), offset);
  
  res.json(success({ list, total, page: Number(page), pageSize: Number(pageSize) }));
});

router.get('/:id', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, i.quantity as stock_quantity, i.avg_cost
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN inventory i ON p.id = i.product_id
    WHERE p.id = ?
  `).get(req.params.id);
  
  if (!product) {
    return res.json(fail('商品不存在'));
  }
  
  res.json(success(product));
});

router.post('/', (req, res) => {
  const {
    sku, name, category_id, unit = '件',
    cost_price = 0, retail_price = 0, wholesale_price = 0,
    safety_stock = 0, shelf_life_days, description, image_url, status = 1
  } = req.body;
  
  if (!sku || !name) {
    return res.json(fail('SKU和商品名称不能为空'));
  }
  
  try {
    const stmt = db.prepare(`
      INSERT INTO products 
      (sku, name, category_id, unit, cost_price, retail_price, wholesale_price, 
       safety_stock, shelf_life_days, description, image_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      sku, name, category_id, unit, cost_price, retail_price, wholesale_price,
      safety_stock, shelf_life_days, description, image_url, status
    );
    
    db.prepare('INSERT INTO inventory (product_id, quantity, avg_cost) VALUES (?, 0, ?)')
      .run(result.lastInsertRowid, cost_price);
    
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.json(success(product));
  } catch (e) {
    res.json(fail(e.message));
  }
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const {
    sku, name, category_id, unit,
    cost_price, retail_price, wholesale_price,
    safety_stock, shelf_life_days, description, image_url, status
  } = req.body;
  
  try {
    db.prepare(`
      UPDATE products SET
        sku = ?, name = ?, category_id = ?, unit = ?,
        cost_price = ?, retail_price = ?, wholesale_price = ?,
        safety_stock = ?, shelf_life_days = ?, description = ?, 
        image_url = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      sku, name, category_id, unit, cost_price, retail_price, wholesale_price,
      safety_stock, shelf_life_days, description, image_url, status, id
    );
    
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json(success(product));
  } catch (e) {
    res.json(fail(e.message));
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  const inv = db.prepare('SELECT quantity FROM inventory WHERE product_id = ?').get(id);
  if (inv && inv.quantity > 0) {
    return res.json(fail('该商品还有库存，不能删除'));
  }
  
  db.prepare('DELETE FROM inventory WHERE product_id = ?').run(id);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json(success(null, '删除成功'));
});

router.get('/search/select', (req, res) => {
  const { keyword = '' } = req.query;
  
  const list = db.prepare(`
    SELECT p.id, p.sku, p.name, p.unit, p.retail_price, p.wholesale_price, p.cost_price,
           c.name as category_name, i.quantity as stock_quantity
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN inventory i ON p.id = i.product_id
    WHERE p.status = 1 AND (p.name LIKE ? OR p.sku LIKE ?)
    ORDER BY p.name ASC
    LIMIT 50
  `).all(`%${keyword}%`, `%${keyword}%`);
  
  res.json(success(list));
});

export default router;
