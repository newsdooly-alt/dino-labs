# DinoInvest

## Overview

DinoInvest is a gamified stock market education platform that teaches users about US and Korean stocks through daily quests, interactive quizzes, and a Duolingo-inspired learning experience. The app features a dinosaur mascot ("Dino") that guides users through their learning journey, complete with XP rewards, streaks, levels, and a watchlist for tracking stocks.

The core experience centers around:
- Daily AI-generated quests covering financial terms, chart patterns, market news, stock search, stock comparison, and valuation concepts (6 varied quests per day)
- Practice Mode for endless learning after daily quests are complete (awards 5 XP per question, no hearts lost)
- Daily News section with market headlines from yfinance (Korean AI summaries available)
- Real-time stock quotes and watchlist management via yfinance Python library (no API key required)
- Stock Detail Page with advanced technical charts (S/R lines, volume bars, MA crossover signals), extended timeframes (1D/1W/1M/1Y/5Y/ALL), period-specific cumulative returns, key stats, and Dino's educational insights
- **Chart Engine**: Full gesture support — mouse drag-to-pan, single-finger swipe panning (with horizontal/vertical direction detection), pinch-to-zoom, mousewheel zoom; LOG scale toggle for YAxis; OHLC info strip above chart that updates live on hover; auto-period-upgrade (smoothly advances to longer period when user pans/zooms to the left edge)
- **Professional Trading Tools** (GlobalChart / InfiniteScrollChart):
  - Technical Indicators panel: SMA (5/20/60/120), Bollinger Bands (20,2σ), RSI (14) in oscillator sub-pane, MACD (12/26/9) in oscillator sub-pane, Volume MA (20) — state persists across symbol switches
  - Drawing Toolkit: Trendline (2-click), Horizontal Line (1-click price line), Fibonacci Retracement (7 levels: 0/23.6/38.2/50/61.8/78.6/100%), Erase mode — per-symbol persistence via `drawingDataRef` Map
  - Event Markers: Earnings "E" (blue circle, above bar) and Dividend "D" (green circle, below bar) via `createSeriesMarkers`
  - Live OHLC+indicator tooltip: shows RSI and MACD values inline when those oscillators are active
  - `/api/stocks/dividends/:symbol` endpoint (Node.js proxy → Python yfinance service)
  - `client/src/lib/chartMath.ts`: Pure math library (SMA, EMA, BB, RSI, MACD, VolumeMA, toLineData)
- Gamification elements (XP, levels, streaks, hearts/lives)
- Dynamic theme color system (Green/Blue/Pink) with real-time CSS variable swapping via ThemeColorContext
- Mathematical leveling formula: nextLevelXP = 100 * level^1.2 (shared utility in shared/leveling.ts)
- Functional leaderboard with real user rankings and 8 seeded bot users
- Multi-language support (English, Korean, Japanese)
- Live USD/KRW currency conversion with real-time exchange rates (CurrencyContext provider)
- Skill level-based quest difficulty (beginner/intermediate/advanced) with 24+ fallback quests per language
- Quest difficulty badge on QuestCard reflects xpReward (≥25→🦖Advanced, ≥20→🦕Intermediate, else 🥚Beginner) — independent of user's skill level
- 7-stage Dino evolution (Egg→Hatching→Baby Dino→Explorer→Raptor Hunter→T-Rex→Dino King) tied to 0–6 quest completions per day
- Smart "Learn More" panel after daily quests complete: shows 3 personalized next-step activities filtered by user's skillLevel (beginner/intermediate/advanced), linking to relevant app sections
- Anti-repetition quest system: `recentQuestTypes` (last 18 = 3 days × 6) stored in user_profiles, passed to quiz-generator to exclude recently used quest types
- Professional Economic Calendar with 40+ curated events (Feb–Aug 2026) covering NFP, CPI, PCE, FOMC, GDP, Retail Sales, ISM PMIs and more
  - KST auto-conversion using `Intl.DateTimeFormat` with `Asia/Seoul` timezone (accounts for US DST automatically)
  - Expandable event deep-dives: Definition, Market Impact (color-coded), Correlation Insight, Linked Indicators
  - Color-coded calendar dots by importance (red/orange/blue) for High/Medium/Low impact events
  - Adjacent month prefetching for smooth navigation; event list scrolls into view on date select
  - Bilingual support (English/Korean) throughout
  - Backend: `GET /api/economic-calendar?year=YYYY&month=M` (authenticated)

## Pro Dashboard (Advanced Mode) — /pro

- **Route**: `/pro` — accessible via "프로 대시보드 / Pro Dashboard" sidebar item
- **4-pane desktop layout**: CSS grid `[200px 1fr 185px 185px]` — Screener | Chart | Fundamentals | Analysis
- **Mobile**: 4-tab system (Screener / Chart / Fundamentals / Analysis) with full-height panels
- **Pattern Screener (Left)**: 15 curated stocks (US + KR), sortable by RS or alphabetical. RS = stock.changePercent - SPY.changePercent. Pattern tags: 급등/Strong/Neutral/Weak/Breakdown colored badges
- **Chart (Center)**: Candlestick/Line toggle, SMA50 (amber) + SMA200 (red) overlays, S/R auto-lines, Volume sub-chart, period tabs 1D/1W/1M/1Y/5Y/ALL, period return % displayed live
- **Fundamentals (Right)**: Market Cap, P/E, Dividend Yield, EPS, 52W High/Low, Beta, Avg Volume, 52W range slider, About (truncated), link to full StockDetail
- **Analysis (Far Right)**: Stage Analysis (Stage 1-4 from SMA50/200), Market Breadth (screener RS %), US Sector Breadth bars (static), Mini RRG Scatter chart (ScatterChart + ReferenceArea quadrants), link to full RRG
- **Localization**: Korean names, Korean labels, currency-aware prices

## Global Search System & Name Localization

- `client/src/lib/stockNames.ts` — Shared stock name library (single source of truth):
  - `KO_COMPANY_NAMES`: 200+ English → Korean company name mappings (US, KR, JP, EU)
  - `KO_INVESTOR_NAMES`: Super investor name localizations
  - `KO_SECTOR_NAMES`: Sector name localizations
  - `KOREAN_STOCK_ALIASES[]`: 100+ stocks with Korean names + search aliases for Korean-text search
  - `containsKorean(text)`: Detects Korean (Hangul) characters
  - `getLocalizedCompanyName(en, lang)`: Exact → stripped → partial match lookup
  - `searchByKoreanAlias(koreanQuery)`: Returns matched stocks for Korean input
- `client/src/pages/GlobalSearch.tsx`:
  - Reads `?q=` URL param (pre-fills from Dashboard search)
  - Detects Korean input → searches `KOREAN_STOCK_ALIASES` client-side instead of API
  - Fetches live prices for Korean alias matches via `/api/stocks/live`
  - Displays Korean company names in results (with English as subtitle)
  - Shows "Searching by Korean name" sparkle hint when Korean input detected
- `client/src/pages/Dashboard.tsx`:
  - Added personalized greeting + search bar at the top of the page
  - Search bar navigates to `/search` on click
  - Watchlist stock names localized via `getLocalizedCompanyName`
- `client/src/pages/SuperInvestors.tsx`: Now imports maps from `stockNames.ts` (DRY)
- `client/src/components/RRGChart.tsx`: Top-10 stock names localized with `getLocalizedCompanyName`

## 13F Database System

- **Architecture: DB-only serving, never auto-fetch on user click**
- `server/sec13FSyncService.ts`: Orchestrates fetching 13F data from SEC EDGAR and persisting to DB
  - `getOrFetch13F(investorId)`: DB-only — returns `null` if not synced (no auto-fetch from SEC)
  - `syncInvestor(investorId)`: Forces a fresh SEC EDGAR fetch and saves all holdings to DB
  - `syncAll([ids])`: Iterates all tracked investors, syncs one by one with 300ms delay
  - `isStale(lastSynced)`: Returns true if data is older than 90 days (quarterly threshold)
  - Returns `isStaleData: boolean` on every response so UI can show "refresh recommended"
- `server/routes.ts` 13F endpoints:
  - `GET /api/13f/:investorId`: DB-only — returns `202 {notSynced: true}` if no DB data; never blocks user with SEC EDGAR fetch
  - `POST /api/13f-sync/:investorId`: Admin: force re-sync single investor from SEC EDGAR
  - `POST /api/13f-sync-all`: Admin: background sync all investors (fire-and-forget)
  - `GET /api/13f-db-status`: Lists all investors with sync status, reportDate, holdingCount
- `server/scripts/sync13f.ts`: CLI script for manual sync (`npx tsx server/scripts/sync13f.ts [investorId|all]`)
- Currently synced investors: druckenmiller (NTRA #1 12.8% Q4 2025), buffett (AAPL #1 22.6%), ackman, burry, dalio, loeb, simons, einhorn
- `sec13FService.ts`: CUSIP→Ticker map includes NTRA (632307104); all holdings returned (no top-50 cap)
- Database tables: `investor_portfolios` + `investor_holdings` (PostgreSQL)
- `SuperInvestors.tsx` UI features:
  - "Sync All Data" button on list page → calls `POST /api/13f-sync-all`
  - "Not synced" amber banner with per-investor "Sync Now" button for unsynced investors
  - Verified green banner showing: 보고서 기준일 · 공시 일자 · DB 동기화 날짜 · 출처: SEC EDGAR 13F 검증 데이터
  - `real13F.notSynced`: If true, shows curated static data + amber sync prompt instead of live data
  - Korean company names in fallback `whyTheyBoughtKo` text via `getLocalizedCompanyName`
- "Why they bought" button: fixed with `type="button"` + `e.stopPropagation()`

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
- **CNN Fear & Greed Index**: Market sentiment data via `production.dataviz.cnn.io`
  - Fetched through Python service at `/fear-greed` endpoint
  - 1-hour cache duration for stability
  - Fallback to alternative.me crypto index if CNN fails
  - Used in Market Temperature dashboard section

### Flash Quiz System (v3)
- **9 Data Sources**: live_news, pe_ratios, earnings, technical_rsi, fear_greed, dividend_yield, macro_events, moving_average, industry_trends
- **Per-Session Rotation**: Sources cycle through all 9 types to ensure variety
- **AI-Generated Quizzes**: Uses GPT-4o-mini with real-time stock fundamentals from 10 stocks
  - Fetches P/E ratio, dividend yield, market cap, beta, EPS, 52-week range via `getStockFundamentals()`
  - Never generates simple "stock went up/down" questions
  - Creates professional analysis questions with **bold keyword** highlighting
  - Server-side `ensureBoldKeywords()` fallback ensures highlights even if AI omits them
  - Natural Korean translations when lang=ko
  - 36 curated fallback quizzes per language (EN + KO) covering all 9 data sources
  - Endpoint: GET /api/news/quiz?lang=en|ko&level=beginner|intermediate|advanced
- **Anti-Repetition**: Dual tracking system (quiz ID history + template history) with 10-quiz non-repeat window
- **4 Category Types**: valuation (overvalued/undervalued), impact (good/bad news), technical (overbought/oversold), movement (upward/downward)
- **Frontend**: Keyword highlighting renders `**bold**` markdown as colored spans; vertically stacked answer buttons; source badge shows quiz origin

### Quest System (Expanded March 2026)
- **Quest Types (11 total)**: term, pattern, news, search, compare, valuation, sector, dividend, earnings, hedge, insider + practice
- **Dino Tier Labels**: Baby Dino (beginner), Raptor Hunter (intermediate), T-Rex Investor (advanced) — shown as badges on each quest card
- **Daily Quests**: 6 varied quests generated per day via AI (15-25 XP each) from 11 quest types
- **Dino Journey Progress Bar**: 5-stage animated progress bar (🥚 Egg → 🦕 Baby Dino → 🦖 Raptor Hunter → 🦴 T-Rex Investor → 👑 Dino King)
- **Quest Chain UI**: Quests lock/unlock sequentially — each quest unlocks after the previous one completes
- **Special Daily Quests** (frontend-only, localStorage tracked):
  - Morning Briefing: Complete by reading news, awards 20 XP
  - Daily Prediction: Predict S&P 500 direction (up/down), awards 15 XP for participating
- **Hidden Quest**: Appears when user visits Economic Calendar (localStorage flag), awards 25 XP
- **Weekly Challenge**: "Weekly Top Picker" — pick a stock for the week, awards 30 XP first time per week
- **Special XP Endpoint**: POST /api/quests/special/complete — awards XP for special quests
- **Practice Mode**: Endless learning mode with AI-generated questions (5 XP each, no hearts lost)
- **Generator**: `server/lib/quiz-generator.ts` (11 types, bilingual EN+KO, with new fallback pools)

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

### Super Investors (SEC 13F Live Data + Sovereign Static Data)
- **Service**: `server/sec13FService.ts` — v2 rewrite (March 2026)
- **Data Source**: SEC EDGAR public API (free, no key required) for US hedge funds; static curated data for sovereign/index funds
- **19 verified investors** with CIK map (Buffett, Druckenmiller, Dalio, Ackman, Burry, etc.)
- **3-stage XML discovery** to handle all SEC filing variants
- **Automatic unit detection**: Most filers use $000s, but Berkshire (Buffett) and Ackman file in actual dollars. If max position value > $100M, detected as dollars and normalized ÷ 1000
- **Manual weight calculation**: `(position_value / sum_of_all_positions) * 100` — never trusts API weights
- **CUSIP → Ticker mapping**: 200+ entries in static map
- **24h in-memory cache** per investor
- **Filing labels**: `periodOfReport`, `filingDate`, `accessionNumber` always surfaced in UI
- **Verified Q4 2025**: Druckenmiller #1 = NTRA at 12.80% ✓, Dalio #1 = SPY ETF ✓, Ackman = 11 holdings ✓
- Routes: `GET /api/13f/:investorId`, `GET /api/13f-status`, `POST /api/13f-cache/clear`

### NPS / GPIF Static Holdings (Sovereign Fund Data)
- **NPS (국민연금)**: 14 holdings — 10 domestic KRX (.KS) + 4 US equities (AAPL, MSFT, NVDA, META)
  - KRX holdings: Samsung, SK Hynix, Hyundai Motor, KB금융, 신한지주, Samsung Biologics, LG Chem, Celltrion, Kakao, NAVER
  - All holdings have `priceApprox` in local currency (KRW) for fallback estimation
  - Data sourced from DART 대량보유 공시 (dart.fss.or.kr)
- **GPIF**: 7 holdings — 5 Japanese (.T) + 1 ETF (SPY) + 1 pharmaceutical
  - All .T holdings have `priceApprox` in JPY for fallback estimation
  - Added Takeda Pharmaceutical (4502.T) to holdings

### Super Investors Value Estimation
- **Dual live queries**: US tickers in batch 1, KRX/.T tickers in batch 2 (separate yfinance query)
- **Currency conversion**: KRX live prices (KRW) ÷ krwRate → USD; JPY live prices ÷ 155 → USD
- **Fallback**: `priceApprox` (local currency) used when live price unavailable
- **Per-holding Est. Value column** (desktop table): Shows live est. with filing-period comparison; approx. est. label for priceApprox fallback
- **Mobile card inline value**: Green "live"/"est" label below weight percentage
- **Portfolio Total Card**: "Est. Current Market Value" aggregates all covered holdings with currency-adjusted amounts
- **Coverage Scope Disclaimer**: "US-listed equities only (SEC 13F)" for US hedge funds; sovereign fund note shows full AUM context

### Market Data (Multi-Country)
- **RRG Chart**: Country tabs US🇺🇸/Korea🇰🇷/Japan🇯🇵/Europe🇪🇺 with `react-zoom-pan-pinch` zoom/pan
- **MarketTrends.tsx**: US + Korean (005930.KS etc.) + Japanese (7203.T etc.) + European ADR (ASML, SAP etc.) prices
- **Python service** (`server/python_stock_service.py`): yfinance batch quotes, country-keyed RRG caches

### Financial Data API Keys
- `FMP_API_KEY`: Financial Modeling Prep — available in secrets. Note: free tier does NOT include institutional/13F endpoints. Used as future upgrade path.

### Replit Integrations
The project includes pre-built integration modules in `server/replit_integrations/`:
- **chat/**: Conversation management with AI chat capabilities
- **image/**: Image generation endpoints
- **batch/**: Batch processing utilities with rate limiting and retries