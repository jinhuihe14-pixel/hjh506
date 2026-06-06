import { Router } from 'express';
import db from '../db.js';
import { success, fail, generateOrderNo } from '../utils.js';

const router = Router();

router.get('/latest', (req, res) => {
  const stocktake = db.prepare(`
    SELECT * FROM stocktakes 
    WHERE status = 'completed' 
    ORDER BY completed_at DESC 
    LIMIT 1
  `).get();
  
  if (!stocktake) {
    return res.json(success(null));
  }
  
  const items = db.prepare(`
    SELECT * FROM stocktake_items WHERE stocktake_id = ?
  `).all(stocktake.id);
  
  let overage_qty = 0;
  let shortage_qty = 0;
  let overage_amount = 0;
  let shortage_amount = 0;
  
  items.forEach(item => {
    if (item.diff_quantity > 0) {
      overage_qty += item.diff_quantity;
      overage_amount += item.diff_amount;
    } else if (item.diff_quantity < 0) {
      shortage_qty += Math.abs(item.diff_quantity);
      shortage_amount += Math.abs(item.diff_amount);
    }
  });
  
  stocktake.overage_quantity = overage_qty;
  stocktake.shortage_quantity = shortage_qty;
  stocktake.overage_amount = Math.round(overage_amount * 100) / 100;
  stocktake.shortage_amount = Math.round(shortage_amount * 100) / 100;
  stocktake.item_count = items.length;
  
  res.json(success(stocktake));
});

router.get('/category-preview/:categoryId', (req, res) => {
  const { categoryId } = req.params;
  
  let whereSql = 'p.status = 1';
  let params = [];
  
  if (categoryId !== 'all') {
    whereSql += ' AND p.category_id = ?';
    params.push(categoryId);
  }
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as product_count,
      COALESCE(SUM(i.quantity), 0) as total_stock,
      COALESCE(SUM(i.quantity * i.avg_cost), 0) as total_value
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
    WHERE ${whereSql}
  `).get(...params);
  
  res.json(success({
    product_count: stats.product_count,
    total_stock: stats.total_stock,
    total_value: Math.round(stats.total_value * 100) / 100
  }));
});

router.get('/', (req, res) => {
  const { page = 1, pageSize = 20, status } = req.query;
  const offset = (page - 1) * pageSize;
  
  let where = [];
  let params = [];
  
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM stocktakes ${whereSql}`).get(...params).cnt;
  
  const list = db.prepare(`
    SELECT * FROM stocktakes
    ${whereSql}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(pageSize), offset);
  
  res.json(success({ list, total, page: Number(page), pageSize: Number(pageSize) }));
});

router.get('/:id', (req, res) => {
  const stocktake = db.prepare('SELECT * FROM stocktakes WHERE id = ?').get(req.params.id);
  
  if (!stocktake) {
    return res.json(fail('盘点单不存在'));
  }
  
  const items = db.prepare(`
    SELECT * FROM stocktake_items WHERE stocktake_id = ? ORDER BY id ASC
  `).all(req.params.id);
  
  stocktake.items = items;
  res.json(success(stocktake));
});

router.post('/', (req, res) => {
  const { category_id, remark = '' } = req.body;
  
  const stocktake_no = generateOrderNo('PD');
  
  let productWhere = 'p.status = 1';
  let params = [];
  
  if (category_id) {
    productWhere += ' AND p.category_id = ?';
    params.push(category_id);
  }
  
  const products = db.prepare(`
    SELECT p.id, p.sku, p.name, c.name as category_name, 
           i.quantity as system_quantity, i.avg_cost as unit_cost
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE ${productWhere}
    ORDER BY p.id ASC
  `).all(...params);
  
  if (products.length === 0) {
    return res.json(fail('没有可盘点的商品'));
  }
  
  const tx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO stocktakes (stocktake_no, status, remark)
      VALUES (?, 'draft', ?)
    `).run(stocktake_no, remark);
    
    const stocktakeId = result.lastInsertRowid;
    
    const itemStmt = db.prepare(`
      INSERT INTO stocktake_items 
      (stocktake_id, product_id, product_name, sku, category_name, system_quantity, unit_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const p of products) {
      itemStmt.run(stocktakeId, p.id, p.name, p.sku, p.category_name || '', 
                   p.system_quantity || 0, p.unit_cost || 0);
    }
    
    return stocktakeId;
  });
  
  try {
    const stocktakeId = tx();
    const stocktake = db.prepare('SELECT * FROM stocktakes WHERE id = ?').get(stocktakeId);
    res.json(success(stocktake));
  } catch (e) {
    res.json(fail(e.message));
  }
});

router.post('/:id/items/:itemId', (req, res) => {
  const { itemId } = req.params;
  const { actual_quantity } = req.body;
  
  const item = db.prepare('SELECT * FROM stocktake_items WHERE id = ?').get(itemId);
  
  if (!item) {
    return res.json(fail('盘点明细不存在'));
  }
  
  const diff_quantity = actual_quantity - item.system_quantity;
  const diff_amount = diff_quantity * item.unit_cost;
  
  db.prepare(`
    UPDATE stocktake_items 
    SET actual_quantity = ?, diff_quantity = ?, diff_amount = ?
    WHERE id = ?
  `).run(actual_quantity, diff_quantity, diff_amount, itemId);
  
  res.json(success(null, '更新成功'));
});

router.post('/:id/complete', (req, res) => {
  const { id } = req.params;
  
  const stocktake = db.prepare('SELECT * FROM stocktakes WHERE id = ?').get(id);
  
  if (!stocktake) {
    return res.json(fail('盘点单不存在'));
  }
  
  if (stocktake.status === 'completed') {
    return res.json(fail('盘点单已完成'));
  }
  
  const items = db.prepare('SELECT * FROM stocktake_items WHERE stocktake_id = ?').all(id);
  
  let total_diff_quantity = 0;
  let total_diff_amount = 0;
  let hasActual = false;
  
  items.forEach(item => {
    if (item.actual_quantity !== null) {
      hasActual = true;
      total_diff_quantity += item.diff_quantity || 0;
      total_diff_amount += item.diff_amount || 0;
    }
  });
  
  if (!hasActual) {
    return res.json(fail('请先录入实际盘点数量'));
  }
  
  const tx = db.transaction(() => {
    for (const item of items) {
      if (item.actual_quantity === null || item.diff_quantity === 0) continue;
      
      const inv = db.prepare('SELECT * FROM inventory WHERE product_id = ?').get(item.product_id);
      const beforeQty = inv ? inv.quantity : 0;
      const afterQty = item.actual_quantity;
      
      if (inv) {
        db.prepare(`
          UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP
          WHERE product_id = ?
        `).run(afterQty, item.product_id);
      }
      
      const changeType = item.diff_quantity > 0 ? 'in' : 'out';
      db.prepare(`
        INSERT INTO inventory_logs
        (product_id, change_type, change_quantity, before_quantity, after_quantity, ref_type, ref_id, remark)
        VALUES (?, ?, ?, ?, ?, 'stocktake', ?, ?)
      `).run(item.product_id, changeType, item.diff_quantity, beforeQty, afterQty, id, 
             item.diff_quantity > 0 ? '盘盈' : '盘亏');
    }
    
    db.prepare(`
      UPDATE stocktakes 
      SET status = 'completed', 
          total_diff_quantity = ?,
          total_diff_amount = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(total_diff_quantity, total_diff_amount, id);
  });
  
  try {
    tx();
    const stocktake = db.prepare('SELECT * FROM stocktakes WHERE id = ?').get(id);
    res.json(success(stocktake, '盘点完成'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

export default router;
