import db from './db.js';
import dayjs from 'dayjs';

console.log('=== Members table ===');
const members = db.prepare('SELECT * FROM members').all();
console.log('Total members:', members.length);
members.forEach(m => {
  console.log(`  - id:${m.id} ${m.name} total_spent:${m.total_spent} total_orders:${m.total_orders} created_at:${m.created_at}`);
});

console.log('\n=== Recent Sales Orders ===');
const sales = db.prepare('SELECT * FROM sales_orders ORDER BY id DESC LIMIT 5').all();
sales.forEach(s => {
  console.log(`  - id:${s.id} ${s.order_no} member_id:${s.member_id} total_amount:${s.total_amount} created_at:${s.created_at}`);
});

console.log('\n=== Recent Sale Inventory Logs ===');
const logs = db.prepare('SELECT * FROM inventory_logs WHERE ref_type = "sale" ORDER BY id DESC LIMIT 5').all();
logs.forEach(l => {
  console.log(`  - id:${l.id} product_id:${l.product_id} change_type:${l.change_type} change_qty:${l.change_quantity} ref_type:${l.ref_type} ref_id:${l.ref_id} remark:${l.remark}`);
});

const logCount = db.prepare('SELECT COUNT(*) as cnt FROM inventory_logs').get().cnt;
console.log('\nTotal inventory logs:', logCount);

console.log('\n=== Monthly summary members check ===');
const month = dayjs().format('YYYY-MM');
const startDate = `${month}-01 00:00:00`;
const endDate = dayjs(month).endOf('month').format('YYYY-MM-DD 23:59:59');
console.log('Month:', month);
console.log('Start:', startDate);
console.log('End:', endDate);

const memberCount = db.prepare(`
  SELECT COUNT(*) as cnt FROM members
  WHERE created_at <= ?
`).get(endDate).cnt;
console.log('Member count (created <= endDate):', memberCount);

const newMemberCount = db.prepare(`
  SELECT COUNT(*) as cnt FROM members
  WHERE created_at >= ? AND created_at <= ?
`).get(startDate, endDate).cnt;
console.log('New member count this month:', newMemberCount);
