import { Router } from 'express';
import db from '../db.js';
import { success, fail } from '../utils.js';

const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, 
           (SELECT COUNT(*) FROM products WHERE category_id = c.id) as product_count
    FROM categories c
    ORDER BY c.sort_order ASC, c.id ASC
  `).all();
  res.json(success(rows));
});

router.get('/tree', (req, res) => {
  const all = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, id ASC').all();
  
  const buildTree = (parentId = null) => {
    return all
      .filter(c => c.parent_id === parentId)
      .map(c => ({
        ...c,
        children: buildTree(c.id)
      }));
  };
  
  res.json(success(buildTree()));
});

router.post('/', (req, res) => {
  const { name, parent_id = null, sort_order = 0 } = req.body;
  
  if (!name) {
    return res.json(fail('分类名称不能为空'));
  }
  
  try {
    const stmt = db.prepare('INSERT INTO categories (name, parent_id, sort_order) VALUES (?, ?, ?)');
    const result = stmt.run(name, parent_id, sort_order);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.json(success(category));
  } catch (e) {
    res.json(fail(e.message));
  }
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, parent_id, sort_order } = req.body;
  
  try {
    db.prepare('UPDATE categories SET name = ?, parent_id = ?, sort_order = ? WHERE id = ?')
      .run(name, parent_id, sort_order, id);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.json(success(category));
  } catch (e) {
    res.json(fail(e.message));
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  const count = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE category_id = ?').get(id);
  if (count.cnt > 0) {
    return res.json(fail('该分类下还有商品，不能删除'));
  }
  
  const childCount = db.prepare('SELECT COUNT(*) as cnt FROM categories WHERE parent_id = ?').get(id);
  if (childCount.cnt > 0) {
    return res.json(fail('该分类下还有子分类，不能删除'));
  }
  
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json(success(null, '删除成功'));
});

export default router;
