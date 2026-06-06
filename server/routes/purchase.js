import { Router } from 'express';
import db from '../db.js';
import { success, fail, generateOrderNo } from '../utils.js';

const router = Router();

router.get('/', (req, res) => {
  const { page = 1, pageSize = 20, keyword = '', start_date, end_date } = req.query;
  const offset = (page - 1) * pageSize;
  
  let where = [];
  let params = [];
  
  if (keyword) {
    where.push('(order_no LIKE ? OR supplier LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
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
  
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM purchase_orders ${whereSql}`).get(...params).cnt;
  
  const list = db.prepare(`
    SELECT * FROM purchase_orders
    ${whereSql}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(pageSize), offset);
  
  res.json(success({ list, total, page: Number(page), pageSize: Number(pageSize) }));
});

router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
  
  if (!order) {
    return res.json(fail('单据不存在'));
  }
  
  const items = db.prepare(`
    SELECT pi.*, p.sku, p.name, c.name as category_name
    FROM purchase_items pi
    LEFT JOIN products p ON pi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE pi.order_id = ?
    ORDER BY pi.id ASC
  `).all(req.params.id);
  
  order.items = items;
  res.json(success(order));
});

router.post('/', (req, res) => {
  const { supplier, items = [], remark = '' } = req.body;
  
  if (!items || items.length === 0) {
    return res.json(fail('请添加商品明细'));
  }
  
  const order_no = generateOrderNo('CG');
  
  let total_amount = 0;
  let total_quantity = 0;
  
  items.forEach(item => {
    item.subtotal = item.quantity * item.unit_price;
    total_amount += item.subtotal;
    total_quantity += item.quantity;
  });
  
  const tx = db.transaction(() => {
    const orderResult = db.prepare(`
      INSERT INTO purchase_orders (order_no, supplier, total_amount, total_quantity, remark)
      VALUES (?, ?, ?, ?, ?)
    `).run(order_no, supplier, total_amount, total_quantity, remark);
    
    const orderId = orderResult.lastInsertRowid;
    
    const itemStmt = db.prepare(`
      INSERT INTO purchase_items 
      (order_id, product_id, quantity, unit_price, production_date, expiry_date, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const invLogStmt = db.prepare(`
      INSERT INTO inventory_logs 
      (product_id, change_type, change_quantity, before_quantity, after_quantity, ref_type, ref_id, remark)
      VALUES (?, 'in', ?, ?, ?, 'purchase', ?, ?)
    `);
    
    for (const item of items) {
      itemStmt.run(orderId, item.product_id, item.quantity, item.unit_price, 
                   item.production_date || null, item.expiry_date || null, item.subtotal);
      
      const inv = db.prepare('SELECT * FROM inventory WHERE product_id = ?').get(item.product_id);
      const beforeQty = inv ? inv.quantity : 0;
      const afterQty = beforeQty + item.quantity;
      
      if (inv) {
        const newAvgCost = (inv.avg_cost * beforeQty + item.unit_price * item.quantity) / afterQty;
        db.prepare(`
          UPDATE inventory 
          SET quantity = ?, avg_cost = ?, last_in_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE product_id = ?
        `).run(afterQty, newAvgCost, item.product_id);
      } else {
        db.prepare(`
          INSERT INTO inventory (product_id, quantity, avg_cost, last_in_date)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).run(item.product_id, item.quantity, item.unit_price);
      }
      
      invLogStmt.run(item.product_id, item.quantity, beforeQty, afterQty, orderId, '采购入库');
    }
    
    return orderId;
  });
  
  try {
    const orderId = tx();
    const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(orderId);
    res.json(success(order));
  } catch (e) {
    res.json(fail(e.message));
  }
});

export default router;
