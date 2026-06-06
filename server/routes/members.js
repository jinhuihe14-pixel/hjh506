import { Router } from 'express';
import db from '../db.js';
import { success, fail } from '../utils.js';

const router = Router();

router.get('/', (req, res) => {
  const { page = 1, pageSize = 20, keyword = '', fishing_type, member_level, sort_by = 'total_spent', sort_order = 'desc' } = req.query;
  const offset = (page - 1) * pageSize;
  
  let where = [];
  let params = [];
  
  if (keyword) {
    where.push('(name LIKE ? OR phone LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  if (fishing_type) {
    where.push('fishing_type = ?');
    params.push(fishing_type);
  }
  
  if (member_level) {
    where.push('member_level = ?');
    params.push(member_level);
  }
  
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM members ${whereSql}`).get(...params).cnt;
  
  const validSortFields = ['id', 'name', 'total_spent', 'total_orders', 'created_at'];
  const sortField = validSortFields.includes(sort_by) ? sort_by : 'total_spent';
  const sortOrder = sort_order === 'asc' ? 'ASC' : 'DESC';
  
  const list = db.prepare(`
    SELECT * FROM members
    ${whereSql}
    ORDER BY ${sortField} ${sortOrder}, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(pageSize), offset);
  
  res.json(success({ list, total, page: Number(page), pageSize: Number(pageSize) }));
});

router.get('/:id', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  
  if (!member) {
    return res.json(fail('会员不存在'));
  }
  
  const recentOrders = db.prepare(`
    SELECT * FROM sales_orders 
    WHERE member_id = ?
    ORDER BY id DESC
    LIMIT 10
  `).all(req.params.id);
  
  const orderIds = recentOrders.map(o => o.id);
  
  let orderItemsMap = {};
  if (orderIds.length > 0) {
    const placeholders = orderIds.map(() => '?').join(',');
    const items = db.prepare(`
      SELECT si.*, so.created_at as order_date
      FROM sales_items si
      LEFT JOIN sales_orders so ON si.order_id = so.id
      WHERE si.order_id IN (${placeholders})
      ORDER BY so.id DESC, si.id ASC
    `).all(...orderIds);
    
    for (const item of items) {
      if (!orderItemsMap[item.order_id]) {
        orderItemsMap[item.order_id] = [];
      }
      orderItemsMap[item.order_id].push(item);
    }
  }
  
  member.recent_orders = recentOrders.map(order => ({
    ...order,
    items: orderItemsMap[order.id] || []
  }));
  
  res.json(success(member));
});

router.post('/', (req, res) => {
  const { name, phone, member_level = '普通', fishing_type } = req.body;
  
  if (!name) {
    return res.json(fail('会员姓名不能为空'));
  }
  
  if (phone) {
    if (!/^\d{11}$/.test(phone)) {
      return res.json(fail('手机号格式不正确，请输入11位数字'));
    }
    const existing = db.prepare('SELECT id FROM members WHERE phone = ?').get(phone);
    if (existing) {
      return res.json(fail('该手机号已注册'));
    }
  }
  
  try {
    const stmt = db.prepare(`
      INSERT INTO members (name, phone, member_level, fishing_type)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(name, phone || null, member_level, fishing_type || null);
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
    res.json(success(member));
  } catch (e) {
    res.json(fail(e.message));
  }
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, phone, member_level, fishing_type } = req.body;
  
  if (phone) {
    if (!/^\d{11}$/.test(phone)) {
      return res.json(fail('手机号格式不正确，请输入11位数字'));
    }
    const existing = db.prepare('SELECT id FROM members WHERE phone = ? AND id != ?').get(phone, id);
    if (existing) {
      return res.json(fail('该手机号已注册'));
    }
  }
  
  try {
    db.prepare(`
      UPDATE members SET name = ?, phone = ?, member_level = ?, fishing_type = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, phone, member_level, fishing_type, id);
    
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    res.json(success(member));
  } catch (e) {
    res.json(fail(e.message));
  }
});

router.delete('/:id', (req, res) => {
  const orderCount = db.prepare('SELECT COUNT(*) as cnt FROM sales_orders WHERE member_id = ?').get(req.params.id).cnt;
  
  if (orderCount > 0) {
    return res.json(fail(`该会员存在 ${orderCount} 笔关联销售记录，无法删除`));
  }
  
  db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  res.json(success(null, '删除成功'));
});

router.get('/search/select', (req, res) => {
  const { keyword = '' } = req.query;
  
  const list = db.prepare(`
    SELECT id, name, phone, member_level, fishing_type, total_spent, total_orders
    FROM members
    WHERE name LIKE ? OR phone LIKE ?
    ORDER BY name ASC
    LIMIT 50
  `).all(`%${keyword}%`, `%${keyword}%`);
  
  res.json(success(list));
});

export default router;
