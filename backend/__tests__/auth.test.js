const request = require('supertest');

// Set up environment variables before requiring the app
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.NODE_ENV = 'test';

const app = require('../server');
const { getDatabase, initializeDatabase } = require('../db/init');

describe('Authentication Endpoints', () => {
  let db;

  beforeAll(async () => {
    await initializeDatabase();
    db = getDatabase();
  });

  afterEach(() => {
    // Clean up database between tests
    db.exec('DELETE FROM users');
    db.exec('DELETE FROM sessions');
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid credentials', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('should reject weak passwords', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'weak',
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject duplicate emails', async () => {
      // First registration
      await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      // Duplicate registration
      const res = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Email already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register a user for login tests
      await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'Test123!@#',
      });
    });

    it('should login with valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should reject invalid password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'Test123!@#',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken;

    beforeEach(async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'Test123!@#',
      });
      refreshToken = res.body.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid refresh token');
    });
  });
});
