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

export async function generateDailyQuests(userId: string, language: string = 'en'): Promise<InsertQuest[]> {
  const isKorean = language === 'ko';
  const randomStock1 = getRandomStock();
  const randomStock2 = stockSymbols.filter(s => s !== randomStock1)[Math.floor(Math.random() * (stockSymbols.length - 1))];
  
  const prompt = isKorean ? `
    사용자가 미국 주식에 대해 배울 수 있도록 매일 6개의 다양한 주식 시장 퀘스트를 생성하세요.
    "quests"라는 키를 가진 JSON 객체를 반환하며, 이 키는 6개의 객체 배열입니다.
    
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
    if (!content) return fallbackQuests(userId);

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
    return fallbackQuests(userId, language);
  }
}

export async function generatePracticeQuest(userId: string, language: string = 'en'): Promise<InsertQuest> {
  const isKorean = language === 'ko';
  const prompt = isKorean ? `
    주식 시장 학습을 위한 연습 퀴즈 1개를 생성하세요.
    "quest"라는 키를 가진 JSON 객체를 반환하세요.
    
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
    if (!content) return fallbackPracticeQuest(userId);

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
      isCompleted: false
    };
  } catch (err) {
    console.error("Error generating practice quest:", err);
    return fallbackPracticeQuest(userId, language);
  }
}

function fallbackPracticeQuest(userId: string, language: string = 'en'): InsertQuest {
  const isKorean = language === 'ko';
  
  const practiceQuestsEn = [
    {
      question: "What does 'blue chip' refer to in investing?",
      options: ["High-risk penny stocks", "Large, stable, well-established companies", "Technology startups", "Government bonds"],
      correctAnswer: 1,
      explanation: "Blue chip stocks are shares of large, well-established companies with a history of reliable performance."
    },
    {
      question: "What is a stock split?",
      options: ["Dividing company assets", "Increasing the number of shares while reducing price proportionally", "Selling half your shares", "A market crash"],
      correctAnswer: 1,
      explanation: "A stock split increases shares outstanding while proportionally reducing the price per share."
    },
    {
      question: "What does 'going long' mean?",
      options: ["Holding a stock for years", "Buying a stock expecting it to rise", "Selling a stock you don't own", "Investing in long-term bonds"],
      correctAnswer: 1,
      explanation: "Going long means buying a security with the expectation that its price will increase."
    }
  ];

  const practiceQuestsKo = [
    {
      question: "'블루칩'이란 투자에서 무엇을 의미하나요?",
      options: ["고위험 페니 주식", "크고 안정적이며 잘 확립된 기업", "기술 스타트업", "국채"],
      correctAnswer: 1,
      explanation: "블루칩 주식은 안정적인 성과 이력을 가진 대형 우량 기업의 주식입니다."
    },
    {
      question: "주식 분할이란 무엇인가요?",
      options: ["회사 자산 분할", "주식 수를 늘리면서 가격을 비례적으로 줄이는 것", "보유 주식의 절반을 파는 것", "시장 붕괴"],
      correctAnswer: 1,
      explanation: "주식 분할은 발행 주식 수를 늘리면서 주당 가격을 비례적으로 낮추는 것입니다."
    },
    {
      question: "'롱 포지션을 취하다'는 무슨 뜻인가요?",
      options: ["주식을 수년간 보유하는 것", "상승을 기대하며 주식을 매수하는 것", "소유하지 않은 주식을 파는 것", "장기 채권에 투자하는 것"],
      correctAnswer: 1,
      explanation: "롱 포지션을 취한다는 것은 가격 상승을 기대하며 증권을 매수하는 것을 의미합니다."
    }
  ];
  
  const practiceQuests = isKorean ? practiceQuestsKo : practiceQuestsEn;
  const random = practiceQuests[Math.floor(Math.random() * practiceQuests.length)];
  return {
    userId,
    type: "practice",
    question: random.question,
    options: random.options,
    correctAnswer: random.correctAnswer,
    explanation: random.explanation,
    xpReward: 5,
    isCompleted: false
  };
}

function fallbackQuests(userId: string, language: string = 'en'): InsertQuest[] {
  const isKorean = language === 'ko';
  
  if (isKorean) {
    return [
      {
        userId,
        type: "term",
        question: "ETF는 무엇의 약자인가요?",
        options: ["Exchange Traded Fund", "Equity Traded Finance", "Electronic Transfer Fund", "Early Trade Fee"],
        correctAnswer: 0,
        explanation: "ETF는 Exchange Traded Fund(상장지수펀드)의 약자로, 주식처럼 거래소에서 거래되는 증권 바구니입니다.",
        xpReward: 15,
        isCompleted: false
      },
      {
        userId,
        type: "pattern",
        question: "하락 추세에서 반전을 신호하는 패턴은 무엇인가요?",
        options: ["더블탑", "헤드앤숄더", "역 헤드앤숄더", "베어 플래그"],
        correctAnswer: 2,
        explanation: "역 헤드앤숄더 패턴은 상승 반전 패턴입니다.",
        xpReward: 15,
        isCompleted: false
      },
      {
        userId,
        type: "news",
        question: "'약세장(Bear Market)'이란 무엇인가요?",
        options: ["상승 추세의 시장", "하락 추세의 시장", "정체된 시장", "변동성이 높은 시장"],
        correctAnswer: 1,
        explanation: "약세장은 주가가 하락하는 시장으로, 일반적으로 20% 이상의 하락으로 정의됩니다.",
        xpReward: 15,
        isCompleted: false
      },
      {
        userId,
        type: "search",
        question: "Apple (AAPL)은 어떤 섹터에 속하나요?",
        options: ["헬스케어", "기술", "소비재", "금융"],
        correctAnswer: 1,
        explanation: "Apple Inc.는 기술 섹터로 분류됩니다.",
        xpReward: 20,
        isCompleted: false
      },
      {
        userId,
        type: "valuation",
        question: "P/E 비율이 15인 주식이 업계 평균 25와 비교할 때 어떻게 평가되나요?",
        options: ["고평가", "적정 평가", "저평가", "판단할 수 없음"],
        correctAnswer: 2,
        explanation: "업계 평균보다 낮은 P/E 비율은 일반적으로 주식이 저평가되어 있음을 나타냅니다.",
        xpReward: 20,
        isCompleted: false
      },
      {
        userId,
        type: "compare",
        question: "두 주식을 비교할 때 상대적 가치를 이해하는 데 도움이 되는 지표는 무엇인가요?",
        options: ["주가만", "P/E 비율", "회사 본사 위치", "로고 디자인"],
        correctAnswer: 1,
        explanation: "P/E 비율은 수익 대비 가격을 보여주므로 주식 간 밸류에이션을 비교하는 데 도움이 됩니다.",
        xpReward: 20,
        isCompleted: false
      }
    ];
  }
  
  return [
    {
      userId,
      type: "term",
      question: "What does ETF stand for?",
      options: ["Exchange Traded Fund", "Equity Traded Finance", "Electronic Transfer Fund", "Early Trade Fee"],
      correctAnswer: 0,
      explanation: "ETF stands for Exchange Traded Fund, which is a basket of securities that trades on an exchange like a stock.",
      xpReward: 15,
      isCompleted: false
    },
    {
      userId,
      type: "pattern",
      question: "Which pattern typically signals a reversal from a downtrend?",
      options: ["Double Top", "Head and Shoulders", "Inverse Head and Shoulders", "Bear Flag"],
      correctAnswer: 2,
      explanation: "An Inverse Head and Shoulders pattern is a bullish reversal pattern.",
      xpReward: 15,
      isCompleted: false
    },
    {
      userId,
      type: "news",
      question: "What is a 'Bear Market'?",
      options: ["A market trending up", "A market trending down", "A stagnant market", "A market with high volatility"],
      correctAnswer: 1,
      explanation: "A Bear Market is characterized by falling stock prices, typically defined as a drop of 20% or more.",
      xpReward: 15,
      isCompleted: false
    },
    {
      userId,
      type: "search",
      question: "What sector does Apple (AAPL) belong to?",
      options: ["Healthcare", "Technology", "Consumer Goods", "Finance"],
      correctAnswer: 1,
      explanation: "Apple Inc. is classified under the Technology sector.",
      xpReward: 20,
      isCompleted: false
    },
    {
      userId,
      type: "valuation",
      question: "A stock with a P/E ratio of 15 compared to an industry average of 25 is considered:",
      options: ["Overvalued", "Fairly valued", "Undervalued", "Cannot be determined"],
      correctAnswer: 2,
      explanation: "A lower P/E ratio compared to the industry average typically indicates the stock may be undervalued.",
      xpReward: 20,
      isCompleted: false
    },
    {
      userId,
      type: "compare",
      question: "When comparing two stocks, which metric helps you understand relative value?",
      options: ["Stock price alone", "P/E Ratio", "Company headquarters location", "Logo design"],
      correctAnswer: 1,
      explanation: "The P/E ratio helps compare valuations between stocks, as it shows the price relative to earnings.",
      xpReward: 20,
      isCompleted: false
    }
  ];
}
