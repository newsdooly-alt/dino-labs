# US Stock Hero (Dinolingo)

## Overview

US Stock Hero is a gamified stock market education platform that teaches users about US stocks through daily quests, interactive quizzes, and a Duolingo-inspired learning experience. The app features a dinosaur mascot ("Dino") that guides users through their learning journey, complete with XP rewards, streaks, levels, and a watchlist for tracking stocks.

The core experience centers around:
- Daily AI-generated quests covering financial terms, chart patterns, market news, stock search, stock comparison, and valuation concepts (6 varied quests per day)
- Practice Mode for endless learning after daily quests are complete (awards 5 XP per question, no hearts lost)
- Daily News section with market headlines from yfinance (Korean AI summaries available)
- Real-time stock quotes and watchlist management via yfinance Python library (no API key required)
- Stock Detail Page with interactive charts, key stats, and Dino's educational insights
- Gamification elements (XP, levels, streaks, hearts/lives)
- Multi-language support (English and Korean)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query (React Query) for server state
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **UI Components**: shadcn/ui (Radix UI primitives with custom styling)
- **Animations**: Framer Motion for transitions and micro-interactions
- **Build Tool**: Vite with path aliases (@/, @shared/, @assets/)

### Backend Architecture
- **Runtime**: Node.js with Express + Python Flask microservice
- **Language**: TypeScript (ESM modules) for main server, Python for stock data service
- **API Pattern**: RESTful endpoints defined in shared/routes.ts as a typed contract
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Schema Location**: shared/schema.ts (shared between frontend and backend)
- **Stock Data**: Python Flask service (server/python_stock_service.py) using yfinance library
  - Spawned automatically by Node.js server on startup
  - Runs on port 5001 (internal)
  - Provides batch quotes, search, and historical data endpoints

### Data Storage
- **Database**: PostgreSQL (via Drizzle ORM)
- **Schema**: Users, stocks, quests, userStocks (watchlist), clubs, conversations, messages
- **Migrations**: Drizzle Kit with migrations stored in /migrations

### Key Design Patterns
1. **Shared Types**: Schema and route contracts are shared between client and server via @shared/ alias
2. **Type-Safe API**: Routes defined with Zod schemas for input validation and response types
3. **MVP Authentication**: Simplified auth with hardcoded userId=1 for demo purposes
4. **Quest Generation**: AI-powered daily quest generation using OpenAI API
5. **Theme System**: Global dark/light mode via ThemeProvider context
   - Location: `client/src/contexts/ThemeContext.tsx`
   - Uses Tailwind's class-based dark mode strategy
   - Persists preference to localStorage (key: "theme")
   - Falls back to system preference if no saved theme
   - Toggle available in UserMenu component

### Build System
- **Development**: tsx for running TypeScript server directly
- **Production**: esbuild bundles server, Vite builds client to dist/public
- **Database Sync**: `npm run db:push` uses drizzle-kit to push schema changes

## External Dependencies

### AI Services
- **OpenAI API**: Used for generating daily quiz questions, practice quests, Korean news summaries, and chat functionality
  - Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
  - Models used: gpt-5.1 for daily quests, gpt-4o-mini for practice quests and news summaries, gpt-image-1 for images

### Financial Data
- **yfinance (Python library)**: Real-time stock quotes, search, historical data, and market news
  - No API key required (free to use)
  - Supports batch requests for multiple tickers
  - Provides OHLCV historical data for charts
  - Fetches market news headlines from major tickers (SPY, QQQ, AAPL, MSFT, NVDA)
  - Service location: `server/python_stock_service.py`
  - Node.js wrapper: `server/stockService.ts`

### Quest System
- **Quest Types**: term, pattern, news, search, compare, valuation, practice
- **Daily Quests**: 6 varied quests generated per day via AI (15-25 XP each)
- **Practice Mode**: Endless learning mode with AI-generated questions (5 XP each, no hearts lost)
- **Generator**: `server/lib/quiz-generator.ts`

### Daily News
- **News Source**: yfinance news API from major market tickers
- **Korean Summaries**: Auto-generated 1-sentence Korean translations using gpt-4o-mini
- **News Reading Progress**: Track 3 articles read for quest completion
- **Routes**: GET /api/news, POST /api/news/read, GET /api/news/read-count

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **connect-pg-simple**: Session storage (configured but auth simplified for MVP)

### UI Dependencies
- **Radix UI**: Full suite of accessible UI primitives
- **Framer Motion**: Animation library
- **canvas-confetti**: Celebration effects on quest completion
- **Recharts**: Stock charts and data visualization
- **Lucide React**: Icon system

### Replit Integrations
The project includes pre-built integration modules in `server/replit_integrations/`:
- **chat/**: Conversation management with AI chat capabilities
- **image/**: Image generation endpoints
- **batch/**: Batch processing utilities with rate limiting and retries