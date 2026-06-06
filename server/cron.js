import cron from 'node-cron';
import dayjs from 'dayjs';
import db from './db.js';

export function generateDailyReport() {
  const today = dayjs().format('YYYY-MM-DD');
  
  const replenishmentList = db.prepare(`
    SELECT p.id, p.sku, p.name, p.unit, p.safety_stock, 
           i.quantity as current_stock, i.avg_cost,
           c.name as category_name,
           (p.safety_stock - i.quantity) as need_quantity
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.status = 1 AND i.quantity <= p.safety_stock
    ORDER BY need_quantity DESC
  `).all();
  
  const expiryDate = dayjs().add(30, 'day').format('YYYY-MM-DD');
  const expiryList = db.prepare(`
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
  
  const slowMovingDate = dayjs().subtract(60, 'day').format('YYYY-MM-DD HH:mm:ss');
  const slowMovingList = db.prepare(`
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
  `).all(slowMovingDate);
  
  db.prepare(`
    INSERT OR REPLACE INTO daily_reports 
    (report_date, replenishment_list, expiry_list, slow_moving_list)
    VALUES (?, ?, ?, ?)
  `).run(
    today,
    JSON.stringify(replenishmentList),
    JSON.stringify(expiryList),
    JSON.stringify(slowMovingList)
  );
  
  console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 每日报表已生成`);
  return { replenishmentList, expiryList, slowMovingList };
}

export function generateMonthlyReport(month) {
  const targetMonth = month || dayjs().subtract(1, 'month').format('YYYY-MM');
  const startDate = `${targetMonth}-01 00:00:00`;
  const endDate = dayjs(targetMonth).endOf('month').format('YYYY-MM-DD 23:59:59');
  
  const productStats = db.prepare(`
    SELECT 
      p.id, p.sku, p.name, p.unit,
      c.name as category_name,
      COALESCE(SUM(si.quantity), 0) as sales_quantity,
      COALESCE(SUM(si.subtotal), 0) as sales_amount,
      COALESCE(SUM(si.quantity * si.unit_cost), 0) as cost_amount,
      COALESCE(SUM(si.subtotal - si.quantity * si.unit_cost), 0) as gross_profit,
      i.quantity as end_stock,
      i.avg_cost
    FROM products p
    LEFT JOIN sales_items si ON p.id = si.product_id
    LEFT JOIN sales_orders so ON si.order_id = so.id
      AND so.created_at >= ? AND so.created_at <= ?
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN inventory i ON p.id = i.product_id
    WHERE p.status = 1
    GROUP BY p.id
    HAVING sales_quantity > 0
    ORDER BY sales_amount DESC
  `).all(startDate, endDate);
  
  productStats.forEach(item => {
    item.sales_amount = Math.round(item.sales_amount * 100) / 100;
    item.cost_amount = Math.round(item.cost_amount * 100) / 100;
    item.gross_profit = Math.round(item.gross_profit * 100) / 100;
    item.gross_margin = item.sales_amount > 0 
      ? Math.round(item.gross_profit / item.sales_amount * 10000) / 100 
      : 0;
  });
  
  const memberStats = db.prepare(`
    SELECT 
      m.id, m.name, m.phone, m.member_level, m.fishing_type,
      COUNT(DISTINCT so.id) as order_count,
      COALESCE(SUM(si.subtotal), 0) as total_amount,
      COALESCE(SUM(si.quantity), 0) as total_quantity
    FROM members m
    LEFT JOIN sales_orders so ON m.id = so.member_id
      AND so.created_at >= ? AND so.created_at <= ?
    LEFT JOIN sales_items si ON so.id = si.order_id
    GROUP BY m.id
    ORDER BY total_amount DESC
  `).all(startDate, endDate);
  
  memberStats.forEach(item => {
    item.total_amount = Math.round(item.total_amount * 100) / 100;
  });
  
  const categoryStats = db.prepare(`
    SELECT 
      c.id, c.name as category_name,
      COUNT(DISTINCT p.id) as product_count,
      COALESCE(SUM(si.quantity), 0) as sales_quantity,
      COALESCE(SUM(si.subtotal), 0) as sales_amount,
      COALESCE(SUM(si.subtotal - si.quantity * si.unit_cost), 0) as gross_profit
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id
    LEFT JOIN sales_items si ON p.id = si.product_id
    LEFT JOIN sales_orders so ON si.order_id = so.id
      AND so.created_at >= ? AND so.created_at <= ?
    WHERE p.status = 1
    GROUP BY c.id
    ORDER BY sales_amount DESC
  `).all(startDate, endDate);
  
  categoryStats.forEach(item => {
    item.sales_amount = Math.round(item.sales_amount * 100) / 100;
    item.gross_profit = Math.round(item.gross_profit * 100) / 100;
    item.gross_margin = item.sales_amount > 0 
      ? Math.round(item.gross_profit / item.sales_amount * 10000) / 100 
      : 0;
  });
  
  const salesTotal = db.prepare(`
    SELECT 
      COUNT(*) as order_count,
      COALESCE(SUM(total_amount), 0) as sales_amount,
      COALESCE(SUM(total_cost), 0) as cost_amount,
      COALESCE(SUM(total_quantity), 0) as total_quantity
    FROM sales_orders
    WHERE created_at >= ? AND created_at <= ?
  `).get(startDate, endDate);
  
  const summary = {
    month: targetMonth,
    order_count: salesTotal.order_count,
    sales_amount: Math.round(salesTotal.sales_amount * 100) / 100,
    cost_amount: Math.round(salesTotal.cost_amount * 100) / 100,
    gross_profit: Math.round((salesTotal.sales_amount - salesTotal.cost_amount) * 100) / 100,
    gross_margin: salesTotal.sales_amount > 0 
      ? Math.round((salesTotal.sales_amount - salesTotal.cost_amount) / salesTotal.sales_amount * 10000) / 100 
      : 0,
    total_quantity: salesTotal.total_quantity,
    product_count: productStats.length
  };
  
  db.prepare(`
    INSERT OR REPLACE INTO monthly_reports 
    (report_month, product_stats, member_stats, category_stats, summary)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    targetMonth,
    JSON.stringify(productStats),
    JSON.stringify(memberStats),
    JSON.stringify(categoryStats),
    JSON.stringify(summary)
  );
  
  console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 月度报表已生成: ${targetMonth}`);
  return { productStats, memberStats, categoryStats, summary };
}

export function startCronJobs() {
  cron.schedule('0 1 * * *', () => {
    console.log('开始执行每日报表生成任务...');
    generateDailyReport();
  });
  
  cron.schedule('0 2 1 * *', () => {
    console.log('开始执行上月月度报表生成任务...');
    generateMonthlyReport();
  });
  
  console.log('定时任务已启动: 每日1点生成日报表，每月1日2点生成月报表');
}
