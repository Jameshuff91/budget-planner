const express = require('express');
const { authenticate, auditLog } = require('../middleware/auth');
const { getDatabase } = require('../db/init');
const { body, validationResult, query } = require('express-validator');

const router = express.Router();

// Get transactions with filtering and pagination
router.get(
  '/',
  authenticate,
  auditLog('GET_TRANSACTIONS', 'transactions'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601(),
    query('category').optional().isString(),
    query('search').optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = req.query.page || 1;
      const limit = req.query.limit || 50;
      const offset = (page - 1) * limit;

      const db = getDatabase();
      let whereConditions = ['user_id = ?'];
      let params = [req.user.id];

      // Add filters
      if (req.query.start_date) {
        whereConditions.push('date >= ?');
        params.push(req.query.start_date);
      }

      if (req.query.end_date) {
        whereConditions.push('date <= ?');
        params.push(req.query.end_date);
      }

      if (req.query.category) {
        whereConditions.push('category = ?');
        params.push(req.query.category);
      }

      if (req.query.search) {
        whereConditions.push('(name LIKE ? OR merchant_name LIKE ?)');
        const searchTerm = `%${req.query.search}%`;
        params.push(searchTerm, searchTerm);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countStmt = db.prepare(`
        SELECT COUNT(*) as total 
        FROM transactions 
        WHERE ${whereClause}
      `);
      const { total } = countStmt.get(...params);

      // Get paginated transactions
      const stmt = db.prepare(`
        SELECT * FROM transactions
        WHERE ${whereClause}
        ORDER BY date DESC, created_at DESC
        LIMIT ? OFFSET ?
      `);

      const transactions = stmt.all(...params, limit, offset);

      res.json({
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error getting transactions:', error);
      res.status(500).json({ error: 'Failed to get transactions' });
    }
  },
);

// Get transaction by ID
router.get('/:id', authenticate, auditLog('GET_TRANSACTION', 'transactions'), async (req, res) => {
  try {
    const db = getDatabase();
    const transaction = db
      .prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Error getting transaction:', error);
    res.status(500).json({ error: 'Failed to get transaction' });
  }
});

// Create manual transaction
router.post(
  '/',
  authenticate,
  auditLog('CREATE_TRANSACTION', 'transactions'),
  [
    body('amount').isFloat().withMessage('Valid amount required'),
    body('date').isISO8601().withMessage('Valid date required'),
    body('name').notEmpty().withMessage('Transaction name required'),
    body('category').notEmpty().withMessage('Category required'),
    body('type').optional().isIn(['income', 'expense']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { amount, date, name, merchant_name, category, subcategory, type } = req.body;

      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT INTO transactions (
          user_id, amount, date, name, merchant_name,
          category, subcategory, type, pending
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      const result = stmt.run(
        req.user.id,
        amount,
        date,
        name,
        merchant_name || null,
        category,
        subcategory || null,
        type || 'expense',
      );

      const newTransaction = db
        .prepare('SELECT * FROM transactions WHERE id = ?')
        .get(result.lastInsertRowid);

      res.status(201).json(newTransaction);
    } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(500).json({ error: 'Failed to create transaction' });
    }
  },
);

// Update transaction
router.put(
  '/:id',
  authenticate,
  auditLog('UPDATE_TRANSACTION', 'transactions'),
  [
    body('amount').optional().isFloat(),
    body('date').optional().isISO8601(),
    body('name').optional().notEmpty(),
    body('category').optional().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const db = getDatabase();

      // Check transaction exists and belongs to user
      const existing = db
        .prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?')
        .get(req.params.id, req.user.id);

      if (!existing) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Build update query dynamically
      const updates = [];
      const values = [];

      const allowedFields = ['amount', 'date', 'name', 'merchant_name', 'category', 'subcategory'];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(req.body[field]);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      // Add updated_at
      updates.push('updated_at = CURRENT_TIMESTAMP');

      // Add WHERE clause params
      values.push(req.params.id, req.user.id);

      const stmt = db.prepare(`
        UPDATE transactions 
        SET ${updates.join(', ')}
        WHERE id = ? AND user_id = ?
      `);

      stmt.run(...values);

      const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);

      res.json(updated);
    } catch (error) {
      console.error('Error updating transaction:', error);
      res.status(500).json({ error: 'Failed to update transaction' });
    }
  },
);

// Delete transaction
router.delete(
  '/:id',
  authenticate,
  auditLog('DELETE_TRANSACTION', 'transactions'),
  async (req, res) => {
    try {
      const db = getDatabase();

      // Check transaction exists and belongs to user
      const existing = db
        .prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?')
        .get(req.params.id, req.user.id);

      if (!existing) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Only allow deletion of manual transactions
      if (existing.plaid_transaction_id) {
        return res.status(403).json({
          error: 'Cannot delete synced transactions. Remove the bank connection instead.',
        });
      }

      db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(
        req.params.id,
        req.user.id,
      );

      res.json({ success: true, message: 'Transaction deleted' });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      res.status(500).json({ error: 'Failed to delete transaction' });
    }
  },
);

// Get spending analytics
router.get(
  '/analytics/spending',
  authenticate,
  auditLog('GET_ANALYTICS', 'transactions'),
  async (req, res) => {
    try {
      const { start_date, end_date } = req.query;
      const db = getDatabase();

      let whereClause = 'user_id = ?';
      const params = [req.user.id];

      if (start_date) {
        whereClause += ' AND date >= ?';
        params.push(start_date);
      }

      if (end_date) {
        whereClause += ' AND date <= ?';
        params.push(end_date);
      }

      // Get spending by category
      const categoryStmt = db.prepare(`
        SELECT 
          category,
          COUNT(*) as transaction_count,
          SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_spent,
          AVG(CASE WHEN amount > 0 THEN amount ELSE 0 END) as avg_transaction
        FROM transactions
        WHERE ${whereClause} AND amount > 0
        GROUP BY category
        ORDER BY total_spent DESC
      `);

      const categoryData = categoryStmt.all(...params);

      // Get monthly trends
      const monthlyStmt = db.prepare(`
        SELECT 
          strftime('%Y-%m', date) as month,
          SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as expenses,
          SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as income
        FROM transactions
        WHERE ${whereClause}
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `);

      const monthlyData = monthlyStmt.all(...params);

      res.json({
        byCategory: categoryData,
        byMonth: monthlyData.reverse(),
      });
    } catch (error) {
      console.error('Error getting analytics:', error);
      res.status(500).json({ error: 'Failed to get analytics' });
    }
  },
);

module.exports = router;
