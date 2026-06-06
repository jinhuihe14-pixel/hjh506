import { Router } from 'express';
import XLSX from 'xlsx';
import dayjs from 'dayjs';
import db from '../db.js';
import { fail } from '../utils.js';

const router = Router();

function sendExcel(res, data, sheetName, fileName) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}.xlsx"`);
  res.send(buffer);
}

router.get('/stocktake/:id', (req, res) => {
  const stocktake = db.prepare('SELECT * FROM stocktakes WHERE id = ?').get(req.params.id);
  
  if (!stocktake) {
    return res.json(fail('盘点单不存在'));
  }
  
  const items = db.prepare(`
    SELECT 
      sku as 'SKU',
      product_name as '商品名称',
      category_name as '分类',
      system_quantity as '账面库存',
      actual_quantity as '实盘数量',
      diff_quantity as '差异数量',
      unit_cost as '单位成本',
      diff_amount as '差异金额'
    FROM stocktake_items 
    WHERE stocktake_id = ? 
    ORDER BY id ASC
  `).all(req.params.id);
  
  sendExcel(res, items, '盘点明细', `盘点单_${stocktake.stocktake_no}`);
});

router.get('/inventory', (req, res) => {
  const { category_id, low_stock } = req.query;
  
  let where = ['p.status = 1'];
  let params = [];
  
  if (category_id) {
    where.push('p.category_id = ?');
    params.push(category_id);
  }
  
  if (low_stock === 'true') {
    where.push('i.quantity <= p.safety_stock');
  }
  
  const whereSql = 'WHERE ' + where.join(' AND ');
  
  const items = db.prepare(`
    SELECT 
      p.sku as 'SKU',
      p.name as '商品名称',
      c.name as '分类',
      p.unit as '单位',
      i.quantity as '库存数量',
      i.avg_cost as '平均成本',
      (i.quantity * i.avg_cost) as '库存金额',
      p.safety_stock as '安全库存',
      CASE WHEN i.quantity <= p.safety_stock THEN '是' ELSE '否' END as '是否低于安全线',
      p.shelf_life_days as '保质期(天)',
      i.last_in_date as '最后入库日期',
      i.last_out_date as '最后出库日期'
    FROM inventory i
    LEFT JOIN products p ON i.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereSql}
    ORDER BY p.id DESC
  `).all(...params);
  
  sendExcel(res, items, '库存清单', `库存清单_${dayjs().format('YYYYMMDD')}`);
});

router.get('/sales/:month', (req, res) => {
  const { month } = req.params;
  const startDate = `${month}-01 00:00:00`;
  const endDate = dayjs(month).endOf('month').format('YYYY-MM-DD 23:59:59');
  
  const items = db.prepare(`
    SELECT 
      so.order_no as '订单号',
      so.order_type as '订单类型',
      so.member_name as '客户',
      p.sku as 'SKU',
      si.product_name as '商品名称',
      c.name as '分类',
      si.quantity as '数量',
      si.unit_price as '单价',
      si.subtotal as '金额',
      si.unit_cost as '成本',
      (si.subtotal - si.quantity * si.unit_cost) as '毛利',
      so.created_at as '下单时间'
    FROM sales_items si
    LEFT JOIN sales_orders so ON si.order_id = so.id
    LEFT JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE so.created_at >= ? AND so.created_at <= ?
    ORDER BY so.id DESC
  `).all(startDate, endDate);
  
  sendExcel(res, items, '销售明细', `销售明细_${month}`);
});

router.get('/purchase/:month', (req, res) => {
  const { month } = req.params;
  const startDate = `${month}-01 00:00:00`;
  const endDate = dayjs(month).endOf('month').format('YYYY-MM-DD 23:59:59');
  
  const items = db.prepare(`
    SELECT 
      po.order_no as '采购单号',
      po.supplier as '供应商',
      p.sku as 'SKU',
      p.name as '商品名称',
      c.name as '分类',
      pi.quantity as '数量',
      pi.unit_price as '单价',
      pi.subtotal as '金额',
      pi.production_date as '生产日期',
      pi.expiry_date as '保质期',
      po.created_at as '入库时间'
    FROM purchase_items pi
    LEFT JOIN purchase_orders po ON pi.order_id = po.id
    LEFT JOIN products p ON pi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE po.created_at >= ? AND po.created_at <= ?
    ORDER BY po.id DESC
  `).all(startDate, endDate);
  
  sendExcel(res, items, '采购明细', `采购明细_${month}`);
});

router.get('/monthly-report/:month', (req, res) => {
  const { month } = req.params;
  const startDate = `${month}-01 00:00:00`;
  const endDate = dayjs(month).endOf('month').format('YYYY-MM-DD 23:59:59');
  
  const productStats = db.prepare(`
    SELECT 
      p.sku as 'SKU',
      p.name as '商品名称',
      c.name as '分类',
      p.unit as '单位',
      COALESCE(SUM(si.quantity), 0) as '销售数量',
      COALESCE(SUM(si.subtotal), 0) as '销售金额',
      COALESCE(SUM(si.quantity * si.unit_cost), 0) as '销售成本',
      COALESCE(SUM(si.subtotal - si.quantity * si.unit_cost), 0) as '毛利',
      CASE 
        WHEN COALESCE(SUM(si.subtotal), 0) > 0 
        THEN ROUND(COALESCE(SUM(si.subtotal - si.quantity * si.unit_cost), 0) / COALESCE(SUM(si.subtotal), 0) * 100, 2)
        ELSE 0 
      END as '毛利率(%)',
      i.quantity as '期末库存'
    FROM products p
    LEFT JOIN sales_items si ON p.id = si.product_id
    LEFT JOIN sales_orders so ON si.order_id = so.id
      AND so.created_at >= ? AND so.created_at <= ?
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN inventory i ON p.id = i.product_id
    WHERE p.status = 1
    GROUP BY p.id
    ORDER BY COALESCE(SUM(si.subtotal), 0) DESC
  `).all(startDate, endDate);
  
  const categoryStats = db.prepare(`
    SELECT 
      c.name as '分类',
      COUNT(DISTINCT p.id) as '商品数',
      COALESCE(SUM(si.quantity), 0) as '销售数量',
      COALESCE(SUM(si.subtotal), 0) as '销售金额',
      COALESCE(SUM(si.subtotal - si.quantity * si.unit_cost), 0) as '毛利',
      CASE 
        WHEN COALESCE(SUM(si.subtotal), 0) > 0 
        THEN ROUND(COALESCE(SUM(si.subtotal - si.quantity * si.unit_cost), 0) / COALESCE(SUM(si.subtotal), 0) * 100, 2)
        ELSE 0 
      END as '毛利率(%)'
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id
    LEFT JOIN sales_items si ON p.id = si.product_id
    LEFT JOIN sales_orders so ON si.order_id = so.id
      AND so.created_at >= ? AND so.created_at <= ?
    WHERE p.status = 1
    GROUP BY c.id
    ORDER BY COALESCE(SUM(si.subtotal), 0) DESC
  `).all(startDate, endDate);
  
  const memberStats = db.prepare(`
    SELECT 
      m.name as '会员姓名',
      m.phone as '电话',
      m.member_level as '会员等级',
      m.fishing_type as '垂钓类型',
      COUNT(DISTINCT so.id) as '订单数',
      COALESCE(SUM(si.subtotal), 0) as '消费金额',
      COALESCE(SUM(si.quantity), 0) as '购买数量'
    FROM members m
    LEFT JOIN sales_orders so ON m.id = so.member_id
      AND so.created_at >= ? AND so.created_at <= ?
    LEFT JOIN sales_items si ON so.id = si.order_id
    GROUP BY m.id
    ORDER BY COALESCE(SUM(si.subtotal), 0) DESC
  `).all(startDate, endDate);
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productStats), '单品分析');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categoryStats), '品类分析');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(memberStats), '会员分析');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="月度分析报表_${month}.xlsx"`);
  res.send(buffer);
});

export default router;
