const express = require('express');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const { authenticate, auditLog } = require('../middleware/auth');
const { getDatabase } = require('../db/init');

const router = express.Router();

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// Create link token
router.post('/link/token', 
  authenticate,
  auditLog('CREATE_LINK_TOKEN', 'plaid'),
  async (req, res) => {
    try {
      const configs = {
        user: {
          client_user_id: req.user.id.toString(),
        },
        client_name: 'Budget Planner',
        products: ['transactions'],
        required_if_supported_products: ['accounts'],
        country_codes: ['US'],
        language: 'en',
        redirect_uri: process.env.PLAID_REDIRECT_URI || null,
        webhook: process.env.PLAID_WEBHOOK_URL || null,
      };

      const createTokenResponse = await plaidClient.linkTokenCreate(configs);
      
      res.json({
        link_token: createTokenResponse.data.link_token,
        expiration: createTokenResponse.data.expiration,
      });
    } catch (error) {
      console.error('Error creating link token:', error);
      res.status(500).json({ 
        error: 'Failed to create link token',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Exchange public token for access token
router.post('/link/exchange',
  authenticate,
  auditLog('EXCHANGE_TOKEN', 'plaid'),
  async (req, res) => {
    try {
      const { public_token } = req.body;

      if (!public_token) {
        return res.status(400).json({ error: 'Public token required' });
      }

      // Exchange public token for access token
      const exchangeResponse = await plaidClient.itemPublicTokenExchange({
        public_token,
      });

      const { access_token, item_id } = exchangeResponse.data;

      // Get item details
      const itemResponse = await plaidClient.itemGet({
        access_token,
      });

      const institution = itemResponse.data.item.institution_id;

      // Store in database
      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT INTO plaid_items (user_id, access_token, item_id, institution_id, institution_name)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(
        req.user.id,
        access_token,
        item_id,
        institution,
        itemResponse.data.institution?.name || 'Unknown'
      );

      res.json({
        success: true,
        item_id,
        institution_name: itemResponse.data.institution?.name,
      });
    } catch (error) {
      console.error('Error exchanging token:', error);
      res.status(500).json({ 
        error: 'Failed to exchange token',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Get accounts
router.get('/accounts',
  authenticate,
  auditLog('GET_ACCOUNTS', 'plaid'),
  async (req, res) => {
    try {
      const db = getDatabase();
      const items = db.prepare(
        'SELECT * FROM plaid_items WHERE user_id = ?'
      ).all(req.user.id);

      const accounts = [];

      for (const item of items) {
        try {
          const accountsResponse = await plaidClient.accountsGet({
            access_token: item.access_token,
          });

          accounts.push({
            item_id: item.item_id,
            institution_name: item.institution_name,
            accounts: accountsResponse.data.accounts,
          });
        } catch (error) {
          console.error(`Error fetching accounts for item ${item.item_id}:`, error);
          // Continue with other items even if one fails
        }
      }

      res.json({ accounts });
    } catch (error) {
      console.error('Error getting accounts:', error);
      res.status(500).json({ 
        error: 'Failed to get accounts',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Get transactions
router.post('/transactions/sync',
  authenticate,
  auditLog('SYNC_TRANSACTIONS', 'plaid'),
  async (req, res) => {
    try {
      const { start_date, end_date } = req.body;
      const db = getDatabase();
      
      // Get all plaid items for user
      const items = db.prepare(
        'SELECT * FROM plaid_items WHERE user_id = ?'
      ).all(req.user.id);

      const allTransactions = [];
      const errors = [];

      for (const item of items) {
        try {
          // Use transactions sync endpoint
          const transactionsResponse = await plaidClient.transactionsGet({
            access_token: item.access_token,
            start_date: start_date || '2023-01-01',
            end_date: end_date || new Date().toISOString().split('T')[0],
          });

          const transactions = transactionsResponse.data.transactions;

          // Store transactions in database
          const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO transactions (
              user_id, plaid_transaction_id, account_id, amount, 
              date, name, merchant_name, category, subcategory, 
              type, pending
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const insertMany = db.transaction((transactions) => {
            for (const txn of transactions) {
              insertStmt.run(
                req.user.id,
                txn.transaction_id,
                txn.account_id,
                txn.amount,
                txn.date,
                txn.name,
                txn.merchant_name,
                txn.category?.[0] || 'Other',
                txn.category?.[1] || null,
                txn.transaction_type,
                txn.pending ? 1 : 0
              );
            }
          });

          insertMany(transactions);

          allTransactions.push({
            item_id: item.item_id,
            institution_name: item.institution_name,
            transaction_count: transactions.length,
          });
        } catch (error) {
          console.error(`Error syncing transactions for item ${item.item_id}:`, error);
          errors.push({
            item_id: item.item_id,
            error: error.message,
          });
        }
      }

      res.json({
        success: true,
        synced: allTransactions,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error('Error syncing transactions:', error);
      res.status(500).json({ 
        error: 'Failed to sync transactions',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Remove bank connection
router.delete('/item/:itemId',
  authenticate,
  auditLog('REMOVE_ITEM', 'plaid'),
  async (req, res) => {
    try {
      const { itemId } = req.params;
      const db = getDatabase();

      // Get item to ensure it belongs to user
      const item = db.prepare(
        'SELECT * FROM plaid_items WHERE item_id = ? AND user_id = ?'
      ).get(itemId, req.user.id);

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // Remove from Plaid
      try {
        await plaidClient.itemRemove({
          access_token: item.access_token,
        });
      } catch (error) {
        console.error('Error removing item from Plaid:', error);
        // Continue even if Plaid removal fails
      }

      // Remove from database
      db.prepare('DELETE FROM plaid_items WHERE id = ?').run(item.id);

      res.json({ success: true, message: 'Bank connection removed' });
    } catch (error) {
      console.error('Error removing item:', error);
      res.status(500).json({ 
        error: 'Failed to remove bank connection',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

module.exports = router;