# Budget Planner Environment Setup

## Required Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# OpenAI Configuration (for AI-powered transaction categorization)
# Get your API key from: https://platform.openai.com/api-keys
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here

# Plaid Configuration (for bank connections)
# Get your credentials from: https://dashboard.plaid.com/
NEXT_PUBLIC_PLAID_CLIENT_ID=your_plaid_client_id_here
PLAID_SECRET=your_plaid_secret_here
NEXT_PUBLIC_PLAID_ENV=sandbox

# Data Ingestion Pipeline Configuration
PLAID_WEBHOOK_URL=https://yourdomain.com/api/plaid/webhook
PLAID_WEBHOOK_SECRET=your_webhook_secret_here
SYNC_SCHEDULE_INTERVAL=3600000

# Optional Plaid Configuration
# PLAID_REDIRECT_URI=your_redirect_uri_here
```

## Setup Instructions

1. **Copy the template above** into a new `.env` file in the project root
2. **Replace the placeholder values** with your actual API keys
3. **Start with sandbox environment** for Plaid (NEXT_PUBLIC_PLAID_ENV=sandbox)
4. **Restart your development server** after adding the environment variables

## API Key Sources

- **OpenAI**: https://platform.openai.com/api-keys
- **Plaid**: https://dashboard.plaid.com/

## Testing

Run `npm run dev` and check that:

- Smart categorization settings show "API key configured"
- Bank connection button is enabled (not grayed out)
