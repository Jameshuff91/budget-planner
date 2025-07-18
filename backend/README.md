# Budget Planner Backend API

Secure backend API for Budget Planner with Plaid integration.

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Update `.env` with your Plaid credentials and JWT secret

3. Install dependencies:

```bash
npm install
```

4. Run development server:

```bash
npm run dev
```

## Security Features

- JWT authentication with refresh tokens
- Password hashing with bcrypt
- Rate limiting on API endpoints
- Helmet.js security headers
- CORS protection
- SQL injection prevention (parameterized queries)
- Audit logging for all sensitive operations
- Input validation with express-validator

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user

### Plaid Integration

- `POST /api/plaid/link/token` - Create Plaid Link token
- `POST /api/plaid/link/exchange` - Exchange public token
- `GET /api/plaid/accounts` - Get linked accounts
- `POST /api/plaid/transactions/sync` - Sync transactions
- `DELETE /api/plaid/item/:itemId` - Remove bank connection

### Transactions

- `GET /api/transactions` - Get transactions (with pagination)
- `GET /api/transactions/:id` - Get single transaction
- `POST /api/transactions` - Create manual transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction
- `GET /api/transactions/analytics/spending` - Get spending analytics

## Database

Uses SQLite for local development with the following tables:

- `users` - User accounts
- `plaid_items` - Plaid bank connections
- `transactions` - Financial transactions
- `audit_logs` - Security audit trail
- `sessions` - Refresh token storage
- `categories` - User categories

## Testing

```bash
npm test
```

## Production Deployment

For production, consider:

1. Using PostgreSQL instead of SQLite
2. Adding SSL certificates
3. Setting up proper monitoring
4. Implementing backup procedures
5. Using environment-specific configs
