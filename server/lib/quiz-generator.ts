import OpenAI from "openai";
import { type InsertQuest } from "@shared/schema";

// We use the integration env vars
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function generateDailyQuests(userId: number, language: string = 'en'): Promise<InsertQuest[]> {
  const isKorean = language === 'ko';
  const prompt = isKorean ? `
    사용자가 미국 주식에 대해 배울 수 있도록 매일 3개의 주식 시장 퀘스트를 생성하세요.
    "quests"라는 키를 가진 JSON 객체를 반환하며, 이 키는 3개의 객체 배열입니다.
    
    퀘스트 유형:
    1. "term": 금융 용어(예: "P/E Ratio", "Dividend")에 대한 퀴즈.
    2. "pattern": 차트 패턴(예: "Bull Flag", "Head and Shoulders")에 대한 설명과 이를 식별하도록 요청.
    3. "news": 일반적인 시장 뉴스 시나리오 퀴즈(예: "연준이 금리를 올리면 일반적으로 채권 가격은 어떻게 됩니까?").

    각 퀘스트 객체는 다음을 포함해야 합니다:
    - type: "term" | "pattern" | "news"
    - question: string (한국어)
    - options: string[] (4개의 옵션, 한국어)
    - correctAnswer: number (0-3 인덱스)
    - explanation: string (정답에 대한 짧은 설명, 한국어)
    - xpReward: number (기본 10-20)
  ` : `
    Generate 3 daily stock market quests for a user learning about US stocks.
    Return a JSON object with a key "quests" which is an array of 3 objects.
    
    Quest types:
    1. "term": A quiz about a financial term (e.g., "P/E Ratio", "Dividend").
    2. "pattern": A description of a chart pattern (e.g., "Bull Flag", "Head and Shoulders") and ask to identify it.
    3. "news": A generic market news scenario quiz (e.g., "If the Fed raises rates, what typically happens to bond prices?").

    Each quest object must have:
    - type: "term" | "pattern" | "news"
    - question: string
    - options: string[] (4 options)
    - correctAnswer: number (0-3 index)
    - explanation: string (short explanation of the answer)
    - xpReward: number (default 10-20)
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
    return fallbackQuests(userId);
  }
}

function fallbackQuests(userId: number): InsertQuest[] {
  return [
    {
      userId,
      type: "term",
      question: "What does ETF stand for?",
      options: ["Exchange Traded Fund", "Equity Traded Finance", "Electronic Transfer Fund", "Early Trade Fee"],
      correctAnswer: 0,
      explanation: "ETF stands for Exchange Traded Fund, which is a basket of securities that trades on an exchange like a stock.",
      xpReward: 10,
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
      xpReward: 10,
      isCompleted: false
    }
  ];
}
