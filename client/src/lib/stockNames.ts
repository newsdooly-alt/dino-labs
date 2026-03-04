/**
 * stockNames.ts
 * Shared library for stock name localization and Korean-language search aliases.
 * Used by GlobalSearch, SuperInvestors, RRGChart, and Dashboard.
 */

// ─── English → Korean Company Name Map ───────────────────────────────────────
export const KO_COMPANY_NAMES: Record<string, string> = {
  // ── US Big Tech ──
  "Apple Inc.": "애플",
  "Apple": "애플",
  "Microsoft Corp.": "마이크로소프트",
  "Microsoft Corp": "마이크로소프트",
  "Microsoft Corporation": "마이크로소프트",
  "Alphabet Inc.": "알파벳",
  "Alphabet Inc": "알파벳",
  "Alphabet": "알파벳",
  "Amazon.com": "아마존",
  "Amazon.com Inc.": "아마존",
  "Amazon": "아마존",
  "NVIDIA Corporation": "엔비디아",
  "NVIDIA Corp.": "엔비디아",
  "Nvidia": "엔비디아",
  "NVIDIA": "엔비디아",
  "Meta Platforms": "메타",
  "Meta Platforms Inc.": "메타",
  "Meta": "메타",
  "Tesla Inc.": "테슬라",
  "Tesla": "테슬라",
  "Berkshire Hathaway": "버크셔 해서웨이",
  "Berkshire Hathaway Inc.": "버크셔 해서웨이",

  // ── US Financials ──
  "JPMorgan Chase": "JP모건 체이스",
  "JPMorgan Chase & Co.": "JP모건 체이스",
  "Visa Inc.": "비자",
  "Visa": "비자",
  "Mastercard": "마스터카드",
  "Mastercard Inc.": "마스터카드",
  "Bank of America": "뱅크오브아메리카",
  "Bank of America Corp.": "뱅크오브아메리카",
  "Wells Fargo": "웰스파고",
  "Goldman Sachs": "골드만삭스",
  "Goldman Sachs Group": "골드만삭스",
  "Morgan Stanley": "모건스탠리",
  "American Express": "아메리칸 익스프레스",
  "Moody's Corp": "무디스",
  "Moody's Corporation": "무디스",
  "S&P Global": "S&P 글로벌",
  "Charles Schwab": "찰스 슈왑",
  "BlackRock": "블랙록",
  "Vanguard Group": "뱅가드",
  "State Street SSGA": "스테이트 스트리트",
  "Fidelity Investments": "피델리티",
  "T. Rowe Price": "T. 로우 프라이스",

  // ── US Energy ──
  "Chevron Corp": "셰브론",
  "Chevron Corporation": "셰브론",
  "Exxon Mobil": "엑슨모빌",
  "ExxonMobil": "엑슨모빌",
  "ConocoPhillips": "코노코필립스",
  "Occidental Petroleum": "옥시덴탈 페트롤리엄",
  "Schlumberger": "슐럼버거",

  // ── US Healthcare ──
  "Johnson & Johnson": "존슨앤드존슨",
  "Procter & Gamble": "프록터앤드갬블",
  "Eli Lilly & Co.": "일라이 릴리",
  "Eli Lilly & Co": "일라이 릴리",
  "Eli Lilly": "일라이 릴리",
  "AbbVie": "애브비",
  "AbbVie Inc.": "애브비",
  "Pfizer Inc.": "화이자",
  "Pfizer": "화이자",
  "Bristol-Myers Squibb": "브리스톨-마이어스 스큅",
  "Merck": "머크",
  "Merck & Co.": "머크",
  "Abbott Laboratories": "애보트",
  "Thermo Fisher Scientific": "써모피셔 사이언티픽",
  "Danaher": "다나허",
  "Intuitive Surgical": "인튜이티브 서지컬",
  "Biogen": "바이오젠",
  "Moderna": "모더나",
  "UnitedHealth Group": "유나이티드헬스 그룹",
  "CVS Health": "CVS 헬스",
  "Cigna": "시그나",
  "Humana": "휴마나",
  "HCA Healthcare": "HCA 헬스케어",
  "Davita Inc.": "다비타",
  "DaVita Inc.": "다비타",
  "CRISPR Therapeutics": "CRISPR 테라퓨틱스",
  "Natera Inc.": "나테라",

  // ── US Consumer ──
  "Coca-Cola": "코카콜라",
  "The Coca-Cola Company": "코카콜라",
  "PepsiCo": "펩시코",
  "PepsiCo Inc.": "펩시코",
  "Walmart Inc.": "월마트",
  "Walmart": "월마트",
  "Costco": "코스트코",
  "Costco Wholesale": "코스트코",
  "Home Depot": "홈디포",
  "The Home Depot": "홈디포",
  "McDonald's": "맥도날드",
  "Starbucks": "스타벅스",
  "Nike Inc.": "나이키",
  "Nike": "나이키",
  "Walt Disney": "월트 디즈니",
  "Walt Disney Co.": "월트 디즈니",
  "Netflix Inc.": "넷플릭스",
  "Netflix": "넷플릭스",
  "Kraft Heinz": "크래프트 하인즈",
  "Chipotle Mexican Grill": "치폴레",
  "Booking Holdings": "부킹 홀딩스",
  "Marriott International": "메리어트 인터내셔널",
  "Airbnb": "에어비앤비",
  "Airbnb Inc.": "에어비앤비",
  "Expedia": "익스피디아",

  // ── US Technology ──
  "Salesforce": "세일즈포스",
  "Salesforce Inc.": "세일즈포스",
  "Adobe Inc.": "어도비",
  "Adobe": "어도비",
  "Intel Corporation": "인텔",
  "Intel": "인텔",
  "Qualcomm": "퀄컴",
  "QUALCOMM": "퀄컴",
  "Broadcom": "브로드컴",
  "Broadcom Inc.": "브로드컴",
  "PayPal": "페이팔",
  "PayPal Holdings": "페이팔",
  "Shopify": "쇼피파이",
  "Uber Technologies": "우버",
  "Uber": "우버",
  "Spotify": "스포티파이",
  "Palantir Technologies": "팔란티어",
  "Palantir": "팔란티어",
  "Snowflake": "스노우플레이크",
  "CrowdStrike": "크라우드스트라이크",
  "CrowdStrike Holdings": "크라우드스트라이크",
  "Palo Alto Networks": "팰로앨토 네트웍스",
  "ServiceNow": "서비스나우",
  "Workday": "워크데이",
  "Texas Instruments": "텍사스 인스트루먼트",
  "Micron Technology": "마이크론",
  "Applied Materials": "어플라이드 머티리얼즈",
  "Lam Research": "램 리서치",
  "ASML Holding": "에이에스엠엘",
  "ASML": "에이에스엠엔엘",
  "Advanced Micro Devices": "AMD",
  "Advanced Micro Devices Inc.": "AMD",
  "Arm Holdings": "ARM 홀딩스",
  "Marvell Technology": "마벨 테크놀로지",
  "VeriSign Inc.": "베리사인",
  "Coinbase": "코인베이스",
  "Coinbase Global": "코인베이스",
  "Roku Inc.": "로쿠",
  "Pinterest": "핀터레스트",
  "Snap Inc.": "스냅",
  "Twitter": "트위터",
  "X Corp.": "X (트위터)",
  "MercadoLibre": "메르카도리브레",

  // ── Chinese ADRs ──
  "Alibaba Group": "알리바바",
  "Alibaba Group Holding": "알리바바",
  "JD.com Inc.": "JD닷컴",
  "JD.com": "JD닷컴",
  "Baidu": "바이두",
  "Baidu Inc.": "바이두",
  "Tencent": "텐센트",
  "Tencent Holdings": "텐센트",
  "Sea Limited": "씨 리미티드",
  "PDD Holdings": "PDD 홀딩스",
  "NIO": "니오",

  // ── Korean Stocks ──
  "삼성전자 (Samsung Electronics)": "삼성전자",
  "Samsung Electronics": "삼성전자",
  "SK하이닉스 (SK Hynix)": "SK하이닉스",
  "SK Hynix": "SK하이닉스",
  "현대자동차 (Hyundai Motor)": "현대자동차",
  "Hyundai Motor": "현대자동차",
  "기아 (Kia)": "기아",
  "Kia Corp.": "기아",
  "LG전자 (LG Electronics)": "LG전자",
  "LG Electronics": "LG전자",
  "NAVER Corp.": "네이버",
  "NAVER": "네이버",
  "Kakao Corp.": "카카오",
  "Kakao": "카카오",
  "POSCO Holdings": "포스코 홀딩스",
  "셀트리온 (Celltrion)": "셀트리온",
  "Celltrion": "셀트리온",
  "Samsung SDI": "삼성 SDI",
  "LG Energy Solution": "LG 에너지솔루션",
  "LGES": "LG 에너지솔루션",
  "KB Financial Group": "KB금융",
  "Shinhan Financial Group": "신한금융",
  "Hana Financial Group": "하나금융",
  "Korea Electric Power": "한국전력",

  // ── Japanese Stocks ──
  "Toyota Motor": "도요타 자동차",
  "Toyota Motor Corp.": "도요타 자동차",
  "Toyota Motor Corporation": "도요타 자동차",
  "Sony Group": "소니 그룹",
  "Sony Group Corp.": "소니 그룹",
  "Sony": "소니",
  "Honda Motor": "혼다 자동차",
  "Honda Motor Co.": "혼다",
  "Nintendo": "닌텐도",
  "Nintendo Co.": "닌텐도",
  "SoftBank Group": "소프트뱅크 그룹",
  "SoftBank": "소프트뱅크",
  "Panasonic": "파나소닉",
  "Panasonic Holdings": "파나소닉",
  "Mitsubishi UFJ Financial": "미쓰비시 UFJ",
  "Mitsubishi UFJ Financial Group": "미쓰비시 UFJ",
  "MUFG": "미쓰비시 UFJ",
  "Sumitomo Mitsui Financial Group": "스미토모 미쓰이",
  "SMFG": "스미토모 미쓰이",
  "Keyence": "키엔스",
  "Keyence Corp.": "키엔스",
  "FANUC": "파낙",
  "Hitachi": "히타치",
  "Hitachi Ltd.": "히타치",
  "Canon": "캐논",
  "Canon Inc.": "캐논",
  "Shin-Etsu Chemical": "신에쓰 화학",
  "Fast Retailing": "패스트리테일링 (유니클로)",
  "Recruit Holdings": "리쿠르트 홀딩스",
  "Daiichi Sankyo": "다이이치 산쿄",
  "Daiichi Sankyo Co.": "다이이치 산쿄",
  "Tokyo Electron": "도쿄 일렉트론",
  "Denso Corp.": "덴소",
  "Denso": "덴소",
  "Shiseido": "시세이도",
  "Murata Manufacturing": "무라타 제작소",
  "Nidec": "니덱",
  "Olympus": "올림푸스",
  "Tokio Marine": "도쿄 해상",
  "Itochu": "이토추",
  "Mitsubishi Corp.": "미쓰비시 상사",
  "Mitsui & Co.": "미쓰이 물산",
  "Softbank Corp.": "소프트뱅크",

  // ── European Stocks ──
  "Novo Nordisk": "노보 노디스크",
  "Novo Nordisk A/S": "노보 노디스크",
  "AstraZeneca": "아스트라제네카",
  "AstraZeneca PLC": "아스트라제네카",
  "ASML Holding N.V.": "에이에스엠엘",
  "SAP SE": "SAP",
  "SAP": "SAP",
  "Siemens": "지멘스",
  "Siemens AG": "지멘스",
  "Volkswagen": "폭스바겐",
  "Volkswagen AG": "폭스바겐",
  "BMW": "BMW",
  "Bayerische Motoren Werke AG": "BMW",
  "Mercedes-Benz": "메르세데스-벤츠",
  "Mercedes-Benz Group": "메르세데스-벤츠",
  "LVMH": "LVMH",
  "LVMH Moet Hennessy": "LVMH",
  "Nestle": "네슬레",
  "Nestlé": "네슬레",
  "Nestlé SA": "네슬레",
  "Roche": "로슈",
  "Roche Holding": "로슈",
  "Novartis": "노바티스",
  "Novartis AG": "노바티스",
  "Unilever": "유니레버",
  "Shell": "쉘",
  "Shell PLC": "쉘",
  "BP": "BP",
  "BP PLC": "BP",
  "TotalEnergies": "토탈에너지",
  "TotalEnergies SE": "토탈에너지",
  "GlaxoSmithKline": "GSK",
  "GSK PLC": "GSK",
  "Sanofi": "사노피",
  "HSBC Holdings": "HSBC",
  "HSBC": "HSBC",
  "L'Oreal": "로레알",
  "L'Oréal": "로레알",
  "Airbus": "에어버스",
  "Airbus SE": "에어버스",
  "Ferrari": "페라리",
  "Ferrari N.V.": "페라리",
  "Adidas": "아디다스",
  "Adidas AG": "아디다스",
  "Inditex": "인디텍스 (자라)",
  "Linde PLC": "린데",
  "Linde": "린데",
  "Stellantis": "스텔란티스",
  "Stellantis N.V.": "스텔란티스",

  // ── US ETFs / Indices (exact API-returned names) ──
  "SPDR S&P 500 ETF": "S&P 500 ETF (SPY)",
  "State Street SPDR S&P 500 ETF T": "S&P 500 ETF",
  "Invesco QQQ Trust, Series 1": "나스닥 100 ETF",
  "Invesco QQQ Trust": "나스닥 100 ETF",
  "State Street SPDR Dow Jones Ind": "다우존스 ETF",
  "State Street SPDR Dow Jones Industrial Average ETF Trust": "다우존스 ETF",
  "iShares Russell 2000 ETF": "러셀 2000 ETF",
  "iShares Emerging Markets ETF": "이머징마켓 ETF (EEM)",
  "SPDR Gold Shares ETF": "금 ETF (GLD)",
  "iShares Core S&P 500 ETF": "iShares S&P 500 ETF",

  // ── Japanese stocks (uppercase API names) ──
  "TOYOTA MOTOR CORP": "도요타 자동차",
  "TOYOTA MOTOR CORPORATION": "도요타 자동차",
  "SONY GROUP CORPORATION": "소니 그룹",
  "SONY GROUP CORP": "소니 그룹",
  "SOFTBANK GROUP CORP": "소프트뱅크 그룹",
  "MITSUBISHI UFJ FINANCIAL GROUP": "미쓰비시 UFJ 금융그룹",
  "MITSUBISHI UFJ FINANCIAL GROUP ": "미쓰비시 UFJ 금융그룹",
  "TAKEDA PHARMACEUTICAL CO LTD": "다케다 제약",
  "KEYENCE CORP": "키엔스",
  "FANUC CORP": "파낙",
  "HITACHI LTD": "히타치",
  "CANON INC": "캐논",
  "SHIN-ETSU CHEMICAL CO LTD": "신에쓰 화학",
  "FAST RETAILING CO LTD": "패스트리테일링 (유니클로)",
  "DAIICHI SANKYO CO LTD": "다이이치 산쿄",
  "TOYOTA INDUSTRIES CORP": "도요타 산업",
  "HONDA MOTOR CO LTD": "혼다 자동차",
  "NINTENDO CO LTD": "닌텐도",
  "RECRUIT HOLDINGS CO LTD": "리쿠르트 홀딩스",
  "NIPPON TELEGRAPH AND TELEPHONE": "NTT 일본전신전화",
  "MURATA MANUFACTURING CO LTD": "무라타 제작소",

  // ── Other ──
  "Barrick Gold": "배릭 골드",
  "Wheaton Precious Metals": "휘튼 프리셔스 메탈스",
  "GEO Group Inc.": "지오 그룹",
  "Vistra Corp": "비스트라",
  "CVR Energy": "CVR 에너지",
  "Qurate Retail": "쿠레이트 리테일",
  "Howard Hughes Holdings": "하워드 휴즈 홀딩스",
  "DBS Group Holdings": "DBS 그룹",
  "Omega Healthcare": "오메가 헬스케어",
  "Allison Transmission": "앨리슨 트랜스미션",
  "Cellebrite DI": "셀레브라이트",
  "PTC Inc.": "PTC",
};

// ─── JP local ticker → US ADR mapping ───────────────────────────────────────
export const JP_ADR_MAP: Record<string, string> = {
  "7203.T":  "TM",    // Toyota
  "6758.T":  "SONY",  // Sony
  "7267.T":  "HMC",   // Honda
  "7974.T":  "NTDOY", // Nintendo
  "9984.T":  "SFTBY", // SoftBank Group
  "9432.T":  "NTTYY", // NTT
  "8306.T":  "MUFG",  // Mitsubishi UFJ
  "8316.T":  "SMFG",  // Sumitomo Mitsui
  "4502.T":  "TAK",   // Takeda Pharmaceutical
  "6861.T":  "KYCCF", // Keyence
  "9433.T":  "KDDIF", // KDDI
  "6501.T":  "HTHIY", // Hitachi
  "7751.T":  "CAJ",   // Canon
  "4063.T":  "SHECY", // Shin-Etsu Chemical
};

// Reverse: US ADR ticker → local JP ticker
export const ADR_TO_LOCAL_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(JP_ADR_MAP).map(([local, adr]) => [adr, local])
);

// ─── Investor name localization ───────────────────────────────────────────────
export const KO_INVESTOR_NAMES: Record<string, string> = {
  "Warren Buffett": "워런 버핏",
  "Seth Klarman": "세스 클라만",
  "Carl Icahn": "칼 아이칸",
  "David Einhorn": "데이비드 아인혼",
  "Mohnish Pabrai": "모니시 파브라이",
  "Bill Miller": "빌 밀러",
  "Chase Coleman III": "체이스 콜먼",
  "Cathie Wood": "캐시 우드",
  "Ray Dalio": "레이 달리오",
  "George Soros": "조지 소로스",
  "Stanley Druckenmiller": "스탠리 드러켄밀러",
  "Ken Griffin": "켄 그리핀",
  "Izzy Englander": "이지 잉글랜더",
  "Michael Burry": "마이클 버리",
  "Jim Simons": "짐 사이먼스",
  "Steve Cohen": "스티브 코헨",
  "Bill Ackman": "빌 애크먼",
  "Paul Singer": "폴 싱어",
  "Dan Loeb": "댄 로브",
  "국민연금공단 (NPS)": "국민연금공단",
  "GPIF": "GPIF (일본)",
  "GIC Singapore": "GIC 싱가포르",
  "Temasek Holdings": "테마섹",
  "Norway Pension Fund (NBIM)": "노르웨이 국부펀드",
  "ADIA": "아부다비투자청",
  "Saudi Arabia PIF": "사우디 PIF",
  "CalPERS": "캘퍼스",
  "BlackRock": "블랙록",
  "Vanguard Group": "뱅가드",
  "State Street SSGA": "스테이트 스트리트",
  "Fidelity Investments": "피델리티",
  "T. Rowe Price": "T. 로우 프라이스",
};

// ─── Sector name localization ─────────────────────────────────────────────────
export const KO_SECTOR_NAMES: Record<string, string> = {
  "Technology": "기술주",
  "Healthcare": "헬스케어",
  "Financials": "금융",
  "Consumer Staples": "필수소비재",
  "Consumer Discretionary": "경기소비재",
  "Energy": "에너지",
  "Communication Services": "통신 서비스",
  "Industrials": "산업재",
  "Materials": "소재",
  "Real Estate": "부동산",
  "Utilities": "유틸리티",
  "Fixed Income": "채권",
  "ETFs": "ETF",
  "Commodities": "원자재",
  "Cash & Others": "현금 및 기타",
  "Other": "기타",
};

// ─── Korean search alias system ───────────────────────────────────────────────
// Each entry maps a Korean name (and aliases) to the stock's ticker and English name
export interface KoreanStockAlias {
  ticker: string;
  en: string;
  ko: string;
  aliases: string[];
}

export const KOREAN_STOCK_ALIASES: KoreanStockAlias[] = [
  // ── US Big Tech ──
  { ticker: "AAPL",  en: "Apple",     ko: "애플",         aliases: ["애플", "아이폰", "아이패드"] },
  { ticker: "MSFT",  en: "Microsoft", ko: "마이크로소프트", aliases: ["마이크로소프트", "마소", "윈도우"] },
  { ticker: "GOOGL", en: "Alphabet",  ko: "알파벳",        aliases: ["알파벳", "구글", "유튜브"] },
  { ticker: "GOOG",  en: "Alphabet",  ko: "알파벳",        aliases: ["알파벳", "구글"] },
  { ticker: "AMZN",  en: "Amazon",    ko: "아마존",        aliases: ["아마존", "아마존닷컴"] },
  { ticker: "NVDA",  en: "NVIDIA",    ko: "엔비디아",      aliases: ["엔비디아", "엔비", "nvidia"] },
  { ticker: "META",  en: "Meta",      ko: "메타",          aliases: ["메타", "페이스북", "인스타그램"] },
  { ticker: "TSLA",  en: "Tesla",     ko: "테슬라",        aliases: ["테슬라", "전기차"] },
  { ticker: "BRK.B", en: "Berkshire Hathaway", ko: "버크셔 해서웨이", aliases: ["버크셔", "버크셔해서웨이", "워런버핏"] },

  // ── US Financials ──
  { ticker: "JPM",   en: "JPMorgan",        ko: "JP모건",          aliases: ["JP모건", "jp모건", "제이피모건"] },
  { ticker: "V",     en: "Visa",            ko: "비자",            aliases: ["비자", "비자카드"] },
  { ticker: "MA",    en: "Mastercard",      ko: "마스터카드",       aliases: ["마스터카드", "마스터"] },
  { ticker: "BAC",   en: "Bank of America", ko: "뱅크오브아메리카", aliases: ["뱅크오브아메리카", "미국은행"] },
  { ticker: "GS",    en: "Goldman Sachs",   ko: "골드만삭스",      aliases: ["골드만삭스", "골드만"] },
  { ticker: "MS",    en: "Morgan Stanley",  ko: "모건스탠리",      aliases: ["모건스탠리", "모건"] },
  { ticker: "BLK",   en: "BlackRock",       ko: "블랙록",          aliases: ["블랙록"] },
  { ticker: "AXP",   en: "American Express", ko: "아메리칸 익스프레스", aliases: ["아메리칸익스프레스", "아멕스"] },
  { ticker: "MCO",   en: "Moody's",         ko: "무디스",          aliases: ["무디스"] },
  { ticker: "SPGI",  en: "S&P Global",      ko: "S&P 글로벌",      aliases: ["S&P글로벌", "에스앤피"] },
  { ticker: "WFC",   en: "Wells Fargo",     ko: "웰스파고",        aliases: ["웰스파고"] },

  // ── US Energy ──
  { ticker: "CVX",   en: "Chevron",    ko: "셰브론",        aliases: ["셰브론"] },
  { ticker: "XOM",   en: "ExxonMobil", ko: "엑슨모빌",     aliases: ["엑슨모빌", "엑슨"] },
  { ticker: "OXY",   en: "Occidental", ko: "옥시덴탈",     aliases: ["옥시덴탈", "옥시"] },

  // ── US Healthcare ──
  { ticker: "LLY",   en: "Eli Lilly",       ko: "일라이 릴리",   aliases: ["일라이릴리", "일라이 릴리", "릴리"] },
  { ticker: "JNJ",   en: "Johnson & Johnson", ko: "존슨앤드존슨", aliases: ["존슨앤드존슨", "존앤존", "존슨"] },
  { ticker: "ABBV",  en: "AbbVie",          ko: "애브비",         aliases: ["애브비"] },
  { ticker: "PFE",   en: "Pfizer",          ko: "화이자",         aliases: ["화이자"] },
  { ticker: "MRK",   en: "Merck",           ko: "머크",           aliases: ["머크"] },
  { ticker: "MRNA",  en: "Moderna",         ko: "모더나",         aliases: ["모더나"] },
  { ticker: "UNH",   en: "UnitedHealth",    ko: "유나이티드헬스",  aliases: ["유나이티드헬스", "유나이티드"] },
  { ticker: "BMY",   en: "Bristol-Myers",   ko: "브리스톨-마이어스", aliases: ["브리스톨마이어스", "BMY"] },
  { ticker: "ISRG",  en: "Intuitive Surgical", ko: "인튜이티브 서지컬", aliases: ["인튜이티브서지컬", "인튜이티브"] },

  // ── US Consumer / Retail ──
  { ticker: "KO",    en: "Coca-Cola",  ko: "코카콜라",  aliases: ["코카콜라", "코크"] },
  { ticker: "PEP",   en: "PepsiCo",   ko: "펩시코",    aliases: ["펩시코", "펩시"] },
  { ticker: "WMT",   en: "Walmart",   ko: "월마트",    aliases: ["월마트"] },
  { ticker: "COST",  en: "Costco",    ko: "코스트코",  aliases: ["코스트코"] },
  { ticker: "HD",    en: "Home Depot", ko: "홈디포",   aliases: ["홈디포"] },
  { ticker: "MCD",   en: "McDonald's", ko: "맥도날드", aliases: ["맥도날드", "맥날"] },
  { ticker: "SBUX",  en: "Starbucks", ko: "스타벅스",  aliases: ["스타벅스"] },
  { ticker: "NKE",   en: "Nike",      ko: "나이키",    aliases: ["나이키"] },
  { ticker: "DIS",   en: "Disney",    ko: "디즈니",    aliases: ["디즈니", "월트디즈니"] },
  { ticker: "NFLX",  en: "Netflix",   ko: "넷플릭스",  aliases: ["넷플릭스", "넷플"] },
  { ticker: "BKNG",  en: "Booking Holdings", ko: "부킹홀딩스", aliases: ["부킹홀딩스", "부킹닷컴"] },
  { ticker: "ABNB",  en: "Airbnb",    ko: "에어비앤비", aliases: ["에어비앤비", "에어비"] },
  { ticker: "CMG",   en: "Chipotle",  ko: "치폴레",    aliases: ["치폴레"] },

  // ── US Technology ──
  { ticker: "CRM",   en: "Salesforce", ko: "세일즈포스",  aliases: ["세일즈포스"] },
  { ticker: "ADBE",  en: "Adobe",      ko: "어도비",      aliases: ["어도비"] },
  { ticker: "INTC",  en: "Intel",      ko: "인텔",        aliases: ["인텔"] },
  { ticker: "QCOM",  en: "Qualcomm",   ko: "퀄컴",        aliases: ["퀄컴"] },
  { ticker: "AVGO",  en: "Broadcom",   ko: "브로드컴",    aliases: ["브로드컴"] },
  { ticker: "PYPL",  en: "PayPal",     ko: "페이팔",      aliases: ["페이팔"] },
  { ticker: "SHOP",  en: "Shopify",    ko: "쇼피파이",    aliases: ["쇼피파이"] },
  { ticker: "UBER",  en: "Uber",       ko: "우버",        aliases: ["우버"] },
  { ticker: "SPOT",  en: "Spotify",    ko: "스포티파이",  aliases: ["스포티파이"] },
  { ticker: "PLTR",  en: "Palantir",   ko: "팔란티어",    aliases: ["팔란티어"] },
  { ticker: "SNOW",  en: "Snowflake",  ko: "스노우플레이크", aliases: ["스노우플레이크"] },
  { ticker: "CRWD",  en: "CrowdStrike", ko: "크라우드스트라이크", aliases: ["크라우드스트라이크"] },
  { ticker: "PANW",  en: "Palo Alto Networks", ko: "팰로앨토", aliases: ["팰로앨토", "팔로알토"] },
  { ticker: "NOW",   en: "ServiceNow", ko: "서비스나우",  aliases: ["서비스나우"] },
  { ticker: "WDAY",  en: "Workday",    ko: "워크데이",    aliases: ["워크데이"] },
  { ticker: "TXN",   en: "Texas Instruments", ko: "텍사스 인스트루먼트", aliases: ["텍사스인스트루먼트", "TI"] },
  { ticker: "MU",    en: "Micron",     ko: "마이크론",    aliases: ["마이크론"] },
  { ticker: "AMD",   en: "AMD",        ko: "AMD",         aliases: ["AMD", "에이엠디", "라이젠"] },
  { ticker: "ARM",   en: "Arm Holdings", ko: "ARM",       aliases: ["ARM", "에이알엠"] },
  { ticker: "COIN",  en: "Coinbase",   ko: "코인베이스",  aliases: ["코인베이스"] },
  { ticker: "ROKU",  en: "Roku",       ko: "로쿠",        aliases: ["로쿠"] },
  { ticker: "PINS",  en: "Pinterest",  ko: "핀터레스트",  aliases: ["핀터레스트"] },
  { ticker: "MELI",  en: "MercadoLibre", ko: "메르카도리브레", aliases: ["메르카도리브레"] },

  // ── Korean Stocks ──
  { ticker: "005930.KS", en: "Samsung Electronics",  ko: "삼성전자",       aliases: ["삼성전자", "삼성", "samsung"] },
  { ticker: "000660.KS", en: "SK Hynix",             ko: "SK하이닉스",     aliases: ["SK하이닉스", "하이닉스"] },
  { ticker: "005380.KS", en: "Hyundai Motor",        ko: "현대자동차",     aliases: ["현대자동차", "현대차", "현대"] },
  { ticker: "000270.KS", en: "Kia",                  ko: "기아",           aliases: ["기아", "기아차"] },
  { ticker: "035420.KS", en: "NAVER",                ko: "네이버",         aliases: ["네이버"] },
  { ticker: "035720.KS", en: "Kakao",                ko: "카카오",         aliases: ["카카오", "카카오톡"] },
  { ticker: "066570.KS", en: "LG Electronics",       ko: "LG전자",         aliases: ["LG전자", "LG"] },
  { ticker: "068270.KS", en: "Celltrion",            ko: "셀트리온",       aliases: ["셀트리온"] },
  { ticker: "005490.KS", en: "POSCO Holdings",       ko: "포스코",         aliases: ["포스코", "포스코홀딩스"] },
  { ticker: "051910.KS", en: "LG Chem",              ko: "LG화학",         aliases: ["LG화학"] },
  { ticker: "003550.KS", en: "LG Corp.",             ko: "LG",             aliases: ["LG지주", "LG주"] },
  { ticker: "015760.KS", en: "Korea Electric Power", ko: "한국전력",        aliases: ["한국전력", "한전"] },
  { ticker: "096770.KS", en: "SK Innovation",        ko: "SK이노베이션",   aliases: ["SK이노베이션"] },
  { ticker: "017670.KS", en: "SK Telecom",           ko: "SK텔레콤",       aliases: ["SK텔레콤"] },
  { ticker: "030200.KS", en: "KT Corp.",             ko: "KT",             aliases: ["KT", "케이티"] },
  { ticker: "055550.KS", en: "Shinhan Financial",    ko: "신한금융",       aliases: ["신한금융", "신한"] },
  { ticker: "105560.KS", en: "KB Financial",         ko: "KB금융",         aliases: ["KB금융", "국민은행"] },
  { ticker: "086790.KS", en: "Hana Financial",       ko: "하나금융",       aliases: ["하나금융", "하나은행"] },

  // ── Japanese Stocks (US ADR listed first for each company) ──
  { ticker: "TM",      en: "Toyota (US ADR)",     ko: "도요타 자동차", aliases: ["도요타", "토요타", "도요타자동차", "도요타 자동차"] },
  { ticker: "7203.T",  en: "Toyota Motor (JP)",   ko: "도요타 자동차", aliases: ["도요타", "토요타", "도요타자동차"] },
  { ticker: "SONY",    en: "Sony (US ADR)",       ko: "소니 그룹",  aliases: ["소니", "소니그룹"] },
  { ticker: "6758.T",  en: "Sony Group (JP)",     ko: "소니 그룹",  aliases: ["소니", "소니그룹"] },
  { ticker: "HMC",     en: "Honda (US ADR)",      ko: "혼다",       aliases: ["혼다", "혼다자동차"] },
  { ticker: "7267.T",  en: "Honda Motor (JP)",    ko: "혼다",       aliases: ["혼다", "혼다자동차"] },
  { ticker: "NTDOY",   en: "Nintendo (US ADR)",   ko: "닌텐도",     aliases: ["닌텐도"] },
  { ticker: "7974.T",  en: "Nintendo (JP)",       ko: "닌텐도",     aliases: ["닌텐도"] },
  { ticker: "SFTBY",   en: "SoftBank (US ADR)",   ko: "소프트뱅크 그룹", aliases: ["소프트뱅크", "소프트방크"] },
  { ticker: "9984.T",  en: "SoftBank Group (JP)", ko: "소프트뱅크 그룹", aliases: ["소프트뱅크", "소프트방크"] },
  { ticker: "MUFG",    en: "Mitsubishi UFJ (US ADR)", ko: "미쓰비시UFJ", aliases: ["미쓰비시UFJ", "MUFG"] },
  { ticker: "8306.T",  en: "Mitsubishi UFJ (JP)", ko: "미쓰비시UFJ", aliases: ["미쓰비시UFJ"] },
  { ticker: "SMFG",    en: "Sumitomo Mitsui (US ADR)", ko: "스미토모 미쓰이", aliases: ["스미토모미쓰이"] },
  { ticker: "8316.T",  en: "Sumitomo Mitsui (JP)", ko: "스미토모 미쓰이", aliases: ["스미토모미쓰이", "SMFG"] },
  { ticker: "TAK",     en: "Takeda Pharma (US ADR)", ko: "다케다 제약", aliases: ["다케다", "다케다제약"] },
  { ticker: "4502.T",  en: "Takeda Pharma (JP)", ko: "다케다 제약", aliases: ["다케다", "다케다제약"] },
  { ticker: "FRCOY",   en: "Fast Retailing ADR (US)", ko: "유니클로", aliases: ["유니클로"] },
  { ticker: "9983.T",  en: "Fast Retailing (JP)", ko: "유니클로",  aliases: ["유니클로", "패스트리테일링"] },
  { ticker: "6954.T",  en: "FANUC",              ko: "파낙",       aliases: ["파낙", "FANUC"] },
  { ticker: "6861.T",  en: "Keyence",            ko: "키엔스",     aliases: ["키엔스"] },
  { ticker: "HTHIY",   en: "Hitachi (US ADR)",   ko: "히타치",     aliases: ["히타치"] },
  { ticker: "6501.T",  en: "Hitachi (JP)",       ko: "히타치",     aliases: ["히타치"] },
  { ticker: "CAJ",     en: "Canon (US ADR)",     ko: "캐논",       aliases: ["캐논"] },
  { ticker: "7751.T",  en: "Canon (JP)",         ko: "캐논",       aliases: ["캐논"] },
  { ticker: "4568.T",  en: "Daiichi Sankyo",     ko: "다이이치산쿄", aliases: ["다이이치산쿄", "다이이치"] },
  { ticker: "6752.T",  en: "Panasonic",          ko: "파나소닉",   aliases: ["파나소닉"] },
  { ticker: "8766.T",  en: "Tokio Marine",       ko: "도쿄해상",   aliases: ["도쿄해상"] },
  { ticker: "6098.T",  en: "Recruit Holdings",   ko: "리쿠르트",   aliases: ["리쿠르트"] },

  // ── EU Stocks ──
  { ticker: "NVO",     en: "Novo Nordisk",   ko: "노보 노디스크", aliases: ["노보노디스크", "노보 노디스크", "노보"] },
  { ticker: "NOVO-B.CO", en: "Novo Nordisk", ko: "노보 노디스크", aliases: ["노보노디스크", "노보"] },
  { ticker: "ASML",    en: "ASML Holding",   ko: "에이에스엠엘", aliases: ["에이에스엠엘", "ASML"] },
  { ticker: "AZN",     en: "AstraZeneca",    ko: "아스트라제네카", aliases: ["아스트라제네카", "아스트라"] },
  { ticker: "SAP",     en: "SAP",            ko: "SAP",          aliases: ["SAP", "에스에이피"] },
  { ticker: "SIEGY",   en: "Siemens",        ko: "지멘스",       aliases: ["지멘스"] },
  { ticker: "VWAGY",   en: "Volkswagen",     ko: "폭스바겐",     aliases: ["폭스바겐"] },
  { ticker: "BMWYY",   en: "BMW",            ko: "BMW",          aliases: ["BMW", "비엠더블유"] },
  { ticker: "MBGAF",   en: "Mercedes-Benz",  ko: "메르세데스-벤츠", aliases: ["메르세데스벤츠", "메르세데스", "벤츠"] },
  { ticker: "LVMHF",   en: "LVMH",           ko: "LVMH",         aliases: ["LVMH", "루이비통", "엘브이엠에이치"] },
  { ticker: "NSRGY",   en: "Nestlé",         ko: "네슬레",       aliases: ["네슬레"] },
  { ticker: "RHHBY",   en: "Roche",          ko: "로슈",         aliases: ["로슈"] },
  { ticker: "NVS",     en: "Novartis",       ko: "노바티스",     aliases: ["노바티스"] },
  { ticker: "UL",      en: "Unilever",       ko: "유니레버",     aliases: ["유니레버"] },
  { ticker: "SHEL",    en: "Shell",          ko: "쉘",           aliases: ["쉘", "셸"] },
  { ticker: "BP",      en: "BP",             ko: "BP",           aliases: ["BP", "브리티시페트롤리엄"] },
  { ticker: "TTE",     en: "TotalEnergies",  ko: "토탈에너지",  aliases: ["토탈에너지", "토탈"] },
  { ticker: "GSK",     en: "GlaxoSmithKline", ko: "GSK",         aliases: ["GSK", "글락소스미스클라인"] },
  { ticker: "SNY",     en: "Sanofi",         ko: "사노피",       aliases: ["사노피"] },
  { ticker: "HSBC",    en: "HSBC",           ko: "HSBC",         aliases: ["HSBC", "에이치에스비씨"] },
  { ticker: "LRLCY",   en: "L'Oréal",        ko: "로레알",       aliases: ["로레알", "로레얄"] },
  { ticker: "EADSY",   en: "Airbus",         ko: "에어버스",     aliases: ["에어버스"] },
  { ticker: "RACE",    en: "Ferrari",        ko: "페라리",       aliases: ["페라리"] },
  { ticker: "ADDYY",   en: "Adidas",         ko: "아디다스",     aliases: ["아디다스"] },
  { ticker: "LIN",     en: "Linde",          ko: "린데",         aliases: ["린데"] },
  { ticker: "STLA",    en: "Stellantis",     ko: "스텔란티스",   aliases: ["스텔란티스"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Detect if a string contains Korean (Hangul) characters */
export function containsKorean(text: string): boolean {
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(text);
}

/**
 * Get a localized company name. Falls back to the original if no mapping exists.
 * Tries exact match first, then a prefix/suffix partial match.
 */
export function getLocalizedCompanyName(englishName: string, lang: string): string {
  if (lang !== "ko") return englishName;
  if (!englishName) return englishName;

  // 1. Exact match
  const exact = KO_COMPANY_NAMES[englishName];
  if (exact) return exact;

  // 2. Try stripping common suffixes and match
  const stripped = englishName
    .replace(/\s+(Inc\.|Inc|Corp\.|Corp|Co\.|Co|Ltd\.?|PLC|plc|AG|SA|SE|NV|N\.V\.|Holdings|Group|Technology|Technologies|Holding|Limited)\.?$/i, "")
    .trim();

  if (stripped !== englishName) {
    const strippedMatch = KO_COMPANY_NAMES[stripped] || KO_COMPANY_NAMES[stripped + " Inc."] || KO_COMPANY_NAMES[stripped + " Corp."];
    if (strippedMatch) return strippedMatch;
  }

  // 3. Partial: check if englishName starts with a known key
  const lower = englishName.toLowerCase();
  for (const [en, ko] of Object.entries(KO_COMPANY_NAMES)) {
    if (lower.startsWith(en.toLowerCase()) || en.toLowerCase().startsWith(lower)) {
      return ko;
    }
  }

  return englishName;
}

/**
 * Look up a stock's localized name by ticker symbol.
 * Checks KOREAN_STOCK_ALIASES first (exact ticker match).
 * Returns null if no ticker match found.
 */
export function getNameByTicker(ticker: string, lang: string): string | null {
  if (!ticker) return null;
  const alias = KOREAN_STOCK_ALIASES.find(a => a.ticker === ticker);
  if (!alias) return null;
  return lang === "ko" ? alias.ko : alias.en;
}

/**
 * Search the Korean alias list for stocks matching a Korean query.
 * Normalizes whitespace for comparison.
 */
export function searchByKoreanAlias(koreanQuery: string): KoreanStockAlias[] {
  const normalized = koreanQuery.replace(/\s+/g, "").toLowerCase();
  if (!normalized) return [];

  const seen = new Set<string>();
  const results: KoreanStockAlias[] = [];

  for (const stock of KOREAN_STOCK_ALIASES) {
    const alreadySeen = seen.has(stock.en);
    const matches = stock.aliases.some(alias => {
      const normAlias = alias.replace(/\s+/g, "").toLowerCase();
      return normAlias.includes(normalized) || normalized.includes(normAlias);
    });

    if (matches && !alreadySeen) {
      seen.add(stock.en);
      results.push(stock);
    }
  }

  return results.slice(0, 15);
}
