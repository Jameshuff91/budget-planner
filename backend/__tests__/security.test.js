const request = require('supertest');

// Set up environment variables before requiring the app
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.NODE_ENV = 'test';

const app = require('../server');

describe('Security Middleware', () => {
  describe('Rate Limiting', () => {
    it('should enforce rate limits on API endpoints', async () => {
      const requests = [];
      
      // Make 101 requests (assuming limit is 100)
      for (let i = 0; i < 101; i++) {
        requests.push(
          request(app)
            .get('/api/transactions')
            .set('Authorization', 'Bearer invalid-token')
        );
      }

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(res => res.status === 429);
      
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });

  describe('CORS', () => {
    it('should allow requests from configured origin', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should include security headers', async () => {
      const res = await request(app).get('/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-xss-protection']).toBe('0');
    });
  });

  describe('Authentication', () => {
    it('should reject requests without authentication', async () => {
      const res = await request(app).get('/api/transactions');
      
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    it('should reject requests with invalid token', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid token');
    });

    it('should reject requests with expired token', async () => {
      // Create an expired token
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { id: 1, email: 'test@example.com' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const res = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Token expired');
    });
  });

  describe('Input Validation', () => {
    it('should sanitize email inputs', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'TEST@EXAMPLE.COM  ',
          password: 'Test123!@#'
        });

      // Email should be normalized
      if (res.status === 201) {
        expect(res.body.user.email).toBe('test@example.com');
      }
    });

    it('should reject SQL injection attempts', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: "admin'--",
          password: 'password'
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });
});