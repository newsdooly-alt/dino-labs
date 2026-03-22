/**
 * stockDatabase.ts
 * Comprehensive global stock master database covering KOSPI, KOSDAQ, NASDAQ, NYSE, AMEX.
 * Powers multilingual (KR/JP/EN) partial-match search across all listed companies.
 */

export interface StockEntry {
  ticker: string;   // e.g. "005930.KS", "COHR", "7203.T"
  ko: string;       // Korean name (primary for KR users)
  en: string;       // English name
  exchange: string; // "KOSPI" | "KOSDAQ" | "NASDAQ" | "NYSE" | "AMEX" | "TSE"
  sector?: string;  // Optional sector
}

// ─── Helper: derive exchange badge from ticker ─────────────────────────────
export function getExchangeLabel(ticker: string): string {
  const t = ticker.toUpperCase();
  if (t.endsWith(".KS")) return "KOSPI";
  if (t.endsWith(".KQ")) return "KOSDAQ";
  if (t.endsWith(".T"))  return "TSE";
  if (t.endsWith(".DE") || t.endsWith(".PA") || t.endsWith(".AS") ||
      t.endsWith(".SW") || t.endsWith(".L")  || t.endsWith(".MI") ||
      t.endsWith(".MC") || t.endsWith(".CO") || t.endsWith(".OL")) return "EU";
  // US tickers: NASDAQ vs NYSE is hard to derive without external data — label by known lists
  const nyse = new Set(["BRK.B","JPM","V","MA","BAC","GS","MS","WFC","AXP","BLK","MCO","SPGI","CVX","XOM","OXY","KO","PEP","WMT","HD","MCD","NKE","DIS","BKNG","CMG","UNH","JNJ","ABBV","PFE","MRK","BMY","LLY","CAT","DE","MMM","HON","BA","RTX","LMT","GE","UPS","FDX","GM","F","T","VZ"]);
  if (nyse.has(t)) return "NYSE";
  return "NASDAQ";
}

// ─── Helper: clean ticker for display (strip .KS / .KQ / .T suffix) ───────
export function getDisplayTicker(ticker: string): string {
  return ticker.replace(/\.(KS|KQ|T|DE|PA|AS|SW|L|MI|MC|CO|OL)$/i, "");
}

// ─── Comprehensive Stock Database ─────────────────────────────────────────
export const STOCK_DATABASE: StockEntry[] = [

  // ══════════════════════════════════════════════════════════
  // KOSPI — Samsung Group (삼성그룹)
  // ══════════════════════════════════════════════════════════
  { ticker: "005930.KS", ko: "삼성전자",          en: "Samsung Electronics",           exchange: "KOSPI", sector: "반도체" },
  { ticker: "005935.KS", ko: "삼성전자우",         en: "Samsung Electronics (Pref)",    exchange: "KOSPI", sector: "반도체" },
  { ticker: "006400.KS", ko: "삼성SDI",           en: "Samsung SDI",                   exchange: "KOSPI", sector: "배터리" },
  { ticker: "009150.KS", ko: "삼성전기",           en: "Samsung Electro-Mechanics",     exchange: "KOSPI", sector: "전자부품" },
  { ticker: "018260.KS", ko: "삼성SDS",           en: "Samsung SDS",                   exchange: "KOSPI", sector: "IT서비스" },
  { ticker: "207940.KS", ko: "삼성바이오로직스",    en: "Samsung Biologics",             exchange: "KOSPI", sector: "바이오" },
  { ticker: "016360.KS", ko: "삼성증권",           en: "Samsung Securities",            exchange: "KOSPI", sector: "금융" },
  { ticker: "010140.KS", ko: "삼성중공업",          en: "Samsung Heavy Industries",      exchange: "KOSPI", sector: "조선" },
  { ticker: "028260.KS", ko: "삼성물산",           en: "Samsung C&T",                   exchange: "KOSPI", sector: "건설/무역" },
  { ticker: "028050.KS", ko: "삼성엔지니어링",      en: "Samsung Engineering",           exchange: "KOSPI", sector: "건설" },
  { ticker: "029780.KS", ko: "삼성카드",           en: "Samsung Card",                  exchange: "KOSPI", sector: "금융" },
  { ticker: "032830.KS", ko: "삼성생명",           en: "Samsung Life Insurance",        exchange: "KOSPI", sector: "보험" },
  { ticker: "000810.KS", ko: "삼성화재",           en: "Samsung Fire & Marine",         exchange: "KOSPI", sector: "보험" },

  // ══════════════════════════════════════════════════════════
  // KOSPI — Hyundai Group (현대그룹)
  // ══════════════════════════════════════════════════════════
  { ticker: "005380.KS", ko: "현대자동차",          en: "Hyundai Motor",                 exchange: "KOSPI", sector: "자동차" },
  { ticker: "000270.KS", ko: "기아",               en: "Kia",                           exchange: "KOSPI", sector: "자동차" },
  { ticker: "012330.KS", ko: "현대모비스",          en: "Hyundai Mobis",                 exchange: "KOSPI", sector: "자동차부품" },
  { ticker: "086280.KS", ko: "현대글로비스",         en: "Hyundai Glovis",                exchange: "KOSPI", sector: "물류" },
  { ticker: "000720.KS", ko: "현대건설",            en: "Hyundai Engineering & Construction", exchange: "KOSPI", sector: "건설" },
  { ticker: "004020.KS", ko: "현대제철",            en: "Hyundai Steel",                 exchange: "KOSPI", sector: "철강" },
  { ticker: "329180.KS", ko: "현대중공업",          en: "HD Hyundai Heavy Industries",   exchange: "KOSPI", sector: "조선" },
  { ticker: "267250.KS", ko: "HD현대",             en: "HD Hyundai",                    exchange: "KOSPI", sector: "지주사" },
  { ticker: "011210.KS", ko: "현대위아",            en: "Hyundai Wia",                   exchange: "KOSPI", sector: "자동차부품" },
  { ticker: "064350.KS", ko: "현대로템",            en: "Hyundai Rotem",                 exchange: "KOSPI", sector: "방산/철도" },
  { ticker: "307950.KS", ko: "현대오토에버",         en: "Hyundai AutoEver",              exchange: "KOSPI", sector: "IT서비스" },
  { ticker: "204320.KS", ko: "만도",               en: "Mando",                         exchange: "KOSPI", sector: "자동차부품" },
  { ticker: "018880.KS", ko: "한온시스템",          en: "Hanon Systems",                 exchange: "KOSPI", sector: "자동차부품" },

  // ══════════════════════════════════════════════════════════
  // KOSPI — LG Group (LG그룹)
  // ══════════════════════════════════════════════════════════
  { ticker: "003550.KS", ko: "LG",                en: "LG Corp",                       exchange: "KOSPI", sector: "지주사" },
  { ticker: "066570.KS", ko: "LG전자",            en: "LG Electronics",                exchange: "KOSPI", sector: "가전" },
  { ticker: "051910.KS", ko: "LG화학",            en: "LG Chem",                       exchange: "KOSPI", sector: "화학/배터리" },
  { ticker: "373220.KS", ko: "LG에너지솔루션",     en: "LG Energy Solution",            exchange: "KOSPI", sector: "배터리" },
  { ticker: "034220.KS", ko: "LG디스플레이",       en: "LG Display",                    exchange: "KOSPI", sector: "디스플레이" },
  { ticker: "011070.KS", ko: "LG이노텍",          en: "LG Innotek",                    exchange: "KOSPI", sector: "전자부품" },
  { ticker: "032640.KS", ko: "LG유플러스",         en: "LG Uplus",                      exchange: "KOSPI", sector: "통신" },
  { ticker: "051900.KS", ko: "LG생활건강",         en: "LG H&H",                        exchange: "KOSPI", sector: "소비재" },
  { ticker: "108670.KS", ko: "LG하우시스",         en: "LG Hausys",                     exchange: "KOSPI", sector: "건자재" },
  { ticker: "037560.KS", ko: "LG헬로비전",         en: "LG HelloVision",                exchange: "KOSPI", sector: "미디어" },

  // ══════════════════════════════════════════════════════════
  // KOSPI — SK Group (SK그룹)
  // ══════════════════════════════════════════════════════════
  { ticker: "034730.KS", ko: "SK",                en: "SK Holdings",                   exchange: "KOSPI", sector: "지주사" },
  { ticker: "000660.KS", ko: "SK하이닉스",         en: "SK Hynix",                      exchange: "KOSPI", sector: "반도체" },
  { ticker: "096770.KS", ko: "SK이노베이션",        en: "SK Innovation",                 exchange: "KOSPI", sector: "에너지/배터리" },
  { ticker: "017670.KS", ko: "SK텔레콤",           en: "SK Telecom",                    exchange: "KOSPI", sector: "통신" },
  { ticker: "011790.KS", ko: "SKC",               en: "SKC",                           exchange: "KOSPI", sector: "화학" },
  { ticker: "001740.KS", ko: "SK네트웍스",         en: "SK Networks",                   exchange: "KOSPI", sector: "유통" },
  { ticker: "018670.KS", ko: "SK가스",            en: "SK Gas",                        exchange: "KOSPI", sector: "에너지" },
  { ticker: "285130.KS", ko: "SK케미칼",           en: "SK Chemicals",                  exchange: "KOSPI", sector: "화학" },
  { ticker: "302440.KS", ko: "SK바이오사이언스",    en: "SK Bioscience",                 exchange: "KOSPI", sector: "바이오" },
  { ticker: "326030.KS", ko: "SK바이오팜",         en: "SK Biopharmaceuticals",         exchange: "KOSPI", sector: "제약" },
  { ticker: "402340.KS", ko: "SK스퀘어",          en: "SK Square",                     exchange: "KOSPI", sector: "IT지주" },
  { ticker: "009070.KS", ko: "SK디스커버리",       en: "SK Discovery",                  exchange: "KOSPI", sector: "지주사" },

  // ══════════════════════════════════════════════════════════
  // KOSPI — Lotte Group (롯데그룹)
  // ══════════════════════════════════════════════════════════
  { ticker: "004990.KS", ko: "롯데지주",           en: "Lotte Holdings",                exchange: "KOSPI", sector: "지주사" },
  { ticker: "011170.KS", ko: "롯데케미칼",          en: "Lotte Chemical",                exchange: "KOSPI", sector: "화학" },
  { ticker: "023530.KS", ko: "롯데쇼핑",           en: "Lotte Shopping",                exchange: "KOSPI", sector: "유통" },
  { ticker: "005300.KS", ko: "롯데칠성음료",        en: "Lotte Chilsung Beverage",       exchange: "KOSPI", sector: "음료" },
  { ticker: "004000.KS", ko: "롯데정밀화학",        en: "Lotte Fine Chemical",           exchange: "KOSPI", sector: "화학" },
  { ticker: "032350.KS", ko: "롯데관광개발",        en: "Lotte Tour Development",        exchange: "KOSPI", sector: "레저" },
  { ticker: "071840.KS", ko: "롯데하이마트",        en: "Lotte Hi-Mart",                 exchange: "KOSPI", sector: "유통" },
  { ticker: "286940.KS", ko: "롯데정보통신",        en: "Lotte Information & Communication", exchange: "KOSPI", sector: "IT서비스" },
  { ticker: "280360.KS", ko: "롯데웰푸드",          en: "Lotte Wellfood",                exchange: "KOSPI", sector: "식품" },

  // ══════════════════════════════════════════════════════════
  // KOSPI — CJ Group (CJ그룹)
  // ══════════════════════════════════════════════════════════
  { ticker: "001040.KS", ko: "CJ",                en: "CJ Corp",                       exchange: "KOSPI", sector: "지주사" },
  { ticker: "097950.KS", ko: "CJ제일제당",          en: "CJ CheilJedang",                exchange: "KOSPI", sector: "식품" },
  { ticker: "035760.KS", ko: "CJ ENM",            en: "CJ ENM",                        exchange: "KOSPI", sector: "미디어" },
  { ticker: "000120.KS", ko: "CJ대한통운",          en: "CJ Logistics",                  exchange: "KOSPI", sector: "물류" },
  { ticker: "051500.KS", ko: "CJ프레시웨이",        en: "CJ Freshway",                   exchange: "KOSPI", sector: "식품유통" },

  // ══════════════════════════════════════════════════════════
  // KOSPI — Hanwha Group (한화그룹)
  // ══════════════════════════════════════════════════════════
  { ticker: "000880.KS", ko: "한화",              en: "Hanwha Corp",                   exchange: "KOSPI", sector: "지주/방산" },
  { ticker: "012450.KS", ko: "한화에어로스페이스",   en: "Hanwha Aerospace",              exchange: "KOSPI", sector: "방산/항공" },
  { ticker: "000370.KS", ko: "한화손해보험",        en: "Hanwha General Insurance",      exchange: "KOSPI", sector: "보험" },
  { ticker: "088350.KS", ko: "한화생명",           en: "Hanwha Life Insurance",          exchange: "KOSPI", sector: "보험" },
  { ticker: "009830.KS", ko: "한화솔루션",          en: "Hanwha Solutions",              exchange: "KOSPI", sector: "화학/태양광" },
  { ticker: "272210.KS", ko: "한화시스템",          en: "Hanwha Systems",                exchange: "KOSPI", sector: "방산/IT" },

  // ══════════════════════════════════════════════════════════
  // KOSPI — Financial (금융)
  // ══════════════════════════════════════════════════════════
  { ticker: "105560.KS", ko: "KB금융",            en: "KB Financial Group",            exchange: "KOSPI", sector: "금융지주" },
  { ticker: "055550.KS", ko: "신한지주",           en: "Shinhan Financial Group",       exchange: "KOSPI", sector: "금융지주" },
  { ticker: "086790.KS", ko: "하나금융지주",        en: "Hana Financial Group",          exchange: "KOSPI", sector: "금융지주" },
  { ticker: "316140.KS", ko: "우리금융지주",        en: "Woori Financial Group",         exchange: "KOSPI", sector: "금융지주" },
  { ticker: "138040.KS", ko: "메리츠금융지주",      en: "Meritz Financial Group",        exchange: "KOSPI", sector: "금융지주" },
  { ticker: "005940.KS", ko: "NH투자증권",         en: "NH Investment & Securities",    exchange: "KOSPI", sector: "증권" },
  { ticker: "006800.KS", ko: "미래에셋증권",        en: "Mirae Asset Securities",        exchange: "KOSPI", sector: "증권" },
  { ticker: "039490.KS", ko: "키움증권",           en: "Kiwoom Securities",             exchange: "KOSPI", sector: "증권" },
  { ticker: "003540.KS", ko: "대신증권",           en: "Daishin Securities",            exchange: "KOSPI", sector: "증권" },
  { ticker: "071050.KS", ko: "한국금융지주",        en: "Korea Financial Group",         exchange: "KOSPI", sector: "금융지주" },
  { ticker: "082640.KS", ko: "동양생명",           en: "Tongyang Life Insurance",       exchange: "KOSPI", sector: "보험" },
  { ticker: "052690.KS", ko: "한전기술",           en: "Korea Power Engineering",       exchange: "KOSPI", sector: "에너지" },

  // ══════════════════════════════════════════════════════════
  // KOSPI — Telecom & Internet (통신/인터넷)
  // ══════════════════════════════════════════════════════════
  { ticker: "035420.KS", ko: "네이버",            en: "NAVER",                         exchange: "KOSPI", sector: "인터넷" },
  { ticker: "035720.KS", ko: "카카오",            en: "Kakao",                         exchange: "KOSPI", sector: "인터넷" },
  { ticker: "323410.KS", ko: "카카오뱅크",         en: "Kakao Bank",                    exchange: "KOSPI", sector: "인터넷은행" },
  { ticker: "030200.KS", ko: "KT",               en: "KT Corp",                       exchange: "KOSPI", sector: "통신" },

  // ══════════════════════════════════════════════════════════
  // KOSPI — Healthcare & Pharma (헬스케어/제약)
  // ══════════════════════════════════════════════════════════
  { ticker: "068270.KS", ko: "셀트리온",           en: "Celltrion",                     exchange: "KOSPI", sector: "바이오" },
  { ticker: "207940.KS", ko: "삼성바이오로직스",    en: "Samsung Biologics",             exchange: "KOSPI", sector: "바이오" },
  { ticker: "000100.KS", ko: "유한양행",           en: "Yuhan Corporation",             exchange: "KOSPI", sector: "제약" },
  { ticker: "006280.KS", ko: "녹십자",            en: "GC Pharma",                     exchange: "KOSPI", sector: "제약" },
  { ticker: "001630.KS", ko: "종근당",            en: "Chong Kun Dang",                exchange: "KOSPI", sector: "제약" },
  { ticker: "128940.KS", ko: "한미약품",           en: "Hanmi Pharmaceutical",          exchange: "KOSPI", sector: "제약" },
  { ticker: "069620.KS", ko: "대웅제약",           en: "Daewoong Pharmaceutical",       exchange: "KOSPI", sector: "제약" },
  { ticker: "003850.KS", ko: "보령",              en: "Boryung",                       exchange: "KOSPI", sector: "제약" },
  { ticker: "170900.KS", ko: "동아에스티",          en: "Dong-A ST",                     exchange: "KOSPI", sector: "제약" },
  { ticker: "185750.KS", ko: "종근당홀딩스",        en: "Chong Kun Dang Holdings",       exchange: "KOSPI", sector: "제약지주" },
  { ticker: "041960.KS", ko: "동아쏘시오홀딩스",    en: "Dong-A Socio Holdings",         exchange: "KOSPI", sector: "제약지주" },
  { ticker: "002630.KS", ko: "오리온홀딩스",        en: "Orion Holdings",                exchange: "KOSPI", sector: "식품지주" },
  { ticker: "271560.KS", ko: "오리온",            en: "Orion",                         exchange: "KOSPI", sector: "식품" },

  // ══════════════════════════════════════════════════════════
  // KOSPI — Energy & Utilities (에너지/유틸리티)
  // ══════════════════════════════════════════════════════════
  { ticker: "015760.KS", ko: "한국전력",           en: "Korea Electric Power",          exchange: "KOSPI", sector: "전력" },
  { ticker: "036460.KS", ko: "한국가스공사",        en: "Korea Gas Corporation",         exchange: "KOSPI", sector: "가스" },
  { ticker: "010950.KS", ko: "S-Oil",             en: "S-Oil",                         exchange: "KOSPI", sector: "정유" },
  { ticker: "078930.KS", ko: "GS",               en: "GS Holdings",                   exchange: "KOSPI", sector: "에너지지주" },
  { ticker: "007070.KS", ko: "GS리테일",           en: "GS Retail",                     exchange: "KOSPI", sector: "유통" },
  { ticker: "001230.KS", ko: "동국제강",           en: "Dongkuk Steel",                 exchange: "KOSPI", sector: "철강" },

  // ══════════════════════════════════════════════════════════
  // KOSPI — Steel & Shipbuilding (철강/조선)
  // ══════════════════════════════════════════════════════════
  { ticker: "005490.KS", ko: "POSCO홀딩스",        en: "POSCO Holdings",                exchange: "KOSPI", sector: "철강" },
  { ticker: "003670.KS", ko: "포스코퓨처엠",        en: "POSCO Future M",                exchange: "KOSPI", sector: "배터리소재" },
  { ticker: "004020.KS", ko: "현대제철",           en: "Hyundai Steel",                 exchange: "KOSPI", sector: "철강" },
  { ticker: "010140.KS", ko: "삼성중공업",          en: "Samsung Heavy Industries",      exchange: "KOSPI", sector: "조선" },
  { ticker: "000140.KS", ko: "하이트진로",          en: "Hite Jinro",                    exchange: "KOSPI", sector: "주류" },

  // ══════════════════════════════════════════════════════════
  // KOSPI — Defense & Aerospace (방산/항공)
  // ══════════════════════════════════════════════════════════
  { ticker: "047810.KS", ko: "한국항공우주",        en: "Korea Aerospace Industries",    exchange: "KOSPI", sector: "방산/항공" },
  { ticker: "079550.KS", ko: "LIG넥스원",          en: "LIG Nex1",                      exchange: "KOSPI", sector: "방산" },
  { ticker: "064350.KS", ko: "현대로템",           en: "Hyundai Rotem",                 exchange: "KOSPI", sector: "방산/철도" },

  // ══════════════════════════════════════════════════════════
  // KOSPI — Consumer & Retail (소비/유통)
  // ══════════════════════════════════════════════════════════
  { ticker: "139480.KS", ko: "이마트",            en: "E-Mart",                        exchange: "KOSPI", sector: "유통" },
  { ticker: "004170.KS", ko: "신세계",            en: "Shinsegae",                     exchange: "KOSPI", sector: "유통" },
  { ticker: "069960.KS", ko: "현대백화점",          en: "Hyundai Department Store",      exchange: "KOSPI", sector: "유통" },
  { ticker: "282330.KS", ko: "BGF리테일",          en: "BGF Retail",                    exchange: "KOSPI", sector: "편의점" },
  { ticker: "007310.KS", ko: "오뚜기",            en: "Ottogi",                        exchange: "KOSPI", sector: "식품" },
  { ticker: "004370.KS", ko: "농심",              en: "Nongshim",                      exchange: "KOSPI", sector: "식품" },
  { ticker: "000080.KS", ko: "하이트진로홀딩스",    en: "Hite Jinro Holdings",            exchange: "KOSPI", sector: "지주" },
  { ticker: "033780.KS", ko: "KT&G",             en: "KT&G",                          exchange: "KOSPI", sector: "담배/건강" },
  { ticker: "001800.KS", ko: "오리온",            en: "Orion",                         exchange: "KOSPI", sector: "식품" },
  { ticker: "000240.KS", ko: "한국타이어앤테크놀로지", en: "Hankook Tire & Technology", exchange: "KOSPI", sector: "타이어" },
  { ticker: "073240.KS", ko: "금호타이어",          en: "Kumho Tire",                    exchange: "KOSPI", sector: "타이어" },
  { ticker: "002350.KS", ko: "넥센타이어",          en: "Nexen Tire",                    exchange: "KOSPI", sector: "타이어" },

  // ══════════════════════════════════════════════════════════
  // KOSPI — Entertainment & Media (엔터/미디어)
  // ══════════════════════════════════════════════════════════
  { ticker: "352820.KS", ko: "하이브",            en: "HYBE",                          exchange: "KOSPI", sector: "엔터" },
  { ticker: "036570.KS", ko: "엔씨소프트",         en: "NCSoft",                        exchange: "KOSPI", sector: "게임" },
  { ticker: "259960.KS", ko: "크래프톤",           en: "Krafton",                       exchange: "KOSPI", sector: "게임" },
  { ticker: "251270.KS", ko: "넷마블",            en: "Netmarble",                     exchange: "KOSPI", sector: "게임" },
  { ticker: "293490.KS", ko: "카카오게임즈",        en: "Kakao Games",                   exchange: "KOSPI", sector: "게임" },

  // ══════════════════════════════════════════════════════════
  // KOSDAQ — Battery & Materials (배터리/소재)
  // ══════════════════════════════════════════════════════════
  { ticker: "247540.KQ", ko: "에코프로비엠",        en: "EcoPro BM",                     exchange: "KOSDAQ", sector: "배터리소재" },
  { ticker: "086520.KQ", ko: "에코프로",           en: "EcoPro",                        exchange: "KOSDAQ", sector: "배터리소재" },
  { ticker: "402920.KQ", ko: "에코프로에이치엔",    en: "EcoPro HN",                     exchange: "KOSDAQ", sector: "환경" },
  { ticker: "006655.KQ", ko: "포스코엠텍",          en: "POSCO M-Tech",                  exchange: "KOSDAQ", sector: "배터리소재" },
  { ticker: "357780.KQ", ko: "솔브레인",           en: "Soulbrain",                     exchange: "KOSDAQ", sector: "반도체소재" },
  { ticker: "277070.KQ", ko: "KPC",               en: "Korea Petrochemical",           exchange: "KOSDAQ", sector: "화학" },

  // ══════════════════════════════════════════════════════════
  // KOSDAQ — Biotech (바이오)
  // ══════════════════════════════════════════════════════════
  { ticker: "091990.KQ", ko: "셀트리온헬스케어",    en: "Celltrion Healthcare",          exchange: "KOSDAQ", sector: "바이오" },
  { ticker: "028300.KQ", ko: "HLB",              en: "HLB",                           exchange: "KOSDAQ", sector: "바이오" },
  { ticker: "237690.KQ", ko: "에스티팜",           en: "ST Pharm",                      exchange: "KOSDAQ", sector: "의약품" },
  { ticker: "086900.KQ", ko: "메디톡스",           en: "Medytox",                       exchange: "KOSDAQ", sector: "바이오/보톡스" },
  { ticker: "214150.KQ", ko: "클래시스",           en: "Classys",                       exchange: "KOSDAQ", sector: "의료기기" },
  { ticker: "048260.KQ", ko: "오스템임플란트",      en: "Osstem Implant",                exchange: "KOSDAQ", sector: "의료기기" },
  { ticker: "096530.KQ", ko: "씨젠",              en: "Seegene",                       exchange: "KOSDAQ", sector: "바이오진단" },
  { ticker: "064550.KQ", ko: "바이오니아",          en: "Bioneer",                       exchange: "KOSDAQ", sector: "바이오" },
  { ticker: "196170.KQ", ko: "알테오젠",           en: "Alteogen",                      exchange: "KOSDAQ", sector: "바이오" },
  { ticker: "145020.KQ", ko: "휴젤",              en: "Hugel",                         exchange: "KOSDAQ", sector: "바이오/보톡스" },
  { ticker: "039030.KQ", ko: "이오테크닉스",        en: "EO Technics",                   exchange: "KOSDAQ", sector: "레이저장비" },
  { ticker: "107640.KQ", ko: "코어라인소프트",      en: "Coreline Soft",                 exchange: "KOSDAQ", sector: "의료AI" },
  { ticker: "237690.KQ", ko: "에스티팜",           en: "ST Pharm",                      exchange: "KOSDAQ", sector: "의약품" },

  // ══════════════════════════════════════════════════════════
  // KOSDAQ — Semiconductor (반도체)
  // ══════════════════════════════════════════════════════════
  { ticker: "240810.KQ", ko: "원익IPS",           en: "Wonik IPS",                     exchange: "KOSDAQ", sector: "반도체장비" },
  { ticker: "089030.KQ", ko: "테크윙",            en: "Techwing",                      exchange: "KOSDAQ", sector: "반도체장비" },
  { ticker: "058470.KQ", ko: "리노공업",           en: "Lino Industrial",               exchange: "KOSDAQ", sector: "반도체부품" },
  { ticker: "319660.KQ", ko: "피에스케이",          en: "PSK",                           exchange: "KOSDAQ", sector: "반도체장비" },
  { ticker: "000990.KS", ko: "DB하이텍",           en: "DB Hitek",                      exchange: "KOSPI", sector: "반도체" },
  { ticker: "036830.KQ", ko: "솔브레인홀딩스",      en: "Soulbrain Holdings",            exchange: "KOSDAQ", sector: "지주" },
  { ticker: "178320.KQ", ko: "서진시스템",          en: "Seojin System",                 exchange: "KOSDAQ", sector: "전자부품" },

  // ══════════════════════════════════════════════════════════
  // KOSDAQ — IT & Software (IT/소프트웨어)
  // ══════════════════════════════════════════════════════════
  { ticker: "067160.KQ", ko: "아프리카TV",          en: "AfreecaTV",                     exchange: "KOSDAQ", sector: "미디어" },
  { ticker: "950170.KQ", ko: "JYP엔터테인먼트",     en: "JYP Entertainment",             exchange: "KOSDAQ", sector: "엔터" },
  { ticker: "041510.KQ", ko: "에스엠",             en: "SM Entertainment",              exchange: "KOSDAQ", sector: "엔터" },
  { ticker: "122870.KQ", ko: "YG엔터테인먼트",      en: "YG Entertainment",              exchange: "KOSDAQ", sector: "엔터" },
  { ticker: "263750.KQ", ko: "펄어비스",           en: "Pearl Abyss",                   exchange: "KOSDAQ", sector: "게임" },
  { ticker: "112040.KQ", ko: "위메이드",           en: "Wemade",                        exchange: "KOSDAQ", sector: "게임/블록체인" },
  { ticker: "078340.KQ", ko: "컴투스",            en: "Com2uS",                        exchange: "KOSDAQ", sector: "게임" },
  { ticker: "192080.KQ", ko: "더블유게임즈",        en: "DoubleU Games",                 exchange: "KOSDAQ", sector: "게임" },
  { ticker: "095660.KQ", ko: "네오위즈",           en: "Neowiz",                        exchange: "KOSDAQ", sector: "게임" },
  { ticker: "293490.KQ", ko: "카카오게임즈",        en: "Kakao Games",                   exchange: "KOSDAQ", sector: "게임" },
  { ticker: "054620.KQ", ko: "APS홀딩스",          en: "APS Holdings",                  exchange: "KOSDAQ", sector: "IT" },
  { ticker: "039560.KQ", ko: "다날",              en: "Danal",                         exchange: "KOSDAQ", sector: "핀테크" },

  // ══════════════════════════════════════════════════════════
  // US — Semiconductor & Hardware
  // ══════════════════════════════════════════════════════════
  { ticker: "NVDA",  ko: "엔비디아",              en: "NVIDIA",                        exchange: "NASDAQ", sector: "반도체" },
  { ticker: "INTC",  ko: "인텔",                 en: "Intel",                         exchange: "NASDAQ", sector: "반도체" },
  { ticker: "AMD",   ko: "AMD",                  en: "AMD",                           exchange: "NASDAQ", sector: "반도체" },
  { ticker: "QCOM",  ko: "퀄컴",                 en: "Qualcomm",                      exchange: "NASDAQ", sector: "반도체" },
  { ticker: "AVGO",  ko: "브로드컴",              en: "Broadcom",                      exchange: "NASDAQ", sector: "반도체" },
  { ticker: "TXN",   ko: "텍사스 인스트루먼트",   en: "Texas Instruments",             exchange: "NASDAQ", sector: "반도체" },
  { ticker: "MU",    ko: "마이크론",              en: "Micron Technology",             exchange: "NASDAQ", sector: "반도체" },
  { ticker: "AMAT",  ko: "어플라이드 머티리얼즈",  en: "Applied Materials",             exchange: "NASDAQ", sector: "반도체장비" },
  { ticker: "LRCX",  ko: "램 리서치",             en: "Lam Research",                  exchange: "NASDAQ", sector: "반도체장비" },
  { ticker: "KLAC",  ko: "KLA 코퍼레이션",        en: "KLA Corporation",               exchange: "NASDAQ", sector: "반도체장비" },
  { ticker: "COHR",  ko: "코히런트",              en: "Coherent Corp",                 exchange: "NYSE",   sector: "포토닉스" },
  { ticker: "SMCI",  ko: "슈퍼마이크로",           en: "Super Micro Computer",          exchange: "NASDAQ", sector: "서버" },
  { ticker: "MRVL",  ko: "마벨 테크놀로지",        en: "Marvell Technology",            exchange: "NASDAQ", sector: "반도체" },
  { ticker: "ON",    ko: "온 세미컨덕터",          en: "ON Semiconductor",              exchange: "NASDAQ", sector: "반도체" },
  { ticker: "SWKS",  ko: "스카이웍스",            en: "Skyworks Solutions",            exchange: "NASDAQ", sector: "반도체" },
  { ticker: "QRVO",  ko: "코르보",               en: "Qorvo",                         exchange: "NASDAQ", sector: "반도체" },
  { ticker: "WOLF",  ko: "울프스피드",            en: "Wolfspeed",                     exchange: "NYSE",   sector: "반도체" },
  { ticker: "ARM",   ko: "ARM 홀딩스",           en: "Arm Holdings",                  exchange: "NASDAQ", sector: "반도체설계" },
  { ticker: "ASML",  ko: "에이에스엠엘",           en: "ASML Holding",                  exchange: "NASDAQ", sector: "반도체장비" },
  { ticker: "DELL",  ko: "델 테크놀로지스",        en: "Dell Technologies",             exchange: "NYSE",   sector: "컴퓨터" },
  { ticker: "HPQ",   ko: "HP",                  en: "HP Inc.",                       exchange: "NYSE",   sector: "컴퓨터" },
  { ticker: "HPE",   ko: "HP 엔터프라이즈",        en: "Hewlett Packard Enterprise",    exchange: "NYSE",   sector: "IT인프라" },
  { ticker: "WDC",   ko: "웨스턴 디지털",          en: "Western Digital",               exchange: "NASDAQ", sector: "스토리지" },
  { ticker: "STX",   ko: "시게이트",              en: "Seagate Technology",            exchange: "NASDAQ", sector: "스토리지" },

  // ══════════════════════════════════════════════════════════
  // US — Big Tech (빅테크)
  // ══════════════════════════════════════════════════════════
  { ticker: "AAPL",  ko: "애플",                 en: "Apple",                         exchange: "NASDAQ", sector: "IT" },
  { ticker: "MSFT",  ko: "마이크로소프트",         en: "Microsoft",                     exchange: "NASDAQ", sector: "IT" },
  { ticker: "GOOGL", ko: "알파벳",               en: "Alphabet",                      exchange: "NASDAQ", sector: "IT" },
  { ticker: "GOOG",  ko: "알파벳",               en: "Alphabet (Class C)",            exchange: "NASDAQ", sector: "IT" },
  { ticker: "AMZN",  ko: "아마존",               en: "Amazon",                        exchange: "NASDAQ", sector: "IT/이커머스" },
  { ticker: "META",  ko: "메타",                 en: "Meta Platforms",                exchange: "NASDAQ", sector: "소셜미디어" },
  { ticker: "TSLA",  ko: "테슬라",               en: "Tesla",                         exchange: "NASDAQ", sector: "전기차" },
  { ticker: "NFLX",  ko: "넷플릭스",              en: "Netflix",                       exchange: "NASDAQ", sector: "스트리밍" },
  { ticker: "ORCL",  ko: "오라클",               en: "Oracle",                        exchange: "NYSE",   sector: "소프트웨어" },

  // ══════════════════════════════════════════════════════════
  // US — Software & Cloud (소프트웨어/클라우드)
  // ══════════════════════════════════════════════════════════
  { ticker: "CRM",   ko: "세일즈포스",            en: "Salesforce",                    exchange: "NYSE",   sector: "클라우드" },
  { ticker: "NOW",   ko: "서비스나우",             en: "ServiceNow",                    exchange: "NYSE",   sector: "클라우드" },
  { ticker: "ADBE",  ko: "어도비",               en: "Adobe",                         exchange: "NASDAQ", sector: "소프트웨어" },
  { ticker: "WDAY",  ko: "워크데이",              en: "Workday",                       exchange: "NASDAQ", sector: "HR소프트웨어" },
  { ticker: "SNOW",  ko: "스노우플레이크",          en: "Snowflake",                     exchange: "NYSE",   sector: "데이터클라우드" },
  { ticker: "PLTR",  ko: "팔란티어",              en: "Palantir Technologies",         exchange: "NASDAQ", sector: "AI/데이터" },
  { ticker: "NET",   ko: "클라우드플레어",          en: "Cloudflare",                    exchange: "NYSE",   sector: "사이버보안" },
  { ticker: "DDOG",  ko: "데이터독",              en: "Datadog",                       exchange: "NASDAQ", sector: "클라우드모니터링" },
  { ticker: "ZS",    ko: "지스케일러",             en: "Zscaler",                       exchange: "NASDAQ", sector: "사이버보안" },
  { ticker: "CRWD",  ko: "크라우드스트라이크",      en: "CrowdStrike",                   exchange: "NASDAQ", sector: "사이버보안" },
  { ticker: "PANW",  ko: "팰로앨토 네트웍스",      en: "Palo Alto Networks",            exchange: "NASDAQ", sector: "사이버보안" },
  { ticker: "FTNT",  ko: "포티넷",               en: "Fortinet",                      exchange: "NASDAQ", sector: "사이버보안" },
  { ticker: "OKTA",  ko: "옥타",                 en: "Okta",                          exchange: "NASDAQ", sector: "ID보안" },
  { ticker: "MDB",   ko: "몽고DB",               en: "MongoDB",                       exchange: "NASDAQ", sector: "데이터베이스" },
  { ticker: "TEAM",  ko: "아틀라시안",            en: "Atlassian",                     exchange: "NASDAQ", sector: "협업툴" },
  { ticker: "HUBS",  ko: "허브스팟",              en: "HubSpot",                       exchange: "NYSE",   sector: "마케팅SW" },
  { ticker: "PATH",  ko: "유아이패스",             en: "UiPath",                        exchange: "NYSE",   sector: "RPA자동화" },
  { ticker: "GTLB",  ko: "깃랩",                 en: "GitLab",                        exchange: "NASDAQ", sector: "개발도구" },
  { ticker: "APP",   ko: "앱러빈",               en: "AppLovin",                      exchange: "NASDAQ", sector: "모바일광고" },
  { ticker: "TTD",   ko: "더 트레이드 데스크",     en: "The Trade Desk",                exchange: "NASDAQ", sector: "광고플랫폼" },
  { ticker: "AI",    ko: "C3.ai",               en: "C3.ai",                         exchange: "NYSE",   sector: "기업AI" },
  { ticker: "SOUN",  ko: "사운드하운드",           en: "SoundHound AI",                 exchange: "NASDAQ", sector: "음성AI" },
  { ticker: "BBAI",  ko: "빅베어 AI",            en: "BigBear.ai",                    exchange: "NYSE",   sector: "AI분석" },
  { ticker: "MSTR",  ko: "마이크로스트래티지",      en: "MicroStrategy",                 exchange: "NASDAQ", sector: "비트코인/BI" },

  // ══════════════════════════════════════════════════════════
  // US — Financials (금융)
  // ══════════════════════════════════════════════════════════
  { ticker: "JPM",   ko: "JP모건",               en: "JPMorgan Chase",                exchange: "NYSE",   sector: "금융" },
  { ticker: "BAC",   ko: "뱅크오브아메리카",       en: "Bank of America",               exchange: "NYSE",   sector: "금융" },
  { ticker: "GS",    ko: "골드만삭스",            en: "Goldman Sachs",                 exchange: "NYSE",   sector: "투자은행" },
  { ticker: "MS",    ko: "모건스탠리",            en: "Morgan Stanley",                exchange: "NYSE",   sector: "투자은행" },
  { ticker: "WFC",   ko: "웰스파고",              en: "Wells Fargo",                   exchange: "NYSE",   sector: "금융" },
  { ticker: "BLK",   ko: "블랙록",               en: "BlackRock",                     exchange: "NYSE",   sector: "자산운용" },
  { ticker: "V",     ko: "비자",                 en: "Visa",                          exchange: "NYSE",   sector: "결제" },
  { ticker: "MA",    ko: "마스터카드",            en: "Mastercard",                    exchange: "NYSE",   sector: "결제" },
  { ticker: "AXP",   ko: "아메리칸 익스프레스",    en: "American Express",              exchange: "NYSE",   sector: "결제" },
  { ticker: "PYPL",  ko: "페이팔",               en: "PayPal",                        exchange: "NASDAQ", sector: "핀테크" },
  { ticker: "COIN",  ko: "코인베이스",            en: "Coinbase",                      exchange: "NASDAQ", sector: "암호화폐" },
  { ticker: "HOOD",  ko: "로빈후드",              en: "Robinhood Markets",             exchange: "NASDAQ", sector: "핀테크" },
  { ticker: "SOFI",  ko: "소파이",               en: "SoFi Technologies",             exchange: "NASDAQ", sector: "핀테크" },
  { ticker: "SCHW",  ko: "찰스 슈왑",            en: "Charles Schwab",                exchange: "NYSE",   sector: "증권" },
  { ticker: "MCO",   ko: "무디스",               en: "Moody's Corporation",           exchange: "NYSE",   sector: "신용평가" },
  { ticker: "SPGI",  ko: "S&P 글로벌",           en: "S&P Global",                    exchange: "NYSE",   sector: "금융데이터" },
  { ticker: "AFRM",  ko: "어펌",                 en: "Affirm Holdings",               exchange: "NASDAQ", sector: "핀테크" },
  { ticker: "UPST",  ko: "업스타트",              en: "Upstart Holdings",              exchange: "NASDAQ", sector: "AI대출" },

  // ══════════════════════════════════════════════════════════
  // US — Healthcare & Biotech (헬스케어/바이오)
  // ══════════════════════════════════════════════════════════
  { ticker: "LLY",   ko: "일라이 릴리",           en: "Eli Lilly",                     exchange: "NYSE",   sector: "제약" },
  { ticker: "JNJ",   ko: "존슨앤드존슨",          en: "Johnson & Johnson",             exchange: "NYSE",   sector: "제약" },
  { ticker: "ABBV",  ko: "애브비",               en: "AbbVie",                        exchange: "NYSE",   sector: "제약" },
  { ticker: "PFE",   ko: "화이자",               en: "Pfizer",                        exchange: "NYSE",   sector: "제약" },
  { ticker: "MRK",   ko: "머크",                 en: "Merck",                         exchange: "NYSE",   sector: "제약" },
  { ticker: "MRNA",  ko: "모더나",               en: "Moderna",                       exchange: "NASDAQ", sector: "바이오" },
  { ticker: "GILD",  ko: "길리어드 사이언스",      en: "Gilead Sciences",               exchange: "NASDAQ", sector: "바이오" },
  { ticker: "REGN",  ko: "리제네론",              en: "Regeneron Pharmaceuticals",     exchange: "NASDAQ", sector: "바이오" },
  { ticker: "VRTX",  ko: "버텍스 제약",           en: "Vertex Pharmaceuticals",        exchange: "NASDAQ", sector: "바이오" },
  { ticker: "ISRG",  ko: "인튜이티브 서지컬",     en: "Intuitive Surgical",            exchange: "NASDAQ", sector: "의료기기" },
  { ticker: "UNH",   ko: "유나이티드헬스",         en: "UnitedHealth Group",            exchange: "NYSE",   sector: "의료보험" },
  { ticker: "ILMN",  ko: "일루미나",              en: "Illumina",                      exchange: "NASDAQ", sector: "유전체분석" },
  { ticker: "CRSP",  ko: "CRISPR 테라퓨틱스",     en: "CRISPR Therapeutics",           exchange: "NASDAQ", sector: "유전자편집" },
  { ticker: "BMY",   ko: "브리스톨-마이어스 스큅", en: "Bristol-Myers Squibb",          exchange: "NYSE",   sector: "제약" },

  // ══════════════════════════════════════════════════════════
  // US — Consumer & Retail (소비/유통)
  // ══════════════════════════════════════════════════════════
  { ticker: "AMZN",  ko: "아마존",               en: "Amazon",                        exchange: "NASDAQ", sector: "이커머스" },
  { ticker: "WMT",   ko: "월마트",               en: "Walmart",                       exchange: "NYSE",   sector: "유통" },
  { ticker: "COST",  ko: "코스트코",              en: "Costco Wholesale",              exchange: "NASDAQ", sector: "유통" },
  { ticker: "HD",    ko: "홈디포",               en: "The Home Depot",                exchange: "NYSE",   sector: "유통" },
  { ticker: "TGT",   ko: "타겟",                 en: "Target Corporation",            exchange: "NYSE",   sector: "유통" },
  { ticker: "NKE",   ko: "나이키",               en: "Nike",                          exchange: "NYSE",   sector: "스포츠" },
  { ticker: "LULU",  ko: "룰루레몬",              en: "Lululemon Athletica",           exchange: "NASDAQ", sector: "스포츠" },
  { ticker: "MCD",   ko: "맥도날드",              en: "McDonald's",                    exchange: "NYSE",   sector: "식음료" },
  { ticker: "SBUX",  ko: "스타벅스",              en: "Starbucks",                     exchange: "NASDAQ", sector: "식음료" },
  { ticker: "CMG",   ko: "치폴레",               en: "Chipotle Mexican Grill",        exchange: "NYSE",   sector: "식음료" },
  { ticker: "KO",    ko: "코카콜라",              en: "Coca-Cola",                     exchange: "NYSE",   sector: "음료" },
  { ticker: "PEP",   ko: "펩시코",               en: "PepsiCo",                       exchange: "NASDAQ", sector: "음료/식품" },
  { ticker: "BKNG",  ko: "부킹홀딩스",            en: "Booking Holdings",              exchange: "NASDAQ", sector: "여행" },
  { ticker: "ABNB",  ko: "에어비앤비",             en: "Airbnb",                        exchange: "NASDAQ", sector: "여행" },
  { ticker: "PTON",  ko: "펠로톤",               en: "Peloton Interactive",           exchange: "NASDAQ", sector: "피트니스" },

  // ══════════════════════════════════════════════════════════
  // US — EV & Clean Energy (전기차/친환경)
  // ══════════════════════════════════════════════════════════
  { ticker: "TSLA",  ko: "테슬라",               en: "Tesla",                         exchange: "NASDAQ", sector: "전기차" },
  { ticker: "RIVN",  ko: "리비안",               en: "Rivian Automotive",             exchange: "NASDAQ", sector: "전기차" },
  { ticker: "LCID",  ko: "루시드 모터스",          en: "Lucid Group",                   exchange: "NASDAQ", sector: "전기차" },
  { ticker: "GM",    ko: "제너럴 모터스",          en: "General Motors",                exchange: "NYSE",   sector: "자동차" },
  { ticker: "F",     ko: "포드",                 en: "Ford Motor",                    exchange: "NYSE",   sector: "자동차" },
  { ticker: "PLUG",  ko: "플러그파워",             en: "Plug Power",                    exchange: "NASDAQ", sector: "수소에너지" },
  { ticker: "ENPH",  ko: "엔페이즈 에너지",        en: "Enphase Energy",                exchange: "NASDAQ", sector: "태양광" },
  { ticker: "FSLR",  ko: "퍼스트 솔라",           en: "First Solar",                   exchange: "NASDAQ", sector: "태양광" },

  // ══════════════════════════════════════════════════════════
  // US — Industrial & Defense (산업재/방산)
  // ══════════════════════════════════════════════════════════
  { ticker: "BA",    ko: "보잉",                 en: "Boeing",                        exchange: "NYSE",   sector: "항공방산" },
  { ticker: "RTX",   ko: "레이시온",              en: "RTX Corporation",               exchange: "NYSE",   sector: "방산" },
  { ticker: "LMT",   ko: "록히드 마틴",           en: "Lockheed Martin",               exchange: "NYSE",   sector: "방산" },
  { ticker: "GE",    ko: "GE 에어로스페이스",      en: "GE Aerospace",                  exchange: "NYSE",   sector: "항공" },
  { ticker: "CAT",   ko: "캐터필러",              en: "Caterpillar",                   exchange: "NYSE",   sector: "기계" },
  { ticker: "DE",    ko: "존 디어",               en: "John Deere",                    exchange: "NYSE",   sector: "농기계" },
  { ticker: "MMM",   ko: "3M",                  en: "3M Company",                    exchange: "NYSE",   sector: "산업재" },
  { ticker: "HON",   ko: "허니웰",               en: "Honeywell International",       exchange: "NASDAQ", sector: "산업자동화" },
  { ticker: "UPS",   ko: "UPS",                 en: "United Parcel Service",         exchange: "NYSE",   sector: "물류" },
  { ticker: "FDX",   ko: "페덱스",               en: "FedEx Corporation",             exchange: "NYSE",   sector: "물류" },

  // ══════════════════════════════════════════════════════════
  // US — Media & Entertainment (미디어/엔터)
  // ══════════════════════════════════════════════════════════
  { ticker: "DIS",   ko: "월트 디즈니",           en: "The Walt Disney Company",       exchange: "NYSE",   sector: "미디어" },
  { ticker: "NFLX",  ko: "넷플릭스",              en: "Netflix",                       exchange: "NASDAQ", sector: "스트리밍" },
  { ticker: "SPOT",  ko: "스포티파이",             en: "Spotify Technology",            exchange: "NYSE",   sector: "음악스트리밍" },
  { ticker: "RBLX",  ko: "로블록스",              en: "Roblox Corporation",            exchange: "NYSE",   sector: "게임메타버스" },
  { ticker: "EA",    ko: "일렉트로닉 아츠",        en: "Electronic Arts",               exchange: "NASDAQ", sector: "게임" },
  { ticker: "TTWO",  ko: "테이크투 인터랙티브",    en: "Take-Two Interactive",          exchange: "NASDAQ", sector: "게임" },
  { ticker: "PARA",  ko: "파라마운트",            en: "Paramount Global",              exchange: "NASDAQ", sector: "미디어" },
  { ticker: "WBD",   ko: "워너 브라더스 디스커버리", en: "Warner Bros. Discovery",      exchange: "NASDAQ", sector: "미디어" },

  // ══════════════════════════════════════════════════════════
  // US — E-commerce & Platform (이커머스/플랫폼)
  // ══════════════════════════════════════════════════════════
  { ticker: "SHOP",  ko: "쇼피파이",              en: "Shopify",                       exchange: "NYSE",   sector: "이커머스" },
  { ticker: "UBER",  ko: "우버",                 en: "Uber Technologies",             exchange: "NYSE",   sector: "모빌리티" },
  { ticker: "LYFT",  ko: "리프트",               en: "Lyft",                          exchange: "NASDAQ", sector: "모빌리티" },
  { ticker: "ABNB",  ko: "에어비앤비",             en: "Airbnb",                        exchange: "NASDAQ", sector: "숙박플랫폼" },
  { ticker: "MELI",  ko: "메르카도리브레",          en: "MercadoLibre",                  exchange: "NASDAQ", sector: "라틴아메리카이커머스" },
  { ticker: "PINS",  ko: "핀터레스트",             en: "Pinterest",                     exchange: "NYSE",   sector: "소셜미디어" },
  { ticker: "SNAP",  ko: "스냅",                 en: "Snap Inc.",                     exchange: "NYSE",   sector: "소셜미디어" },
  { ticker: "ROKU",  ko: "로쿠",                 en: "Roku",                          exchange: "NASDAQ", sector: "스트리밍플랫폼" },

  // ══════════════════════════════════════════════════════════
  // Chinese ADR (중국ADR)
  // ══════════════════════════════════════════════════════════
  { ticker: "BABA",  ko: "알리바바",              en: "Alibaba Group",                 exchange: "NYSE",   sector: "이커머스" },
  { ticker: "BIDU",  ko: "바이두",               en: "Baidu",                         exchange: "NASDAQ", sector: "인터넷검색" },
  { ticker: "PDD",   ko: "PDD홀딩스",             en: "PDD Holdings (Temu)",           exchange: "NASDAQ", sector: "이커머스" },
  { ticker: "JD",    ko: "JD닷컴",               en: "JD.com",                        exchange: "NASDAQ", sector: "이커머스" },
  { ticker: "NIO",   ko: "니오",                 en: "NIO",                           exchange: "NYSE",   sector: "전기차" },
  { ticker: "XPEV",  ko: "샤오펑",               en: "XPeng",                         exchange: "NYSE",   sector: "전기차" },
  { ticker: "LI",    ko: "리오토",               en: "Li Auto",                       exchange: "NASDAQ", sector: "전기차" },
  { ticker: "BILI",  ko: "빌리빌리",              en: "Bilibili",                      exchange: "NASDAQ", sector: "동영상플랫폼" },

  // ══════════════════════════════════════════════════════════
  // EU Stocks (유럽주식)
  // ══════════════════════════════════════════════════════════
  { ticker: "NVO",   ko: "노보 노디스크",          en: "Novo Nordisk",                  exchange: "NYSE",   sector: "제약" },
  { ticker: "AZN",   ko: "아스트라제네카",          en: "AstraZeneca",                   exchange: "NASDAQ", sector: "제약" },
  { ticker: "ASML",  ko: "에이에스엠엘",            en: "ASML Holding",                  exchange: "NASDAQ", sector: "반도체장비" },
  { ticker: "SAP",   ko: "SAP",                  en: "SAP SE",                        exchange: "NYSE",   sector: "기업소프트웨어" },
  { ticker: "SIEGY", ko: "지멘스",               en: "Siemens AG",                    exchange: "NASDAQ", sector: "산업자동화" },
  { ticker: "LVMHF", ko: "LVMH",                en: "LVMH",                          exchange: "NASDAQ", sector: "명품" },
  { ticker: "NSRGY", ko: "네슬레",               en: "Nestlé",                        exchange: "NYSE",   sector: "식품" },
  { ticker: "RHHBY", ko: "로슈",                 en: "Roche Holding",                 exchange: "NASDAQ", sector: "제약/진단" },
  { ticker: "NVS",   ko: "노바티스",              en: "Novartis",                      exchange: "NYSE",   sector: "제약" },
  { ticker: "SHEL",  ko: "쉘",                   en: "Shell PLC",                     exchange: "NYSE",   sector: "에너지" },
  { ticker: "EADSY", ko: "에어버스",              en: "Airbus SE",                     exchange: "NASDAQ", sector: "항공" },
  { ticker: "RACE",  ko: "페라리",               en: "Ferrari N.V.",                  exchange: "NYSE",   sector: "자동차" },
  { ticker: "ADDYY", ko: "아디다스",              en: "Adidas AG",                     exchange: "NASDAQ", sector: "스포츠" },
  { ticker: "LRLCY", ko: "로레알",               en: "L'Oréal",                       exchange: "NASDAQ", sector: "뷰티" },
  { ticker: "HSBC",  ko: "HSBC",                en: "HSBC Holdings",                 exchange: "NYSE",   sector: "금융" },

  // ══════════════════════════════════════════════════════════
  // Japan (일본주식)
  // ══════════════════════════════════════════════════════════
  { ticker: "TM",    ko: "도요타",               en: "Toyota Motor",                  exchange: "NYSE",   sector: "자동차" },
  { ticker: "7203.T",ko: "도요타 자동차",          en: "Toyota Motor Corp (JP)",        exchange: "TSE",    sector: "자동차" },
  { ticker: "SONY",  ko: "소니",                 en: "Sony Group",                    exchange: "NYSE",   sector: "전자/엔터" },
  { ticker: "6758.T",ko: "소니그룹",              en: "Sony Group Corp (JP)",          exchange: "TSE",    sector: "전자" },
  { ticker: "HMC",   ko: "혼다",                 en: "Honda Motor",                   exchange: "NYSE",   sector: "자동차" },
  { ticker: "NTDOY", ko: "닌텐도",               en: "Nintendo",                      exchange: "NASDAQ", sector: "게임" },
  { ticker: "7974.T",ko: "닌텐도",               en: "Nintendo Co. (JP)",             exchange: "TSE",    sector: "게임" },
  { ticker: "SFTBY", ko: "소프트뱅크",            en: "SoftBank Group",                exchange: "NASDAQ", sector: "IT지주" },
  { ticker: "9984.T",ko: "소프트뱅크 그룹",        en: "SoftBank Group Corp (JP)",      exchange: "TSE",    sector: "IT지주" },
  { ticker: "MUFG",  ko: "미쓰비시 UFJ",          en: "Mitsubishi UFJ Financial",      exchange: "NYSE",   sector: "금융" },
  { ticker: "TAK",   ko: "다케다 제약",            en: "Takeda Pharmaceutical",         exchange: "NYSE",   sector: "제약" },
  { ticker: "FRCOY", ko: "유니클로",              en: "Fast Retailing",                exchange: "NASDAQ", sector: "패션" },
  { ticker: "9983.T",ko: "패스트리테일링 (유니클로)", en: "Fast Retailing Co. (JP)",    exchange: "TSE",    sector: "패션" },
  { ticker: "6861.T",ko: "키엔스",               en: "Keyence Corp (JP)",             exchange: "TSE",    sector: "센서/자동화" },
  { ticker: "6954.T",ko: "파낙",                 en: "FANUC Corp (JP)",               exchange: "TSE",    sector: "로봇" },
  { ticker: "4568.T",ko: "다이이치 산쿄",          en: "Daiichi Sankyo (JP)",           exchange: "TSE",    sector: "제약" },
];

// ─── Smart Partial-Match Search ──────────────────────────────────────────────
export function searchStockDatabase(query: string, maxResults = 20): StockEntry[] {
  const q = query.replace(/\s+/g, "").toLowerCase();
  if (q.length < 1) return [];

  const exact:   StockEntry[] = [];
  const starts:  StockEntry[] = [];
  const partial: StockEntry[] = [];
  const seen = new Set<string>();

  for (const stock of STOCK_DATABASE) {
    const ticker  = stock.ticker.replace(/\.(KS|KQ|T)$/i, "").toLowerCase();
    const koNorm  = stock.ko.replace(/\s+/g, "").toLowerCase();
    const enNorm  = stock.en.replace(/\s+/g, "").toLowerCase();
    const key     = stock.ticker;

    if (seen.has(key)) continue;

    const isExact    = ticker === q || koNorm === q || enNorm === q;
    const isStarts   = ticker.startsWith(q) || koNorm.startsWith(q) || enNorm.startsWith(q);
    const isPartial  = ticker.includes(q) || koNorm.includes(q) || enNorm.includes(q);

    if (isExact)        { exact.push(stock);   seen.add(key); }
    else if (isStarts)  { starts.push(stock);  seen.add(key); }
    else if (isPartial) { partial.push(stock); seen.add(key); }
  }

  return [...exact, ...starts, ...partial].slice(0, maxResults);
}
