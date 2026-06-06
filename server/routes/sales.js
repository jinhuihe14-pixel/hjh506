import { Router } from 'express';
import db from '../db.js';
import { success, fail, generateOrderNo } from '../utils.js';

const router = Router();

router.get('/', (req, res) => {
  const { page = 1, pageSize = 20, keyword = '', start_date, end_date, order_type, member_id } = req.query;
  const offset = (page - 1) * pageSize;
  
  let where = [];
  let params = [];
  
  if (keyword) {
    where.push('(order_no LIKE ? OR member_name LIKE ?)');
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
  
  if (order_type) {
    where.push('order_type = ?');
    params.push(order_type);
  }
  
  if (member_id) {
    where.push('member_id = ?');
    params.push(member_id);
  }
  
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM sales_orders ${whereSql}`).get(...params).cnt;
  
  const list = db.prepare(`
    SELECT * FROM sales_orders
    ${whereSql}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(pageSize), offset);
  
  res.json(success({ list, total, page: Number(page), pageSize: Number(pageSize) }));
});

router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(req.params.id);
  
  if (!order) {
    return res.json(fail('单据不存在'));
  }
  
  const items = db.prepare(`
    SELECT si.*, p.sku, c.name as category_name
    FROM sales_items si
    LEFT JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE si.order_id = ?
    ORDER BY si.id ASC
  `).all(req.params.id);
  
  order.items = items;
  res.json(success(order));
});

router.post('/', (req, res) => {
  const { order_type = 'retail', member_id, member_name, items = [], remark = '' } = req.body;
  
  if (!items || items.length === 0) {
    return res.json(fail('请添加商品明细'));
  }
  
  const order_no = generateOrderNo('XS');
  
  let total_amount = 0;
  let total_cost = 0;
  let total_quantity = 0;
  
  for (const item of items) {
    const inv = db.prepare('SELECT * FROM inventory WHERE product_id = ?').get(item.product_id);
    if (!inv || inv.quantity < item.quantity) {
      const product = db.prepare('SELECT name FROM products WHERE id = ?').get(item.product_id);
      return res.json(fail(`商品【${product?.name}】库存不足`));
    }
    
    const unit_price = order_type === 'wholesale' ? item.wholesale_price || item.unit_price : item.unit_price;
    item.unit_price = unit_price;
    item.unit_cost = inv.avg_cost;
    item.subtotal = item.quantity * unit_price;
    
    total_amount += item.subtotal;
    total_cost += item.quantity * inv.avg_cost;
    total_quantity += item.quantity;
  }
  
  const tx = db.transaction(() => {
    const orderResult = db.prepare(`
      INSERT INTO sales_orders 
      (order_no, order_type, member_id, member_name, total_amount, total_cost, total_quantity, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(order_no, order_type, member_id || null, member_name || '', 
           total_amount, total_cost, total_quantity, remark);
    
    const orderId = orderResult.lastInsertRowid;
    
    const itemStmt = db.prepare(`
      INSERT INTO sales_items 
      (order_id, product_id, product_name, quantity, unit_price, unit_cost, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const invLogStmt = db.prepare(`
      INSERT INTO inventory_logs 
      (product_id, change_type, change_quantity, before_quantity, after_quantity, ref_type, ref_id, remark)
      VALUES (?, 'out', ?, ?, ?, 'sale', ?, ?)
    `);
    
    for (const item of items) {
      itemStmt.run(orderId, item.product_id, item.product_name, item.quantity, 
                   item.unit_price, item.unit_cost, item.subtotal);
      
      const inv = db.prepare('SELECT * FROM inventory WHERE product_id = ?').get(item.product_id);
      const beforeQty = inv.quantity;
      const afterQty = beforeQty - item.quantity;
      
      db.prepare(`
        UPDATE inventory 
        SET quantity = ?, last_out_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ?
      `).run(afterQty, item.product_id);
      
      invLogStmt.run(item.product_id, -item.quantity, beforeQty, afterQty, orderId, '销售出库');
    }
    
    if (member_id) {
      db.prepare(`
        UPDATE members 
        SET total_spent = total_spent + ?, 
            total_orders = total_orders + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(total_amount, member_id);
    }
    
    return orderId;
  });
  
  try {
    const orderId = tx();
    const order = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(orderId);
    res.json(success(order));
  } catch (e) {
    res.json(fail(e.message));
  }
});

export default router;
