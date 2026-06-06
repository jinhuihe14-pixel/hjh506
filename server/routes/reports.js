import { Router } from 'express';
import dayjs from 'dayjs';
import db from '../db.js';
import { success, fail } from '../utils.js';

const router = Router();

router.get('/daily/replenishment', (req, res) => {
  const list = db.prepare(`
    SELECT p.id, p.sku, p.name, p.unit, p.safety_stock, 
           i.quantity as current_stock, i.avg_cost,
           c.name as category_name,
           (p.safety_stock - i.quantity) as need_quantity
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.status = 1 AND i.quantity <= p.safety_stock
    ORDER BY need_quantity DESC, p.id DESC
  `).all();
  
  res.json(success(list));
});

router.get('/daily/expiry', (req, res) => {
  const { days = 30 } = req.query;
  const today = dayjs().format('YYYY-MM-DD');
  const expiryDate = dayjs().add(days, 'day').format('YYYY-MM-DD');
  
  const list = db.prepare(`
    SELECT DISTINCT p.id, p.sku, p.name, p.unit, p.shelf_life_days,
           i.quantity as current_stock,
           c.name as category_name,
           pi.expiry_date,
           pi.production_date,
           pi.quantity as batch_quantity
    FROM purchase_items pi
    LEFT JOIN products p ON pi.product_id = p.id
    LEFT JOIN inventory i ON p.id = i.product_id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE pi.expiry_date IS NOT NULL 
      AND pi.expiry_date <= ?
      AND pi.expiry_date >= ?
      AND p.status = 1
    ORDER BY pi.expiry_date ASC
  `).all(expiryDate, today);
  
  res.json(success(list));
});

router.get('/daily/slow-moving', (req, res) => {
  const { days = 60 } = req.query;
  const dateThreshold = dayjs().subtract(days, 'day').format('YYYY-MM-DD HH:mm:ss');
  
  const list = db.prepare(`
    SELECT p.id, p.sku, p.name, p.unit,
           i.quantity as current_stock, i.avg_cost, i.last_out_date,
           c.name as category_name,
           (i.quantity * i.avg_cost) as stock_value,
           CAST(julianday('now') - julianday(COALESCE(i.last_out_date, p.created_at)) AS INTEGER) as days_no_sale
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.status = 1 
      AND i.quantity > 0
      AND (i.last_out_date IS NULL OR i.last_out_date <= ?)
    ORDER BY days_no_sale DESC, stock_value DESC
  `).all(dateThreshold);
  
  res.json(success(list));
});

router.get('/monthly/summary', (req, res) => {
  const { month } = req.query;
  const targetMonth = month || dayjs().format('YYYY-MM');
  const startDate = `${targetMonth}-01 00:00:00`;
  const endDate = dayjs(targetMonth).endOf('month').format('YYYY-MM-DD 23:59:59');
  
  const salesStats = db.prepare(`
    SELECT 
      COUNT(*) as order_count,
      COALESCE(SUM(total_amount), 0) as sales_amount,
      COALESCE(SUM(total_cost), 0) as cost_amount,
      COALESCE(SUM(total_quantity), 0) as total_quantity,
      COALESCE(SUM(CASE WHEN order_type = 'retail' THEN 1 ELSE 0 END), 0) as retail_orders,
      COALESCE(SUM(CASE WHEN order_type = 'wholesale' THEN 1 ELSE 0 END), 0) as wholesale_orders
    FROM sales_orders
    WHERE created_at >= ? AND created_at <= ?
  `).get(startDate, endDate);
  
  const purchaseStats = db.prepare(`
    SELECT 
      COUNT(*) as order_count,
      COALESCE(SUM(total_amount), 0) as purchase_amount,
      COALESCE(SUM(total_quantity), 0) as total_quantity
    FROM purchase_orders
    WHERE created_at >= ? AND created_at <= ?
  `).get(startDate, endDate);
  
  const memberCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM members
    WHERE created_at <= ?
  `).get(endDate).cnt;
  
  const newMemberCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM members
    WHERE created_at >= ? AND created_at <= ?
  `).get(startDate, endDate).cnt;
  
  const grossProfit = salesStats.sales_amount - salesStats.cost_amount;
  const grossMargin = salesStats.sales_amount > 0 ? (grossProfit / salesStats.sales_amount * 100) : 0;
  
  res.json(success({
    month: targetMonth,
    sales: {
      order_count: salesStats.order_count,
      sales_amount: Math.round(salesStats.sales_amount * 100) / 100,
      cost_amount: Math.round(salesStats.cost_amount * 100) / 100,
      gross_profit: Math.round(grossProfit * 100) / 100,
      gross_margin: Math.round(grossMargin * 100) / 100,
      total_quantity: salesStats.total_quantity,
      retail_orders: salesStats.retail_orders,
      wholesale_orders: salesStats.wholesale_orders
    },
    purchase: {
      order_count: purchaseStats.order_count,
      purchase_amount: Math.round(purchaseStats.purchase_amount * 100) / 100,
      total_quantity: purchaseStats.total_quantity
    },
    members: {
      total: memberCount,
      new_count: newMemberCount
    }
  }));
});

router.get('/monthly/products', (req, res) => {
  const { month, sort_by = 'sales_amount', sort_order = 'desc', limit = 50 } = req.query;
  const targetMonth = month || dayjs().format('YYYY-MM');
  const startDate = `${targetMonth}-01 00:00:00`;
  const endDate = dayjs(targetMonth).endOf('month').format('YYYY-MM-DD 23:59:59');
  
  const list = db.prepare(`
    SELECT 
      p.id, p.sku, p.name, p.unit,
      c.name as category_name,
      COALESCE(SUM(si.quantity), 0) as sales_quantity,
      COALESCE(SUM(si.subtotal), 0) as sales_amount,
      COALESCE(SUM(si.quantity * si.unit_cost), 0) as cost_amount,
      COALESCE(SUM(si.subtotal - si.quantity * si.unit_cost), 0) as gross_profit,
      i.quantity as current_stock,
      i.avg_cost,
      CASE 
        WHEN AVG(i.quantity) > 0 
        THEN CAST(julianday(?) - julianday(?) AS INTEGER) / (COALESCE(SUM(si.quantity), 0) / NULLIF(AVG(i.quantity), 0))
        ELSE NULL 
      END as turnover_days
    FROM products p
    LEFT JOIN sales_items si ON p.id = si.product_id
    LEFT JOIN sales_orders so ON si.order_id = so.id
      AND so.created_at >= ? AND so.created_at <= ?
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN inventory i ON p.id = i.product_id
    WHERE p.status = 1
    GROUP BY p.id
    HAVING sales_quantity > 0
    ORDER BY ${sort_by} ${sort_order === 'asc' ? 'ASC' : 'DESC'}
    LIMIT ?
  `).all(endDate, startDate, startDate, endDate, limit);
  
  list.forEach(item => {
    item.sales_amount = Math.round(item.sales_amount * 100) / 100;
    item.cost_amount = Math.round(item.cost_amount * 100) / 100;
    item.gross_profit = Math.round(item.gross_profit * 100) / 100;
    item.gross_margin = item.sales_amount > 0 
      ? Math.round(item.gross_profit / item.sales_amount * 10000) / 100 
      : 0;
    if (item.turnover_days) {
      item.turnover_days = Math.round(item.turnover_days * 10) / 10;
    }
  });
  
  res.json(success(list));
});

router.get('/monthly/categories', (req, res) => {
  const { month } = req.query;
  const targetMonth = month || dayjs().format('YYYY-MM');
  const startDate = `${targetMonth}-01 00:00:00`;
  const endDate = dayjs(targetMonth).endOf('month').format('YYYY-MM-DD 23:59:59');
  
  const list = db.prepare(`
    SELECT 
      c.id, c.name as category_name,
      COUNT(DISTINCT p.id) as product_count,
      COALESCE(SUM(si.quantity), 0) as sales_quantity,
      COALESCE(SUM(si.subtotal), 0) as sales_amount,
      COALESCE(SUM(si.subtotal - si.quantity * si.unit_cost), 0) as gross_profit,
      COALESCE(SUM(i.quantity), 0) as total_stock,
      COALESCE(SUM(i.quantity * i.avg_cost), 0) as stock_value
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id
    LEFT JOIN sales_items si ON p.id = si.product_id
    LEFT JOIN sales_orders so ON si.order_id = so.id
      AND so.created_at >= ? AND so.created_at <= ?
    LEFT JOIN inventory i ON p.id = i.product_id
    WHERE p.status = 1
    GROUP BY c.id
    ORDER BY sales_amount DESC
  `).all(startDate, endDate);
  
  list.forEach(item => {
    item.sales_amount = Math.round(item.sales_amount * 100) / 100;
    item.gross_profit = Math.round(item.gross_profit * 100) / 100;
    item.stock_value = Math.round(item.stock_value * 100) / 100;
    item.gross_margin = item.sales_amount > 0 
      ? Math.round(item.gross_profit / item.sales_amount * 10000) / 100 
      : 0;
  });
  
  res.json(success(list));
});

router.get('/monthly/members', (req, res) => {
  const { month, fishing_type } = req.query;
  const targetMonth = month || dayjs().format('YYYY-MM');
  const startDate = `${targetMonth}-01 00:00:00`;
  const endDate = dayjs(targetMonth).endOf('month').format('YYYY-MM-DD 23:59:59');
  
  let whereSql = '';
  let params = [startDate, endDate];
  
  if (fishing_type) {
    whereSql = 'AND m.fishing_type = ?';
    params.push(fishing_type);
  }
  
  const list = db.prepare(`
    SELECT 
      m.id, m.name, m.phone, m.member_level, m.fishing_type,
      COUNT(DISTINCT so.id) as order_count,
      COALESCE(SUM(si.subtotal), 0) as total_amount,
      COALESCE(SUM(si.quantity), 0) as total_quantity
    FROM members m
    LEFT JOIN sales_orders so ON m.id = so.member_id
      AND so.created_at >= ? AND so.created_at <= ?
    LEFT JOIN sales_items si ON so.id = si.order_id
    WHERE 1=1 ${whereSql}
    GROUP BY m.id
    ORDER BY total_amount DESC
    LIMIT 100
  `).all(...params);
  
  list.forEach(item => {
    item.total_amount = Math.round(item.total_amount * 100) / 100;
    item.avg_order_amount = item.order_count > 0 
      ? Math.round(item.total_amount / item.order_count * 100) / 100 
      : 0;
  });
  
  res.json(success(list));
});

router.get('/monthly/fishing-types', (req, res) => {
  const { month } = req.query;
  const targetMonth = month || dayjs().format('YYYY-MM');
  const startDate = `${targetMonth}-01 00:00:00`;
  const endDate = dayjs(targetMonth).endOf('month').format('YYYY-MM-DD 23:59:59');
  
  const list = db.prepare(`
    SELECT 
      m.fishing_type,
      COUNT(DISTINCT m.id) as member_count,
      COUNT(DISTINCT so.id) as order_count,
      COALESCE(SUM(si.subtotal), 0) as total_amount
    FROM members m
    LEFT JOIN sales_orders so ON m.id = so.member_id
      AND so.created_at >= ? AND so.created_at <= ?
    LEFT JOIN sales_items si ON so.id = si.order_id
    WHERE m.fishing_type IS NOT NULL AND m.fishing_type != ''
    GROUP BY m.fishing_type
    ORDER BY total_amount DESC
  `).all(startDate, endDate);
  
  list.forEach(item => {
    item.total_amount = Math.round(item.total_amount * 100) / 100;
    item.avg_per_member = item.member_count > 0 
      ? Math.round(item.total_amount / item.member_count * 100) / 100 
      : 0;
  });
  
  res.json(success(list));
});

router.get('/monthly/category-preference', (req, res) => {
  const { month, fishing_type } = req.query;
  const targetMonth = month || dayjs().format('YYYY-MM');
  const startDate = `${targetMonth}-01 00:00:00`;
  const endDate = dayjs(targetMonth).endOf('month').format('YYYY-MM-DD 23:59:59');
  
  let typeWhere = '';
  let params = [startDate, endDate];
  
  if (fishing_type) {
    typeWhere = 'AND m.fishing_type = ?';
    params.push(fishing_type);
  }
  
  const list = db.prepare(`
    SELECT 
      c.name as category_name,
      COUNT(DISTINCT si.id) as item_count,
      COALESCE(SUM(si.quantity), 0) as total_quantity,
      COALESCE(SUM(si.subtotal), 0) as total_amount
    FROM sales_items si
    LEFT JOIN sales_orders so ON si.order_id = so.id
    LEFT JOIN members m ON so.member_id = m.id
    LEFT JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE so.created_at >= ? AND so.created_at <= ? ${typeWhere}
      AND so.member_id IS NOT NULL
    GROUP BY c.id
    ORDER BY total_amount DESC
  `).all(...params);
  
  res.json(success(list));
});

router.get('/trend/sales', (req, res) => {
  const { months = 6 } = req.query;
  const result = [];
  
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = dayjs().subtract(i, 'month');
    const monthStr = monthDate.format('YYYY-MM');
    const startDate = monthDate.startOf('month').format('YYYY-MM-DD HH:mm:ss');
    const endDate = monthDate.endOf('month').format('YYYY-MM-DD HH:mm:ss');
    
    const stats = db.prepare(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as sales_amount,
        COALESCE(SUM(total_quantity), 0) as sales_quantity,
        COUNT(*) as order_count
      FROM sales_orders
      WHERE created_at >= ? AND created_at <= ?
    `).get(startDate, endDate);
    
    result.push({
      month: monthStr,
      sales_amount: Math.round(stats.sales_amount * 100) / 100,
      sales_quantity: stats.sales_quantity,
      order_count: stats.order_count
    });
  }
  
  res.json(success(result));
});

router.get('/trend/yoy', (req, res) => {
  const { month } = req.query;
  const currentMonth = month || dayjs().format('YYYY-MM');
  const lastMonth = dayjs(currentMonth).subtract(1, 'month').format('YYYY-MM');
  const sameMonthLastYear = dayjs(currentMonth).subtract(1, 'year').format('YYYY-MM');
  
  const getMonthStats = (monthStr) => {
    const startDate = dayjs(monthStr).startOf('month').format('YYYY-MM-DD HH:mm:ss');
    const endDate = dayjs(monthStr).endOf('month').format('YYYY-MM-DD HH:mm:ss');
    
    return db.prepare(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as sales_amount,
        COALESCE(SUM(total_quantity), 0) as sales_quantity,
        COUNT(*) as order_count,
        COALESCE(SUM(total_cost), 0) as cost_amount
      FROM sales_orders
      WHERE created_at >= ? AND created_at <= ?
    `).get(startDate, endDate);
  };
  
  const current = getMonthStats(currentMonth);
  const last = getMonthStats(lastMonth);
  const lastYear = getMonthStats(sameMonthLastYear);
  
  const calcGrowth = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round((current - previous) / previous * 10000) / 100;
  };
  
  res.json(success({
    current_month: currentMonth,
    current: {
      sales_amount: Math.round(current.sales_amount * 100) / 100,
      sales_quantity: current.sales_quantity,
      order_count: current.order_count,
      gross_profit: Math.round((current.sales_amount - current.cost_amount) * 100) / 100
    },
    last_month: {
      month: lastMonth,
      sales_amount: Math.round(last.sales_amount * 100) / 100,
      sales_quantity: last.sales_quantity,
      order_count: last.order_count,
      growth_amount: calcGrowth(current.sales_amount, last.sales_amount),
      growth_quantity: calcGrowth(current.sales_quantity, last.sales_quantity)
    },
    last_year: {
      month: sameMonthLastYear,
      sales_amount: Math.round(lastYear.sales_amount * 100) / 100,
      sales_quantity: lastYear.sales_quantity,
      order_count: lastYear.order_count,
      growth_amount: calcGrowth(current.sales_amount, lastYear.sales_amount),
      growth_quantity: calcGrowth(current.sales_quantity, lastYear.sales_quantity)
    }
  }));
});

router.get('/saved/daily', (req, res) => {
  const { page = 1, pageSize = 30 } = req.query;
  const offset = (page - 1) * pageSize;
  
  const total = db.prepare('SELECT COUNT(*) as cnt FROM daily_reports').get().cnt;
  
  const list = db.prepare(`
    SELECT id, report_date, created_at FROM daily_reports
    ORDER BY report_date DESC
    LIMIT ? OFFSET ?
  `).all(Number(pageSize), offset);
  
  res.json(success({ list, total, page: Number(page), pageSize: Number(pageSize) }));
});

router.get('/saved/daily/:date', (req, res) => {
  const report = db.prepare('SELECT * FROM daily_reports WHERE report_date = ?').get(req.params.date);
  
  if (!report) {
    return res.json(fail('报表不存在'));
  }
  
  report.replenishment_list = report.replenishment_list ? JSON.parse(report.replenishment_list) : [];
  report.expiry_list = report.expiry_list ? JSON.parse(report.expiry_list) : [];
  report.slow_moving_list = report.slow_moving_list ? JSON.parse(report.slow_moving_list) : [];
  
  res.json(success(report));
});

router.get('/saved/monthly', (req, res) => {
  const { page = 1, pageSize = 12 } = req.query;
  const offset = (page - 1) * pageSize;
  
  const total = db.prepare('SELECT COUNT(*) as cnt FROM monthly_reports').get().cnt;
  
  const list = db.prepare(`
    SELECT id, report_month, summary, created_at FROM monthly_reports
    ORDER BY report_month DESC
    LIMIT ? OFFSET ?
  `).all(Number(pageSize), offset);
  
  list.forEach(item => {
    item.summary = item.summary ? JSON.parse(item.summary) : null;
  });
  
  res.json(success({ list, total, page: Number(page), pageSize: Number(pageSize) }));
});

router.get('/saved/monthly/:month', (req, res) => {
  const report = db.prepare('SELECT * FROM monthly_reports WHERE report_month = ?').get(req.params.month);
  
  if (!report) {
    return res.json(fail('报表不存在'));
  }
  
  report.product_stats = report.product_stats ? JSON.parse(report.product_stats) : [];
  report.member_stats = report.member_stats ? JSON.parse(report.member_stats) : [];
  report.category_stats = report.category_stats ? JSON.parse(report.category_stats) : [];
  report.summary = report.summary ? JSON.parse(report.summary) : null;
  
  res.json(success(report));
});

export default router;
