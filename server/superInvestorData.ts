export interface Holding {
  ticker: string;
  company: string;
  sector: string;
  shares: number;
  weight: number;
  change: "Bought" | "Sold" | "Held" | "New";
  changePct: number | null;
  whyTheyBoughtEn: string;
  whyTheyBoughtKo: string;
  priceApprox: number;
}

export interface SectorAllocation {
  sector: string;
  weight: number;
  color: string;
}

export interface SuperInvestor {
  id: string;
  name: string;
  firm: string;
  country: "US" | "KR";
  aum: number;
  aumUnit: string;
  initials: string;
  avatarColor: string;
  biographyEn: string;
  biographyKo: string;
  styleEn: string;
  styleKo: string;
  styleTagsEn: string[];
  styleTagsKo: string[];
  lastUpdated: string;
  filingType: string;
  sectorAllocation: SectorAllocation[];
  holdings: Holding[];
}

export const SUPER_INVESTORS: SuperInvestor[] = [
  {
    id: "buffett",
    name: "Warren Buffett",
    firm: "Berkshire Hathaway",
    country: "US",
    aum: 291,
    aumUnit: "B",
    initials: "WB",
    avatarColor: "#2563eb",
    biographyEn:
      "Known as the 'Oracle of Omaha,' Warren Buffett is one of the most successful investors of all time. Born in 1930, he began investing at age 11 and built Berkshire Hathaway into a $700B+ conglomerate. His mentor, Benjamin Graham, taught him the principles of value investing.",
    biographyKo:
      "'오마하의 현인'으로 알려진 워렌 버핏은 역사상 가장 성공한 투자자 중 한 명입니다. 1930년에 태어나 11세에 투자를 시작하여 버크셔 해서웨이를 7000억 달러 이상의 대기업으로 키웠습니다. 스승인 벤저민 그레이엄에게 가치투자 원칙을 배웠습니다.",
    styleEn:
      "Value investing with a long-term horizon. Focuses on businesses with durable competitive moats, predictable cash flows, and excellent management. Famous quote: 'Be fearful when others are greedy, and greedy when others are fearful.'",
    styleKo:
      "장기적 관점의 가치 투자. 지속적인 경쟁 우위, 예측 가능한 현금 흐름, 뛰어난 경영진을 갖춘 기업에 집중합니다. 유명한 명언: '다른 사람들이 탐욕스러울 때 두려워하고, 다른 사람들이 두려워할 때 탐욕스러워라.'",
    styleTagsEn: ["Value Investing", "Long-Term", "Economic Moat", "Dividends"],
    styleTagsKo: ["가치 투자", "장기 투자", "경제적 해자", "배당주"],
    lastUpdated: "Q3 2025",
    filingType: "13F Filing (SEC)",
    sectorAllocation: [
      { sector: "Financials", weight: 36.2, color: "#3b82f6" },
      { sector: "Technology", weight: 25.8, color: "#8b5cf6" },
      { sector: "Consumer Staples", weight: 12.1, color: "#10b981" },
      { sector: "Energy", weight: 11.4, color: "#f59e0b" },
      { sector: "Healthcare", weight: 6.8, color: "#ef4444" },
      { sector: "Communications", weight: 4.7, color: "#06b6d4" },
      { sector: "Other", weight: 3.0, color: "#6b7280" },
    ],
    holdings: [
      {
        ticker: "AAPL",
        company: "Apple Inc.",
        sector: "Technology",
        shares: 300000000,
        weight: 25.8,
        change: "Sold",
        changePct: -22.4,
        whyTheyBoughtEn:
          "Buffett sees Apple as a consumer products company with unmatched brand loyalty and an ecosystem that creates extreme customer stickiness. It generates enormous free cash flow and returns capital via buybacks.",
        whyTheyBoughtKo:
          "버핏은 애플을 타의 추종을 불허하는 브랜드 충성도와 강력한 소비자 집착을 만드는 생태계를 갖춘 소비재 회사로 봅니다. 거대한 자유 현금 흐름을 창출하고 자사주 매입을 통해 자본을 환원합니다.",
      },
      {
        ticker: "AXP",
        company: "American Express",
        sector: "Financials",
        shares: 151610700,
        weight: 15.1,
        change: "Held",
        changePct: 0,
        whyTheyBoughtEn:
          "American Express has a unique closed-loop network and focuses on affluent customers who spend more and default less. Its brand is a moat — members pay premium fees for status and rewards.",
        whyTheyBoughtKo:
          "아메리칸 익스프레스는 독특한 폐쇄형 네트워크를 보유하고 더 많이 소비하고 덜 연체하는 부유한 고객에 집중합니다. 브랜드 자체가 해자입니다 — 회원들은 지위와 혜택을 위해 프리미엄 수수료를 기꺼이 냅니다.",
      },
      {
        ticker: "BAC",
        company: "Bank of America",
        sector: "Financials",
        shares: 680000000,
        weight: 11.3,
        change: "Sold",
        changePct: -12.1,
        whyTheyBoughtEn:
          "One of America's largest banks with massive scale advantages. Benefits from rising interest rates as a net interest income earner. Buffett invested heavily during the 2008-2011 financial crisis and built this position over time.",
        whyTheyBoughtKo:
          "거대한 규모 우위를 갖춘 미국 최대 은행 중 하나입니다. 순이자 수익 창출자로서 금리 상승의 혜택을 받습니다. 버핏은 2008-2011년 금융 위기 동안 대규모로 투자하여 이 포지션을 구축했습니다.",
      },
      {
        ticker: "KO",
        company: "Coca-Cola",
        sector: "Consumer Staples",
        shares: 400000000,
        weight: 8.7,
        change: "Held",
        changePct: 0,
        whyTheyBoughtEn:
          "Buffett's most iconic long-term holding since 1988. Coca-Cola has one of the world's most recognized brands, operates in 200+ countries, and generates consistent dividends. A masterclass in pricing power and global distribution.",
        whyTheyBoughtKo:
          "1988년부터 버핏의 가장 상징적인 장기 보유 종목입니다. 코카콜라는 세계에서 가장 인지도 높은 브랜드 중 하나로, 200개 이상의 국가에서 운영되며 지속적인 배당금을 창출합니다. 가격 결정력과 글로벌 유통의 교과서입니다.",
      },
      {
        ticker: "CVX",
        company: "Chevron Corp",
        sector: "Energy",
        shares: 118262602,
        weight: 5.2,
        change: "Sold",
        changePct: -8.3,
        whyTheyBoughtEn:
          "Major integrated oil company with global operations, strong cash generation, and attractive dividend yield. Buffett sees energy as essential infrastructure with Chevron's balance sheet strength as a key advantage.",
        whyTheyBoughtKo:
          "글로벌 운영, 강력한 현금 창출, 매력적인 배당 수익률을 갖춘 주요 통합 석유 회사입니다. 버핏은 에너지를 필수 인프라로 보며 셰브론의 탄탄한 재무상태표를 핵심 강점으로 봅니다.",
      },
      {
        ticker: "OXY",
        company: "Occidental Petroleum",
        sector: "Energy",
        shares: 264800000,
        weight: 6.2,
        change: "Bought",
        changePct: 4.8,
        whyTheyBoughtEn:
          "Buffett aggressively built this position starting in 2022. OXY has US onshore oil assets, chemical operations, and CEO Vicki Hollub's disciplined capital allocation. He also holds $10B in preferred shares from the 2019 Anadarko deal.",
        whyTheyBoughtKo:
          "버핏은 2022년부터 이 포지션을 공격적으로 구축했습니다. OXY는 미국 육상 석유 자산, 화학 사업을 보유하고 비키 홀럽 CEO의 규율 있는 자본 배분이 특징입니다. 2019년 아나다코 인수 당시 우선주 100억 달러도 보유합니다.",
      },
      {
        ticker: "MCO",
        company: "Moody's Corp",
        sector: "Financials",
        shares: 24669778,
        weight: 2.4,
        change: "Held",
        changePct: 0,
        whyTheyBoughtEn:
          "Moody's is the perfect Buffett business: massive switching costs (can't skip a credit rating), recurring revenue, near-zero capital requirements, and extraordinary returns on equity. A toll road on the global debt market.",
        whyTheyBoughtKo:
          "무디스는 버핏이 좋아하는 완벽한 사업입니다: 막대한 전환 비용(신용 평가 생략 불가), 반복 수익, 거의 제로에 가까운 자본 요구량, 탁월한 자기자본이익률. 글로벌 채권 시장의 유료 도로입니다.",
      },
      {
        ticker: "KHC",
        company: "Kraft Heinz",
        sector: "Consumer Staples",
        shares: 325634818,
        weight: 3.1,
        change: "Held",
        changePct: 0,
        whyTheyBoughtEn:
          "A challenged position — Buffett has admitted this was an overpayment. Despite iconic brands like Heinz ketchup and Velveeta, changing consumer tastes hurt the thesis. Demonstrates even Buffett makes mistakes.",
        whyTheyBoughtKo:
          "어려운 포지션입니다 — 버핏은 이것이 과지불이었음을 인정했습니다. 하인즈 케첩과 벨비타 같은 상징적인 브랜드에도 불구하고 변화하는 소비자 기호가 투자 논거를 약화시켰습니다. 버핏도 실수를 한다는 것을 보여줍니다.",
      },
      {
        ticker: "DVA",
        company: "DaVita Inc.",
        sector: "Healthcare",
        shares: 36095570,
        weight: 1.9,
        change: "Held",
        changePct: 0,
        whyTheyBoughtEn:
          "Kidney dialysis is a necessity — patients cannot skip treatment. DaVita runs the largest dialysis network in the US with predictable, recurring revenue. Classic defensive healthcare moat with inelastic demand.",
        whyTheyBoughtKo:
          "신장 투석은 필수입니다 — 환자들은 치료를 건너뛸 수 없습니다. 다비타는 미국 최대 투석 네트워크를 운영하며 예측 가능하고 반복적인 수익을 냅니다. 비탄력적 수요를 갖춘 전형적인 방어적 헬스케어 해자입니다.",
      },
      {
        ticker: "VRSN",
        company: "VeriSign Inc.",
        sector: "Communications",
        shares: 13259468,
        weight: 1.6,
        change: "Held",
        changePct: 0,
        whyTheyBoughtEn:
          "VeriSign owns the exclusive contract to manage .com and .net domain registries — a government-backed monopoly. Has pricing power, recurring revenues, and virtually no capital requirements. Perfect Buffett business model.",
        whyTheyBoughtKo:
          "베리사인은 .com 및 .net 도메인 레지스트리를 관리하는 독점 계약을 보유합니다 — 정부가 보장하는 독점입니다. 가격 결정력, 반복 수익, 거의 제로에 가까운 자본 요구량을 갖추었습니다. 완벽한 버핏 비즈니스 모델입니다.",
      },
    ],
  },

  {
    id: "dalio",
    name: "Ray Dalio",
    firm: "Bridgewater Associates",
    country: "US",
    aum: 124,
    aumUnit: "B",
    initials: "RD",
    avatarColor: "#7c3aed",
    biographyEn:
      "Ray Dalio founded Bridgewater Associates in his New York City apartment in 1975. It grew to become the world's largest hedge fund. His philosophy of 'radical transparency' and 'idea meritocracy' revolutionized hedge fund culture. Author of 'Principles' and 'The Changing World Order.'",
    biographyKo:
      "레이 달리오는 1975년 뉴욕 아파트에서 브리지워터 어소시에이츠를 창립했습니다. 세계 최대 헤지펀드로 성장했습니다. '극단적 투명성'과 '아이디어 능력주의' 철학으로 헤지펀드 문화에 혁명을 가져왔습니다. '원칙'과 '변화하는 세계 질서'의 저자입니다.",
    styleEn:
      "Global macro investing with a focus on 'All Weather' portfolio construction. Diversifies across asset classes to be resilient in all economic environments. Believes in understanding economic machine cycles and risk parity — balancing risk, not capital.",
    styleKo:
      "모든 경제 환경에서 탄력적인 '올웨더' 포트폴리오 구성에 초점을 맞춘 글로벌 매크로 투자. 자산 클래스 전반에 걸쳐 분산투자합니다. 경제 기계 사이클을 이해하고 리스크 패리티(자본이 아닌 리스크 균형)를 믿습니다.",
    styleTagsEn: ["Global Macro", "Risk Parity", "All Weather", "Diversification"],
    styleTagsKo: ["글로벌 매크로", "리스크 패리티", "올웨더", "분산투자"],
    lastUpdated: "Q3 2025",
    filingType: "13F Filing (SEC)",
    sectorAllocation: [
      { sector: "ETFs / Index", weight: 42.3, color: "#3b82f6" },
      { sector: "Emerging Markets", weight: 18.7, color: "#f59e0b" },
      { sector: "Consumer Staples", weight: 9.8, color: "#10b981" },
      { sector: "Healthcare", weight: 9.4, color: "#ef4444" },
      { sector: "Financials", weight: 8.2, color: "#8b5cf6" },
      { sector: "Gold / Commodities", weight: 7.6, color: "#f97316" },
      { sector: "Other", weight: 4.0, color: "#6b7280" },
    ],
    holdings: [
      {
        ticker: "SPY",
        company: "SPDR S&P 500 ETF",
        sector: "ETFs / Index",
        shares: 10200000,
        weight: 18.4,
        change: "Bought",
        changePct: 8.2,
        whyTheyBoughtEn:
          "Core broad market exposure. In Dalio's All Weather portfolio, US equities represent one leg of the risk parity framework — performing well in growth environments. SPY provides instant diversification with minimal cost.",
        whyTheyBoughtKo:
          "핵심 광범위 시장 노출. 달리오의 올웨더 포트폴리오에서 미국 주식은 리스크 패리티 프레임워크의 한 축을 대표합니다 — 성장 환경에서 좋은 성과를 냅니다. SPY는 최소한의 비용으로 즉각적인 분산을 제공합니다.",
      },
      {
        ticker: "EEM",
        company: "iShares MSCI Emerging Markets ETF",
        sector: "Emerging Markets",
        shares: 19800000,
        weight: 14.2,
        change: "Bought",
        changePct: 12.1,
        whyTheyBoughtEn:
          "Dalio is bullish on emerging markets, especially China and India, as global power shifts. EEM provides exposure to these growth economies with their younger populations and rising middle classes.",
        whyTheyBoughtKo:
          "달리오는 글로벌 권력 이동에 따라 특히 중국과 인도의 신흥시장에 대해 강세입니다. EEM은 더 젊은 인구와 증가하는 중산층을 가진 이러한 성장 경제에 대한 노출을 제공합니다.",
      },
      {
        ticker: "GLD",
        company: "SPDR Gold Shares ETF",
        sector: "Gold / Commodities",
        shares: 5600000,
        weight: 7.6,
        change: "Held",
        changePct: 0,
        whyTheyBoughtEn:
          "Gold is Dalio's inflation and currency debasement hedge. In his framework, gold performs when fiat currencies lose purchasing power. He famously said 'Cash is trash' and advocates gold as a store of value outside the financial system.",
        whyTheyBoughtKo:
          "금은 달리오의 인플레이션 및 통화 가치 하락 헤지입니다. 그의 프레임워크에서 금은 법정화폐가 구매력을 잃을 때 좋은 성과를 냅니다. '현금은 쓰레기다'라는 유명한 말을 남겼으며 금융 시스템 외부의 가치 저장 수단으로서 금을 지지합니다.",
      },
      {
        ticker: "IVV",
        company: "iShares Core S&P 500 ETF",
        sector: "ETFs / Index",
        shares: 4200000,
        weight: 9.7,
        change: "Held",
        changePct: 0,
        whyTheyBoughtEn:
          "Complementary to SPY, IVV provides additional US equity exposure. Bridgewater uses overlapping ETF positions as part of its risk-balanced approach, ensuring stable core equity allocation regardless of market cycles.",
        whyTheyBoughtKo:
          "SPY의 보완으로 IVV는 추가적인 미국 주식 노출을 제공합니다. 브리지워터는 리스크 균형 접근의 일환으로 중복 ETF 포지션을 사용하여 시장 사이클에 관계없이 안정적인 핵심 주식 배분을 보장합니다.",
      },
      {
        ticker: "PG",
        company: "Procter & Gamble",
        sector: "Consumer Staples",
        shares: 4800000,
        weight: 3.8,
        change: "Held",
        changePct: 0,
        whyTheyBoughtEn:
          "Consumer staples perform well during economic downturns. P&G is a defensive stalwart with brands like Tide, Gillette, and Pampers — products people buy regardless of economic conditions, making it a reliable All Weather component.",
        whyTheyBoughtKo:
          "소비자 필수품은 경기 침체 시 좋은 성과를 냅니다. P&G는 타이드, 질레트, 팸퍼스 같은 브랜드를 보유한 방어적 기업으로 — 경제 상황에 관계없이 사람들이 구매하는 제품으로 신뢰할 수 있는 올웨더 구성 요소입니다.",
      },
      {
        ticker: "JNJ",
        company: "Johnson & Johnson",
        sector: "Healthcare",
        shares: 3200000,
        weight: 4.2,
        change: "Bought",
        changePct: 3.5,
        whyTheyBoughtEn:
          "J&J is a healthcare conglomerate with pharmaceutical, medical device, and consumer health divisions. Its diversification within healthcare makes it a defensive holding that performs across economic cycles.",
        whyTheyBoughtKo:
          "J&J는 제약, 의료기기, 소비자 건강 부문을 갖춘 헬스케어 대기업입니다. 헬스케어 내의 다각화로 경제 사이클 전반에 걸쳐 성과를 내는 방어적 보유 종목입니다.",
      },
      {
        ticker: "VWO",
        company: "Vanguard FTSE Emerging Markets ETF",
        sector: "Emerging Markets",
        shares: 7800000,
        weight: 4.5,
        change: "Sold",
        changePct: -5.2,
        whyTheyBoughtEn:
          "VWO provides diversified emerging market exposure at low cost. Dalio views the rise of China and India as the key economic story of the next 20 years and maintains EM exposure as a structural position.",
        whyTheyBoughtKo:
          "VWO는 저비용으로 다각화된 신흥 시장 노출을 제공합니다. 달리오는 중국과 인도의 부상을 향후 20년의 핵심 경제 스토리로 보고 신흥시장 노출을 구조적 포지션으로 유지합니다.",
      },
      {
        ticker: "WMT",
        company: "Walmart Inc.",
        sector: "Consumer Staples",
        shares: 3500000,
        weight: 3.1,
        change: "New",
        changePct: null,
        whyTheyBoughtEn:
          "Walmart thrives during inflationary and deflationary environments as consumers trade down. Its e-commerce growth and market share gains in grocery make it a modern defensive holding with growth characteristics.",
        whyTheyBoughtKo:
          "월마트는 소비자들이 저렴한 선택을 하면서 인플레이션 및 디플레이션 환경 모두에서 번창합니다. 전자상거래 성장과 식료품 시장 점유율 확대로 성장 특성을 갖춘 현대적인 방어적 보유 종목입니다.",
      },
    ],
  },

  {
    id: "burry",
    name: "Michael Burry",
    firm: "Scion Asset Management",
    country: "US",
    aum: 0.36,
    aumUnit: "B",
    initials: "MB",
    avatarColor: "#dc2626",
    biographyEn:
      "Michael Burry became famous for his bet against the US housing market before the 2008 financial crisis — a trade immortalized in the book and film 'The Big Short.' A trained physician, he turned to investing by running a successful investment blog. He runs a concentrated, high-conviction portfolio.",
    biographyKo:
      "마이클 버리는 2008년 금융위기 전 미국 주택 시장에 대한 베팅으로 유명해졌습니다 — 책과 영화 '빅쇼트'에 불멸의 거래로 기록되었습니다. 훈련된 의사인 그는 성공적인 투자 블로그를 운영하며 투자로 전향했습니다. 집중적이고 확신에 찬 포트폴리오를 운용합니다.",
    styleEn:
      "Deep value contrarian investing. Finds assets priced well below intrinsic value, often in unpopular or misunderstood sectors. Known for macro short bets and concentrated stock picking. Highly secretive — rarely gives interviews.",
    styleKo:
      "심층 가치 역발상 투자. 종종 비인기적이거나 잘못 이해된 섹터에서 내재 가치보다 훨씬 낮게 가격이 매겨진 자산을 찾습니다. 매크로 공매도 베팅과 집중적 종목 선정으로 유명합니다. 매우 비밀스럽고 인터뷰를 거의 하지 않습니다.",
    styleTagsEn: ["Deep Value", "Contrarian", "Concentrated", "Short Selling"],
    styleTagsKo: ["심층 가치", "역발상", "집중 투자", "공매도"],
    lastUpdated: "Q3 2025",
    filingType: "13F Filing (SEC)",
    sectorAllocation: [
      { sector: "Technology", weight: 34.8, color: "#8b5cf6" },
      { sector: "Consumer Discretionary", weight: 28.2, color: "#f59e0b" },
      { sector: "Financials", weight: 19.6, color: "#3b82f6" },
      { sector: "Healthcare", weight: 11.4, color: "#ef4444" },
      { sector: "Other", weight: 6.0, color: "#6b7280" },
    ],
    holdings: [
      {
        ticker: "BABA",
        company: "Alibaba Group",
        sector: "Technology",
        shares: 250000,
        weight: 22.4,
        change: "Held",
        changePct: 0,
        whyTheyBoughtEn:
          "Burry sees Alibaba as deeply undervalued relative to its earnings power — trading at low single-digit P/E despite massive cash flows. Chinese regulatory pressure created what he viewed as a generational buying opportunity in a misunderstood asset.",
        whyTheyBoughtKo:
          "버리는 알리바바가 엄청난 현금 흐름에도 불구하고 한 자리 수 P/E에 거래되는 등 수익 창출 능력 대비 심각하게 저평가되어 있다고 봅니다. 중국의 규제 압박이 잘못 이해된 자산에서 세대를 넘는 매수 기회를 만들었다고 보았습니다.",
      },
      {
        ticker: "JD",
        company: "JD.com Inc.",
        sector: "Consumer Discretionary",
        shares: 500000,
        weight: 14.8,
        change: "Bought",
        changePct: 28.3,
        whyTheyBoughtEn:
          "JD.com operates its own logistics network, giving it structural cost advantages over competitors. At Burry's entry price, it traded at a fraction of its logistics infrastructure value alone. Significant insider ownership aligned interests.",
        whyTheyBoughtKo:
          "JD닷컴은 자체 물류 네트워크를 운영하여 경쟁사 대비 구조적 비용 우위를 갖습니다. 버리의 진입가에서 물류 인프라 가치만의 일부에 거래되었습니다. 높은 내부자 지분이 이해관계를 일치시킵니다.",
      },
      {
        ticker: "REAL",
        company: "The RealReal Inc.",
        sector: "Consumer Discretionary",
        shares: 3500000,
        weight: 8.4,
        change: "New",
        changePct: null,
        whyTheyBoughtEn:
          "Authenticated luxury resale marketplace with a defensible niche. Burry likely sees it as deeply discounted to its asset base and potential in the growing recommerce market. Classic contrarian play in an unloved sector.",
        whyTheyBoughtKo:
          "방어 가능한 틈새를 가진 정품 인증 럭셔리 재판매 마켓플레이스입니다. 버리는 자산 기반과 성장하는 리커머스 시장에서의 잠재력 대비 크게 할인된 가격으로 보았을 것입니다. 인기 없는 섹터의 전형적인 역발상 투자입니다.",
      },
      {
        ticker: "GEO",
        company: "GEO Group Inc.",
        sector: "Financials",
        shares: 1200000,
        weight: 9.6,
        change: "Bought",
        changePct: 15.7,
        whyTheyBoughtEn:
          "Private prison operator with government contracts providing stable recurring revenue. Heavily stigmatized by ESG concerns, driving the stock to what Burry views as severely undervalued levels. Classic value-in-unpopular-assets play.",
        whyTheyBoughtKo:
          "정부 계약으로 안정적인 반복 수익을 제공하는 민간 교도소 운영업체입니다. ESG 우려로 크게 낙인찍혀 주가가 버리가 심각하게 저평가된 수준으로 보는 수준으로 내려갔습니다. 인기 없는 자산의 전형적인 가치 투자입니다.",
      },
      {
        ticker: "HCA",
        company: "HCA Healthcare",
        sector: "Healthcare",
        shares: 180000,
        weight: 11.4,
        change: "Held",
        changePct: 0,
        whyTheyBoughtEn:
          "Largest US for-profit hospital chain with pricing power and scale advantages. Healthcare demand is inelastic. HCA benefits from aging US population demographics and consolidation in the hospital industry.",
        whyTheyBoughtKo:
          "가격 결정력과 규모의 경제를 갖춘 미국 최대 영리 병원 체인입니다. 헬스케어 수요는 비탄력적입니다. HCA는 미국 인구 고령화 추세와 병원 산업 통합의 혜택을 받습니다.",
      },
      {
        ticker: "FNMA",
        company: "Fannie Mae",
        sector: "Financials",
        shares: 3800000,
        weight: 10.0,
        change: "Sold",
        changePct: -20.0,
        whyTheyBoughtEn:
          "Speculative position on government-sponsored enterprise reform and potential re-privatization of Fannie Mae after years in conservatorship. High-risk, high-reward bet on regulatory and political outcomes.",
        whyTheyBoughtKo:
          "수년간의 정부 관리 후 정부보증기업 개혁과 패니매의 잠재적 재민영화에 대한 투기적 포지션입니다. 규제 및 정치적 결과에 대한 고위험 고수익 베팅입니다.",
      },
    ],
  },

  {
    id: "nps",
    name: "국민연금공단 (NPS)",
    firm: "National Pension Service",
    country: "KR",
    aum: 1100,
    aumUnit: "T₩",
    initials: "NP",
    avatarColor: "#059669",
    biographyEn:
      "South Korea's National Pension Service is one of the world's largest sovereign wealth and pension funds, managing over ₩1,100 trillion (approx. $850B USD) in assets as of 2025. Established in 1988, it covers over 22 million subscribers. Its investment decisions move Korean markets.",
    biographyKo:
      "한국 국민연금공단은 2025년 현재 1,100조 원(약 8,500억 달러) 이상의 자산을 운용하는 세계 최대 국부펀드 및 연금 펀드 중 하나입니다. 1988년 설립되어 2,200만 명 이상의 가입자를 보유합니다. 투자 결정이 한국 시장을 움직입니다.",
    styleEn:
      "Long-term institutional investor diversifying across domestic equities, foreign equities, bonds, and alternative assets. Domestic equity strategy focuses on Korean blue-chips, while overseas allocation targets global leaders. Acts as a 'market stabilizer' during crashes.",
    styleKo:
      "국내 주식, 해외 주식, 채권, 대체 자산에 걸쳐 분산 투자하는 장기 기관 투자자입니다. 국내 주식 전략은 한국 블루칩에 집중하며, 해외 배분은 글로벌 선도 기업을 대상으로 합니다. 폭락 시 '시장 안정자' 역할을 합니다.",
    styleTagsEn: ["Long-Term", "Diversified", "Institutional", "ESG-Aware"],
    styleTagsKo: ["장기 투자", "분산투자", "기관 투자", "ESG 고려"],
    lastUpdated: "Q3 2025",
    filingType: "공시 데이터 (Public Disclosure)",
    sectorAllocation: [
      { sector: "Technology", weight: 28.4, color: "#8b5cf6" },
      { sector: "Financials", weight: 18.7, color: "#3b82f6" },
      { sector: "Industrials", weight: 14.2, color: "#f59e0b" },
      { sector: "Consumer Discretionary", weight: 12.3, color: "#f97316" },
      { sector: "Materials", weight: 9.6, color: "#10b981" },
      { sector: "Healthcare", weight: 8.1, color: "#ef4444" },
      { sector: "Other", weight: 8.7, color: "#6b7280" },
    ],
    holdings: [
      {
        ticker: "005930.KS",
        company: "삼성전자 (Samsung Electronics)",
        sector: "Technology",
        shares: 500000000,
        weight: 18.2,
        change: "Held",
        changePct: 0,
        whyTheyBoughtEn:
          "Samsung is Korea's largest company and a global leader in memory chips (DRAM, NAND) and smartphones. NPS holds Samsung as a strategic national asset. The stock is a proxy for Korean export competitiveness and global tech demand.",
        whyTheyBoughtKo:
          "삼성은 한국 최대 기업이자 메모리 칩(DRAM, NAND)과 스마트폰의 글로벌 선도 기업입니다. 국민연금은 삼성을 전략적 국가 자산으로 보유합니다. 이 주식은 한국 수출 경쟁력과 글로벌 기술 수요의 대리 지표입니다.",
      },
      {
        ticker: "000660.KS",
        company: "SK하이닉스 (SK Hynix)",
        sector: "Technology",
        shares: 80000000,
        weight: 6.8,
        change: "Bought",
        changePct: 7.2,
        whyTheyBoughtEn:
          "SK Hynix is the world's second-largest memory chip maker, a key beneficiary of the AI revolution driving HBM (High Bandwidth Memory) demand. NPS increased holdings amid the AI boom as HBM chips are critical for NVIDIA's AI accelerators.",
        whyTheyBoughtKo:
          "SK하이닉스는 세계 2위 메모리 칩 제조업체로, HBM(고대역폭 메모리) 수요를 주도하는 AI 혁명의 핵심 수혜자입니다. 국민연금은 AI 붐 속에 HBM 칩이 엔비디아 AI 가속기에 필수적임에 따라 보유를 늘렸습니다.",
      },
      {
        ticker: "005380.KS",
        company: "현대자동차 (Hyundai Motor)",
        sector: "Consumer Discretionary",
        shares: 25000000,
        weight: 5.4,
        change: "Held",
        changePct: 0,
        whyTheyBoughtEn:
          "Hyundai has transformed from a budget carmaker to a global EV leader. Its Ioniq lineup competes directly with Tesla, and the Hyundai-Kia group now ranks among global EV sales leaders. NPS benefits from both dividend income and capital appreciation.",
        whyTheyBoughtKo:
          "현대자동차는 저가 자동차 제조업체에서 글로벌 EV 리더로 변신했습니다. 아이오닉 라인업은 테슬라와 직접 경쟁하며, 현대-기아 그룹은 이제 글로벌 EV 판매 상위권에 올랐습니다. 국민연금은 배당 수익과 자본 이득 모두에서 혜택을 받습니다.",
      },
      {
        ticker: "035420.KS",
        company: "NAVER Corp.",
        sector: "Technology",
        shares: 10000000,
        weight: 3.4,
        change: "Sold",
        changePct: -8.5,
        whyTheyBoughtEn:
          "NAVER is South Korea's dominant search engine and internet ecosystem, akin to Google in Korea. Its LINE messaging app, cloud services, webtoon platform, and e-commerce give it diversified revenue streams in Asia.",
        whyTheyBoughtKo:
          "네이버는 한국의 지배적인 검색 엔진 및 인터넷 생태계로 한국의 구글과 같습니다. 라인 메시징 앱, 클라우드 서비스, 웹툰 플랫폼, 전자상거래가 아시아에서 다각화된 수익원을 제공합니다.",
      },
      {
        ticker: "051910.KS",
        company: "LG화학 (LG Chem)",
        sector: "Materials",
        shares: 4500000,
        weight: 4.1,
        change: "Bought",
        changePct: 12.3,
        whyTheyBoughtEn:
          "LG Chem is a global leader in EV battery materials and chemicals. Through LG Energy Solution, it supplies batteries to GM, Stellantis, and others. Structural beneficiary of EV adoption worldwide.",
        whyTheyBoughtKo:
          "LG화학은 EV 배터리 소재 및 화학 분야의 글로벌 선도 기업입니다. LG에너지솔루션을 통해 GM, 스텔란티스 등에 배터리를 공급합니다. 전 세계 EV 채택의 구조적 수혜자입니다.",
      },
      {
        ticker: "AAPL",
        company: "Apple Inc.",
        sector: "Technology",
        shares: 15000000,
        weight: 4.8,
        change: "Held",
        changePct: 0,
        whyTheyBoughtEn:
          "NPS holds Apple as part of its overseas equity allocation targeting global market leaders. Apple's consistent earnings, dividend growth, and buybacks make it an ideal long-term institutional holding for a pension fund.",
        whyTheyBoughtKo:
          "국민연금은 글로벌 시장 선도 기업을 대상으로 하는 해외 주식 배분의 일환으로 애플을 보유합니다. 애플의 일관된 실적, 배당 성장, 자사주 매입이 연금 펀드의 이상적인 장기 기관 보유 종목으로 만듭니다.",
      },
      {
        ticker: "MSFT",
        company: "Microsoft Corp.",
        sector: "Technology",
        shares: 8000000,
        weight: 3.6,
        change: "Bought",
        changePct: 5.4,
        whyTheyBoughtEn:
          "Microsoft's leadership in cloud (Azure) and AI (OpenAI partnership) makes it a core overseas holding. NPS increased its position as Microsoft demonstrated sustained revenue growth from AI monetization through Copilot and Azure AI services.",
        whyTheyBoughtKo:
          "클라우드(Azure)와 AI(OpenAI 파트너십)에서의 마이크로소프트의 리더십이 핵심 해외 보유 종목으로 만듭니다. 국민연금은 마이크로소프트가 코파일럿과 Azure AI 서비스를 통한 AI 수익화에서 지속적인 매출 성장을 보임에 따라 포지션을 늘렸습니다.",
      },
      {
        ticker: "068270.KS",
        company: "셀트리온 (Celltrion)",
        sector: "Healthcare",
        shares: 15000000,
        weight: 3.8,
        change: "New",
        changePct: null,
        whyTheyBoughtEn:
          "Korea's leading biopharmaceutical company, specializing in biosimilars. With patents on many blockbuster biologics expiring, Celltrion's pipeline of biosimilars targeting global markets represents a significant growth opportunity.",
        whyTheyBoughtKo:
          "바이오시밀러를 전문으로 하는 한국 선도 바이오제약 회사입니다. 많은 블록버스터 바이오의약품의 특허가 만료됨에 따라 글로벌 시장을 겨냥한 셀트리온의 바이오시밀러 파이프라인이 상당한 성장 기회를 나타냅니다.",
      },
    ],
  },
];

export function getSuperInvestorById(id: string): SuperInvestor | undefined {
  return SUPER_INVESTORS.find((inv) => inv.id === id);
}
