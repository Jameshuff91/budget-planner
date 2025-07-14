# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Development
```bash
npm run dev                    # Start Next.js development server on http://localhost:3000
npm run build                  # Build production bundle
npm start                      # Start production server
```

### Code Quality
```bash
npm run lint                   # Run ESLint (currently set to warnings)
npm run format                 # Format code with Prettier
npm run type-check             # Run TypeScript type checking (no emit)
```

### Testing
```bash
npm test                       # Run unit tests with Vitest
npm run test:watch             # Run tests in watch mode
npm run test:e2e               # Run E2E tests with Playwright
npm run test:e2e:ui            # Run E2E tests with UI mode
npm run test:e2e:debug         # Debug E2E tests
```

### Single Test Execution
```bash
# Run a specific test file
npm test -- src/services/pdfService.test.ts

# Run E2E test for specific browser
npx playwright test --project=chromium

# Run specific E2E test
npx playwright test e2e/budget-planner.spec.ts
```

## Project Architecture

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript with path aliases (@components, @services, etc.)
- **Database**: IndexedDB (browser storage) via idb library
- **Styling**: Tailwind CSS with Radix UI components
- **Testing**: Vitest for unit tests, Playwright for E2E
- **PWA**: Service worker support with @ducanh2912/next-pwa

### Key Architecture Patterns

#### 1. Client-Side Data Management
The app uses IndexedDB for all data persistence, making it fully client-side with no backend dependencies. The database schema is defined in `src/services/db.ts` and includes:
- Transactions (financial records)
- Categories (income/expense categories)
- PDFs (uploaded statements)
- Assets & Liabilities (net worth tracking)
- Recurring preferences (transaction patterns)

#### 2. Context-Based State Management
`src/context/DatabaseContext.tsx` provides a React context that wraps the entire app, offering:
- Centralized database operations
- Real-time data synchronization
- Loading and error states
- Transaction CRUD operations

#### 3. Service Layer Pattern
Services in `src/services/` handle specific domains:
- `pdfService.ts`: PDF parsing with OCR (Tesseract.js) and optional OpenCV preprocessing
- `csvService.ts`: CSV parsing with auto-detection of formats
- `llmService.ts`: OpenAI integration for smart categorization
- `plaidService.ts`: Bank connection handling (requires API keys)

#### 4. Component Architecture
- **UI Components** (`components/ui/`): Reusable Radix UI primitives
- **Feature Components** (`components/`): Business logic components
- **Skeleton Components** (`components/skeletons/`): Loading states
- **Error Boundaries**: Graceful error handling for charts and components

### Critical Implementation Details

#### PDF Processing Flow
1. User uploads PDF → `PDFUpload.tsx`
2. PDF parsed by `pdfService.ts` using pdf.js
3. OCR performed with Tesseract.js (optional OpenCV preprocessing)
4. Transactions extracted and validated
5. Smart categorization applied (if enabled)
6. Data stored in IndexedDB

#### Transaction Categorization Pipeline
1. Custom user rules (highest priority)
2. AI categorization via OpenAI (if API key configured)
3. Built-in rule-based categorization (fallback)

#### Key State Management Flows
- Month/Year selection stored in React state
- All financial data flows through DatabaseContext
- Real-time updates when transactions change
- Analytics computed on-demand from raw transactions

### Environment Variables
```env
# Required for Plaid integration
NEXT_PUBLIC_PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
NEXT_PUBLIC_PLAID_ENV=sandbox

# OpenAI API key stored in localStorage, not env vars
```

### Important File Locations
- Database operations: `src/services/db.ts`
- PDF parsing logic: `src/services/pdfService.ts`
- Transaction categorization: `src/utils/categoryRules.ts`, `src/utils/smartCategorization.ts`
- Analytics calculations: `src/hooks/useAnalytics.ts`
- Chart components: `components/SpendingByCategory.tsx`, `components/SpendingTrend.tsx`

### Common Development Tasks

#### Adding a New Chart
1. Create component in `components/` using Recharts
2. Wrap with `ChartErrorBoundary`
3. Use `useDatabase()` or `useAnalytics()` hooks for data
4. Add loading skeleton if needed

#### Modifying Transaction Schema
1. Update interface in `src/services/db.ts`
2. Increment database VERSION
3. Add migration logic in `upgrade()` method
4. Update TypeScript types throughout

#### Adding New Category Rules
1. Modify `src/utils/categoryRules.ts`
2. Add new patterns to `CATEGORY_RULES`
3. Test with sample transactions

### Known Issues & Gotchas
- ESLint is set to warnings only (not errors) to allow development flexibility
- Some E2E tests may be skipped pending dashboard updates
- PDF parsing accuracy depends on statement format
- OpenCV.js loading can be slow on first use
- Browser must support IndexedDB (all modern browsers do)
- Commit and push using git after each major contribution 