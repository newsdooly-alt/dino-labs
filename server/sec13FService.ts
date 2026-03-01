/**
 * SEC EDGAR 13F Filing Service
 * Fetches real institutional holdings from the SEC EDGAR API (free, no key required)
 * CIK (Central Index Key) maps each fund to its SEC filer ID
 */

const EDGAR_SUBMISSIONS_URL = "https://data.sec.gov/submissions";
const EDGAR_ARCHIVES_URL = "https://www.sec.gov/Archives/edgar/data";
const USER_AGENT = "DinoInvest financial-education@dinoinvest.app";
const RATE_LIMIT_MS = 120; // ~8 req/sec (SEC allows 10/sec)

export interface Real13FHolding {
  rank: number;
  ticker: string;
  company: string;
  cusip: string;
  value: number;   // USD thousands
  shares: number;
  weight: number;  // percentage of total equity
  putCall: string; // "" | "Put" | "Call"
}

export interface Real13FData {
  investorId: string;
  cik: string;
  entityName: string;
  periodOfReport: string;  // e.g. "2024-12-31"
  filingDate: string;      // e.g. "2025-02-14"
  accessionNumber: string;
  totalValueUSD: number;   // in thousands USD
  holdingCount: number;    // total number of holdings in filing
  holdings: Real13FHolding[];
  fetchedAt: string;
  source: string;
}

// ─── CIK MAP ────────────────────────────────────────────────────────────────
// CIK must be padded to 10 digits when used in EDGAR URLs
export const INVESTOR_CIK_MAP: Record<string, string> = {
  buffett:       "0001067983", // Berkshire Hathaway Inc.
  klarman:       "0001113228", // Baupost Group LLC
  icahn:         "0000813762", // Icahn Capital Management LP
  einhorn:       "0001079114", // Greenlight Capital Inc.
  pabrai:        "0001168296", // Pabrai Investment Funds
  miller:        "0001647251", // Miller Value Partners LLC
  coleman:       "0001167483", // Tiger Global Management LLC
  wood:          "0001656792", // ARK Investment Management LLC
  dalio:         "0001350694", // Bridgewater Associates LP
  soros:         "0000866730", // Soros Fund Management LLC
  druckenmiller: "0001536411", // Duquesne Family Office LLC (confirmed by user)
  griffin:       "0001423298", // Citadel Advisors LLC
  englander:     "0001273931", // Millennium Management LLC
  burry:         "0001649339", // Scion Asset Management LLC
  simons:        "0001037389", // Renaissance Technologies LLC
  cohen:         "0001592106", // Point72 Asset Management LP
  ackman:        "0001336528", // Pershing Square Capital Management LP
  singer:        "0000941221", // Elliott Associates LP
  loeb:          "0001040273", // Third Point LLC
};

// ─── CUSIP → TICKER MAPPING ─────────────────────────────────────────────────
const CUSIP_TO_TICKER: Record<string, string> = {
  "037833100": "AAPL",  "594918104": "MSFT",  "023135106": "AMZN",
  "02079K107": "GOOGL", "02079K305": "GOOG",  "67066G104": "NVDA",
  "30303M102": "META",  "88160R101": "TSLA",  "09075V102": "BRK.B",
  "084670702": "BRK.B", "46625H100": "JPM",   "478160104": "JNJ",
  "92826C839": "V",     "57636Q104": "MA",    "025816109": "AXP",
  "091912108": "BAC",   "949746101": "WFC",   "38141G104": "GS",
  "617446448": "MS",    "166764100": "CVX",   "30231G102": "XOM",
  "64110L106": "NEE",   "220055402": "KO",    "713448108": "PEP",
  "931142103": "WMT",   "417766001": "HD",    "22160K105": "COST",
  "532457108": "LLY",   "002824100": "ABT",   "003670100": "ABBV",
  "780168103": "PFE",   "747525103": "QCOM",  "11135F101": "BRKR",
  "82811F105": "SIG",   "632307104": "NTRA",  // ← Natera (Druckenmiller #1)
  "G56866104": "MSCI",  "09258J100": "BLK",   "20030N101": "CMCSA",
  "126490100": "CVS",   "293850038": "ELV",   "382388102": "GE",
  "38150A105": "GS",    "78409V104": "CRM",   "817124108": "SHW",
  "824348106": "SQ",    "461202103": "INTU",  "826552101": "SNOW",
  "22788C105": "CRWD",  "81761W100": "SHOP",  "90353T100": "UBER",
  "726854104": "PLTR",  "40434L105": "HUM",   "418613108": "HCA",
  "G5494J103": "MDB",   "N25953101": "SMCI",  "693475105": "PNC",
  "742718109": "PRU",   "740816101": "PSA",   "345370860": "FI",
  "87165B103": "SYK",   "872540109": "TJX",   "891482102": "TMUS",
  "02079K107": "GOOGL", "67066G104": "NVDA",  "857477103": "STZ",
  "98975N109": "ZTS",   "171340102": "CHTR",  "50076Q106": "KVUE",
  "615975106": "MOS",   "45168D104": "IAMGOLD","067475104": "BABA",
  "23311P100": "DVN",   "55354G100": "MPC",   "92343V104": "VLO",
  "149123101": "CF",    "09857L108": "BNTX",  "585508104": "MEG",
  "G3223R108": "DKNG",  "25179M103": "DESK",  "98975N109": "ZTS",
  "81211K100": "SE",    "78464A301": "GLD",   "78464A870": "GLD",
  "002824100": "ABT",   "14448C104": "CARR",  "67421J108": "OXY",
  "690742101": "OXY",   "71375U101": "PH",    "71654V408": "PINS",
  "26614N102": "DRI",   "31791R102": "FIVE",  "353278103": "FR",
  "743315103": "PSX",   "68623V106": "ORLY",  "759916109": "RS",
  "86312B101": "STLD",  "88355L109": "TLRY",  "29081T102": "NVAX",
  "46120E602": "IRM",   "92345Y106": "VZ",    "192446102": "COF",
  "375558103": "GIB",   "52493T101": "LBRT",  "552953101": "MRK",
  "832696405": "SKX",   "74834L100": "QRVO",  "87612E106": "TGT",
  "023608102": "AMP",   "14040H105": "CAG",   "57060D108": "MDT",
  "844741104": "SW",    "756109104": "REGN",  "G5176H102": "MELI",
  "89417E109": "TSCO",  "125523100": "CI",    "30040W108": "F",
  "902973304": "UAL",   "74005P104": "PRGO",  "806407102": "SCHW",
  "69351T106": "PPL",   "29269F107": "ENIC",  "G3777B104": "GLPG",
  "25278X109": "DG",    "254709108": "DLTR",  "316206101": "FDX",
  "693830107": "NOC",   "655844108": "NOC",   "097023105": "BOX",
  "023586100": "AMD",   "11135F101": "BRKR",  "D1861V102": "AON",
  "N76280102": "QGEN",  "67716B106": "OBE",   "56585A102": "MANH",
  "46138E677": "IVV",   "464287655": "IWM",   "78462F103": "SPY",
  "46090E103": "VOO",   "922908769": "VTI",   "78463X107": "QQQ",
};

function cusipToTicker(cusip: string): string {
  return CUSIP_TO_TICKER[cusip] || "";
}

// ─── RATE LIMITING ───────────────────────────────────────────────────────────
let lastFetchTime = 0;
async function throttledFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastFetchTime);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchTime = Date.now();
  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "application/json, text/xml, */*",
    },
  });
}

// ─── IN-MEMORY CACHE ─────────────────────────────────────────────────────────
const cache = new Map<string, { data: Real13FData; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function getCached(investorId: string): Real13FData | null {
  const entry = cache.get(investorId);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(investorId);
    return null;
  }
  return entry.data;
}

function setCached(investorId: string, data: Real13FData): void {
  cache.set(investorId, { data, ts: Date.now() });
}

export function clearCache(): void {
  cache.clear();
}

// ─── XML PARSER ──────────────────────────────────────────────────────────────
interface RawInfoTable {
  nameOfIssuer: string;
  titleOfClass: string;
  cusip: string;
  value: number;
  shares: number;
  putCall: string;
}

function parseInfoTableXML(xml: string): RawInfoTable[] {
  const results: RawInfoTable[] = [];
  // Split by infoTable elements
  const blocks = xml.split(/<\/?infoTable>/i).filter((_, i) => i % 2 === 1);

  for (const block of blocks) {
    const getText = (tag: string): string => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i"));
      return m ? m[1].trim() : "";
    };

    const name = getText("nameOfIssuer");
    const cusip = getText("cusip");
    const valueStr = getText("value");
    const sharesStr = getText("sshPrnamt");
    const putCallStr = getText("putCall");

    if (!name || !cusip) continue;

    const value = parseInt(valueStr.replace(/,/g, ""), 10) || 0;
    const shares = parseInt(sharesStr.replace(/,/g, ""), 10) || 0;

    results.push({
      nameOfIssuer: name,
      titleOfClass: getText("titleOfClass"),
      cusip,
      value,
      shares,
      putCall: putCallStr || "",
    });
  }

  return results;
}

// ─── AGGREGATE HOLDINGS ──────────────────────────────────────────────────────
// Many funds report the same position multiple times with different share classes.
// Aggregate by CUSIP to get true position size.
function aggregateHoldings(raw: RawInfoTable[]): RawInfoTable[] {
  const map = new Map<string, RawInfoTable>();
  for (const h of raw) {
    const key = `${h.cusip}|${h.putCall}`;
    const existing = map.get(key);
    if (existing) {
      existing.value += h.value;
      existing.shares += h.shares;
    } else {
      map.set(key, { ...h });
    }
  }
  return Array.from(map.values());
}

// ─── CORE FETCH LOGIC ────────────────────────────────────────────────────────
interface SubmissionsRecent {
  accessionNumber: string[];
  filingDate: string[];
  reportDate: string[];
  form: string[];
  primaryDocument: string[];
}

async function fetchLatest13F(investorId: string, cik: string): Promise<Real13FData> {
  const paddedCik = cik.replace(/^0+/, "").padStart(10, "0");

  // Step 1: Get submissions
  const submissionsUrl = `${EDGAR_SUBMISSIONS_URL}/CIK${paddedCik}.json`;
  const submResp = await throttledFetch(submissionsUrl);
  if (!submResp.ok) {
    throw new Error(`EDGAR submissions fetch failed: ${submResp.status} for CIK ${cik}`);
  }
  const submData = await submResp.json() as {
    cik: string;
    name: string;
    filings: { recent: SubmissionsRecent; files?: { name: string }[] };
  };

  const recent = submData.filings.recent;
  const entityName = submData.name || "";

  // Step 2: Find most recent 13F-HR
  let filingIndex = -1;
  for (let i = 0; i < recent.form.length; i++) {
    if (recent.form[i] === "13F-HR" || recent.form[i] === "13F-HR/A") {
      filingIndex = i;
      break;
    }
  }

  // If not found in recent, check older files (for funds that don't file frequently)
  if (filingIndex === -1) {
    // Try older filings if available
    if (submData.filings.files && submData.filings.files.length > 0) {
      throw new Error(`13F-HR not found in recent filings for ${entityName} (${cik}). Fund may not file 13F.`);
    }
    throw new Error(`13F-HR not found in filings for ${entityName} (${cik})`);
  }

  const accessionRaw = recent.accessionNumber[filingIndex];   // "0001536411-25-000003"
  const filingDate = recent.filingDate[filingIndex];          // "2025-02-14"
  const periodOfReport = recent.reportDate[filingIndex];      // "2024-12-31"
  const primaryDoc = recent.primaryDocument[filingIndex];     // "form13fInfoTable.xml"

  const accessionNoDashes = accessionRaw.replace(/-/g, "");
  const cikNumeric = cik.replace(/^0+/, "");

  // Step 3: Try primary document first; if that's a summary, find the infotable
  let infoTableXml = "";
  const primaryUrl = `${EDGAR_ARCHIVES_URL}/${cikNumeric}/${accessionNoDashes}/${primaryDoc}`;

  await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  const primaryResp = await throttledFetch(primaryUrl);

  if (primaryResp.ok) {
    const text = await primaryResp.text();
    // Check if this is the infotable (contains <informationTable> or <infoTable>)
    if (text.toLowerCase().includes("infotable") || text.toLowerCase().includes("nameofissuer")) {
      infoTableXml = text;
    } else {
      // Primary doc is the cover page; need to fetch the index to find infotable
      const indexUrl = `${EDGAR_ARCHIVES_URL}/${cikNumeric}/${accessionNoDashes}/${accessionRaw}-index.json`;
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
      const idxResp = await throttledFetch(indexUrl);
      if (idxResp.ok) {
        const idxData = await idxResp.json() as { directory: { item: { name: string; type: string }[] } };
        const files = idxData.directory?.item || [];
        const infoTableFile = files.find(
          (f) => f.name.toLowerCase().includes("infotable") ||
                 f.name.toLowerCase().includes("13f") ||
                 f.type === "13F-HR" ||
                 f.name.toLowerCase().endsWith(".xml")
        );
        if (infoTableFile) {
          await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
          const xmlResp = await throttledFetch(`${EDGAR_ARCHIVES_URL}/${cikNumeric}/${accessionNoDashes}/${infoTableFile.name}`);
          if (xmlResp.ok) {
            infoTableXml = await xmlResp.text();
          }
        }
      }
    }
  }

  if (!infoTableXml) {
    throw new Error(`Could not fetch infotable XML for ${entityName} (${cik})`);
  }

  // Step 4: Parse and calculate
  const rawHoldings = parseInfoTableXML(infoTableXml);
  if (rawHoldings.length === 0) {
    throw new Error(`No holdings parsed from infotable XML for ${entityName}`);
  }

  const aggregated = aggregateHoldings(rawHoldings);

  // Sort by value descending
  aggregated.sort((a, b) => b.value - a.value);

  // Calculate total equity value
  const totalValue = aggregated.reduce((sum, h) => sum + h.value, 0);
  if (totalValue === 0) {
    throw new Error(`Total equity value is 0 for ${entityName}`);
  }

  // Take top 50 by value, calculate weights
  const top50 = aggregated.slice(0, 50);
  const holdings: Real13FHolding[] = top50.map((h, idx) => ({
    rank: idx + 1,
    ticker: cusipToTicker(h.cusip),
    company: toTitleCase(h.nameOfIssuer),
    cusip: h.cusip,
    value: h.value,
    shares: h.shares,
    weight: Math.round((h.value / totalValue) * 10000) / 100, // 2 decimal places
    putCall: h.putCall,
  }));

  return {
    investorId,
    cik,
    entityName,
    periodOfReport,
    filingDate,
    accessionNumber: accessionRaw,
    totalValueUSD: totalValue,
    holdingCount: aggregated.length,
    holdings,
    fetchedAt: new Date().toISOString(),
    source: `SEC EDGAR 13F-HR · CIK ${cik}`,
  };
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bInc\b/g, "Inc.")
    .replace(/\bLlc\b/g, "LLC")
    .replace(/\bCorp\b/g, "Corp.")
    .replace(/\bLtd\b/g, "Ltd.")
    .replace(/\bPlc\b/g, "PLC")
    .replace(/\bAdr\b/g, "ADR");
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
export async function get13FData(investorId: string): Promise<Real13FData> {
  // Check cache
  const cached = getCached(investorId);
  if (cached) return cached;

  const cik = INVESTOR_CIK_MAP[investorId];
  if (!cik) {
    throw new Error(`No CIK mapping for investor: ${investorId}`);
  }

  const data = await fetchLatest13F(investorId, cik);
  setCached(investorId, data);
  return data;
}

export function has13FData(investorId: string): boolean {
  return !!INVESTOR_CIK_MAP[investorId];
}
