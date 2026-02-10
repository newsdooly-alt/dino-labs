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

export async function generateDailyQuests(userId: string, language: string = 'en', skillLevel: SkillLevel = 'beginner'): Promise<InsertQuest[]> {
  const isKorean = language === 'ko';
  const randomStock1 = getRandomStock();
  const randomStock2 = stockSymbols.filter(s => s !== randomStock1)[Math.floor(Math.random() * (stockSymbols.length - 1))];
  const skillDescription = getSkillLevelDescription(skillLevel, isKorean);
  
  const prompt = isKorean ? `
    사용자가 미국 주식에 대해 배울 수 있도록 매일 6개의 다양한 주식 시장 퀘스트를 생성하세요.
    "quests"라는 키를 가진 JSON 객체를 반환하며, 이 키는 6개의 객체 배열입니다.
    
    중요: 사용자 레벨 - ${skillDescription}
    
    퀘스트 유형 (각각 1개씩 포함):
    1. "term": 금융 용어(예: "P/E Ratio", "Dividend", "Market Cap")에 대한 퀴즈.
    2. "pattern": 차트 패턴(예: "Bull Flag", "Head and Shoulders")에 대한 설명과 이를 식별하도록 요청.
    3. "news": 일반적인 시장 뉴스 시나리오 퀴즈(예: "연준이 금리를 올리면 일반적으로 채권 가격은 어떻게 됩니까?").
    4. "search": "${randomStock1}" 종목에 대한 질문 (예: "${randomStock1}의 섹터는 무엇입니까?" 또는 "${randomStock1}은 어떤 산업에 속합니까?").
    5. "compare": "${randomStock1}"와 "${randomStock2}" 두 종목을 비교하는 질문 (예: "다음 중 시가총액이 더 큰 회사는?").
    6. "valuation": PER이 20 미만인 주식을 찾는 것과 관련된 밸류에이션 퀴즈 (예: "PER이 낮다는 것은 무엇을 의미합니까?").

    각 퀘스트 객체는 다음을 포함해야 합니다:
    - type: "term" | "pattern" | "news" | "search" | "compare" | "valuation"
    - question: string (한국어)
    - options: string[] (4개의 옵션, 한국어)
    - correctAnswer: number (0-3 인덱스)
    - explanation: string (정답에 대한 짧은 설명, 한국어)
    - xpReward: number (15-25)
    - targetSymbol: string (search, compare 타입일 경우 해당 종목 심볼, 그 외는 null)
  ` : `
    Generate 6 varied daily stock market quests for a user learning about US stocks.
    Return a JSON object with a key "quests" which is an array of 6 objects.
    
    IMPORTANT: User skill level - ${skillDescription}
    
    Quest types (include one of each):
    1. "term": A quiz about a financial term (e.g., "P/E Ratio", "Dividend", "Market Cap").
    2. "pattern": A description of a chart pattern (e.g., "Bull Flag", "Head and Shoulders") and ask to identify it.
    3. "news": A generic market news scenario quiz (e.g., "If the Fed raises rates, what typically happens to bond prices?").
    4. "search": A question about the stock "${randomStock1}" (e.g., "What sector does ${randomStock1} belong to?" or "What industry is ${randomStock1} in?").
    5. "compare": A question comparing "${randomStock1}" and "${randomStock2}" stocks (e.g., "Which company has a larger market cap?").
    6. "valuation": A valuation quiz related to finding stocks with P/E below 20 (e.g., "What does a low P/E ratio indicate?").

    Each quest object must have:
    - type: "term" | "pattern" | "news" | "search" | "compare" | "valuation"
    - question: string
    - options: string[] (4 options)
    - correctAnswer: number (0-3 index)
    - explanation: string (short explanation of the answer)
    - xpReward: number (15-25)
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
    if (!content) return fallbackQuests(userId, language, skillLevel);

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
    return fallbackQuests(userId, language, skillLevel);
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

function fallbackQuests(userId: string, language: string = 'en', skillLevel: SkillLevel = 'beginner'): InsertQuest[] {
  const isKorean = language === 'ko';
  const pool = isKorean ? dailyQuestsPoolKo : dailyQuestsPoolEn;
  const filtered = pool.filter(q => q.level === skillLevel);

  const questTypes = ["term", "pattern", "news", "search", "compare", "valuation"];
  const selected: FallbackQuestData[] = [];

  for (const type of questTypes) {
    const typeQuests = filtered.filter(q => q.type === type);
    if (typeQuests.length > 0) {
      selected.push(typeQuests[Math.floor(Math.random() * typeQuests.length)]);
    }
  }

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
