const request = require('supertest');

// Set up environment variables before requiring the app
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.NODE_ENV = 'test';
process.env.PLAID_CLIENT_ID = 'test-client-id';
process.env.PLAID_SECRET = 'test-secret';
process.env.PLAID_ENV = 'sandbox';

const app = require('../server');
const jwt = require('jsonwebtoken');
const { initializeDatabase } = require('../db/init');

// Mock Plaid
jest.mock('plaid', () => {
  return {
    PlaidApi: jest.fn().mockImplementation(() => ({
      linkTokenCreate: jest.fn().mockResolvedValue({
        data: {
          link_token: 'test-link-token',
          expiration: '2025-01-01T00:00:00Z',
        },
      }),
      itemPublicTokenExchange: jest.fn().mockResolvedValue({
        data: {
          access_token: 'test-access-token',
          item_id: 'test-item-id',
        },
      }),
      itemGet: jest.fn().mockResolvedValue({
        data: {
          item: {
            institution_id: 'test-institution',
          },
          institution: {
            name: 'Test Bank',
          },
        },
      }),
      accountsGet: jest.fn().mockResolvedValue({
        data: {
          accounts: [
            {
              account_id: 'test-account-1',
              name: 'Test Checking',
              type: 'depository',
              subtype: 'checking',
              balances: {
                current: 1000,
                available: 900,
              },
            },
          ],
        },
      }),
      transactionsGet: jest.fn().mockResolvedValue({
        data: {
          transactions: [
            {
              transaction_id: 'test-txn-1',
              account_id: 'test-account-1',
              amount: 25.5,
              date: '2025-01-15',
              name: 'Test Transaction',
              merchant_name: 'Test Merchant',
              category: ['Food and Drink', 'Restaurants'],
              pending: false,
            },
          ],
        },
      }),
    })),
    Configuration: jest.fn(),
    PlaidEnvironments: {
      sandbox: 'https://sandbox.plaid.com',
    },
  };
});

describe('Plaid Endpoints', () => {
  let authToken;
  let userId = 1;

  beforeAll(async () => {
    // Initialize database first
    await initializeDatabase();

    // Create a test user in the database
    const { getDatabase } = require('../db/init');
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `);
    stmt.run(userId, 'test@example.com', 'fake-hash');

    // Create a valid auth token
    authToken = jwt.sign({ id: userId, email: 'test@example.com' }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
  });

  afterEach(() => {
    // Clean up test data
    const { getDatabase } = require('../db/init');
    const db = getDatabase();
    db.exec('DELETE FROM plaid_items WHERE user_id = 1');
    db.exec('DELETE FROM audit_logs WHERE user_id = 1');
  });

  describe('POST /api/plaid/link/token', () => {
    it('should create a link token for authenticated user', async () => {
      const res = await request(app)
        .post('/api/plaid/link/token')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.link_token).toBe('test-link-token');
      expect(res.body.expiration).toBeDefined();
    });

    it('should require authentication', async () => {
      const res = await request(app).post('/api/plaid/link/token');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/plaid/link/exchange', () => {
    it('should exchange public token for access token', async () => {
      const res = await request(app)
        .post('/api/plaid/link/exchange')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          public_token: 'test-public-token',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.item_id).toBe('test-item-id');
      expect(res.body.institution_name).toBe('Test Bank');
    });

    it('should reject request without public token', async () => {
      const res = await request(app)
        .post('/api/plaid/link/exchange')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Public token required');
    });
  });

  describe('GET /api/plaid/accounts', () => {
    it('should return user accounts', async () => {
      const res = await request(app)
        .get('/api/plaid/accounts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.accounts).toBeDefined();
      expect(Array.isArray(res.body.accounts)).toBe(true);
    });
  });

  describe('POST /api/plaid/transactions/sync', () => {
    it('should sync transactions', async () => {
      const res = await request(app)
        .post('/api/plaid/transactions/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          start_date: '2025-01-01',
          end_date: '2025-01-31',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.synced).toBeDefined();
    });
  });
});
