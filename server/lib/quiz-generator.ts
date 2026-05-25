import OpenAI from "openai";
import { type InsertQuest } from "@shared/schema";

// We use the integration env vars
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Random stock symbols for interactive quests
const stockSymbols = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "META", "AMD", "NFLX", "DIS"];

function getRandomStock(): string {
  return stockSymbols[Math.floor(Math.random() * stockSymbols.length)];
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

function getSkillLevelDescription(skillLevel: SkillLevel, isKorean: boolean): string {
  if (isKorean) {
    switch (skillLevel) {
      case 'beginner':
        return '초보자 수준: 기본 금융 용어, 간단한 개념, 주식 시장의 기초에 집중하세요. 예: "주식이란?", "배당금이란?", "ETF란?"';
      case 'intermediate':
        return '중급 수준: P/E 비율, 시가총액 비교, 차트 패턴, 섹터 분석에 집중하세요. 예: "적정 P/E 비율은?", "헤드앤숄더 패턴이란?"';
      case 'advanced':
        return '고급 수준: DCF 분석, 옵션 전략, 매크로 경제, 고급 밸류에이션에 집중하세요. 예: "내재가치 계산", "풋/콜 비율 해석"';
    }
  }
  switch (skillLevel) {
    case 'beginner':
      return 'Beginner level: Focus on basic financial terms, simple concepts, stock market fundamentals. Examples: "What is a stock?", "What is a dividend?", "What is an ETF?"';
    case 'intermediate':
      return 'Intermediate level: Focus on P/E ratios, market cap comparisons, chart patterns, sector analysis. Examples: "What is a good P/E ratio?", "What is a head and shoulders pattern?"';
    case 'advanced':
      return 'Advanced level: Focus on DCF analysis, options strategies, macroeconomics, advanced valuation. Examples: "Calculate intrinsic value", "Interpret put/call ratio"';
  }
}

export async function generateDailyQuests(userId: string, language: string = 'en', skillLevel: SkillLevel = 'beginner', recentTypes: string[] = []): Promise<InsertQuest[]> {
  const isKorean = language === 'ko';
  const randomStock1 = getRandomStock();
  const randomStock2 = stockSymbols.filter(s => s !== randomStock1)[Math.floor(Math.random() * (stockSymbols.length - 1))];
  const skillDescription = getSkillLevelDescription(skillLevel, isKorean);
  const recentNote = recentTypes.length > 0
    ? (isKorean
        ? `\n    최근 3일간 사용된 유형 (반드시 제외): ${recentTypes.join(', ')}`
        : `\n    Types used in the past 3 days (MUST avoid repeating these): ${recentTypes.join(', ')}`)
    : '';

  const prompt = isKorean ? `
    사용자가 미국 주식에 대해 배울 수 있도록 매일 6개의 다양한 주식 시장 퀘스트를 생성하세요.
    "quests"라는 키를 가진 JSON 객체를 반환하며, 이 키는 6개의 객체 배열입니다.
    
    중요: 사용자 레벨 - ${skillDescription}
    규칙: 반드시 6가지 모두 다른 유형이어야 합니다. 비슷한 느낌의 퀘스트를 반복하지 마세요.${recentNote}
    
    다음 15가지 유형 중 6가지를 다양하게 선택하세요 (중복 없이, 유사한 유형도 피하세요):
    1. "term": 금융 용어(예: P/E, 배당금, 시가총액, ETF, RSI, MACD, 볼린저밴드)에 대한 퀴즈.
    2. "pattern": 차트 패턴(예: Bull Flag, 헤드앤숄더, 골든크로스, 이중천장, 컵앤핸들)에 대한 퀴즈.
    3. "news": 시장 뉴스 시나리오(예: "연준이 금리를 올리면 채권 가격은?", "달러 강세 시 수출주 영향은?").
    4. "search": "${randomStock1}" 종목의 섹터, 비즈니스 모델, 핵심 지표에 대한 질문.
    5. "compare": "${randomStock1}"와 "${randomStock2}"의 밸류에이션이나 사업 모델 비교 질문.
    6. "valuation": 밸류에이션 퀴즈 (PER, PBR, DCF, EV/EBITDA, PSR 등).
    7. "sector": 섹터 로테이션 질문 (예: "금리 상승기에 어떤 섹터가 유리한가?", "RRG 차트에서 '약화' 구간에 있는 섹터의 의미는?").
    8. "dividend": 배당 관련 퀴즈 (예: "배당 수익률 계산법", "배당성향이란?", "배당 재투자 복리 효과").
    9. "earnings": 실적 발표 시나리오 (예: "어닝 서프라이즈 +10%일 때 일반적인 주가 반응은?", "EPS 가이던스 하향의 의미").
    10. "hedge": 헤지 전략 질문 (예: "시장 10% 하락 시 안전자산은?", "인플레이션 헤지로 효과적인 자산은?", "역상관 자산 구성법").
    11. "insider": 슈퍼인베스터 추적 (예: "워렌 버핏이 장기 보유하는 이유는?", "빌 애크먼의 집중 투자 철학이란?", "기관 13F 공시를 추적하는 방법").
    12. "rrg": RRG(상대적 회전 그래프) 분석 (예: "'선도(Leading)' 구간에 있는 섹터의 특징은?", "RRG에서 모멘텀 축의 의미는?", "약화→개선 이동 신호가 의미하는 것은?").
    13. "chart": 기술적 지표 활용 (예: "이동평균(MA) 20일선이 50일선을 상향 돌파하면?", "RSI 30 이하의 의미는?", "볼린저밴드 수축이 신호하는 것은?").
    14. "economic": 경제 지표 해석 (예: "CPI 예상치 상회 시 시장 반응은?", "고용지표 호조가 금리에 미치는 영향은?", "GDP 성장률과 주식시장의 관계").
    15. "macro_action": 실전 관찰 과제 (예: "오늘 워치리스트에서 가장 상승폭 큰 종목을 찾으세요", "다음 실적 발표 종목의 EPS 예상치를 확인하세요", "Pro 대시보드에서 최강 섹터를 RRG로 확인하세요").

    각 퀘스트 객체는 다음을 포함해야 합니다:
    - type: 위 15가지 유형 중 하나
    - question: string (한국어, 구체적이고 교육적인 질문 — macro_action 유형은 앱 내 실전 행동 지시문)
    - options: string[] (4개의 옵션, 한국어 — macro_action 유형도 4개 옵션 포함)
    - correctAnswer: number (0-3 인덱스)
    - explanation: string (정답에 대한 짧은 설명, 한국어, 2-3문장)
    - xpReward: number (term/pattern/news=15, search/compare/valuation/sector/dividend/chart=20, earnings/hedge/insider/rrg/economic/macro_action=25)
    - targetSymbol: string (search, compare 타입일 경우 해당 종목 심볼, 그 외는 null)
  ` : `
    Generate 6 varied daily stock market quests for a user learning about US/global stocks.
    Return a JSON object with a key "quests" which is an array of 6 objects.
    
    IMPORTANT: User skill level - ${skillDescription}
    RULE: All 6 must be different types. Do not repeat similar-feeling quests.${recentNote}
    
    Pick 6 diverse types from the following 15 (no duplicates, avoid similar-feeling types):
    1. "term": A quiz about a financial term (P/E, Dividend, Market Cap, ETF, RSI, MACD, Bollinger Bands, etc.).
    2. "pattern": A chart pattern quiz (Bull Flag, Head and Shoulders, Golden Cross, Double Top, Cup and Handle, etc.).
    3. "news": A market news scenario (e.g., "If the Fed raises rates, what happens to bond prices?", "How does a strong dollar affect exporters?").
    4. "search": A question about ${randomStock1}'s sector, business model, or key metrics.
    5. "compare": A valuation or business model comparison between ${randomStock1} and ${randomStock2}.
    6. "valuation": A valuation quiz (P/E, P/B, DCF, EV/EBITDA, P/S, etc.).
    7. "sector": Sector rotation question (e.g., "Which sector benefits from rising rates?", "What does a sector in the 'Weakening' quadrant of an RRG chart suggest?").
    8. "dividend": Dividend quiz (e.g., "How to calculate dividend yield?", "What is a payout ratio?", "Dividend reinvestment compounding effect").
    9. "earnings": Earnings scenario (e.g., "If a company beats EPS by 10%, what typically happens to the stock?", "What does EPS guidance reduction signal?").
    10. "hedge": Hedging strategy quiz (e.g., "What are safe haven assets in a 10% drop?", "Which assets hedge against inflation?", "How to construct negatively correlated portfolios?").
    11. "insider": Super investor tracking (e.g., "Why does Warren Buffett hold long-term?", "What is Bill Ackman's concentrated investing philosophy?", "How to track institutional 13F filings?").
    12. "rrg": RRG (Relative Rotation Graph) analysis (e.g., "What characterizes a sector in the 'Leading' quadrant?", "What does the Momentum axis mean in RRG?", "What does a Weakening→Improving move signal?").
    13. "chart": Technical indicator usage (e.g., "What happens when the 20-day MA crosses above the 50-day MA?", "What does RSI below 30 mean?", "What does Bollinger Band contraction signal?").
    14. "economic": Economic indicator interpretation (e.g., "If CPI beats expectations, how does the market typically react?", "How does strong jobs data affect interest rates?", "Relationship between GDP growth and equities").
    15. "macro_action": Real-world observation task (e.g., "Find the biggest gainer in your Watchlist today", "Check the EPS estimate for the next earnings release on a stock you follow", "Use the RRG in the Pro Dashboard to find the Leading sector today").

    Each quest object must have:
    - type: one of the 15 types above
    - question: string (specific, educational question — macro_action type should be an in-app action instruction)
    - options: string[] (4 options, even macro_action types must have 4 options)
    - correctAnswer: number (0-3 index)
    - explanation: string (2-3 sentence explanation of the answer)
    - xpReward: number (term/pattern/news=15, search/compare/valuation/sector/dividend/chart=20, earnings/hedge/insider/rrg/economic/macro_action=25)
    - targetSymbol: string (the stock symbol for search/compare quests, null for others)
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: isKorean ? "당신은 금융 교육 보조원입니다. 유효한 JSON만 반환하세요. 모든 텍스트는 한국어여야 합니다." : "You are a financial education assistant. Return only valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return fallbackQuests(userId, language, skillLevel, recentTypes);

    const data = JSON.parse(content);
    const quests: any[] = data.quests;

    return quests.map(q => ({
      userId,
      type: q.type,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      xpReward: q.xpReward || 15,
      isCompleted: false
    }));

  } catch (err) {
    console.error("Error generating quests:", err);
    return fallbackQuests(userId, language, skillLevel, recentTypes);
  }
}

export async function generatePracticeQuest(userId: string, language: string = 'en', skillLevel: SkillLevel = 'beginner'): Promise<InsertQuest> {
  const isKorean = language === 'ko';
  const skillDescription = getSkillLevelDescription(skillLevel, isKorean);
  
  const prompt = isKorean ? `
    주식 시장 학습을 위한 연습 퀴즈 1개를 생성하세요.
    "quest"라는 키를 가진 JSON 객체를 반환하세요.
    
    중요: 사용자 레벨 - ${skillDescription}
    
    다양한 유형 중 하나를 무작위로 선택:
    - 금융 용어 퀴즈
    - 차트 패턴 식별
    - 시장 뉴스 시나리오
    - 밸류에이션 개념
    
    퀘스트 객체:
    - type: "practice"
    - question: string (한국어)
    - options: string[] (4개의 옵션, 한국어)
    - correctAnswer: number (0-3 인덱스)
    - explanation: string (정답에 대한 짧은 설명, 한국어)
    - xpReward: 5
  ` : `
    Generate 1 practice quiz question for stock market learning.
    Return a JSON object with a key "quest".
    
    IMPORTANT: User skill level - ${skillDescription}
    
    Randomly pick one type:
    - Financial term quiz
    - Chart pattern identification
    - Market news scenario
    - Valuation concept
    
    Quest object:
    - type: "practice"
    - question: string
    - options: string[] (4 options)
    - correctAnswer: number (0-3 index)
    - explanation: string (short explanation of the answer)
    - xpReward: 5
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: isKorean ? "당신은 금융 교육 보조원입니다. 유효한 JSON만 반환하세요. 모든 텍스트는 한국어여야 합니다." : "You are a financial education assistant. Return only valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return fallbackPracticeQuest(userId, language, skillLevel);

    const data = JSON.parse(content);
    const q = data.quest;

    return {
      userId,
      type: "practice",
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      xpReward: 5,
    };
  } catch (err) {
    console.error("Error generating practice quest:", err);
    return fallbackPracticeQuest(userId, language, skillLevel);
  }
}

type FallbackQuestData = {
  level: SkillLevel;
  type: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  xpReward: number;
};

type FallbackPracticeData = {
  level: SkillLevel;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

const dailyQuestsPoolEn: FallbackQuestData[] = [
  { level: "beginner", type: "term", question: "What does ETF stand for?", options: ["Exchange Traded Fund", "Equity Traded Finance", "Electronic Transfer Fund", "Early Trade Fee"], correctAnswer: 0, explanation: "ETF stands for Exchange Traded Fund, which is a basket of securities that trades on an exchange like a stock.", xpReward: 15 },
  { level: "beginner", type: "term", question: "What is a dividend?", options: ["A company's total revenue", "A portion of profits paid to shareholders", "A type of stock order", "A tax on investments"], correctAnswer: 1, explanation: "A dividend is a distribution of a portion of a company's earnings to its shareholders.", xpReward: 15 },
  { level: "beginner", type: "pattern", question: "What does a 'bull market' indicate?", options: ["Prices are falling", "Prices are rising", "Prices are stable", "The market is closed"], correctAnswer: 1, explanation: "A bull market is a period of rising stock prices, typically 20% or more from recent lows.", xpReward: 15 },
  { level: "beginner", type: "news", question: "What is a 'Bear Market'?", options: ["A market trending up", "A market trending down", "A stagnant market", "A market with high volatility"], correctAnswer: 1, explanation: "A Bear Market is characterized by falling stock prices, typically defined as a drop of 20% or more.", xpReward: 15 },
  { level: "beginner", type: "search", question: "What sector does Apple (AAPL) belong to?", options: ["Healthcare", "Technology", "Consumer Goods", "Finance"], correctAnswer: 1, explanation: "Apple Inc. is classified under the Technology sector.", xpReward: 20 },
  { level: "beginner", type: "compare", question: "Which metric is best to compare the size of two companies?", options: ["Stock price", "Market capitalization", "Number of employees", "Year founded"], correctAnswer: 1, explanation: "Market capitalization (share price x total shares) is the standard metric for comparing company sizes.", xpReward: 20 },
  { level: "beginner", type: "valuation", question: "What does IPO stand for?", options: ["Internal Profit Operation", "Initial Public Offering", "Investment Portfolio Option", "Indexed Price Order"], correctAnswer: 1, explanation: "IPO stands for Initial Public Offering, which is when a company first sells shares to the public.", xpReward: 15 },
  { level: "beginner", type: "news", question: "What is a portfolio in investing?", options: ["A single stock holding", "A collection of financial investments", "A type of bond", "A trading strategy"], correctAnswer: 1, explanation: "A portfolio is a collection of financial investments like stocks, bonds, and other assets held by an investor.", xpReward: 15 },

  { level: "intermediate", type: "term", question: "What does the P/E ratio measure?", options: ["Price to Equity", "Price to Earnings", "Profit to Expense", "Portfolio to Equity"], correctAnswer: 1, explanation: "The P/E (Price-to-Earnings) ratio measures a company's current share price relative to its per-share earnings.", xpReward: 20 },
  { level: "intermediate", type: "term", question: "What is a moving average used for in stock analysis?", options: ["Predicting exact prices", "Smoothing price data to identify trends", "Calculating dividends", "Measuring company debt"], correctAnswer: 1, explanation: "A moving average smooths out price data by creating a constantly updated average price, helping identify trends.", xpReward: 20 },
  { level: "intermediate", type: "pattern", question: "What does a 'Head and Shoulders' pattern indicate?", options: ["Bullish continuation", "Bearish reversal", "Market consolidation", "Volume spike"], correctAnswer: 1, explanation: "A Head and Shoulders pattern is a bearish reversal pattern that signals a potential trend change from up to down.", xpReward: 20 },
  { level: "intermediate", type: "news", question: "What typically happens to stock prices when a company beats earnings expectations?", options: ["They always drop", "They usually rise", "They stay the same", "The market closes"], correctAnswer: 1, explanation: "When a company reports earnings above analyst expectations, its stock price typically rises due to positive sentiment.", xpReward: 20 },
  { level: "intermediate", type: "search", question: "Which index does Tesla (TSLA) belong to?", options: ["Dow Jones Industrial Average", "S&P 500", "Russell 2000 only", "None of the above"], correctAnswer: 1, explanation: "Tesla is a component of the S&P 500 index, which it joined in December 2020.", xpReward: 20 },
  { level: "intermediate", type: "compare", question: "When comparing two stocks, what does a lower P/E ratio generally suggest?", options: ["Higher risk", "The stock may be undervalued relative to earnings", "Better brand recognition", "Higher dividend yield"], correctAnswer: 1, explanation: "A lower P/E ratio compared to peers generally suggests the stock may be undervalued relative to its earnings.", xpReward: 20 },
  { level: "intermediate", type: "valuation", question: "What does RSI (Relative Strength Index) measure?", options: ["Company revenue growth", "Speed and magnitude of price changes", "Debt-to-equity ratio", "Dividend payout frequency"], correctAnswer: 1, explanation: "RSI measures the speed and magnitude of recent price changes to evaluate overbought or oversold conditions.", xpReward: 20 },
  { level: "intermediate", type: "news", question: "How does sector rotation affect stock performance?", options: ["It has no effect", "Investors move money between sectors based on economic cycles", "Only tech stocks are affected", "It only matters for bonds"], correctAnswer: 1, explanation: "Sector rotation is when investors shift investments between sectors as economic conditions change through business cycles.", xpReward: 20 },

  { level: "advanced", type: "term", question: "What is a Discounted Cash Flow (DCF) analysis?", options: ["A method to count physical cash", "A valuation method using projected future cash flows discounted to present value", "A way to calculate dividends", "A tax calculation method"], correctAnswer: 1, explanation: "DCF analysis estimates the value of an investment based on its expected future cash flows, discounted back to present value.", xpReward: 25 },
  { level: "advanced", type: "term", question: "What is a derivative in finance?", options: ["A company's secondary product", "A financial contract whose value is derived from an underlying asset", "A type of savings account", "A government regulation"], correctAnswer: 1, explanation: "A derivative is a financial instrument whose value is based on the price of an underlying asset such as stocks, bonds, or commodities.", xpReward: 25 },
  { level: "advanced", type: "pattern", question: "What does a yield curve inversion typically signal?", options: ["Strong economic growth", "Potential upcoming recession", "Rising stock prices", "Increased consumer spending"], correctAnswer: 1, explanation: "A yield curve inversion, where short-term rates exceed long-term rates, has historically been a reliable recession indicator.", xpReward: 25 },
  { level: "advanced", type: "news", question: "In options trading, what does 'writing a covered call' involve?", options: ["Buying call options on stocks you don't own", "Selling call options on stocks you already own", "Purchasing put options for protection", "Short selling with leverage"], correctAnswer: 1, explanation: "Writing a covered call means selling call options on shares you already hold, generating income from the premium.", xpReward: 25 },
  { level: "advanced", type: "search", question: "What is NVIDIA's (NVDA) primary competitive advantage in AI?", options: ["Social media platform", "GPU architecture for parallel processing", "Cloud storage services", "Smartphone manufacturing"], correctAnswer: 1, explanation: "NVIDIA's GPU architecture excels at parallel processing, making it the dominant platform for AI and machine learning workloads.", xpReward: 25 },
  { level: "advanced", type: "compare", question: "When comparing two companies, what does Enterprise Value (EV) capture that market cap does not?", options: ["Stock price history", "Debt and cash positions", "Number of products", "Employee satisfaction"], correctAnswer: 1, explanation: "Enterprise Value includes market cap plus debt minus cash, giving a more complete picture of a company's total value.", xpReward: 25 },
  { level: "advanced", type: "valuation", question: "What does a high short interest ratio indicate about market sentiment?", options: ["Strong bullish consensus", "Many investors are betting the stock will decline", "The company is about to split", "Dividend increase is expected"], correctAnswer: 1, explanation: "A high short interest ratio means many investors have sold shares short, indicating bearish sentiment and expectations of a price decline.", xpReward: 25 },
  { level: "advanced", type: "news", question: "How does margin trading amplify both gains and losses?", options: ["It doesn't affect returns", "Borrowed funds increase position size beyond your capital", "It only amplifies gains", "It reduces transaction fees"], correctAnswer: 1, explanation: "Margin trading uses borrowed funds to increase position size, which magnifies both potential gains and losses proportionally.", xpReward: 25 },

  { level: "beginner", type: "sector", question: "Which sector includes companies like Apple and Microsoft?", options: ["Healthcare", "Technology", "Energy", "Financials"], correctAnswer: 1, explanation: "Apple and Microsoft belong to the Technology sector, which includes companies that produce software, hardware, and technology services.", xpReward: 20 },
  { level: "beginner", type: "dividend", question: "What is a dividend yield?", options: ["The company's total revenue", "Annual dividend per share divided by the stock price", "The company's profit margin", "The stock's annual return"], correctAnswer: 1, explanation: "Dividend yield is calculated by dividing the annual dividend payment per share by the current stock price, expressed as a percentage.", xpReward: 20 },
  { level: "beginner", type: "earnings", question: "What does 'EPS' stand for in stock analysis?", options: ["Equity Per Share", "Earnings Per Share", "Exchange Price System", "Expected Profit Score"], correctAnswer: 1, explanation: "EPS (Earnings Per Share) is a company's profit divided by the number of outstanding shares. It's a key metric for evaluating profitability.", xpReward: 20 },
  { level: "intermediate", type: "sector", question: "Which sector typically outperforms during periods of rising interest rates?", options: ["Technology", "Financials", "Consumer Discretionary", "Real Estate"], correctAnswer: 1, explanation: "The Financials sector, especially banks, tends to benefit from rising rates as they can charge more for loans while paying less on deposits.", xpReward: 20 },
  { level: "intermediate", type: "dividend", question: "What is a 'dividend aristocrat'?", options: ["A stock paying dividends once a year", "A company that has raised dividends for 25+ consecutive years", "The highest-yielding dividend stock", "A government bond with fixed dividends"], correctAnswer: 1, explanation: "Dividend Aristocrats are S&P 500 companies that have increased their dividends for at least 25 consecutive years, signaling financial stability.", xpReward: 20 },
  { level: "intermediate", type: "earnings", question: "What is an 'earnings surprise'?", options: ["An unexpected CEO resignation", "When actual earnings differ significantly from analyst estimates", "A sudden stock split announcement", "A dividend cut"], correctAnswer: 1, explanation: "An earnings surprise occurs when a company's reported earnings are significantly higher or lower than analyst consensus estimates, often causing sharp price moves.", xpReward: 20 },
  { level: "advanced", type: "hedge", question: "Which assets are commonly considered 'safe havens' during market downturns?", options: ["High-growth tech stocks", "Gold, US Treasuries, and Japanese Yen", "Real estate investment trusts", "Emerging market equities"], correctAnswer: 1, explanation: "Gold, US Treasuries, and the Japanese Yen are traditional safe haven assets that investors flock to during market stress due to their stability.", xpReward: 25 },
  { level: "advanced", type: "insider", question: "Why do institutional investors' 13F filings matter to retail investors?", options: ["They show exact trading algorithms", "They reveal large investors' quarterly holdings and possible conviction buys", "They predict next quarter's earnings", "They guarantee stock price increases"], correctAnswer: 1, explanation: "13F filings reveal what major institutions like hedge funds hold each quarter, giving retail investors insight into where smart money is positioned.", xpReward: 25 },
  { level: "advanced", type: "earnings", question: "What is 'earnings guidance' and why does it matter?", options: ["A government regulation on earnings reports", "Management's forward-looking outlook on future financial performance", "A historical earnings analysis", "An accounting adjustment method"], correctAnswer: 1, explanation: "Earnings guidance is management's forecast of future financial performance. It often moves stock prices more than current earnings because markets are forward-looking.", xpReward: 25 },

  // RRG quests
  { level: "beginner", type: "rrg", question: "In an RRG (Relative Rotation Graph), what does the 'Leading' quadrant indicate?", options: ["The sector is losing momentum", "The sector has strong relative strength and rising momentum", "The sector is about to collapse", "The sector has no movement"], correctAnswer: 1, explanation: "The Leading quadrant in an RRG shows sectors with high relative strength AND improving momentum — the strongest positioning.", xpReward: 25 },
  { level: "intermediate", type: "rrg", question: "What does a sector moving from 'Weakening' to 'Lagging' on an RRG suggest?", options: ["The sector is recovering", "Both relative strength and momentum are deteriorating", "The sector is outperforming", "Volume is increasing"], correctAnswer: 1, explanation: "A move from Weakening to Lagging on RRG signals continued deterioration — both relative strength and momentum are declining, suggesting sector rotation away from this area.", xpReward: 25 },
  { level: "advanced", type: "rrg", question: "Which RRG quadrant transition is typically the earliest bullish signal for a sector?", options: ["Leading → Weakening", "Lagging → Improving", "Improving → Leading", "Weakening → Lagging"], correctAnswer: 1, explanation: "The Lagging → Improving transition is often the earliest bullish signal — it shows momentum is turning positive even while relative strength is still below average.", xpReward: 25 },

  // Chart quests
  { level: "beginner", type: "chart", question: "What does adding a Moving Average (MA) to a chart help investors identify?", options: ["Exact future prices", "The overall price trend direction", "Company earnings growth", "Dividend payment dates"], correctAnswer: 1, explanation: "A Moving Average smooths out daily price fluctuations to reveal the underlying trend direction — up, down, or sideways.", xpReward: 20 },
  { level: "intermediate", type: "chart", question: "If RSI on a stock chart drops below 30, what does this typically indicate?", options: ["The stock is overbought", "The stock may be oversold and due for a bounce", "The company is about to report earnings", "Dividends will be cut"], correctAnswer: 1, explanation: "RSI below 30 indicates the stock may be oversold — meaning it has fallen sharply and could be due for a technical recovery or bounce.", xpReward: 20 },
  { level: "advanced", type: "chart", question: "What does Bollinger Band contraction (squeeze) typically signal?", options: ["The trend is strengthening", "Low volatility that often precedes a sharp breakout move", "The stock is about to pay a dividend", "Volume is declining permanently"], correctAnswer: 1, explanation: "A Bollinger Band squeeze (bands narrowing) indicates very low volatility. Historically, this compression often precedes a significant price move — though direction is not guaranteed.", xpReward: 20 },

  // Economic quests
  { level: "beginner", type: "economic", question: "What happens to stocks generally when inflation (CPI) comes in higher than expected?", options: ["Stocks always rise sharply", "Stocks often fall as rate hike fears increase", "Stocks are not affected by inflation", "Only tech stocks fall"], correctAnswer: 1, explanation: "Higher-than-expected CPI signals that the Fed may raise rates further to fight inflation, which increases borrowing costs and makes future earnings less valuable — often pressuring stocks.", xpReward: 25 },
  { level: "intermediate", type: "economic", question: "How does a strong jobs report (low unemployment) typically affect interest rates?", options: ["Interest rates are expected to fall immediately", "It may keep rates higher as the Fed tries to prevent overheating", "Jobs data never affects interest rates", "Rates only move on inflation data"], correctAnswer: 1, explanation: "A strong jobs report suggests the economy is running hot, which may prevent the Fed from cutting rates — potentially keeping borrowing costs higher for longer.", xpReward: 25 },
  { level: "advanced", type: "economic", question: "What does an inverted yield curve (short-term rates > long-term rates) historically predict?", options: ["A strong bull market ahead", "An increased probability of recession within 12-18 months", "A tech sector boom", "Accelerating GDP growth"], correctAnswer: 1, explanation: "An inverted yield curve has preceded every US recession for the past 50 years. When short-term treasury yields exceed long-term yields, it signals credit market stress and recession risk.", xpReward: 25 },

  // Macro Action quests
  { level: "beginner", type: "macro_action", question: "In the Pro Dashboard, check the Market Breadth section. What % of tracked stocks are above their SMA50?", options: ["The exact number varies daily — check it now!", "Always 50%", "Always 100%", "Always 0%"], correctAnswer: 0, explanation: "Market Breadth shows what percentage of stocks are trending above key moving averages. When above 50%, it signals broad market health — below 50% indicates weakness.", xpReward: 25 },
  { level: "intermediate", type: "macro_action", question: "Open the Pro Dashboard and check the RRG chart. Which sector is currently in the 'Leading' quadrant?", options: ["The answer changes daily — check the RRG now!", "Technology is always Leading", "Energy is always Leading", "Financials are always Leading"], correctAnswer: 0, explanation: "The RRG Leading quadrant changes based on real market data. Identifying which sectors are Leading helps you rotate into the strongest areas — check it regularly!", xpReward: 25 },
  { level: "advanced", type: "macro_action", question: "Using the Earnings panel in the Pro Dashboard, find a stock whose next earnings date is within the next 30 days. What is its EPS estimate?", options: ["The answer depends on the stock — check the Pro Dashboard now!", "All EPS estimates are the same", "EPS estimates are not available in the app", "You need a paid subscription for this data"], correctAnswer: 0, explanation: "The Earnings panel shows upcoming earnings dates and analyst EPS estimates. Tracking upcoming earnings lets you prepare for potential volatility around announcement dates.", xpReward: 25 },
];

const dailyQuestsPoolKo: FallbackQuestData[] = [
  { level: "beginner", type: "term", question: "ETF는 무엇의 약자인가요?", options: ["Exchange Traded Fund", "Equity Traded Finance", "Electronic Transfer Fund", "Early Trade Fee"], correctAnswer: 0, explanation: "ETF는 Exchange Traded Fund(상장지수펀드)의 약자로, 주식처럼 거래소에서 거래되는 증권 바구니입니다.", xpReward: 15 },
  { level: "beginner", type: "term", question: "배당금이란 무엇인가요?", options: ["회사의 총 매출", "주주에게 지급되는 이익의 일부", "주식 주문의 한 유형", "투자에 대한 세금"], correctAnswer: 1, explanation: "배당금은 회사 이익의 일부를 주주에게 분배하는 것입니다.", xpReward: 15 },
  { level: "beginner", type: "pattern", question: "'강세장(Bull Market)'은 무엇을 나타내나요?", options: ["가격이 하락하는 것", "가격이 상승하는 것", "가격이 안정적인 것", "시장이 닫힌 것"], correctAnswer: 1, explanation: "강세장은 주가가 상승하는 기간으로, 일반적으로 최근 저점에서 20% 이상 상승한 것입니다.", xpReward: 15 },
  { level: "beginner", type: "news", question: "'약세장(Bear Market)'이란 무엇인가요?", options: ["상승 추세의 시장", "하락 추세의 시장", "정체된 시장", "변동성이 높은 시장"], correctAnswer: 1, explanation: "약세장은 주가가 하락하는 시장으로, 일반적으로 20% 이상의 하락으로 정의됩니다.", xpReward: 15 },
  { level: "beginner", type: "search", question: "Apple (AAPL)은 어떤 섹터에 속하나요?", options: ["헬스케어", "기술", "소비재", "금융"], correctAnswer: 1, explanation: "Apple Inc.는 기술 섹터로 분류됩니다.", xpReward: 20 },
  { level: "beginner", type: "compare", question: "두 기업의 크기를 비교할 때 가장 좋은 지표는 무엇인가요?", options: ["주가", "시가총액", "직원 수", "설립 연도"], correctAnswer: 1, explanation: "시가총액(주가 x 총 주식 수)은 기업 규모를 비교하는 표준 지표입니다.", xpReward: 20 },
  { level: "beginner", type: "valuation", question: "IPO는 무엇의 약자인가요?", options: ["Internal Profit Operation", "Initial Public Offering", "Investment Portfolio Option", "Indexed Price Order"], correctAnswer: 1, explanation: "IPO는 Initial Public Offering(기업공개)의 약자로, 회사가 처음으로 일반 대중에게 주식을 판매하는 것입니다.", xpReward: 15 },
  { level: "beginner", type: "news", question: "투자에서 포트폴리오란 무엇인가요?", options: ["단일 주식 보유", "금융 투자의 모음", "채권의 한 유형", "거래 전략"], correctAnswer: 1, explanation: "포트폴리오는 투자자가 보유한 주식, 채권 및 기타 자산과 같은 금융 투자의 모음입니다.", xpReward: 15 },

  { level: "intermediate", type: "term", question: "P/E 비율은 무엇을 측정하나요?", options: ["가격 대 자기자본", "가격 대 수익", "이익 대 비용", "포트폴리오 대 자기자본"], correctAnswer: 1, explanation: "P/E(주가수익비율)는 회사의 현재 주가를 주당 수익과 비교하여 측정합니다.", xpReward: 20 },
  { level: "intermediate", type: "term", question: "이동평균은 주식 분석에서 어떻게 사용되나요?", options: ["정확한 가격 예측", "추세 식별을 위한 가격 데이터 평활화", "배당금 계산", "회사 부채 측정"], correctAnswer: 1, explanation: "이동평균은 지속적으로 업데이트되는 평균 가격을 만들어 가격 데이터를 평활화하여 추세를 식별하는 데 도움을 줍니다.", xpReward: 20 },
  { level: "intermediate", type: "pattern", question: "'헤드앤숄더' 패턴은 무엇을 나타내나요?", options: ["강세 지속", "약세 반전", "시장 횡보", "거래량 급증"], correctAnswer: 1, explanation: "헤드앤숄더 패턴은 상승에서 하락으로의 추세 전환 가능성을 나타내는 약세 반전 패턴입니다.", xpReward: 20 },
  { level: "intermediate", type: "news", question: "기업이 실적 예상치를 상회하면 주가에 어떤 영향이 있나요?", options: ["항상 하락", "일반적으로 상승", "변화 없음", "시장이 닫힘"], correctAnswer: 1, explanation: "기업이 애널리스트 예상보다 높은 실적을 발표하면, 긍정적인 심리로 인해 주가가 일반적으로 상승합니다.", xpReward: 20 },
  { level: "intermediate", type: "search", question: "Tesla (TSLA)는 어떤 지수에 포함되어 있나요?", options: ["다우존스 산업평균", "S&P 500", "러셀 2000만", "해당 없음"], correctAnswer: 1, explanation: "Tesla는 2020년 12월에 편입된 S&P 500 지수의 구성 종목입니다.", xpReward: 20 },
  { level: "intermediate", type: "compare", question: "두 주식을 비교할 때 낮은 P/E 비율은 일반적으로 무엇을 시사하나요?", options: ["높은 위험", "수익 대비 저평가 가능성", "더 나은 브랜드 인지도", "더 높은 배당 수익률"], correctAnswer: 1, explanation: "동종 업계 대비 낮은 P/E 비율은 일반적으로 수익 대비 주식이 저평가되어 있을 수 있음을 시사합니다.", xpReward: 20 },
  { level: "intermediate", type: "valuation", question: "RSI(상대강도지수)는 무엇을 측정하나요?", options: ["회사 매출 성장", "가격 변동의 속도와 크기", "부채비율", "배당 지급 빈도"], correctAnswer: 1, explanation: "RSI는 최근 가격 변동의 속도와 크기를 측정하여 과매수 또는 과매도 상태를 평가합니다.", xpReward: 20 },
  { level: "intermediate", type: "news", question: "섹터 로테이션이 주식 성과에 어떤 영향을 미치나요?", options: ["영향 없음", "경제 주기에 따라 투자자들이 섹터 간 자금을 이동", "기술주만 영향을 받음", "채권에만 중요"], correctAnswer: 1, explanation: "섹터 로테이션은 경제 상황이 경기 주기를 통해 변화함에 따라 투자자들이 섹터 간 투자를 전환하는 것입니다.", xpReward: 20 },

  { level: "advanced", type: "term", question: "DCF(현금흐름할인법) 분석이란 무엇인가요?", options: ["실제 현금을 세는 방법", "미래 현금흐름을 현재가치로 할인하는 가치평가 방법", "배당금 계산 방법", "세금 계산 방법"], correctAnswer: 1, explanation: "DCF 분석은 예상 미래 현금흐름을 현재 가치로 할인하여 투자 가치를 추정합니다.", xpReward: 25 },
  { level: "advanced", type: "term", question: "금융에서 파생상품이란 무엇인가요?", options: ["회사의 부수적 제품", "기초자산에서 가치가 파생되는 금융 계약", "저축 계좌의 한 유형", "정부 규제"], correctAnswer: 1, explanation: "파생상품은 주식, 채권, 상품 등 기초자산의 가격에 기반한 금융 상품입니다.", xpReward: 25 },
  { level: "advanced", type: "pattern", question: "수익률 곡선 역전은 일반적으로 무엇을 신호하나요?", options: ["강한 경제 성장", "잠재적인 경기 침체", "주가 상승", "소비 지출 증가"], correctAnswer: 1, explanation: "단기 금리가 장기 금리를 초과하는 수익률 곡선 역전은 역사적으로 신뢰할 수 있는 경기 침체 지표였습니다.", xpReward: 25 },
  { level: "advanced", type: "news", question: "옵션 거래에서 '커버드 콜 작성'이란 무엇인가요?", options: ["보유하지 않은 주식에 콜옵션 매수", "이미 보유한 주식에 콜옵션 매도", "보호를 위한 풋옵션 매수", "레버리지를 이용한 공매도"], correctAnswer: 1, explanation: "커버드 콜 작성은 이미 보유한 주식에 대해 콜옵션을 매도하여 프리미엄 수입을 창출하는 것입니다.", xpReward: 25 },
  { level: "advanced", type: "search", question: "NVIDIA (NVDA)의 AI 분야 주요 경쟁 우위는 무엇인가요?", options: ["소셜 미디어 플랫폼", "병렬 처리를 위한 GPU 아키텍처", "클라우드 스토리지 서비스", "스마트폰 제조"], correctAnswer: 1, explanation: "NVIDIA의 GPU 아키텍처는 병렬 처리에 뛰어나 AI 및 머신러닝 워크로드의 지배적 플랫폼입니다.", xpReward: 25 },
  { level: "advanced", type: "compare", question: "기업가치(EV)는 시가총액이 포착하지 못하는 무엇을 포함하나요?", options: ["주가 이력", "부채와 현금 포지션", "제품 수", "직원 만족도"], correctAnswer: 1, explanation: "기업가치는 시가총액에 부채를 더하고 현금을 빼서 회사의 총 가치를 더 완전하게 보여줍니다.", xpReward: 25 },
  { level: "advanced", type: "valuation", question: "높은 공매도 비율은 시장 심리에 대해 무엇을 나타내나요?", options: ["강한 강세 합의", "많은 투자자가 주가 하락에 베팅", "회사가 분할될 예정", "배당금 인상 예상"], correctAnswer: 1, explanation: "높은 공매도 비율은 많은 투자자가 공매도를 했음을 의미하며, 약세 심리와 가격 하락 기대를 나타냅니다.", xpReward: 25 },
  { level: "advanced", type: "news", question: "마진 거래는 어떻게 이익과 손실을 모두 증폭시키나요?", options: ["수익에 영향 없음", "차입 자금이 자본 이상으로 포지션 크기를 증가", "이익만 증폭", "거래 수수료 절감"], correctAnswer: 1, explanation: "마진 거래는 차입 자금을 사용하여 포지션 크기를 늘려 잠재적 이익과 손실 모두를 비례적으로 확대합니다.", xpReward: 25 },

  { level: "beginner", type: "sector", question: "Apple(AAPL)과 Microsoft(MSFT)는 어떤 섹터에 속하나요?", options: ["헬스케어", "기술(Technology)", "에너지", "금융"], correctAnswer: 1, explanation: "Apple과 Microsoft는 소프트웨어, 하드웨어, 기술 서비스를 제공하는 기술 섹터에 속합니다.", xpReward: 20 },
  { level: "beginner", type: "dividend", question: "배당 수익률(Dividend Yield)이란 무엇인가요?", options: ["회사의 총 매출", "주당 연간 배당금을 주가로 나눈 비율", "회사의 이익률", "주식의 연간 수익률"], correctAnswer: 1, explanation: "배당 수익률은 주당 연간 배당금을 현재 주가로 나눈 값으로, 배당투자의 수익성을 나타냅니다.", xpReward: 20 },
  { level: "beginner", type: "earnings", question: "EPS(주당순이익)이란 무엇인가요?", options: ["주당 자기자본", "주당 순이익", "주당 배당금", "주당 매출"], correctAnswer: 1, explanation: "EPS(주당순이익)는 회사의 순이익을 발행 주식 수로 나눈 값으로, 수익성 평가의 핵심 지표입니다.", xpReward: 20 },
  { level: "intermediate", type: "sector", question: "금리 상승기에 어떤 섹터가 일반적으로 유리한가요?", options: ["기술주", "금융주", "소비재", "부동산"], correctAnswer: 1, explanation: "금리 상승기에는 금융주(특히 은행)가 유리합니다. 대출금리는 오르고 예금금리 인상은 더디어 예대마진이 확대됩니다.", xpReward: 20 },
  { level: "intermediate", type: "dividend", question: "'배당 귀족(Dividend Aristocrat)'이란 무엇인가요?", options: ["연 1회 배당을 지급하는 주식", "25년 이상 연속 배당을 인상한 S&P 500 기업", "배당수익률이 가장 높은 주식", "고정 배당을 지급하는 국채"], correctAnswer: 1, explanation: "배당 귀족은 25년 이상 연속으로 배당금을 인상한 S&P 500 기업으로, 재정적 안정성과 주주 친화 정책의 상징입니다.", xpReward: 20 },
  { level: "intermediate", type: "earnings", question: "'어닝 서프라이즈(Earnings Surprise)'란 무엇인가요?", options: ["갑작스러운 CEO 사임", "실제 실적이 애널리스트 예상치와 크게 차이 나는 것", "갑작스러운 주식 분할 발표", "배당 삭감"], correctAnswer: 1, explanation: "어닝 서프라이즈는 실제 실적이 애널리스트 컨센서스 예상치보다 크게 높거나 낮을 때 발생하며, 주가에 급격한 변동을 초래합니다.", xpReward: 20 },
  { level: "advanced", type: "hedge", question: "시장이 10% 하락할 때 '안전자산'으로 주로 꼽히는 것은?", options: ["성장주", "금, 미국 국채, 일본 엔화", "리츠(REITs)", "신흥국 주식"], correctAnswer: 1, explanation: "금, 미국 국채, 일본 엔화는 시장 불안 시 투자자들이 몰리는 전통적인 안전자산으로, 변동성이 낮고 안정적입니다.", xpReward: 25 },
  { level: "advanced", type: "insider", question: "기관투자자의 13F 공시가 개인 투자자에게 중요한 이유는?", options: ["정확한 거래 알고리즘을 공개하기 때문", "분기별 대형 투자자의 보유 종목과 컨빅션 매수를 파악할 수 있기 때문", "다음 분기 실적을 예측할 수 있기 때문", "주가 상승을 보장하기 때문"], correctAnswer: 1, explanation: "13F 공시는 헤지펀드 등 대형 기관이 분기별로 보유한 종목을 공개합니다. 스마트머니의 포지션을 파악하는 핵심 자료입니다.", xpReward: 25 },
  { level: "advanced", type: "earnings", question: "'실적 가이던스(Earnings Guidance)'란 무엇이며 왜 중요한가요?", options: ["정부의 실적 공시 규정", "경영진이 제시하는 미래 재무 성과 전망", "과거 실적 분석 보고서", "회계 조정 방법"], correctAnswer: 1, explanation: "실적 가이던스는 경영진이 제시하는 미래 실적 전망입니다. 시장은 미래를 반영하기 때문에 현재 실적보다 가이던스가 주가에 더 큰 영향을 미칩니다.", xpReward: 25 },

  // RRG 퀘스트
  { level: "beginner", type: "rrg", question: "RRG(상대적 회전 그래프)에서 '선도(Leading)' 구간이 의미하는 것은?", options: ["섹터가 모멘텀을 잃고 있음", "높은 상대강도와 상승하는 모멘텀을 가진 강세 섹터", "섹터가 곧 붕괴될 것", "섹터에 변화가 없음"], correctAnswer: 1, explanation: "RRG의 Leading 구간은 상대강도와 모멘텀이 모두 강한 섹터를 나타냅니다. 이 구간의 섹터는 시장 전체 대비 가장 강한 포지션에 있습니다.", xpReward: 25 },
  { level: "intermediate", type: "rrg", question: "RRG에서 섹터가 '약화(Weakening)'에서 '지연(Lagging)'으로 이동할 때의 신호는?", options: ["섹터가 회복 중", "상대강도와 모멘텀이 모두 악화되고 있음", "섹터가 시장을 앞서고 있음", "거래량이 증가 중"], correctAnswer: 1, explanation: "Weakening → Lagging 이동은 섹터의 상대강도와 모멘텀이 모두 하락하는 것을 나타냅니다. 이는 해당 섹터에서 자금이 이탈하고 있음을 시사합니다.", xpReward: 25 },
  { level: "advanced", type: "rrg", question: "RRG에서 가장 이른 강세 신호를 나타내는 구간 이동은?", options: ["선도 → 약화", "지연 → 개선", "개선 → 선도", "약화 → 지연"], correctAnswer: 1, explanation: "지연 → 개선 이동은 가장 이른 강세 신호입니다. 상대강도는 아직 낮지만 모멘텀이 긍정적으로 전환되어 조기 진입 기회를 제공할 수 있습니다.", xpReward: 25 },

  // 차트 퀘스트
  { level: "beginner", type: "chart", question: "차트에 이동평균(MA)을 추가하면 투자자에게 어떤 도움이 되나요?", options: ["미래 정확한 가격 예측", "전체적인 가격 추세 방향 파악", "회사 실적 성장 측정", "배당 지급일 확인"], correctAnswer: 1, explanation: "이동평균은 일별 가격 변동을 부드럽게 만들어 전반적인 추세 방향(상승, 하락, 횡보)을 파악하는 데 도움을 줍니다.", xpReward: 20 },
  { level: "intermediate", type: "chart", question: "차트에서 RSI가 30 이하로 떨어지면 일반적으로 무엇을 의미하나요?", options: ["주식이 과매수 상태", "주식이 과매도 상태로 반등 가능성이 있음", "회사가 실적을 발표할 예정", "배당이 삭감될 것"], correctAnswer: 1, explanation: "RSI 30 이하는 주식이 과매도 상태임을 나타냅니다. 급격한 하락 이후 기술적 반등이나 회복이 가능함을 시사합니다.", xpReward: 20 },
  { level: "advanced", type: "chart", question: "볼린저밴드 수축(스퀴즈)은 일반적으로 무엇을 신호하나요?", options: ["추세가 강화되고 있음", "변동성이 낮아 곧 강한 방향성 움직임이 나타날 가능성이 있음", "주식이 곧 배당을 지급할 것", "거래량이 영구적으로 감소함"], correctAnswer: 1, explanation: "볼린저밴드 수축은 변동성이 매우 낮음을 나타냅니다. 이 압축 상태 후에는 강한 가격 움직임이 자주 뒤따르지만, 방향은 별도로 판단해야 합니다.", xpReward: 20 },

  // 경제 지표 퀘스트
  { level: "beginner", type: "economic", question: "소비자물가지수(CPI)가 예상보다 높게 나오면 주식시장은 어떻게 반응하나요?", options: ["주식은 항상 급등함", "금리 인상 우려로 주식이 하락하는 경우가 많음", "주식은 물가에 영향받지 않음", "기술주만 하락함"], correctAnswer: 1, explanation: "CPI가 예상치를 상회하면 연준이 금리를 더 올릴 수 있다는 우려가 커집니다. 금리 상승은 차입 비용 증가와 미래 이익의 현재가치 하락을 초래해 주식에 부정적입니다.", xpReward: 25 },
  { level: "intermediate", type: "economic", question: "고용보고서가 강세(실업률 하락)를 보일 때 금리에 미치는 영향은?", options: ["금리가 즉시 하락함", "경제 과열 방지를 위해 금리가 높게 유지될 수 있음", "고용지표는 금리에 영향 없음", "금리는 물가지수에만 반응함"], correctAnswer: 1, explanation: "강한 고용지표는 경제가 과열되고 있음을 시사하며, 연준이 금리 인하를 서두르지 않을 가능성이 높아집니다. 이는 금리를 더 오래 높게 유지시킬 수 있습니다.", xpReward: 25 },
  { level: "advanced", type: "economic", question: "장단기 금리역전(단기>장기) 현상이 역사적으로 예고하는 것은?", options: ["강한 강세장의 시작", "12-18개월 내 경기침체 가능성 상승", "기술섹터 호황", "GDP 성장 가속화"], correctAnswer: 1, explanation: "장단기 금리역전은 지난 50년간 모든 미국 경기침체에 앞서 나타났습니다. 단기 국채 수익률이 장기를 초과하면 신용시장 스트레스와 경기침체 위험을 신호합니다.", xpReward: 25 },

  // 실전 행동 퀘스트
  { level: "beginner", type: "macro_action", question: "Pro 대시보드의 시장 폭(Market Breadth) 섹션에서 SMA50 위에 있는 종목의 비율은?", options: ["매일 변함 — 지금 확인하세요!", "항상 50%", "항상 100%", "항상 0%"], correctAnswer: 0, explanation: "시장 폭 지수는 주요 이동평균 위에서 거래되는 종목의 비율을 보여줍니다. 50% 이상이면 전반적인 시장 건전성, 이하면 약세를 나타냅니다.", xpReward: 25 },
  { level: "intermediate", type: "macro_action", question: "Pro 대시보드의 RRG 차트를 확인하세요. 현재 '선도(Leading)' 구간에 있는 섹터는?", options: ["답은 매일 변함 — 지금 RRG를 확인하세요!", "기술 섹터가 항상 선도", "에너지 섹터가 항상 선도", "금융 섹터가 항상 선도"], correctAnswer: 0, explanation: "RRG 선도 구간은 실시간 시장 데이터에 따라 변합니다. 어떤 섹터가 선도하고 있는지 정기적으로 확인하면 섹터 로테이션 기회를 포착할 수 있습니다.", xpReward: 25 },
  { level: "advanced", type: "macro_action", question: "Pro 대시보드의 실적 패널에서 향후 30일 내 실적 발표 예정인 종목의 EPS 예상치를 확인하세요.", options: ["답은 종목마다 다름 — 지금 Pro 대시보드를 확인하세요!", "모든 EPS 예상치는 동일", "앱에서 EPS 예상치를 볼 수 없음", "유료 구독이 필요한 데이터"], correctAnswer: 0, explanation: "실적 패널은 향후 실적 발표일과 애널리스트 EPS 예상치를 보여줍니다. 실적 발표일 전후의 잠재적 변동성에 대비하기 위해 이를 추적하는 것이 중요합니다.", xpReward: 25 },
];

const practiceQuestsPoolEn: FallbackPracticeData[] = [
  { level: "beginner", question: "What does 'blue chip' refer to in investing?", options: ["High-risk penny stocks", "Large, stable, well-established companies", "Technology startups", "Government bonds"], correctAnswer: 1, explanation: "Blue chip stocks are shares of large, well-established companies with a history of reliable performance." },
  { level: "beginner", question: "What is a stock split?", options: ["Dividing company assets", "Increasing the number of shares while reducing price proportionally", "Selling half your shares", "A market crash"], correctAnswer: 1, explanation: "A stock split increases shares outstanding while proportionally reducing the price per share." },
  { level: "beginner", question: "What does 'going long' mean?", options: ["Holding a stock for years", "Buying a stock expecting it to rise", "Selling a stock you don't own", "Investing in long-term bonds"], correctAnswer: 1, explanation: "Going long means buying a security with the expectation that its price will increase." },
  { level: "beginner", question: "What is a stock exchange?", options: ["A place to trade currencies only", "A marketplace where stocks are bought and sold", "A government office", "An insurance company"], correctAnswer: 1, explanation: "A stock exchange is an organized marketplace where securities like stocks and bonds are bought and sold." },
  { level: "beginner", question: "What does 'diversification' mean in investing?", options: ["Putting all money in one stock", "Spreading investments across different assets to reduce risk", "Only investing in technology", "Buying stocks daily"], correctAnswer: 1, explanation: "Diversification means spreading investments across various assets to reduce the impact of any single investment's poor performance." },

  { level: "intermediate", question: "What is the significance of the 200-day moving average?", options: ["It predicts exact prices", "It is a key indicator of long-term trend direction", "It measures company profits", "It calculates dividend payments"], correctAnswer: 1, explanation: "The 200-day moving average is widely used to determine long-term trend direction; prices above it suggest an uptrend." },
  { level: "intermediate", question: "What does a 'golden cross' signal?", options: ["A company going bankrupt", "A bullish signal when the 50-day MA crosses above the 200-day MA", "A bearish reversal", "A dividend announcement"], correctAnswer: 1, explanation: "A golden cross occurs when the 50-day moving average crosses above the 200-day moving average, signaling a potential bullish trend." },
  { level: "intermediate", question: "What is market capitalization?", options: ["A company's annual revenue", "Share price multiplied by total outstanding shares", "Total company debt", "Annual dividend payments"], correctAnswer: 1, explanation: "Market capitalization equals the current share price multiplied by the total number of outstanding shares." },
  { level: "intermediate", question: "What does an earnings surprise mean?", options: ["A company closing unexpectedly", "Actual earnings differ significantly from analyst estimates", "A new product launch", "A CEO resignation"], correctAnswer: 1, explanation: "An earnings surprise occurs when a company's reported earnings differ significantly from what analysts expected." },
  { level: "intermediate", question: "What is a support level in technical analysis?", options: ["The highest price ever reached", "A price level where buying pressure tends to prevent further decline", "The company's book value", "A government-set price floor"], correctAnswer: 1, explanation: "A support level is a price point where sufficient buying interest typically prevents the stock from falling further." },

  { level: "advanced", question: "What is the primary risk of selling naked put options?", options: ["Limited to the premium received", "Obligation to buy the stock at the strike price if it falls significantly", "No risk involved", "Only losing the time value"], correctAnswer: 1, explanation: "Selling naked puts creates an obligation to buy shares at the strike price, which can result in significant losses if the stock drops well below that level." },
  { level: "advanced", question: "What is the Sharpe Ratio used to measure?", options: ["Company profitability", "Risk-adjusted return of an investment", "Stock price momentum", "Market liquidity"], correctAnswer: 1, explanation: "The Sharpe Ratio measures the excess return per unit of risk (standard deviation), helping compare risk-adjusted performance across investments." },
  { level: "advanced", question: "What happens during a short squeeze?", options: ["Stock price gradually declines", "Rapid price increase forces short sellers to buy back shares, further driving up the price", "Trading is halted permanently", "Dividends are suspended"], correctAnswer: 1, explanation: "A short squeeze occurs when a heavily shorted stock's price rises, forcing short sellers to cover positions by buying shares, which accelerates the price increase." },
  { level: "advanced", question: "What does the WACC (Weighted Average Cost of Capital) represent?", options: ["A company's stock price target", "The blended rate of return a company must earn to satisfy all capital providers", "The total debt amount", "Annual revenue growth rate"], correctAnswer: 1, explanation: "WACC represents the weighted average of the costs of all sources of capital (debt and equity), used as a discount rate in DCF analysis." },
  { level: "advanced", question: "What is delta in options trading?", options: ["The time until expiration", "The rate of change of option price relative to the underlying asset's price change", "The strike price difference", "The total premium paid"], correctAnswer: 1, explanation: "Delta measures how much an option's price is expected to change for a $1 change in the underlying asset's price." },
];

const practiceQuestsPoolKo: FallbackPracticeData[] = [
  { level: "beginner", question: "'블루칩'이란 투자에서 무엇을 의미하나요?", options: ["고위험 페니 주식", "크고 안정적이며 잘 확립된 기업", "기술 스타트업", "국채"], correctAnswer: 1, explanation: "블루칩 주식은 안정적인 성과 이력을 가진 대형 우량 기업의 주식입니다." },
  { level: "beginner", question: "주식 분할이란 무엇인가요?", options: ["회사 자산 분할", "주식 수를 늘리면서 가격을 비례적으로 줄이는 것", "보유 주식의 절반을 파는 것", "시장 붕괴"], correctAnswer: 1, explanation: "주식 분할은 발행 주식 수를 늘리면서 주당 가격을 비례적으로 낮추는 것입니다." },
  { level: "beginner", question: "'롱 포지션을 취하다'는 무슨 뜻인가요?", options: ["주식을 수년간 보유하는 것", "상승을 기대하며 주식을 매수하는 것", "소유하지 않은 주식을 파는 것", "장기 채권에 투자하는 것"], correctAnswer: 1, explanation: "롱 포지션을 취한다는 것은 가격 상승을 기대하며 증권을 매수하는 것을 의미합니다." },
  { level: "beginner", question: "증권거래소란 무엇인가요?", options: ["화폐만 거래하는 곳", "주식이 매매되는 시장", "정부 기관", "보험 회사"], correctAnswer: 1, explanation: "증권거래소는 주식과 채권 같은 증권이 매매되는 조직화된 시장입니다." },
  { level: "beginner", question: "투자에서 '분산투자'란 무엇을 의미하나요?", options: ["모든 돈을 한 종목에 투자", "위험을 줄이기 위해 다양한 자산에 투자를 분산", "기술주에만 투자", "매일 주식 매수"], correctAnswer: 1, explanation: "분산투자란 단일 투자의 저조한 성과가 미치는 영향을 줄이기 위해 다양한 자산에 투자를 분산하는 것입니다." },

  { level: "intermediate", question: "200일 이동평균의 중요성은 무엇인가요?", options: ["정확한 가격 예측", "장기 추세 방향의 핵심 지표", "회사 이익 측정", "배당금 계산"], correctAnswer: 1, explanation: "200일 이동평균은 장기 추세 방향을 결정하는 데 널리 사용됩니다. 가격이 그 위에 있으면 상승 추세를 시사합니다." },
  { level: "intermediate", question: "'골든 크로스'는 무엇을 신호하나요?", options: ["회사 파산", "50일 이동평균이 200일 이동평균을 상향 돌파하는 강세 신호", "약세 반전", "배당 발표"], correctAnswer: 1, explanation: "골든 크로스는 50일 이동평균이 200일 이동평균을 상향 돌파할 때 발생하며, 잠재적 강세 추세를 신호합니다." },
  { level: "intermediate", question: "시가총액이란 무엇인가요?", options: ["회사의 연간 매출", "주가에 총 발행 주식 수를 곱한 것", "총 회사 부채", "연간 배당금 지급액"], correctAnswer: 1, explanation: "시가총액은 현재 주가에 총 발행 주식 수를 곱한 것입니다." },
  { level: "intermediate", question: "어닝 서프라이즈란 무엇인가요?", options: ["회사의 예상치 못한 폐업", "실제 실적이 애널리스트 추정치와 크게 다른 것", "신제품 출시", "CEO 사임"], correctAnswer: 1, explanation: "어닝 서프라이즈는 기업의 발표 실적이 애널리스트가 예상한 것과 크게 다를 때 발생합니다." },
  { level: "intermediate", question: "기술적 분석에서 지지선이란 무엇인가요?", options: ["역대 최고 가격", "매수 압력이 추가 하락을 방지하는 가격 수준", "회사의 장부가치", "정부가 설정한 가격 하한"], correctAnswer: 1, explanation: "지지선은 충분한 매수 관심이 일반적으로 주가가 더 하락하는 것을 방지하는 가격 포인트입니다." },

  { level: "advanced", question: "네이키드 풋옵션 매도의 주요 위험은 무엇인가요?", options: ["받은 프리미엄으로 제한", "주가가 크게 하락하면 행사가로 주식을 매수해야 할 의무", "위험 없음", "시간가치만 손실"], correctAnswer: 1, explanation: "네이키드 풋 매도는 행사가에 주식을 매수해야 할 의무를 생성하며, 주가가 그 수준 이하로 크게 하락하면 상당한 손실을 초래할 수 있습니다." },
  { level: "advanced", question: "샤프 비율은 무엇을 측정하나요?", options: ["회사 수익성", "투자의 위험 조정 수익률", "주가 모멘텀", "시장 유동성"], correctAnswer: 1, explanation: "샤프 비율은 위험(표준편차) 단위당 초과 수익을 측정하여 투자 간 위험 조정 성과를 비교하는 데 도움을 줍니다." },
  { level: "advanced", question: "숏 스퀴즈 동안 무슨 일이 발생하나요?", options: ["주가가 점진적으로 하락", "급격한 가격 상승이 공매도자의 환매를 강제하여 가격을 더욱 끌어올림", "거래가 영구적으로 중단", "배당금이 중단"], correctAnswer: 1, explanation: "숏 스퀴즈는 공매도가 많은 주식의 가격이 상승하여 공매도자가 매수로 포지션을 청산하면서 가격 상승을 가속화하는 것입니다." },
  { level: "advanced", question: "WACC(가중평균자본비용)는 무엇을 나타내나요?", options: ["회사의 목표 주가", "모든 자본 제공자를 만족시키기 위해 회사가 벌어야 하는 혼합 수익률", "총 부채 금액", "연간 매출 성장률"], correctAnswer: 1, explanation: "WACC는 모든 자본원천(부채와 자기자본)의 비용의 가중 평균으로, DCF 분석에서 할인율로 사용됩니다." },
  { level: "advanced", question: "옵션 거래에서 델타란 무엇인가요?", options: ["만기까지의 시간", "기초자산 가격 변동에 대한 옵션 가격의 변화율", "행사가 차이", "지불한 총 프리미엄"], correctAnswer: 1, explanation: "델타는 기초자산 가격이 1달러 변동할 때 옵션 가격이 얼마나 변할 것으로 예상되는지를 측정합니다." },
];

function fallbackPracticeQuest(userId: string, language: string = 'en', skillLevel: SkillLevel = 'beginner'): InsertQuest {
  const isKorean = language === 'ko';
  const pool = isKorean ? practiceQuestsPoolKo : practiceQuestsPoolEn;
  const filtered = pool.filter(q => q.level === skillLevel);
  const selected = filtered[Math.floor(Math.random() * filtered.length)];
  return {
    userId,
    type: "practice",
    question: selected.question,
    options: selected.options,
    correctAnswer: selected.correctAnswer,
    explanation: selected.explanation,
    xpReward: 5,
  };
}

function fallbackQuests(userId: string, language: string = 'en', skillLevel: SkillLevel = 'beginner', recentTypes: string[] = []): InsertQuest[] {
  const isKorean = language === 'ko';
  const pool = isKorean ? dailyQuestsPoolKo : dailyQuestsPoolEn;
  const filtered = pool.filter(q => q.level === skillLevel);

  // All 15 quest types — pick 6 diverse ones, avoid recently used types
  const ALL_TYPES = ["term", "pattern", "news", "search", "compare", "valuation", "sector", "dividend", "earnings", "hedge", "insider", "rrg", "chart", "economic", "macro_action"];

  // Shuffle types for daily variety, deprioritize recently used ones
  const shuffled = [...ALL_TYPES].sort(() => Math.random() - 0.5);
  const recentSet = new Set(recentTypes);
  // Move recently-used types to end so fresh types are picked first
  const prioritized = [...shuffled.filter(t => !recentSet.has(t)), ...shuffled.filter(t => recentSet.has(t))];

  const selected: FallbackQuestData[] = [];
  const usedTypes = new Set<string>();

  for (const type of prioritized) {
    if (selected.length >= 6) break;
    if (usedTypes.has(type)) continue;
    const typeQuests = filtered.filter(q => q.type === type);
    if (typeQuests.length > 0) {
      selected.push(typeQuests[Math.floor(Math.random() * typeQuests.length)]);
      usedTypes.add(type);
    }
  }

  // Fill up to 6 from any remaining if needed
  while (selected.length < 6 && filtered.length > 0) {
    const remaining = filtered.filter(q => !selected.includes(q));
    if (remaining.length === 0) break;
    selected.push(remaining[Math.floor(Math.random() * remaining.length)]);
  }

  return selected.map(q => ({
    userId,
    type: q.type,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    xpReward: q.xpReward,
    isCompleted: false
  }));
}

// ─── Chart Master AI Quiz Generator ────────────────────────────────────────────

const CHART_PATTERNS_POOL = [
  "Double Bottom","Double Top","Head and Shoulders","Inverse Head and Shoulders",
  "Bull Flag","Bear Flag","Ascending Triangle","Descending Triangle","Symmetrical Triangle",
  "Cup and Handle","Rising Wedge","Falling Wedge","Bollinger Band Squeeze",
  "Golden Cross","Death Cross","VWAP Reclaim","Bull Trap / Fake-out",
  "Engulfing Candle Reversal","Hammer Reversal at Support","Gap and Go Continuation",
  "Support/Resistance Breakout","Volume Dry-up at Base","RSI Divergence Setup",
  "Moving Average Ribbon","Consolidation Before Breakout","Three White Soldiers",
  "Evening Star / Morning Star","Pennant Continuation","Channel Breakout",
  "High Tight Flag","Volatility Contraction Pattern","On-Balance Volume Divergence",
];

const SECTORS_POOL = [
  "semiconductor","energy","financial","healthcare","consumer discretionary",
  "software","biotech","industrial","utilities","REIT","defense","retail",
  "electric vehicle","cloud computing","commodity","media","auto","insurance",
];

export async function generateChartQuiz(
  lang: string,
  difficulty: string,
  recentPatterns: string[] = []
): Promise<{ context: string; answer: "up" | "down"; analysis: string; patternName: string; difficulty: string }> {
  const available = CHART_PATTERNS_POOL.filter(p => !recentPatterns.includes(p));
  const pool = available.length > 0 ? available : CHART_PATTERNS_POOL;
  const pattern = pool[Math.floor(Math.random() * pool.length)];
  const sector = SECTORS_POOL[Math.floor(Math.random() * SECTORS_POOL.length)];
  const answer: "up" | "down" = Math.random() > 0.5 ? "up" : "down";

  const difficultyGuide = difficulty === "beginner"
    ? "2-3 clear, easy-to-read signals. Use simple language. Keep price action straightforward."
    : difficulty === "intermediate"
    ? "3-4 signals including volume behavior and one indicator reading. Moderate terminology."
    : "4-5 signals including at least one divergence or multi-timeframe observation. Professional terminology.";

  const langInstruction = lang === "ko"
    ? "Respond ENTIRELY in Korean. All text — context and analysis — must be in Korean."
    : lang === "ja"
    ? "Respond ENTIRELY in Japanese. All text — context and analysis — must be in Japanese."
    : "Respond in English.";

  const correctDir = answer === "up" ? "UP / bullish" : "DOWN / bearish";

  const prompt = `You are a professional technical analyst creating an interactive chart pattern quiz for stock market learners.

Create a realistic stock market scenario based on the "${pattern}" pattern in the ${sector} sector.
The correct answer MUST be "${answer}" — price is expected to move ${correctDir}.
Difficulty: ${difficultyGuide}
${langInstruction}

Rules:
- Write a scenario of 4-6 sentences describing recent price action, indicator readings, volume behavior with specific realistic numbers (prices, percentages, RSI values, volume multipliers, day counts)
- Use a plausible stock price range for the ${sector} sector
- The scenario should contain clear but non-obvious confirming signals for the "${answer}" direction
- Do NOT explicitly name the pattern in the context (let the student identify it)
- Do NOT use any markdown formatting — no asterisks, no bold markers, no symbols like ** or *
- The analysis: 1-2 plain sentences introducing the correct direction, then 3-5 bullet points starting with "•" followed by "Concept name: explanation" (no bold, no asterisks)
- Do NOT use phrases like "Imagine", "Let me", "Certainly", "Great question"

Return ONLY valid JSON (no markdown fences):
{
  "context": "4-6 sentence scenario with specific numbers",
  "analysis": "Correct direction: ${answer === "up" ? "UP" : "DOWN"}. [1-2 sentence explanation of the pattern]\\n\\n• Concept name: explanation\\n• Concept name: explanation\\n• Concept name: explanation"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    const stripBold = (s: string) => s.replace(/\*\*/g, "");
    return {
      context: stripBold(parsed.context ?? ""),
      answer,
      analysis: stripBold(parsed.analysis ?? `Correct direction: ${answer.toUpperCase()}. This pattern showed a classic ${pattern} setup.`),
      patternName: pattern,
      difficulty,
    };
  } catch (err) {
    console.error("generateChartQuiz error:", err);
    return {
      context: `A ${sector} stock has been forming a ${pattern} over the past several weeks with notable volume characteristics and momentum shifts.`,
      answer,
      analysis: `Correct direction: ${answer.toUpperCase()}. The ${pattern} pattern signaled a ${answer === "up" ? "bullish" : "bearish"} directional move based on price structure and volume confirmation.`,
      patternName: pattern,
      difficulty,
    };
  }
}
