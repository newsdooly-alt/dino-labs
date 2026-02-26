"""
Stock data service using yfinance.
Provides real-time quotes, batch quotes, stock search, and historical data.
No API key required.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
from datetime import datetime, timedelta
import pytz

app = Flask(__name__)
# CORS only needed if accessed from browser directly - we're proxying through Node
# Restrict to localhost only for security
CORS(app, origins=["http://localhost:5000", "http://127.0.0.1:5000"])

# US market timezone
US_EASTERN = pytz.timezone('America/New_York')
KST = pytz.timezone('Asia/Seoul')

def is_korean_ticker(symbol):
    """Check if a ticker is a Korean stock (.KS or .KQ suffix)."""
    s = symbol.upper()
    return s.endswith('.KS') or s.endswith('.KQ')

def is_market_open(symbol=None):
    """Check if stock market is currently open."""
    if symbol and is_korean_ticker(symbol):
        now = datetime.now(KST)
        if now.weekday() >= 5:
            return False
        market_open = now.replace(hour=9, minute=0, second=0, microsecond=0)
        market_close = now.replace(hour=15, minute=30, second=0, microsecond=0)
        return market_open <= now <= market_close
    now = datetime.now(US_EASTERN)
    if now.weekday() >= 5:
        return False
    market_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now.replace(hour=16, minute=0, second=0, microsecond=0)
    return market_open <= now <= market_close


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "yfinance-stock-service"})


@app.route('/quote/<path:symbol>', methods=['GET'])
def get_quote(symbol):
    """Get real-time quote for a single stock using fast_info for latest prices."""
    try:
        ticker = yf.Ticker(symbol.upper())
        is_kr = is_korean_ticker(symbol)
        market_open = is_market_open(symbol)
        now_tz = datetime.now(KST if is_kr else US_EASTERN)
        
        # Use fast_info for the most current price (less cached than .info)
        try:
            fast = ticker.fast_info
            price = float(fast.get('lastPrice', 0) or fast.get('regularMarketPrice', 0) or 0)
            prev_close = float(fast.get('previousClose', 0) or fast.get('regularMarketPreviousClose', 0) or price)
            market_cap = fast.get('marketCap', None)
        except Exception as e:
            print(f"[yfinance] fast_info failed for {symbol}, falling back to info: {e}")
            info = ticker.info
            price = info.get('regularMarketPrice') or info.get('currentPrice') or 0
            prev_close = info.get('previousClose') or info.get('regularMarketPreviousClose') or price
            market_cap = info.get('marketCap')
        
        # Get additional info for name and other details
        info = ticker.info
        
        # Calculate change
        change = price - prev_close if price and prev_close else 0
        change_percent = (change / prev_close * 100) if prev_close and prev_close != 0 else 0
        
        # Validate price is reasonable (not 0 or negative)
        if price <= 0:
            print(f"[yfinance] Warning: Invalid price {price} for {symbol}")
        
        time_label = 'KST' if is_kr else 'ET'
        region = 'South Korea' if is_kr else 'United States'
        native_currency = 'KRW' if is_kr else 'USD'
        
        return jsonify({
            "symbol": symbol.upper(),
            "name": info.get('shortName') or info.get('longName') or symbol.upper(),
            "price": round(float(price), 2),
            "change": round(float(change), 2),
            "changePercent": round(float(change_percent), 2),
            "previousClose": round(float(prev_close), 2),
            "open": info.get('regularMarketOpen') or info.get('open'),
            "high": info.get('regularMarketDayHigh') or info.get('dayHigh'),
            "low": info.get('regularMarketDayLow') or info.get('dayLow'),
            "volume": info.get('regularMarketVolume') or info.get('volume'),
            "marketCap": market_cap,
            "isMarketOpen": market_open,
            "region": region,
            "currency": native_currency,
            "isKorean": is_kr,
            "lastUpdated": now_tz.strftime('%Y-%m-%dT%H:%M:%S'),
            "lastUpdatedFormatted": now_tz.strftime(f'%I:%M %p {time_label}')
        })
    except Exception as e:
        print(f"[yfinance] Error in /quote/{symbol}: {e}")
        return jsonify({"error": str(e), "symbol": symbol}), 500


# Simple name cache to avoid repeated info calls
_name_cache = {}

@app.route('/quotes', methods=['GET'])
def get_batch_quotes():
    """Get quotes for multiple symbols at once using fast_info for real-time prices."""
    symbols_param = request.args.get('symbols', '')
    if not symbols_param:
        return jsonify({"error": "No symbols provided"}), 400
    
    symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
    
    if not symbols:
        return jsonify({"error": "No valid symbols provided"}), 400
    
    results = []
    now_et = datetime.now(US_EASTERN)
    now_kst = datetime.now(KST)
    us_market_open = is_market_open()
    
    has_kr = any(is_korean_ticker(s) for s in symbols)
    has_us = any(not is_korean_ticker(s) for s in symbols)
    
    print(f"[yfinance] Batch quotes request for: {symbols}, us_market_open={us_market_open}")
    
    for symbol in symbols:
        try:
            is_kr = is_korean_ticker(symbol)
            sym_market_open = is_market_open(symbol)
            ticker = yf.Ticker(symbol)
            price = 0
            prev_close = 0
            name = _name_cache.get(symbol, symbol)
            
            if is_kr and symbol in korean_stocks:
                name = f"{korean_stocks[symbol]['ko']} ({korean_stocks[symbol]['name']})"
                _name_cache[symbol] = name
            
            try:
                fast = ticker.fast_info
                price = float(fast.get('lastPrice', 0) or 0)
                if price == 0:
                    price = float(fast.get('regularMarketPrice', 0) or 0)
                prev_close = float(fast.get('previousClose', 0) or 0)
                
                if sym_market_open and price == prev_close and price > 0:
                    print(f"[yfinance] {symbol} Warning: price equals prev_close during market hours")
                
                print(f"[yfinance] {symbol} fast_info: price={price}, prev_close={prev_close}")
            except Exception as e:
                print(f"[yfinance] {symbol} fast_info failed: {e}")
                price = 0
                prev_close = 0
            
            if price > 0 and name == symbol:
                try:
                    info = ticker.info
                    fetched_name = info.get('shortName') or info.get('longName') or symbol
                    _name_cache[symbol] = fetched_name
                    name = fetched_name
                except Exception as e:
                    print(f"[yfinance] {symbol} info for name failed: {e}")
            
            change = price - prev_close if price > 0 and prev_close > 0 else 0
            change_percent = (change / prev_close * 100) if prev_close > 0 else 0
            
            is_stale = price <= 0
            if is_stale:
                print(f"[yfinance] Warning: {symbol} has invalid price={price}")
            
            if is_kr:
                time_str = now_kst.strftime('%I:%M %p KST')
                updated_str = now_kst.strftime('%Y-%m-%dT%H:%M:%S')
            else:
                time_str = now_et.strftime('%I:%M %p ET')
                updated_str = now_et.strftime('%Y-%m-%dT%H:%M:%S')
            
            results.append({
                "symbol": symbol,
                "name": name,
                "price": round(price, 2),
                "change": round(change, 2),
                "changePercent": round(change_percent, 2),
                "isMarketOpen": sym_market_open,
                "isStale": is_stale,
                "isKorean": is_kr,
                "currency": "KRW" if is_kr else "USD",
                "lastUpdated": updated_str,
                "lastUpdatedFormatted": time_str
            })
        except Exception as e:
            print(f"[yfinance] Error fetching {symbol}: {e}")
            is_kr = is_korean_ticker(symbol)
            results.append({
                "symbol": symbol,
                "name": _name_cache.get(symbol, symbol),
                "price": 0,
                "change": 0,
                "changePercent": 0,
                "isMarketOpen": is_market_open(symbol),
                "isStale": True,
                "isKorean": is_kr,
                "currency": "KRW" if is_kr else "USD",
                "error": str(e),
                "lastUpdated": now_et.strftime('%Y-%m-%dT%H:%M:%S'),
                "lastUpdatedFormatted": now_et.strftime('%I:%M %p ET')
            })
    
    print(f"[yfinance] Batch quotes complete: {len(results)} results")
    
    overall_market_open = us_market_open
    time_formatted = now_et.strftime('%I:%M %p ET')
    if has_kr and not has_us:
        overall_market_open = is_market_open(symbols[0])
        time_formatted = now_kst.strftime('%I:%M %p KST')
    
    return jsonify({
        "quotes": results,
        "isMarketOpen": overall_market_open,
        "fetchedAt": now_et.strftime('%Y-%m-%dT%H:%M:%S'),
        "fetchedAtFormatted": time_formatted
    })


korean_stocks = {
    '005930.KS': {'name': 'Samsung Electronics', 'ko': '삼성전자', 'market': 'KOSPI'},
    '000660.KS': {'name': 'SK Hynix', 'ko': 'SK하이닉스', 'market': 'KOSPI'},
    '373220.KS': {'name': 'LG Energy Solution', 'ko': 'LG에너지솔루션', 'market': 'KOSPI'},
    '207940.KS': {'name': 'Samsung Biologics', 'ko': '삼성바이오로직스', 'market': 'KOSPI'},
    '005380.KS': {'name': 'Hyundai Motor', 'ko': '현대자동차', 'market': 'KOSPI'},
    '000270.KS': {'name': 'Kia Corporation', 'ko': '기아', 'market': 'KOSPI'},
    '006400.KS': {'name': 'Samsung SDI', 'ko': '삼성SDI', 'market': 'KOSPI'},
    '051910.KS': {'name': 'LG Chem', 'ko': 'LG화학', 'market': 'KOSPI'},
    '035420.KS': {'name': 'NAVER Corp', 'ko': '네이버', 'market': 'KOSPI'},
    '035720.KS': {'name': 'Kakao Corp', 'ko': '카카오', 'market': 'KOSPI'},
    '068270.KS': {'name': 'Celltrion', 'ko': '셀트리온', 'market': 'KOSPI'},
    '105560.KS': {'name': 'KB Financial Group', 'ko': 'KB금융', 'market': 'KOSPI'},
    '055550.KS': {'name': 'Shinhan Financial Group', 'ko': '신한지주', 'market': 'KOSPI'},
    '066570.KS': {'name': 'LG Electronics', 'ko': 'LG전자', 'market': 'KOSPI'},
    '003670.KS': {'name': 'POSCO Holdings', 'ko': '포스코홀딩스', 'market': 'KOSPI'},
    '012330.KS': {'name': 'Hyundai Mobis', 'ko': '현대모비스', 'market': 'KOSPI'},
    '028260.KS': {'name': 'Samsung C&T', 'ko': '삼성물산', 'market': 'KOSPI'},
    '034730.KS': {'name': 'SK Inc', 'ko': 'SK', 'market': 'KOSPI'},
    '003550.KS': {'name': 'LG Corp', 'ko': 'LG', 'market': 'KOSPI'},
    '096770.KS': {'name': 'SK Innovation', 'ko': 'SK이노베이션', 'market': 'KOSPI'},
    '030200.KS': {'name': 'KT Corp', 'ko': 'KT', 'market': 'KOSPI'},
    '017670.KS': {'name': 'SK Telecom', 'ko': 'SK텔레콤', 'market': 'KOSPI'},
    '032830.KS': {'name': 'Samsung Life Insurance', 'ko': '삼성생명', 'market': 'KOSPI'},
    '009150.KS': {'name': 'Samsung Electro-Mechanics', 'ko': '삼성전기', 'market': 'KOSPI'},
    '018260.KS': {'name': 'Samsung SDS', 'ko': '삼성SDS', 'market': 'KOSPI'},
    '247540.KS': {'name': 'Ecopro BM', 'ko': '에코프로비엠', 'market': 'KOSPI'},
    '086520.KS': {'name': 'Ecopro', 'ko': '에코프로', 'market': 'KOSPI'},
    '352820.KS': {'name': 'Hive Co', 'ko': '하이브', 'market': 'KOSPI'},
    '259960.KS': {'name': 'Krafton Inc', 'ko': '크래프톤', 'market': 'KOSPI'},
    '036570.KS': {'name': 'NCsoft Corp', 'ko': '엔씨소프트', 'market': 'KOSPI'},
    '263750.KQ': {'name': 'Pearl Abyss', 'ko': '펄어비스', 'market': 'KOSDAQ'},
    '293490.KQ': {'name': 'Kakao Games', 'ko': '카카오게임즈', 'market': 'KOSDAQ'},
    '041510.KQ': {'name': 'SM Entertainment', 'ko': 'SM', 'market': 'KOSDAQ'},
    '122870.KQ': {'name': 'YG Entertainment', 'ko': 'YG엔터테인먼트', 'market': 'KOSDAQ'},
    '352820.KQ': {'name': 'JYP Entertainment', 'ko': 'JYP엔터테인먼트', 'market': 'KOSDAQ'},
}

korean_aliases = {
    '삼전': '005930.KS',
    '삼성': '005930.KS',
    '하닉': '000660.KS',
    '하이닉스': '000660.KS',
    '현대차': '005380.KS',
    '현차': '005380.KS',
    '기아차': '000270.KS',
    '엘지화학': '051910.KS',
    '엘지전자': '066570.KS',
    '엘지에너지': '373220.KS',
    '삼바': '207940.KS',
    '삼성바이오': '207940.KS',
    '카카오게임': '293490.KQ',
    '포스코': '003670.KS',
    '현대모비': '012330.KS',
    '삼성물': '028260.KS',
    '에코프로': '086520.KS',
}

korean_name_map = {}
for sym, info in korean_stocks.items():
    korean_name_map[info['ko'].upper()] = sym
    korean_name_map[info['name'].upper()] = sym
    num = sym.split('.')[0]
    korean_name_map[num] = sym

for alias, sym in korean_aliases.items():
    korean_name_map[alias.upper()] = sym

@app.route('/search', methods=['GET'])
def search_stocks():
    """Search for stocks by symbol or name (US and Korean)."""
    raw_query = request.args.get('q', '').strip()
    try:
        raw_query = raw_query.encode('latin-1').decode('utf-8')
    except (UnicodeDecodeError, UnicodeEncodeError):
        pass
    query = raw_query.upper()
    if not query or len(query) < 1:
        return jsonify({"results": []})
    
    results = []
    added_symbols = set()
    
    alias_match = korean_name_map.get(raw_query.upper())
    if alias_match and alias_match in korean_stocks:
        info = korean_stocks[alias_match]
        results.append({
            "symbol": alias_match,
            "name": f"{info['ko']} ({info['name']})",
            "type": "Equity",
            "region": "South Korea",
            "market": info['market'],
            "currency": "KRW",
            "isKorean": True,
        })
        added_symbols.add(alias_match)
    
    for sym, info in korean_stocks.items():
        if sym in added_symbols:
            continue
        ko_name = info['ko']
        en_name = info['name']
        num = sym.split('.')[0]
        if (raw_query in ko_name or raw_query.upper() in ko_name.upper() or
            query in en_name.upper() or query in sym or query == num):
            results.append({
                "symbol": sym,
                "name": f"{ko_name} ({en_name})",
                "type": "Equity",
                "region": "South Korea",
                "market": info['market'],
                "currency": "KRW",
                "isKorean": True,
            })
            added_symbols.add(sym)
            if len(results) >= 10:
                return jsonify({"results": results})
    
    popular_stocks = {
        'AAPL': 'Apple Inc.',
        'MSFT': 'Microsoft Corporation',
        'GOOGL': 'Alphabet Inc.',
        'GOOG': 'Alphabet Inc. Class C',
        'AMZN': 'Amazon.com Inc.',
        'NVDA': 'NVIDIA Corporation',
        'META': 'Meta Platforms Inc.',
        'TSLA': 'Tesla Inc.',
        'BRK.B': 'Berkshire Hathaway Inc.',
        'JPM': 'JPMorgan Chase & Co.',
        'V': 'Visa Inc.',
        'UNH': 'UnitedHealth Group Inc.',
        'JNJ': 'Johnson & Johnson',
        'WMT': 'Walmart Inc.',
        'MA': 'Mastercard Inc.',
        'PG': 'Procter & Gamble Co.',
        'HD': 'The Home Depot Inc.',
        'CVX': 'Chevron Corporation',
        'MRK': 'Merck & Co. Inc.',
        'ABBV': 'AbbVie Inc.',
        'KO': 'The Coca-Cola Company',
        'PEP': 'PepsiCo Inc.',
        'COST': 'Costco Wholesale Corporation',
        'TMO': 'Thermo Fisher Scientific Inc.',
        'AVGO': 'Broadcom Inc.',
        'MCD': 'McDonald\'s Corporation',
        'CSCO': 'Cisco Systems Inc.',
        'ACN': 'Accenture plc',
        'ABT': 'Abbott Laboratories',
        'DHR': 'Danaher Corporation',
        'NEE': 'NextEra Energy Inc.',
        'LIN': 'Linde plc',
        'TXN': 'Texas Instruments Inc.',
        'ADBE': 'Adobe Inc.',
        'CRM': 'Salesforce Inc.',
        'AMD': 'Advanced Micro Devices Inc.',
        'NFLX': 'Netflix Inc.',
        'INTC': 'Intel Corporation',
        'QCOM': 'QUALCOMM Inc.',
        'BA': 'The Boeing Company',
        'DIS': 'The Walt Disney Company',
        'NKE': 'NIKE Inc.',
        'PYPL': 'PayPal Holdings Inc.',
        'SPY': 'SPDR S&P 500 ETF Trust',
        'QQQ': 'Invesco QQQ Trust',
        'DIA': 'SPDR Dow Jones Industrial Average ETF',
        'IWM': 'iShares Russell 2000 ETF',
        'VTI': 'Vanguard Total Stock Market ETF',
        'VOO': 'Vanguard S&P 500 ETF',
        'COIN': 'Coinbase Global Inc.',
        'SQ': 'Block Inc.',
        'SHOP': 'Shopify Inc.',
        'PLTR': 'Palantir Technologies Inc.',
        'UBER': 'Uber Technologies Inc.',
        'LYFT': 'Lyft Inc.',
        'SNAP': 'Snap Inc.',
        'PINS': 'Pinterest Inc.',
        'ROKU': 'Roku Inc.',
        'ZM': 'Zoom Video Communications Inc.',
        'DOCU': 'DocuSign Inc.',
        'CRWD': 'CrowdStrike Holdings Inc.',
        'NET': 'Cloudflare Inc.',
        'SNOW': 'Snowflake Inc.',
        'DDOG': 'Datadog Inc.',
        'TEAM': 'Atlassian Corporation',
        'WDAY': 'Workday Inc.',
        'NOW': 'ServiceNow Inc.',
        'PANW': 'Palo Alto Networks Inc.',
        'ZS': 'Zscaler Inc.',
        'OKTA': 'Okta Inc.',
        'MDB': 'MongoDB Inc.',
        'TWLO': 'Twilio Inc.',
        'U': 'Unity Software Inc.',
        'RBLX': 'Roblox Corporation',
        'ABNB': 'Airbnb Inc.',
        'DASH': 'DoorDash Inc.',
        'RIVN': 'Rivian Automotive Inc.',
        'LCID': 'Lucid Group Inc.',
        'F': 'Ford Motor Company',
        'GM': 'General Motors Company',
        'T': 'AT&T Inc.',
        'VZ': 'Verizon Communications Inc.',
        'TMUS': 'T-Mobile US Inc.',
    }
    
    # First, check if query matches a symbol exactly
    if query in popular_stocks:
        results.append({
            "symbol": query,
            "name": popular_stocks[query],
            "type": "Equity",
            "region": "United States"
        })
    
    # Then find partial matches
    for symbol, name in popular_stocks.items():
        if symbol == query:
            continue  # Already added
        if query in symbol or query.lower() in name.lower():
            results.append({
                "symbol": symbol,
                "name": name,
                "type": "Equity",
                "region": "United States"
            })
            if len(results) >= 10:
                break
    
    # If no matches found, try direct yfinance lookup
    if not results:
        lookup_symbols = []
        if len(query) <= 5 and query.isalpha():
            lookup_symbols.append(query)
        if query.endswith('.KS') or query.endswith('.KQ'):
            lookup_symbols.append(query)
        elif query.isdigit() and len(query) == 6:
            lookup_symbols.extend([f"{query}.KS", f"{query}.KQ"])
        
        for sym in lookup_symbols:
            try:
                ticker = yf.Ticker(sym)
                info = ticker.info
                name = info.get('shortName') or info.get('longName')
                if name:
                    is_kr = is_korean_ticker(sym)
                    results.append({
                        "symbol": sym,
                        "name": name,
                        "type": info.get('quoteType', 'Equity'),
                        "region": "South Korea" if is_kr else "United States",
                        "currency": "KRW" if is_kr else "USD",
                        "isKorean": is_kr,
                    })
                    break
            except:
                pass
    
    return jsonify({"results": results[:10]})


@app.route('/history/<path:symbol>', methods=['GET'])
def get_history(symbol):
    """Get historical price data for charts."""
    period = request.args.get('period', '1mo')
    interval = request.args.get('interval', '1d')
    
    try:
        ticker = yf.Ticker(symbol.upper())
        hist = ticker.history(period=period, interval=interval)
        
        if hist.empty:
            return jsonify({"error": "No historical data found", "symbol": symbol}), 404
        
        # Convert to list of data points
        data = []
        for date, row in hist.iterrows():
            data.append({
                "date": date.isoformat(),
                "open": round(row['Open'], 2),
                "high": round(row['High'], 2),
                "low": round(row['Low'], 2),
                "close": round(row['Close'], 2),
                "volume": int(row['Volume']) if not pd.isna(row['Volume']) else 0
            })
        
        return jsonify({
            "symbol": symbol.upper(),
            "period": period,
            "interval": interval,
            "data": data,
            "count": len(data)
        })
    except Exception as e:
        return jsonify({"error": str(e), "symbol": symbol}), 500


def _normalize_dividend_yield(info):
    """Normalize dividend yield to a standard decimal (e.g. 0.004 = 0.4%).
    
    yfinance returns dividendYield as a percentage (0.4 means 0.4%),
    while trailingAnnualDividendYield is already a decimal (0.00374 means 0.374%).
    We standardize to decimal so the frontend can simply do (value * 100) for display.
    """
    raw = info.get('dividendYield')
    if raw is not None and raw > 0:
        return round(raw / 100, 6)
    trailing = info.get('trailingAnnualDividendYield')
    if trailing is not None and trailing > 0:
        return round(trailing, 6)
    return None


@app.route('/info/<path:symbol>', methods=['GET'])
def get_info(symbol):
    """Get detailed stock information."""
    try:
        ticker = yf.Ticker(symbol.upper())
        info = ticker.info
        is_kr = is_korean_ticker(symbol)
        
        result = {
            "symbol": symbol.upper(),
            "name": info.get('shortName') or info.get('longName'),
            "sector": info.get('sector'),
            "industry": info.get('industry'),
            "description": info.get('longBusinessSummary'),
            "website": info.get('website'),
            "marketCap": info.get('marketCap'),
            "peRatio": info.get('trailingPE'),
            "forwardPE": info.get('forwardPE'),
            "eps": info.get('trailingEps'),
            "dividendYield": _normalize_dividend_yield(info),
            "52WeekHigh": info.get('fiftyTwoWeekHigh'),
            "52WeekLow": info.get('fiftyTwoWeekLow'),
            "avgVolume": info.get('averageVolume'),
            "beta": info.get('beta'),
            "pbRatio": info.get('priceToBook'),
            "region": 'South Korea' if is_kr else 'United States',
            "currency": 'KRW' if is_kr else 'USD',
            "isKorean": is_kr,
        }
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e), "symbol": symbol}), 500


@app.route('/fear-greed', methods=['GET'])
def get_fear_greed():
    """Fetch CNN Fear & Greed Index from production endpoint."""
    try:
        import requests as req
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        url = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata/'
        resp = req.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        
        fg = data.get('fear_and_greed', {})
        score = fg.get('score', 50)
        rating = fg.get('rating', 'Neutral')
        previous_close = fg.get('previous_close', score)
        previous_1_week = fg.get('previous_1_week', score)
        previous_1_month = fg.get('previous_1_month', score)
        
        return jsonify({
            "score": round(score),
            "rating": rating,
            "previous_close": round(previous_close) if previous_close else None,
            "previous_1_week": round(previous_1_week) if previous_1_week else None,
            "previous_1_month": round(previous_1_month) if previous_1_month else None,
            "source": "cnn"
        })
    except Exception as e:
        print(f"[Fear & Greed] CNN fetch failed: {e}")
        return jsonify({"error": str(e), "score": None}), 500


# Need pandas for history endpoint
import pandas as pd


@app.route('/news', methods=['GET'])
def get_market_news():
    """Get latest market news from major tickers."""
    try:
        # Get news from major market ETFs and stocks
        tickers_for_news = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA']
        all_news = []
        seen_titles = set()
        
        for symbol in tickers_for_news:
            try:
                ticker = yf.Ticker(symbol)
                news = ticker.news
                
                if news:
                    for item in news[:3]:  # Get top 3 from each
                        # Handle both old and new yfinance news structure
                        content = item.get('content', item)
                        title = content.get('title', item.get('title', ''))
                        
                        if title and title not in seen_titles:
                            seen_titles.add(title)
                            
                            # Get thumbnail URL from either structure
                            thumbnail_url = None
                            if content.get('thumbnail'):
                                resolutions = content.get('thumbnail', {}).get('resolutions', [])
                                if resolutions:
                                    # Prefer smaller resolution for faster loading
                                    thumbnail_url = resolutions[-1].get('url') if len(resolutions) > 1 else resolutions[0].get('url')
                            elif item.get('thumbnail'):
                                resolutions = item.get('thumbnail', {}).get('resolutions', [])
                                if resolutions:
                                    thumbnail_url = resolutions[0].get('url')
                            
                            # Get link from either structure
                            link = ''
                            if content.get('canonicalUrl'):
                                link = content.get('canonicalUrl', {}).get('url', '')
                            elif content.get('clickThroughUrl'):
                                link = content.get('clickThroughUrl', {}).get('url', '')
                            else:
                                link = item.get('link', '')
                            
                            # Get publisher from either structure
                            publisher = 'Unknown'
                            if content.get('provider'):
                                publisher = content.get('provider', {}).get('displayName', 'Unknown')
                            else:
                                publisher = item.get('publisher', 'Unknown')
                            
                            # Get publish time - try multiple fields
                            pub_time = 0
                            if content.get('pubDate'):
                                try:
                                    from dateutil import parser
                                    pub_time = int(parser.parse(content.get('pubDate')).timestamp())
                                except:
                                    pub_time = item.get('providerPublishTime', 0)
                            else:
                                pub_time = item.get('providerPublishTime', 0)
                            
                            all_news.append({
                                "title": title,
                                "publisher": publisher,
                                "link": link,
                                "publishedAt": pub_time,
                                "relatedSymbol": symbol,
                                "thumbnail": thumbnail_url
                            })
            except Exception as e:
                print(f"Error fetching news for {symbol}: {e}")
                continue
        
        # Sort by publish time (newest first) and limit to 10
        all_news.sort(key=lambda x: x['publishedAt'], reverse=True)
        all_news = all_news[:10]
        
        return jsonify({
            "news": all_news,
            "count": len(all_news),
            "fetchedAt": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e), "news": []}), 500


@app.route('/news/<symbol>', methods=['GET'])
def get_stock_news(symbol):
    """Get news for a specific stock."""
    try:
        ticker = yf.Ticker(symbol.upper())
        news = ticker.news
        
        if not news:
            return jsonify({"news": [], "count": 0, "symbol": symbol.upper()})
        
        stock_news = []
        for item in news[:5]:
            content = item.get('content', item)
            title = content.get('title', item.get('title', ''))
            
            if title:
                thumbnail_url = None
                if content.get('thumbnail'):
                    resolutions = content.get('thumbnail', {}).get('resolutions', [])
                    if resolutions:
                        thumbnail_url = resolutions[-1].get('url') if len(resolutions) > 1 else resolutions[0].get('url')
                elif item.get('thumbnail'):
                    resolutions = item.get('thumbnail', {}).get('resolutions', [])
                    if resolutions:
                        thumbnail_url = resolutions[0].get('url')
                
                link = ''
                if content.get('canonicalUrl'):
                    link = content.get('canonicalUrl', {}).get('url', '')
                elif content.get('clickThroughUrl'):
                    link = content.get('clickThroughUrl', {}).get('url', '')
                else:
                    link = item.get('link', '')
                
                publisher = 'Unknown'
                if content.get('provider'):
                    publisher = content.get('provider', {}).get('displayName', 'Unknown')
                else:
                    publisher = item.get('publisher', 'Unknown')
                
                pub_time = 0
                if content.get('pubDate'):
                    try:
                        from dateutil import parser
                        pub_time = int(parser.parse(content.get('pubDate')).timestamp())
                    except:
                        pub_time = item.get('providerPublishTime', 0)
                else:
                    pub_time = item.get('providerPublishTime', 0)
                
                stock_news.append({
                    "title": title,
                    "publisher": publisher,
                    "link": link,
                    "publishedAt": pub_time,
                    "relatedSymbol": symbol.upper(),
                    "thumbnail": thumbnail_url
                })
        
        return jsonify({
            "news": stock_news,
            "count": len(stock_news),
            "symbol": symbol.upper()
        })
    except Exception as e:
        return jsonify({"error": str(e), "news": [], "symbol": symbol}), 500


_recommended_cache = {"data": None, "timestamp": 0}
RECOMMENDED_CACHE_DURATION = 1800

@app.route('/recommended', methods=['GET'])
def get_recommended_stocks():
    """Get recommended stocks based on high volume and price momentum from US and KR markets."""
    import time
    now = time.time()
    if _recommended_cache["data"] and (now - _recommended_cache["timestamp"]) < RECOMMENDED_CACHE_DURATION:
        return jsonify(_recommended_cache["data"])

    try:
        us_symbols = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "AMD", "NFLX", "AVGO",
                       "JPM", "V", "MA", "WMT", "UNH", "LLY", "XOM", "PG", "JNJ", "COST"]
        kr_symbols = ["005930.KS", "000660.KS", "373220.KS", "035420.KS", "035720.KS",
                       "068270.KS", "051910.KS", "006400.KS", "003670.KS", "207940.KS"]

        all_symbols = us_symbols + kr_symbols
        results = []

        for symbol in all_symbols:
            try:
                ticker = yf.Ticker(symbol)
                fast = ticker.fast_info
                info = ticker.info

                price = float(fast.get('lastPrice', 0) or fast.get('regularMarketPrice', 0) or 0)
                prev_close = float(fast.get('previousClose', 0) or fast.get('regularMarketPreviousClose', 0) or price)
                volume = int(info.get('regularMarketVolume', 0) or info.get('volume', 0) or 0)
                avg_volume = int(info.get('averageVolume', 0) or info.get('averageDailyVolume10Day', 0) or 1)

                if price <= 0 or volume <= 0:
                    continue

                change = price - prev_close if prev_close else 0
                change_pct = (change / prev_close * 100) if prev_close and prev_close != 0 else 0
                volume_ratio = volume / avg_volume if avg_volume > 0 else 1.0

                is_kr = is_korean_ticker(symbol)

                results.append({
                    "symbol": symbol.upper(),
                    "name": info.get('shortName') or info.get('longName') or symbol.upper(),
                    "price": round(float(price), 2),
                    "change": round(float(change), 2),
                    "changePercent": round(float(change_pct), 2),
                    "volume": volume,
                    "avgVolume": avg_volume,
                    "volumeRatio": round(volume_ratio, 2),
                    "marketCap": fast.get('marketCap'),
                    "isKorean": is_kr,
                    "currency": 'KRW' if is_kr else 'USD',
                })
            except Exception as e:
                print(f"[yfinance] Recommended skip {symbol}: {e}")
                continue

        results.sort(key=lambda x: x['volumeRatio'], reverse=True)
        top_picks = results[:10]

        response = {"recommended": top_picks, "count": len(top_picks)}
        _recommended_cache["data"] = response
        _recommended_cache["timestamp"] = now

        return jsonify(response)
    except Exception as e:
        print(f"[yfinance] Error in /recommended: {e}")
        return jsonify({"error": str(e), "recommended": []}), 500


_macro_quotes_cache = {}
MACRO_QUOTES_CACHE_DURATION = 55

@app.route('/macro/quotes', methods=['GET'])
def get_macro_quotes():
    """Dedicated fast endpoint for macro instrument quotes (futures, bonds, forex, crypto)."""
    import time
    now = time.time()

    symbols_param = request.args.get('symbols', '')
    cache_key = symbols_param.strip()
    if cache_key in _macro_quotes_cache:
        entry = _macro_quotes_cache[cache_key]
        if entry["data"] and (now - entry["timestamp"]) < MACRO_QUOTES_CACHE_DURATION:
            return jsonify(entry["data"])
    if not symbols_param:
        return jsonify({"error": "No symbols provided"}), 400

    symbols = [s.strip() for s in symbols_param.split(',') if s.strip()]
    results = []
    now_et = datetime.now(US_EASTERN)
    us_market_open = is_market_open()

    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            price = 0.0
            prev_close = 0.0
            name = symbol

            try:
                fast = ticker.fast_info
                price = float(fast.get('lastPrice', 0) or 0)
                if price == 0:
                    price = float(fast.get('regularMarketPrice', 0) or 0)
                prev_close = float(fast.get('previousClose', 0) or 0)
                if prev_close == 0:
                    prev_close = float(fast.get('regularMarketPreviousClose', 0) or price)
                print(f"[macro] {symbol}: price={price}, prev_close={prev_close}")
            except Exception as e:
                print(f"[macro] {symbol} fast_info failed: {e}")
                price = 0.0
                prev_close = 0.0

            if price > 0 and name == symbol:
                try:
                    info = ticker.info
                    name = info.get('shortName') or info.get('longName') or symbol
                except Exception:
                    pass

            change = price - prev_close if price > 0 and prev_close > 0 else 0
            change_pct = (change / prev_close * 100) if prev_close > 0 else 0

            results.append({
                "symbol": symbol,
                "name": name,
                "price": round(price, 4),
                "change": round(change, 4),
                "changePercent": round(change_pct, 4),
                "isMarketOpen": us_market_open,
                "isStale": price <= 0,
                "lastUpdated": now_et.strftime('%Y-%m-%dT%H:%M:%S'),
                "lastUpdatedFormatted": now_et.strftime('%I:%M %p ET'),
            })
        except Exception as e:
            print(f"[macro] Error for {symbol}: {e}")
            results.append({
                "symbol": symbol,
                "name": symbol,
                "price": 0,
                "change": 0,
                "changePercent": 0,
                "isMarketOpen": us_market_open,
                "isStale": True,
                "lastUpdated": now_et.strftime('%Y-%m-%dT%H:%M:%S'),
                "lastUpdatedFormatted": now_et.strftime('%I:%M %p ET'),
                "error": str(e),
            })

    response = {
        "quotes": results,
        "fetchedAt": now_et.strftime('%Y-%m-%dT%H:%M:%S'),
        "fetchedAtFormatted": now_et.strftime('%I:%M %p ET'),
        "isMarketOpen": us_market_open,
    }
    _macro_quotes_cache[cache_key] = {"data": response, "timestamp": now}
    return jsonify(response)


_rrg_cache = {"data": None, "timestamp": 0}
RRG_CACHE_DURATION = 300  # 5 minutes - daily data doesn't change often

@app.route('/rrg/data', methods=['GET'])
def get_rrg_data():
    """Compute RRG (Relative Rotation Graph) data for US sector ETFs vs SPY benchmark."""
    import time
    now = time.time()
    if _rrg_cache["data"] and (now - _rrg_cache["timestamp"]) < RRG_CACHE_DURATION:
        return jsonify(_rrg_cache["data"])

    benchmark = request.args.get('benchmark', 'SPY')
    sectors_param = request.args.get('sectors', 'XLK,XLF,XLV,XLE,XLY,XLP,XLI,XLB,XLRE,XLU,XLC')
    tail_length = int(request.args.get('tail', '10'))
    sectors = [s.strip() for s in sectors_param.split(',') if s.strip()]

    all_symbols = [benchmark] + sectors
    period = '60d'
    interval = '1d'

    try:
        raw = yf.download(all_symbols, period=period, interval=interval, progress=False, auto_adjust=True)
        if raw.empty:
            return jsonify({"error": "No data", "sectors": []}), 500

        closes = raw['Close'] if 'Close' in raw.columns else raw
        closes = closes.dropna(how='all')

        if benchmark not in closes.columns:
            return jsonify({"error": f"Benchmark {benchmark} not found", "sectors": []}), 500

        spy = closes[benchmark]
        rrg_sectors = []

        for sector in sectors:
            if sector not in closes.columns:
                print(f"[RRG] {sector} not found in data")
                continue
            try:
                sec_prices = closes[sector].dropna()
                spy_aligned = spy.reindex(sec_prices.index).dropna()
                sec_aligned = sec_prices.reindex(spy_aligned.index).dropna()

                if len(sec_aligned) < 20:
                    print(f"[RRG] {sector} insufficient data: {len(sec_aligned)} rows")
                    continue

                rs_raw = (sec_aligned / spy_aligned) * 100.0

                # RS-Ratio: 10-period EMA of RS relative to its own 10-period EMA
                ema10 = rs_raw.ewm(span=10, adjust=False).mean()
                rs_ratio = (rs_raw / ema10) * 100.0

                # RS-Momentum: 5-period EMA of RS-Ratio relative to its own EMA
                ema5 = rs_ratio.ewm(span=5, adjust=False).mean()
                rs_momentum = (rs_ratio / ema5) * 100.0

                # Take last `tail_length` valid points
                points = []
                n = min(tail_length, len(rs_ratio))
                for i in range(n):
                    idx = -(n - i)
                    try:
                        rr = float(rs_ratio.iloc[idx])
                        rm = float(rs_momentum.iloc[idx])
                        if pd.isna(rr) or pd.isna(rm):
                            continue
                        points.append({"rsRatio": round(rr, 3), "rsMomentum": round(rm, 3)})
                    except Exception:
                        continue

                if not points:
                    continue

                current = points[-1]
                rr_val = current["rsRatio"]
                rm_val = current["rsMomentum"]

                if rr_val >= 100 and rm_val >= 100:
                    quadrant = "leading"
                elif rr_val >= 100 and rm_val < 100:
                    quadrant = "weakening"
                elif rr_val < 100 and rm_val >= 100:
                    quadrant = "improving"
                else:
                    quadrant = "lagging"

                rrg_sectors.append({
                    "symbol": sector,
                    "quadrant": quadrant,
                    "rsRatio": rr_val,
                    "rsMomentum": rm_val,
                    "tail": points,
                })
            except Exception as e:
                print(f"[RRG] Error computing {sector}: {e}")
                continue

        response = {
            "benchmark": benchmark,
            "sectors": rrg_sectors,
            "tailLength": tail_length,
            "fetchedAt": datetime.now(US_EASTERN).strftime('%Y-%m-%dT%H:%M:%S'),
        }
        _rrg_cache["data"] = response
        _rrg_cache["timestamp"] = now
        return jsonify(response)
    except Exception as e:
        print(f"[RRG] Fatal error: {e}")
        return jsonify({"error": str(e), "sectors": []}), 500


_macro_sparklines_cache = {"data": None, "timestamp": 0, "symbols": ""}
MACRO_SPARKLINES_CACHE_DURATION = 60

@app.route('/macro/sparklines', methods=['GET'])
def get_macro_sparklines():
    """Get 1-day sparkline data (5-minute intervals) for multiple macro symbols."""
    import time
    symbols_param = request.args.get('symbols', '')
    if not symbols_param:
        return jsonify({"error": "No symbols provided"}), 400

    symbols = [s.strip() for s in symbols_param.split(',') if s.strip()]
    cache_key = ','.join(sorted(symbols))
    now = time.time()

    if (_macro_sparklines_cache["data"] and
        _macro_sparklines_cache["symbols"] == cache_key and
        (now - _macro_sparklines_cache["timestamp"]) < MACRO_SPARKLINES_CACHE_DURATION):
        return jsonify(_macro_sparklines_cache["data"])

    result = {}
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period='1d', interval='5m')
            if not hist.empty:
                closes = [round(float(v), 4) for v in hist['Close'].tolist() if not pd.isna(v)]
                result[symbol] = closes
            else:
                hist2 = ticker.history(period='5d', interval='1h')
                if not hist2.empty:
                    closes = [round(float(v), 4) for v in hist2['Close'].tolist()[-24:] if not pd.isna(v)]
                    result[symbol] = closes
                else:
                    result[symbol] = []
        except Exception as e:
            print(f"[macro sparklines] Error for {symbol}: {e}")
            result[symbol] = []

    response = {"sparklines": result, "fetchedAt": datetime.now().isoformat()}
    _macro_sparklines_cache["data"] = response
    _macro_sparklines_cache["timestamp"] = now
    _macro_sparklines_cache["symbols"] = cache_key
    return jsonify(response)


if __name__ == '__main__':
    print("[yfinance Stock Service] Starting on port 5001...")
    app.run(host='127.0.0.1', port=5001, debug=False)
