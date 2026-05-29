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
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
import time as _t

app = Flask(__name__)
# CORS only needed if accessed from browser directly - we're proxying through Node
# Restrict to localhost only for security
CORS(app, origins=["http://localhost:5000", "http://127.0.0.1:5000"])

# US market timezone
US_EASTERN = pytz.timezone('America/New_York')
KST = pytz.timezone('Asia/Seoul')
JST = pytz.timezone('Asia/Tokyo')

def is_korean_ticker(symbol):
    """Check if a ticker is a Korean stock (.KS or .KQ suffix)."""
    s = symbol.upper()
    return s.endswith('.KS') or s.endswith('.KQ')

def is_japanese_ticker(symbol):
    """Check if a ticker is a Japanese stock (.T suffix)."""
    return symbol.upper().endswith('.T')

def is_market_open(symbol=None):
    """Check if stock market is currently open."""
    if symbol and is_korean_ticker(symbol):
        now = datetime.now(KST)
        if now.weekday() >= 5:
            return False
        market_open = now.replace(hour=9, minute=0, second=0, microsecond=0)
        market_close = now.replace(hour=15, minute=30, second=0, microsecond=0)
        return market_open <= now <= market_close
    if symbol and is_japanese_ticker(symbol):
        now = datetime.now(JST)
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
    sym = symbol.upper()
    cached = _quote_cache.get(sym)
    if cached and (_t.time() - cached["ts"] < _QUOTE_CACHE_TTL):
        return jsonify(cached["data"])
    try:
        ticker = yf.Ticker(sym)
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
        
        result = {
            "symbol": sym,
            "name": info.get('shortName') or info.get('longName') or sym,
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
        }
        _quote_cache[sym] = {"data": result, "ts": _t.time()}
        return jsonify(result)
    except Exception as e:
        print(f"[yfinance] Error in /quote/{symbol}: {e}")
        return jsonify({"error": str(e), "symbol": symbol}), 500


# Simple name cache to avoid repeated info calls
_name_cache = {}

# Per-symbol quote cache (avoids hammering yfinance on every request)
_quote_cache: dict = {}
_QUOTE_CACHE_TTL = 45  # seconds

def _get_cached_quote(symbol: str):
    entry = _quote_cache.get(symbol)
    if entry and (_t.time() - entry["ts"] < _QUOTE_CACHE_TTL):
        return entry["data"]
    return None

def _set_cached_quote(symbol: str, data: dict):
    _quote_cache[symbol] = {"data": data, "ts": _t.time()}

# News cache
_news_cache = {"data": None, "ts": 0.0}
_NEWS_CACHE_TTL = 600  # 10 minutes

def _fetch_single_quote(symbol, now_et, now_kst, now_jst):
    """Fetch a single stock quote; used by batch parallel fetch."""
    # Return from cache when fresh enough
    cached = _get_cached_quote(symbol)
    if cached is not None:
        return cached

    is_kr = is_korean_ticker(symbol)
    is_jp = is_japanese_ticker(symbol)
    sym_market_open = is_market_open(symbol)
    try:
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
        
        if is_kr:
            time_str = now_kst.strftime('%I:%M %p KST')
            updated_str = now_kst.strftime('%Y-%m-%dT%H:%M:%S')
            currency = "KRW"
        elif is_jp:
            time_str = now_jst.strftime('%I:%M %p JST')
            updated_str = now_jst.strftime('%Y-%m-%dT%H:%M:%S')
            currency = "JPY"
        else:
            time_str = now_et.strftime('%I:%M %p ET')
            updated_str = now_et.strftime('%Y-%m-%dT%H:%M:%S')
            currency = "USD"
        
        try:
            vol = int(getattr(ticker.fast_info, 'last_volume', None) or ticker.fast_info.get('lastVolume', 0) or 0)
        except Exception:
            vol = 0

        result = {
            "symbol": symbol,
            "name": name,
            "price": round(price, 2),
            "change": round(change, 2),
            "changePercent": round(change_percent, 2),
            "volume": vol,
            "isMarketOpen": sym_market_open,
            "isStale": is_stale,
            "isKorean": is_kr,
            "currency": currency,
            "lastUpdated": updated_str,
            "lastUpdatedFormatted": time_str
        }
        _set_cached_quote(symbol, result)
        return result
    except Exception as e:
        print(f"[yfinance] Error fetching {symbol}: {e}")
        err_currency = "KRW" if is_kr else "JPY" if is_jp else "USD"
        err_tz = now_kst if is_kr else now_jst if is_jp else now_et
        err_label = "KST" if is_kr else "JST" if is_jp else "ET"
        return {
            "symbol": symbol,
            "name": _name_cache.get(symbol, symbol),
            "price": 0,
            "change": 0,
            "changePercent": 0,
            "isMarketOpen": sym_market_open,
            "isStale": True,
            "isKorean": is_kr,
            "currency": err_currency,
            "error": str(e),
            "lastUpdated": err_tz.strftime('%Y-%m-%dT%H:%M:%S'),
            "lastUpdatedFormatted": err_tz.strftime(f'%I:%M %p {err_label}')
        }


@app.route('/quotes', methods=['GET'])
def get_batch_quotes():
    """Get quotes for multiple symbols at once using parallel fetch."""
    symbols_param = request.args.get('symbols', '')
    if not symbols_param:
        return jsonify({"error": "No symbols provided"}), 400
    
    symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
    
    if not symbols:
        return jsonify({"error": "No valid symbols provided"}), 400
    
    now_et = datetime.now(US_EASTERN)
    now_kst = datetime.now(KST)
    now_jst = datetime.now(JST)
    us_market_open = is_market_open()
    
    has_kr = any(is_korean_ticker(s) for s in symbols)
    has_us = any(not is_korean_ticker(s) for s in symbols)
    
    print(f"[yfinance] Batch quotes request for: {symbols}, us_market_open={us_market_open}")
    
    results_map = {}
    max_workers = min(len(symbols), 8)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(_fetch_single_quote, sym, now_et, now_kst, now_jst): sym
            for sym in symbols
        }
        for future in as_completed(futures):
            result = future.result()
            results_map[result["symbol"]] = result
    
    results = [results_map[sym] for sym in symbols if sym in results_map]
    
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
    '041510.KQ': {'name': 'SM Entertainment', 'ko': 'SM엔터테인먼트', 'market': 'KOSDAQ'},
    '122870.KQ': {'name': 'YG Entertainment', 'ko': 'YG엔터테인먼트', 'market': 'KOSDAQ'},
    '035900.KQ': {'name': 'JYP Entertainment', 'ko': 'JYP엔터테인먼트', 'market': 'KOSDAQ'},
    '352820.KQ': {'name': 'JYP Entertainment', 'ko': 'JYP엔터테인먼트', 'market': 'KOSDAQ'},
    # KOSPI mid-cap / growth added in expansion
    '086790.KS': {'name': 'Hana Financial Group', 'ko': '하나금융지주', 'market': 'KOSPI'},
    '316140.KS': {'name': 'Woori Financial Group', 'ko': '우리금융지주', 'market': 'KOSPI'},
    '003490.KS': {'name': 'Korean Air', 'ko': '대한항공', 'market': 'KOSPI'},
    '011200.KS': {'name': 'HMM Co', 'ko': 'HMM', 'market': 'KOSPI'},
    '015760.KS': {'name': 'Korea Electric Power', 'ko': '한국전력', 'market': 'KOSPI'},
    '090430.KS': {'name': 'Amorepacific', 'ko': '아모레퍼시픽', 'market': 'KOSPI'},
    '271560.KS': {'name': 'Orion Corp', 'ko': '오리온', 'market': 'KOSPI'},
    '000720.KS': {'name': 'Hyundai E&C', 'ko': '현대건설', 'market': 'KOSPI'},
    '009830.KS': {'name': 'Hanwha Solutions', 'ko': '한화솔루션', 'market': 'KOSPI'},
    '010130.KS': {'name': 'Korea Zinc', 'ko': '고려아연', 'market': 'KOSPI'},
    '047050.KS': {'name': 'Posco Future M', 'ko': '포스코퓨처엠', 'market': 'KOSPI'},
    '326030.KS': {'name': 'SK Biopharmaceuticals', 'ko': 'SK바이오팜', 'market': 'KOSPI'},
    '145020.KS': {'name': 'Hugel Inc', 'ko': '휴젤', 'market': 'KOSPI'},
    '196170.KS': {'name': 'Alteogen', 'ko': '알테오젠', 'market': 'KOSPI'},
    '011070.KS': {'name': 'LG Innotek', 'ko': 'LG이노텍', 'market': 'KOSPI'},
    '000810.KS': {'name': 'Samsung Fire & Marine', 'ko': '삼성화재', 'market': 'KOSPI'},
    '032640.KS': {'name': 'LG Uplus', 'ko': 'LG유플러스', 'market': 'KOSPI'},
    '008770.KS': {'name': 'Hotel Shilla', 'ko': '호텔신라', 'market': 'KOSPI'},
    '021240.KS': {'name': 'Coway Co', 'ko': '코웨이', 'market': 'KOSPI'},
    '005490.KS': {'name': 'POSCO Holdings', 'ko': '포스코', 'market': 'KOSPI'},
    '042700.KS': {'name': 'Hanmi Semiconductor', 'ko': '한미반도체', 'market': 'KOSPI'},
    '095340.KS': {'name': 'ISC Co', 'ko': 'ISC', 'market': 'KOSPI'},
    '251270.KS': {'name': 'Krafton Inc', 'ko': '크래프톤', 'market': 'KOSPI'},
    # KOSDAQ
    '247540.KQ': {'name': 'Ecopro BM', 'ko': '에코프로비엠', 'market': 'KOSDAQ'},
    '086520.KQ': {'name': 'Ecopro Co', 'ko': '에코프로', 'market': 'KOSDAQ'},
    '357780.KQ': {'name': 'Solus Advanced Materials', 'ko': '솔루스첨단소재', 'market': 'KOSDAQ'},
    '028300.KQ': {'name': 'HLB Inc', 'ko': 'HLB', 'market': 'KOSDAQ'},
    '112610.KQ': {'name': 'CS Wind', 'ko': 'CS윈드', 'market': 'KOSDAQ'},
    '293490.KQ': {'name': 'Kakao Games', 'ko': '카카오게임즈', 'market': 'KOSDAQ'},
    # Japanese stocks
    '7203.T':  {'name': 'Toyota Motor', 'ko': '도요타 자동차', 'market': 'TSE'},
    '6758.T':  {'name': 'Sony Group', 'ko': '소니 그룹', 'market': 'TSE'},
    '9984.T':  {'name': 'SoftBank Group', 'ko': '소프트뱅크 그룹', 'market': 'TSE'},
    '6861.T':  {'name': 'Keyence Corp', 'ko': '키엔스', 'market': 'TSE'},
    '8306.T':  {'name': 'Mitsubishi UFJ Financial', 'ko': '미쓰비시UFJ파이낸셜', 'market': 'TSE'},
    '9432.T':  {'name': 'NTT Corp', 'ko': 'NTT', 'market': 'TSE'},
    '7974.T':  {'name': 'Nintendo Co', 'ko': '닌텐도', 'market': 'TSE'},
    '6367.T':  {'name': 'Daikin Industries', 'ko': '다이킨 공업', 'market': 'TSE'},
    '8058.T':  {'name': 'Mitsubishi Corp', 'ko': '미쓰비시 상사', 'market': 'TSE'},
    '9983.T':  {'name': 'Fast Retailing (Uniqlo)', 'ko': '패스트리테일링(유니클로)', 'market': 'TSE'},
    '4519.T':  {'name': 'Chugai Pharmaceutical', 'ko': '주가이 제약', 'market': 'TSE'},
    '6954.T':  {'name': 'Fanuc Corp', 'ko': '화낙', 'market': 'TSE'},
    '2802.T':  {'name': 'Ajinomoto Co', 'ko': '아지노모토', 'market': 'TSE'},
    '4661.T':  {'name': 'Oriental Land (Disney Japan)', 'ko': '오리엔탈랜드(도쿄디즈니)', 'market': 'TSE'},
    '8035.T':  {'name': 'Tokyo Electron', 'ko': '도쿄 일렉트론', 'market': 'TSE'},
    '6098.T':  {'name': 'Recruit Holdings', 'ko': '리크루트 홀딩스', 'market': 'TSE'},
    '3382.T':  {'name': 'Seven & i Holdings', 'ko': '세븐앤아이 홀딩스', 'market': 'TSE'},
    '9022.T':  {'name': 'Central Japan Railway', 'ko': 'JR 도카이', 'market': 'TSE'},
    '4502.T':  {'name': 'Takeda Pharmaceutical', 'ko': '다케다 약품', 'market': 'TSE'},
    '6501.T':  {'name': 'Hitachi Ltd', 'ko': '히타치', 'market': 'TSE'},
    '6702.T':  {'name': 'Fujitsu Ltd', 'ko': '후지쓰', 'market': 'TSE'},
    '8031.T':  {'name': 'Mitsui & Co', 'ko': '미쓰이물산', 'market': 'TSE'},
    '8001.T':  {'name': 'Itochu Corp', 'ko': '이토추 상사', 'market': 'TSE'},
    '7267.T':  {'name': 'Honda Motor', 'ko': '혼다 자동차', 'market': 'TSE'},
    '4063.T':  {'name': 'Shin-Etsu Chemical', 'ko': '신에츠 화학', 'market': 'TSE'},
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
    
    # ── Yahoo Finance universal symbol search ─────────────────────────
    # Replaces the old hardcoded popular_stocks dictionary.
    # Covers NYSE, NASDAQ, AMEX, KRX, TSE, LSE, XETRA, Euronext, ETFs, etc.
    remaining_slots = 10 - len(results)
    if remaining_slots > 0:
        try:
            import requests as _req
            yf_url = (
                "https://query1.finance.yahoo.com/v1/finance/search"
                f"?q={_req.utils.quote(raw_query)}"
                f"&quotesCount={remaining_slots + 5}&newsCount=0&enableFuzzyQuery=true"
            )
            yf_resp = _req.get(
                yf_url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                timeout=6,
            )
            yf_quotes = yf_resp.json().get("quotes", []) if yf_resp.status_code == 200 else []
            for q in yf_quotes:
                sym = q.get("symbol", "")
                if not sym or sym in added_symbols:
                    continue
                name = q.get("shortname") or q.get("longname") or sym
                quote_type = (q.get("quoteType") or "Equity").capitalize()
                exch = q.get("exchange", "")
                # Determine region & currency from symbol suffix
                if sym.endswith(".KS") or sym.endswith(".KQ"):
                    region, currency, is_kr = "South Korea", "KRW", True
                elif sym.endswith(".T"):
                    region, currency, is_kr = "Japan", "JPY", False
                elif sym.endswith(".HK"):
                    region, currency, is_kr = "Hong Kong", "HKD", False
                elif sym.endswith(".L"):
                    region, currency, is_kr = "United Kingdom", "GBP", False
                elif sym.endswith(".PA") or sym.endswith(".AS") or sym.endswith(".DE") or sym.endswith(".SW"):
                    region, currency, is_kr = "Europe", "EUR", False
                else:
                    region = "United States"
                    currency = q.get("currency") or "USD"
                    is_kr = False
                results.append({
                    "symbol": sym,
                    "name": name,
                    "type": quote_type,
                    "region": region,
                    "currency": currency,
                    "isKorean": is_kr,
                    "exchange": exch,
                })
                added_symbols.add(sym)
                if len(results) >= 10:
                    break
        except Exception as _e:
            pass  # Silently fall through; return whatever Korean results we have

    # Kept for backward compatibility: old popular_stocks = {
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
        # ── Japan (Nikkei 225 major stocks) ──────────────────────────────────
        '7203.T': 'Toyota Motor Corporation',
        '6758.T': 'Sony Group Corporation',
        '8306.T': 'Mitsubishi UFJ Financial Group',
        '4502.T': 'Takeda Pharmaceutical',
        '9984.T': 'SoftBank Group',
        '6501.T': 'Hitachi Ltd',
        '3382.T': 'Seven & i Holdings',
        '8802.T': 'Mitsubishi Estate',
        '9501.T': 'Tokyo Electric Power (TEPCO)',
        '4661.T': 'Oriental Land (Tokyo Disneyland)',
        '7267.T': 'Honda Motor Company',
        '6702.T': 'Fujitsu Ltd',
        '6954.T': 'Fanuc Corporation',
        '4503.T': 'Astellas Pharma',
        '8035.T': 'Tokyo Electron',
        '6367.T': 'Daikin Industries',
        '7751.T': 'Canon Inc.',
        '4568.T': 'Daiichi Sankyo',
        '9432.T': 'NTT (Nippon Telegraph)',
        '2914.T': 'Japan Tobacco International',
        # ── Europe ADRs & major tickers ──────────────────────────────────────
        'ASML': 'ASML Holding (Netherlands)',
        'SAP': 'SAP SE (Germany)',
        'NVO': 'Novo Nordisk (Denmark)',
        'BP': 'BP plc (UK)',
        'SHEL': 'Shell plc (UK/Netherlands)',
        'AZN': 'AstraZeneca (UK/Sweden)',
        'UL': 'Unilever plc (UK)',
        'GSK': 'GSK plc (UK)',
        'EADSY': 'Airbus SE (France/Germany)',
        'VWAGY': 'Volkswagen AG (Germany)',
        'BMWYY': 'BMW AG (Germany)',
        'DMLRY': 'Mercedes-Benz Group (Germany)',
        'MC.PA': 'LVMH Moët Hennessy (France)',
        'TTE.PA': 'TotalEnergies (France)',
        'SAN.PA': 'Sanofi (France)',
        'BNP.PA': 'BNP Paribas (France)',
        'AI.PA': 'Air Liquide (France)',
        'SIE.DE': 'Siemens AG (Germany)',
        'ALV.DE': 'Allianz SE (Germany)',
        'BAS.DE': 'BASF SE (Germany)',
        'MBG.DE': 'Mercedes-Benz Group (Germany)',
        'DTE.DE': 'Deutsche Telekom (Germany)',
        'IFX.DE': 'Infineon Technologies (Germany)',
        'NESN.SW': 'Nestle SA (Switzerland)',
        'ROG.SW': 'Roche Holding (Switzerland)',
        'NOVN.SW': 'Novartis AG (Switzerland)',
        'UHR.SW': 'Swatch Group (Switzerland)',
        # ── European ETFs (country rotation) ────────────────────────────────
        'EWG': 'iShares MSCI Germany ETF',
        'EWQ': 'iShares MSCI France ETF',
        'EWI': 'iShares MSCI Italy ETF',
        'EWP': 'iShares MSCI Spain ETF',
        'EWN': 'iShares MSCI Netherlands ETF',
        'EWL': 'iShares MSCI Switzerland ETF',
        'EWU': 'iShares MSCI United Kingdom ETF',
        'EWD': 'iShares MSCI Sweden ETF',
        'EWO': 'iShares MSCI Austria ETF',
        'ENOR': 'iShares MSCI Norway ETF',
        'VGK': 'Vanguard FTSE Europe ETF',
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
    start = request.args.get('start', None)
    end = request.args.get('end', None)
    
    try:
        ticker = yf.Ticker(symbol.upper())
        if start:
            hist = ticker.history(start=start, end=end, interval=interval)
        else:
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
        is_jp = is_japanese_ticker(symbol)
        
        native_currency = 'KRW' if is_kr else 'JPY' if is_jp else 'USD'
        native_region = 'South Korea' if is_kr else 'Japan' if is_jp else 'United States'
        
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
            "region": native_region,
            "currency": native_currency,
            "isKorean": is_kr,
            "isJapanese": is_jp,
        }
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e), "symbol": symbol}), 500


@app.route('/earnings/<path:symbol>', methods=['GET'])
def get_earnings(symbol):
    """Get earnings dates, EPS estimates, and actuals for a symbol."""
    try:
        import pandas as pd
        ticker = yf.Ticker(symbol.upper())
        info = ticker.info

        result = {
            "nextEarningsDate": None,
            "nextEpsEstimate": None,
            "nextEpsHigh": None,
            "nextEpsLow": None,
            "lastEarningsDate": None,
            "lastEpsActual": None,
            "lastEpsEstimate": None,
            "lastSurprisePct": None,
            "trailingEps": None,
            "forwardEps": None,
            "history": [],
        }

        # Trailing / forward EPS from info
        trailing = info.get("trailingEps")
        forward  = info.get("forwardEps")
        if trailing is not None:
            result["trailingEps"] = float(trailing)
        if forward is not None:
            result["forwardEps"] = float(forward)

        # Next earnings from calendar
        try:
            cal = ticker.calendar
            if cal and isinstance(cal, dict):
                dates = cal.get("Earnings Date")
                if dates and len(dates) > 0:
                    result["nextEarningsDate"] = str(dates[0])
                avg = cal.get("Earnings Average")
                high = cal.get("Earnings High")
                low  = cal.get("Earnings Low")
                if avg is not None:
                    result["nextEpsEstimate"] = float(avg)
                if high is not None:
                    result["nextEpsHigh"] = float(high)
                if low is not None:
                    result["nextEpsLow"] = float(low)
        except Exception:
            pass

        # PRIMARY: earnings_dates — Estimated vs Actual + Surprise%
        # Note: earnings_dates requires lxml; falls back gracefully when unavailable
        history_loaded = False
        try:
            ed = ticker.earnings_dates
            if ed is not None and not ed.empty:
                ed_reset = ed.reset_index()
                history = []
                date_col = ed_reset.columns[0]
                for _, row in ed_reset.iterrows():
                    raw_date = row.get(date_col)
                    if raw_date is None:
                        continue
                    # Preserve full ISO timestamp with timezone (yfinance earnings_dates has tz-aware timestamps)
                    if hasattr(raw_date, 'isoformat'):
                        date_full = raw_date.isoformat()
                    else:
                        date_full = str(raw_date)
                    date_str = date_full[:10]
                    if not date_str or date_str in ("None", "nan", "NaT"):
                        continue
                    eps_est = row.get("EPS Estimate")
                    eps_act = row.get("Reported EPS")
                    surp    = row.get("Surprise(%)")
                    entry = {
                        "date":        date_full,
                        "epsEstimate": float(eps_est) if eps_est is not None and pd.notna(eps_est) else None,
                        "epsActual":   float(eps_act) if eps_act is not None and pd.notna(eps_act) else None,
                        "surprisePct": float(surp)    if surp    is not None and pd.notna(surp)    else None,
                    }
                    # Compute surprise if missing but both values present
                    if entry["surprisePct"] is None and entry["epsEstimate"] and entry["epsActual"]:
                        est, act = entry["epsEstimate"], entry["epsActual"]
                        if est != 0:
                            entry["surprisePct"] = round((act - est) / abs(est) * 100, 2)
                    history.append(entry)

                history.sort(key=lambda x: x["date"], reverse=True)
                # Only keep past quarters (epsActual populated) + 1 upcoming
                past   = [h for h in history if h["epsActual"] is not None]
                future = [h for h in history if h["epsActual"] is None][:1]
                result["history"] = (past[:7] + future)
                history_loaded = len(past) > 0

                if past:
                    result["lastEarningsDate"] = past[0]["date"]
                    result["lastEpsActual"]    = past[0]["epsActual"]
                    result["lastEpsEstimate"]  = past[0]["epsEstimate"]
                    result["lastSurprisePct"]  = past[0]["surprisePct"]
        except Exception as e:
            if "lxml" not in str(e):
                print(f"[earnings_dates] {e}")

        # FALLBACK: quarterly_income_stmt when earnings_dates is empty
        if not history_loaded:
            try:
                qs = ticker.quarterly_income_stmt
                if qs is not None and not qs.empty and "Diluted EPS" in qs.index:
                    eps_row = qs.loc["Diluted EPS"]
                    history = []
                    for col in eps_row.index:
                        val = eps_row[col]
                        if val is not None and pd.notna(val):
                            history.append({
                                "date":        str(col.date()) if hasattr(col, "date") else str(col),
                                "epsActual":   float(val),
                                "epsEstimate": None,
                                "surprisePct": None,
                            })
                    history.sort(key=lambda x: x["date"], reverse=True)
                    result["history"] = history[:6]
                    if history:
                        result["lastEarningsDate"] = history[0]["date"]
                        result["lastEpsActual"]    = history[0]["epsActual"]
            except Exception:
                pass

        # Revenue history from quarterly_income_stmt
        try:
            import pandas as _pd2
            qs = ticker.quarterly_income_stmt
            if qs is not None and not qs.empty:
                rev_index = None
                for candidate in ["Total Revenue", "Revenue", "Net Revenue", "Operating Revenue"]:
                    if candidate in qs.index:
                        rev_index = candidate
                        break
                if rev_index:
                    rev_row = qs.loc[rev_index]
                    rev_history = []
                    for col in rev_row.index:
                        val = rev_row[col]
                        if val is not None and _pd2.notna(val):
                            rev_history.append({
                                "date": str(col.date()) if hasattr(col, "date") else str(col),
                                "revenue": float(val),
                            })
                    rev_history.sort(key=lambda x: x["date"], reverse=True)
                    result["revenueHistory"] = rev_history[:8]
        except Exception:
            pass

        # Revenue estimate for next quarter from analyst data
        try:
            result["nextRevEstimate"] = info.get("revenueEstimatesAvg") or None
        except Exception:
            pass

        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e), "nextEarningsDate": None, "lastEpsActual": None, "history": []}), 200


# ── Upcoming Earnings ─────────────────────────────────────────────────────
_upcoming_earnings_cache: dict = {"data": None, "ts": 0.0}
_UPCOMING_EARNINGS_TTL = 1800  # 30 minutes

UPCOMING_WATCHLIST = list(dict.fromkeys([
    # ── US Mega-Cap Tech ──────────────────────────────────────────────────────
    "AAPL", "MSFT", "NVDA", "GOOGL", "GOOG", "AMZN", "META", "TSLA", "AMD",
    # ── US Tech / Software ────────────────────────────────────────────────────
    "NFLX", "AVGO", "CRM", "ORCL", "ADBE", "INTC", "QCOM", "MU", "ARM", "PLTR",
    "SNOW", "UBER", "LYFT", "SHOP", "SQ", "PYPL", "TWLO", "ZM", "DOCU",
    "NOW", "WDAY", "DDOG", "CRWD", "NET", "ZS", "PANW", "OKTA", "MDB",
    "AMAT", "LRCX", "KLAC", "MRVL", "SMCI", "ON", "TXN", "ADI", "MCHP",
    "APP", "RBLX", "SNAP", "PINS", "SPOT", "MTCH", "DASH", "ABNB", "LYFT",
    "BILL", "GTLB", "HCP", "ESTC", "PD", "CFLT", "S", "SMAR",
    "AFRM", "COIN", "HOOD", "SOFI", "OPEN", "NUAN",
    # ── US AI / Data / Cloud ──────────────────────────────────────────────────
    "AI", "GFAI", "BBAI", "SOUN", "IONQ", "QBTS", "RGTI",
    "IBM", "HPE", "DELL", "WDC", "STX", "PSTG",
    # ── US Financials ─────────────────────────────────────────────────────────
    "JPM", "BAC", "GS", "MS", "WFC", "V", "MA", "AXP", "C", "BLK",
    "COF", "USB", "PNC", "SCHW", "CB", "MMC", "AON", "MET", "PRU",
    "TFC", "RF", "HBAN", "KEY", "CFG", "FHN", "ALLY", "SYF", "DFS",
    "ICE", "CME", "NDAQ", "CBOE", "MKTX",
    # ── US Healthcare / Pharma ────────────────────────────────────────────────
    "JNJ", "UNH", "LLY", "MRK", "ABBV", "PFE", "CVS", "TMO", "ABT",
    "DHR", "BSX", "ISRG", "MDT", "BDX", "SYK", "EW", "REGN", "VRTX",
    "AMGN", "GILD", "BIIB", "MRNA", "BMY",
    "DXCM", "ALGN", "HOLX", "BAX", "ZBH", "XRAY", "HSIC",
    "ILMN", "IQV", "CRL", "CTLT", "PKI",
    "HALO", "ARQT", "RXRX", "EXAS", "NVAX", "BNTX",
    # ── US Consumer / Retail ──────────────────────────────────────────────────
    "WMT", "COST", "HD", "MCD", "SBUX", "NKE", "TGT",
    "LOW", "TJX", "BKNG", "MAR", "HLT", "YUM", "CMG", "DPZ",
    "PG", "KO", "PEP", "PM", "MO", "CL", "KMB", "GIS",
    "ULTA", "EL", "COTY", "LULU", "TPR", "RL", "VFC",
    "F", "GM", "RIVN", "LCID", "QS",
    "RACE", "PHM", "LEN", "DHI", "TOL", "NVR",
    "RCL", "CCL", "NCLH", "MGM", "WYNN", "LVS",
    "DKNG", "PENN", "CZR",
    # ── US Energy ────────────────────────────────────────────────────────────
    "XOM", "CVX", "COP", "SLB", "OXY", "PSX", "VLO", "MPC",
    "PXD", "DVN", "FANG", "MRO", "APA", "HAL", "BKR",
    "ENPH", "FSLR", "RUN", "ARRY", "BE", "PLUG",
    # ── US Industrials / Aero / Defense ──────────────────────────────────────
    "BA", "CAT", "GE", "RTX", "HON", "LMT", "NOC", "GD", "MMM",
    "UPS", "FDX", "CSX", "NSC", "DE", "EMR",
    "TDG", "HEI", "AXON", "LHX", "LDOS", "CACI", "SAIC",
    "ROK", "ITW", "ETN", "DOV", "AME", "PH", "IR",
    "GWW", "FLS", "RXO", "XPO", "ODFL", "SAIA", "JBHT",
    # ── US Telecom / Media ────────────────────────────────────────────────────
    "DIS", "CMCSA", "T", "VZ", "TMUS",
    "WBD", "PARA", "FOX", "NYT", "NWSA",
    "CHTR", "LBRDA", "ATUS",
    # ── US Real Estate / Utilities ────────────────────────────────────────────
    "AMT", "PLD", "EQIX", "NEE", "DUK", "SO",
    "CCI", "SBAC", "WPC", "O", "VICI", "SPG", "EQR", "AVB",
    "AWK", "AEP", "EXC", "SRE", "D", "PCG", "XEL",
    # ── US Materials / Metals ─────────────────────────────────────────────────
    "FCX", "NEM", "GOLD", "AA", "ALB", "MP", "PAAS", "HL",
    "NUE", "STLD", "CLF", "X", "PKG", "IP", "WRK",
    "LIN", "APD", "ECL", "SHW", "PPG", "EMN",
    # ── Chinese ADR ──────────────────────────────────────────────────────────
    "BABA", "JD", "PDD", "BIDU", "NIO", "XPEV", "LI",
    "NTES", "BILI", "IQ", "TUYA", "VNET", "GDS",
    "ZTO", "YMM", "DIDI", "EDU", "TAL", "NEW",
    "FUTU", "UP", "TIGR",
    # ── European ADR / US-listed ──────────────────────────────────────────────
    "ASML", "SAP", "NVO", "AZN", "SHEL", "BP",
    "TTE", "EQNR", "UL", "BTI", "DEO",
    "LVMH", "MC.PA",
    "NESN.SW", "ROG.SW", "NOVN.SW",
    "SIE.DE", "BMW.DE", "VOW3.DE", "MBG.DE", "BAS.DE", "BAYN.DE",
    "AIR.PA", "BNP.PA", "SAN.PA",
    # ── Japanese Stocks (.T) ──────────────────────────────────────────────────
    "7203.T",   # Toyota Motor
    "6758.T",   # Sony Group
    "9984.T",   # SoftBank Group
    "6861.T",   # Keyence
    "8306.T",   # Mitsubishi UFJ Financial
    "9432.T",   # NTT
    "7974.T",   # Nintendo
    "6367.T",   # Daikin Industries
    "8058.T",   # Mitsubishi Corp
    "9983.T",   # Fast Retailing (Uniqlo)
    "4519.T",   # Chugai Pharmaceutical
    "6954.T",   # Fanuc
    "2802.T",   # Ajinomoto
    "4661.T",   # Oriental Land (Disney Japan)
    "8035.T",   # Tokyo Electron
    "6098.T",   # Recruit Holdings
    "3382.T",   # Seven & i Holdings
    "9022.T",   # Central Japan Railway
    "4502.T",   # Takeda Pharmaceutical
    "6501.T",   # Hitachi
    "6702.T",   # Fujitsu
    "8031.T",   # Mitsui & Co
    "8001.T",   # Itochu Corp
    "7267.T",   # Honda Motor
    "4063.T",   # Shin-Etsu Chemical
    # ── Korean KOSPI Blue-Chips ───────────────────────────────────────────────
    "005930.KS",  # Samsung Electronics
    "000660.KS",  # SK Hynix
    "035420.KS",  # Naver
    "005380.KS",  # Hyundai Motor
    "051910.KS",  # LG Chem
    "035720.KS",  # Kakao
    "000270.KS",  # Kia Motors
    "068270.KS",  # Celltrion
    "105560.KS",  # KB Financial
    "055550.KS",  # Shinhan Financial
    "012330.KS",  # Hyundai Mobis
    "207940.KS",  # Samsung Biologics
    "003550.KS",  # LG Corp
    "034730.KS",  # SK Inc
    "096770.KS",  # SK Innovation
    "373220.KS",  # LG Energy Solution
    "006400.KS",  # Samsung SDI
    "028260.KS",  # Samsung C&T
    "032830.KS",  # Samsung Life Insurance
    "003490.KS",  # Korean Air
    "009150.KS",  # Samsung Electro-Mechanics
    "011200.KS",  # HMM (shipping)
    "015760.KS",  # Korea Electric Power (KEPCO)
    "030200.KS",  # KT Corp
    "017670.KS",  # SK Telecom
    "090430.KS",  # Amorepacific
    "271560.KS",  # Orion
    "000720.KS",  # Hyundai E&C
    "086790.KS",  # Hana Financial
    "316140.KS",  # Woori Financial
    # ── Korean KOSPI Mid-Cap / Growth ─────────────────────────────────────────
    "036570.KS",  # NCsoft
    "251270.KS",  # Krafton
    "112040.KS",  # Wemade
    "263750.KS",  # Pearl Abyss
    "095340.KS",  # ISC (semiconductor)
    "042700.KS",  # Hanmi Semiconductor
    "009830.KS",  # Hanwha Solutions
    "010130.KS",  # Korea Zinc
    "047050.KS",  # Posco Future M
    "003670.KS",  # Posco Holdings
    "326030.KS",  # SK Biopharmaceuticals
    "145020.KS",  # Hugel (botox)
    "196170.KS",  # Alteogen
    "011070.KS",  # LG Innotek
    "066570.KS",  # LG Electronics
    "000810.KS",  # Samsung Fire & Marine
    "032640.KS",  # LG Uplus
    "008770.KS",  # Hotel Shilla
    "021240.KS",  # Coway
    "005490.KS",  # POSCO
    # ── Korean KOSDAQ ─────────────────────────────────────────────────────────
    "247540.KQ",  # Ecopro BM
    "086520.KQ",  # Ecopro
    "357780.KQ",  # Solus Advanced Materials
    "028300.KQ",  # HLB (biotech)
    "000250.KQ",  # Sam Chun Dang Pharm
    "214150.KQ",  # Classsys
    "041510.KQ",  # SM Entertainment
    "035900.KQ",  # JYP Entertainment
    "122870.KQ",  # YG Entertainment
    "293490.KQ",  # Kakao Games
    "112610.KQ",  # CS Wind
    "236340.KQ",  # Mobiis
]))

# Currency mapping by exchange suffix
_SYMBOL_CURRENCY = {"KS": "KRW", "KQ": "KRW", "T": "JPY"}

@app.route('/earnings_upcoming/flush', methods=['POST'])
def flush_earnings_cache():
    """Force-clear the upcoming earnings cache so next GET re-fetches."""
    global _upcoming_earnings_cache
    _upcoming_earnings_cache = {"data": None, "ts": 0.0}
    return jsonify({"ok": True, "message": "Earnings cache cleared"})

@app.route('/earnings_upcoming', methods=['GET'])
def get_earnings_upcoming():
    """Return upcoming earnings dates for a curated watchlist. Cached 30 min."""
    import time as _t
    global _upcoming_earnings_cache

    now = _t.time()
    if _upcoming_earnings_cache["data"] and (now - _upcoming_earnings_cache["ts"]) < _UPCOMING_EARNINGS_TTL:
        return jsonify(_upcoming_earnings_cache["data"])

    results = []
    import threading
    lock = threading.Lock()

    def fetch_one(symbol):
        try:
            ticker = yf.Ticker(symbol)
            cal = ticker.calendar
            if not cal or not isinstance(cal, dict):
                return
            dates = cal.get("Earnings Date")
            if not dates or len(dates) == 0:
                return
            raw_ts = dates[0]
            next_date = str(raw_ts)[:10]
            # Preserve full ISO timestamp with timezone if available (for accurate local-time display)
            if hasattr(raw_ts, 'isoformat'):
                next_date_full = raw_ts.isoformat()
            else:
                next_date_full = str(raw_ts)
            # Skip dates already in the past (stock already reported) or more than 90 days out
            from datetime import datetime as _dt
            try:
                next_dt = _dt.strptime(next_date, "%Y-%m-%d")
                days_diff = (next_dt - _dt.now()).days
                if days_diff < -1:  # More than 1 day in the past → already reported
                    return
                if days_diff > 90:  # Too far out
                    return
            except Exception:
                return
            avg_eps = cal.get("Earnings Average")
            info = ticker.fast_info
            name = ""
            try:
                info_full = ticker.info
                raw_name = (info_full.get("shortName") or info_full.get("longName") or symbol)[:45]
                # For Korean/Japanese stocks, prefer our verified name dict over yfinance
                if symbol in korean_stocks:
                    name = korean_stocks[symbol]["name"]
                else:
                    name = raw_name
                price = info_full.get("currentPrice") or info_full.get("regularMarketPrice")
                change_pct = info_full.get("regularMarketChangePercent")
                sector = info_full.get("sector")
                mkt_cap = info_full.get("marketCap")
            except Exception:
                name = symbol
                price = None
                change_pct = None
                sector = None
                mkt_cap = None
            # Determine currency from symbol suffix
            suffix = symbol.split(".")[-1] if "." in symbol else "USD"
            currency = _SYMBOL_CURRENCY.get(suffix, "USD")
            entry = {
                "symbol": symbol,
                "name": name,
                "nextEarningsDate": next_date_full,
                "epsEstimate": float(avg_eps) if avg_eps is not None else None,
                "sector": sector,
                "currentPrice": price,
                "changePercent": change_pct,
                "marketCap": mkt_cap,
                "currency": currency,
            }
            with lock:
                results.append(entry)
        except Exception:
            pass

    with ThreadPoolExecutor(max_workers=10) as executor:
        list(executor.map(fetch_one, UPCOMING_WATCHLIST))

    results.sort(key=lambda x: x["nextEarningsDate"])
    data = {"upcoming": results, "fetchedAt": int(now)}
    _upcoming_earnings_cache["data"] = data
    _upcoming_earnings_cache["ts"] = now
    print(f"[earnings_upcoming] {len(results)} stocks with upcoming earnings")
    return jsonify(data)


@app.route('/dividends/<path:symbol>', methods=['GET'])
def get_dividends(symbol):
    """Get dividend payment dates and amounts for a symbol."""
    try:
        ticker = yf.Ticker(symbol.upper())
        divs = ticker.dividends
        if divs is None or divs.empty:
            return jsonify({"symbol": symbol.upper(), "dividends": []})
        result = []
        for date, amount in divs.items():
            if amount > 0:
                result.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "amount": round(float(amount), 4)
                })
        result.sort(key=lambda x: x["date"])
        return jsonify({"symbol": symbol.upper(), "dividends": result})
    except Exception as e:
        return jsonify({"symbol": symbol, "dividends": [], "error": str(e)}), 200


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
    # Serve from cache if fresh
    if _news_cache["data"] is not None and (_t.time() - _news_cache["ts"] < _NEWS_CACHE_TTL):
        print("[yfinance] News served from cache")
        return jsonify({"news": _news_cache["data"], "count": len(_news_cache["data"]), "fetchedAt": datetime.now().isoformat(), "cached": True})
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

        _news_cache["data"] = all_news
        _news_cache["ts"] = _t.time()
        
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

def is_japanese_ticker(symbol):
    return symbol.upper().endswith('.T')

def is_eu_ticker(symbol):
    # EU ADRs that trade on US exchanges in USD — identified by ticker list
    EU_ADRS = {"ASML", "SAP", "NVO", "AZN", "SHEL", "BP", "UL", "GSK", "TM", "HMC", "SONY"}
    return symbol.upper() in EU_ADRS

def fetch_top_headline(symbol: str) -> dict:
    """Fetch the most recent news headline for a stock symbol. Returns {} on failure."""
    try:
        ticker = yf.Ticker(symbol.upper())
        news = ticker.news
        if not news:
            return {}
        item = news[0]
        content = item.get('content', item)
        title = content.get('title', item.get('title', ''))
        if not title:
            return {}
        publisher = 'Unknown'
        if content.get('provider'):
            publisher = content.get('provider', {}).get('displayName', 'Unknown')
        else:
            publisher = item.get('publisher', 'Unknown')
        link = ''
        if content.get('canonicalUrl'):
            link = content.get('canonicalUrl', {}).get('url', '')
        elif content.get('clickThroughUrl'):
            link = content.get('clickThroughUrl', {}).get('url', '')
        else:
            link = item.get('link', '')
        return {"headline": title, "source": publisher, "url": link}
    except Exception:
        return {}


@app.route('/recommended', methods=['GET'])
def get_recommended_stocks():
    """Get recommended stocks from US, KR, JP, and EU markets — balanced global portfolio."""
    import time
    now = time.time()
    if _recommended_cache["data"] and (now - _recommended_cache["timestamp"]) < RECOMMENDED_CACHE_DURATION:
        return jsonify(_recommended_cache["data"])

    try:
        # US large-caps & high-momentum
        us_symbols = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "AMD", "NFLX", "AVGO",
                      "JPM", "V", "MA", "WMT", "LLY", "XOM", "COST", "PLTR", "CRM", "SNOW"]
        # Korean KOSPI/KOSDAQ blue chips
        kr_symbols = ["005930.KS", "000660.KS", "373220.KS", "035420.KS", "035720.KS",
                      "068270.KS", "051910.KS", "006400.KS", "003670.KS", "207940.KS"]
        # Japanese TSE blue chips (priced in JPY)
        jp_symbols = ["7203.T", "6758.T", "9984.T", "8306.T", "7974.T", "6861.T", "4502.T", "6098.T"]
        # European ADRs trading on US exchanges (priced in USD)
        eu_symbols = ["ASML", "SAP", "NVO", "AZN", "SHEL", "BP", "UL", "GSK"]

        market_map = {}
        for s in us_symbols: market_map[s] = "US"
        for s in kr_symbols: market_map[s] = "KR"
        for s in jp_symbols: market_map[s] = "JP"
        for s in eu_symbols: market_map[s] = "EU"

        all_symbols = us_symbols + kr_symbols + jp_symbols + eu_symbols
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

                if price <= 0:
                    continue

                change = price - prev_close if prev_close else 0
                change_pct = (change / prev_close * 100) if prev_close and prev_close != 0 else 0
                volume_ratio = volume / avg_volume if avg_volume > 0 and volume > 0 else 1.0

                is_kr = is_korean_ticker(symbol)
                is_jp = is_japanese_ticker(symbol)
                market = market_map.get(symbol.upper(), market_map.get(symbol, "US"))

                # Determine native currency
                if is_kr:
                    currency = 'KRW'
                elif is_jp:
                    currency = 'JPY'
                else:
                    currency = 'USD'

                # Balanced momentum score: volume ratio (50%) + price change strength (30%) + stability (20%)
                cp_score = min(abs(change_pct) / 5.0, 1.0)  # normalize to 0–1, cap at 5%
                score = volume_ratio * 0.5 + cp_score * 0.3 + 0.2  # baseline 0.2 for all

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
                    "isJapanese": is_jp,
                    "market": market,
                    "currency": currency,
                    "_score": score,
                })
            except Exception as e:
                print(f"[yfinance] Recommended skip {symbol}: {e}")
                continue

        # Balanced selection: sort by score, then ensure global diversity (max 5 per market)
        results.sort(key=lambda x: x['_score'], reverse=True)

        market_counts = {"US": 0, "KR": 0, "JP": 0, "EU": 0}
        market_limits = {"US": 5, "KR": 3, "JP": 3, "EU": 3}
        top_picks = []

        for r in results:
            m = r.get("market", "US")
            limit = market_limits.get(m, 3)
            if market_counts.get(m, 0) < limit:
                r_clean = {k: v for k, v in r.items() if k != '_score'}
                top_picks.append(r_clean)
                market_counts[m] = market_counts.get(m, 0) + 1
            if len(top_picks) >= 12:
                break

        # Re-sort final picks by score descending for display
        results_scored = {r["symbol"]: r["_score"] if "_score" in r else 0 for r in results}
        top_picks.sort(key=lambda x: results_scored.get(x["symbol"], 0), reverse=True)

        # Fetch top news headline for each final pick (best-effort, with timeout protection)
        import concurrent.futures
        symbols_for_news = [r["symbol"] for r in top_picks]
        news_map = {}
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
                future_to_sym = {executor.submit(fetch_top_headline, sym): sym for sym in symbols_for_news}
                for future in concurrent.futures.as_completed(future_to_sym, timeout=8):
                    sym = future_to_sym[future]
                    try:
                        news_map[sym] = future.result()
                    except Exception:
                        news_map[sym] = {}
        except Exception as e:
            print(f"[yfinance] News fetch error: {e}")

        for r in top_picks:
            nd = news_map.get(r["symbol"], {})
            r["newsHeadline"] = nd.get("headline", "")
            r["newsSource"] = nd.get("source", "")
            r["newsUrl"] = nd.get("url", "")

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


# ─── RRG: Per-country configuration ──────────────────────────────────────────
# mode='etf'     → each symbol is a standalone sector/country ETF (US, EU)
# mode='grouped' → constituent stocks grouped by sector; Python pre-aggregates (KR, JP)
# This guarantees exactly 11 nodes for every country.

RRG_COUNTRY_CONFIG = {
    'us': {
        'benchmark': 'SPY',
        'mode': 'etf',
        'sectors': ['XLK','XLF','XLV','XLE','XLY','XLP','XLI','XLB','XLRE','XLU','XLC'],
    },
    'eu': {
        'benchmark': 'VGK',
        'mode': 'etf',
        # 11 iShares country ETFs for European country rotation (EWQ delisted 2024 → EDEN)
        'sectors': ['EWG','EDEN','EWI','EWP','EWN','EWL','EWU','EWD','EWO','ENOR','EWK'],
    },
    'kr': {
        'benchmark': '^KS11',
        'mode': 'grouped',
        # 11 GICS-aligned sectors; Python pre-aggregates constituent stocks → 11 nodes guaranteed
        'sector_groups': {
            'KR_SEMI':    ['005930.KS','000660.KS','066570.KS','006400.KS'],
            'KR_AUTO':    ['005380.KS','000270.KS','012330.KS'],
            'KR_BIO':     ['068270.KS','207940.KS','128940.KS'],
            'KR_FIN':     ['105560.KS','055550.KS','086790.KS'],
            'KR_CHEM':    ['051910.KS','373220.KS','247540.KS'],
            'KR_NET':     ['035420.KS','035720.KS','259960.KS'],
            'KR_STEEL':   ['003670.KS','004020.KS','010120.KS'],
            'KR_TELE':    ['017670.KS','030200.KS','032640.KS'],
            'KR_CONDISC': ['069960.KS','023530.KS','139480.KS','004170.KS'],
            'KR_UTIL':    ['015760.KS','036460.KS','018670.KS'],
            'KR_RE':      ['012630.KS','000720.KS','006360.KS','000210.KS'],
        },
    },
    'jp': {
        'benchmark': '^N225',
        'mode': 'grouped',
        # 11 GICS-aligned sectors for Japan
        'sector_groups': {
            'JP_AUTO':     ['7203.T','7267.T','7270.T','7201.T'],
            'JP_ELEC':     ['6758.T','6501.T','6752.T','7751.T','6701.T'],
            'JP_FIN':      ['8306.T','8316.T','8411.T'],
            'JP_PHARM':    ['4502.T','4503.T','4568.T'],
            'JP_IT':       ['9984.T','4689.T','3659.T'],
            'JP_RETAIL':   ['3382.T','8267.T','8028.T'],
            'JP_RE':       ['8802.T','8801.T','8804.T'],
            'JP_UTIL':     ['9501.T','9502.T','9503.T','4661.T'],
            'JP_CHEM':     ['4063.T','4005.T','3402.T','3407.T'],
            'JP_STEEL':    ['5401.T','5411.T','5406.T'],
            'JP_CONSTAPLE':['2503.T','2502.T','2802.T','2269.T'],
        },
    },
}

_rrg_caches: dict = {}
RRG_CACHE_DURATION = 300  # 5 minutes


def _build_rrg_result(symbol, rs_ratio_series, rs_momentum_series, tail_length):
    """Build an RRG sector dict from pre-computed RS-Ratio and RS-Momentum pandas Series."""
    points = []
    n = min(tail_length, len(rs_ratio_series))
    for i in range(n):
        idx = -(n - i)
        try:
            rr = float(rs_ratio_series.iloc[idx])
            rm = float(rs_momentum_series.iloc[idx])
            if pd.isna(rr) or pd.isna(rm):
                continue
            points.append({"rsRatio": round(rr, 3), "rsMomentum": round(rm, 3)})
        except Exception:
            continue
    if not points:
        return None
    current = points[-1]
    rr_val, rm_val = current["rsRatio"], current["rsMomentum"]
    quadrant = ("leading"   if rr_val >= 100 and rm_val >= 100 else
                "weakening" if rr_val >= 100 else
                "improving" if rm_val >= 100 else "lagging")
    return {"symbol": symbol, "quadrant": quadrant, "rsRatio": rr_val,
            "rsMomentum": rm_val, "tail": points}


def _compute_rrg_for_sym(sym_col, bm_prices, ratio_span, mom_span):
    """Compute RS-Ratio / RS-Momentum series for a single price column vs benchmark."""
    sec = sym_col.dropna()
    bm = bm_prices.reindex(sec.index).dropna()
    sec = sec.reindex(bm.index).dropna()
    if len(sec) < max(3, ratio_span):
        return None, None
    rs_raw = (sec / bm) * 100.0
    ema_r = rs_raw.ewm(span=ratio_span, adjust=False).mean()
    rs_ratio = (rs_raw / ema_r) * 100.0
    ema_m = rs_ratio.ewm(span=mom_span, adjust=False).mean()
    rs_momentum = (rs_ratio / ema_m) * 100.0
    return rs_ratio, rs_momentum


def _normalize_rrg_coords(sectors):
    """Normalize RRG coordinates so all 11 nodes fit around center=100 with ~3-unit std dev.

    Uses ALL tail points (not just current values) so the historical path is
    consistently scaled — no jumps when switching between periods.
    """
    if len(sectors) < 2:
        return sectors

    all_rr, all_rm = [], []
    for s in sectors:
        all_rr.append(s['rsRatio'])
        all_rm.append(s['rsMomentum'])
        for p in s.get('tail', []):
            all_rr.append(p['rsRatio'])
            all_rm.append(p['rsMomentum'])

    rr_mean = sum(all_rr) / len(all_rr)
    rm_mean = sum(all_rm) / len(all_rm)
    rr_std = (sum((x - rr_mean) ** 2 for x in all_rr) / len(all_rr)) ** 0.5 or 0.01
    rm_std = (sum((x - rm_mean) ** 2 for x in all_rm) / len(all_rm)) ** 0.5 or 0.01

    TARGET_STD = 3.0            # normalize spread to ~3 units
    rr_scale = min(TARGET_STD / rr_std, 10.0)
    rm_scale = min(TARGET_STD / rm_std, 10.0)

    for s in sectors:
        norm_rr = 100.0 + (s['rsRatio']    - rr_mean) * rr_scale
        norm_rm = 100.0 + (s['rsMomentum'] - rm_mean) * rm_scale
        s['rsRatio']    = round(norm_rr, 3)
        s['rsMomentum'] = round(norm_rm, 3)
        s['tail'] = [
            {'rsRatio':    round(100.0 + (p['rsRatio']    - rr_mean) * rr_scale, 3),
             'rsMomentum': round(100.0 + (p['rsMomentum'] - rm_mean) * rm_scale, 3)}
            for p in s.get('tail', [])
        ]
        s['quadrant'] = ("leading"   if norm_rr >= 100 and norm_rm >= 100 else
                         "weakening" if norm_rr >= 100 else
                         "improving" if norm_rm >= 100 else "lagging")
    return sectors


@app.route('/rrg/data', methods=['GET'])
def get_rrg_data():
    """Compute RRG data for any country's sectors vs benchmark.

    Guarantees exactly 11 sector nodes per country.
    KR/JP: pre-aggregates constituent stocks in Python to avoid missing-stock distortion.
    US/EU: uses liquid ETFs directly.
    Applies adaptive EMA spans + post-normalization for all timeframes.
    """
    import time
    now = time.time()

    country = request.args.get('country', 'us').lower()
    cfg = RRG_COUNTRY_CONFIG.get(country, RRG_COUNTRY_CONFIG['us'])
    benchmark = request.args.get('benchmark', cfg['benchmark'])
    tail_length = int(request.args.get('tail', '10'))

    rrg_period = request.args.get('period', '1m').lower()
    _period_map = {
        '1d': ('5d',   '1d'),
        '1w': ('30d',  '1d'),
        '1m': ('60d',  '1d'),
        '3m': ('90d',  '1d'),
        '6m': ('1y',   '1wk'),
        '1y': ('2y',   '1wk'),
    }
    yf_period, interval = _period_map.get(rrg_period, ('60d', '1d'))

    cache_key = f"{country}|{benchmark}|{rrg_period}"
    if cache_key in _rrg_caches:
        entry = _rrg_caches[cache_key]
        if entry.get("data") and (now - entry["timestamp"]) < RRG_CACHE_DURATION:
            return jsonify(entry["data"])

    try:
        mode = cfg['mode']
        rrg_sectors = []

        if mode == 'etf':
            sectors_list = cfg['sectors']
            all_symbols = [benchmark] + sectors_list
            raw = yf.download(all_symbols, period=yf_period, interval=interval,
                              progress=False, auto_adjust=True)
            if raw.empty:
                return jsonify({"error": "No data", "sectors": []}), 500
            closes = (raw['Close'] if 'Close' in raw.columns else raw).dropna(how='all')
            if benchmark not in closes.columns:
                return jsonify({"error": f"Benchmark {benchmark} not found", "sectors": []}), 500
            bm = closes[benchmark]
            n_pts = int(bm.dropna().count())
            ratio_span = max(5, min(n_pts // 4, 40))
            mom_span   = max(3, ratio_span // 2)

            for sym in sectors_list:
                col = closes[sym] if sym in closes.columns else None
                if col is None:
                    print(f"[RRG] ETF {sym} missing from download")
                    continue
                try:
                    rs_ratio, rs_momentum = _compute_rrg_for_sym(col, bm, ratio_span, mom_span)
                    if rs_ratio is None:
                        continue
                    result = _build_rrg_result(sym, rs_ratio, rs_momentum, tail_length)
                    if result:
                        rrg_sectors.append(result)
                except Exception as e:
                    print(f"[RRG] ETF {sym}: {e}")

        else:  # grouped — pre-aggregate in Python
            sector_groups = cfg['sector_groups']
            all_members = list(set(m for ms in sector_groups.values() for m in ms))
            all_symbols = [benchmark] + all_members
            raw = yf.download(all_symbols, period=yf_period, interval=interval,
                              progress=False, auto_adjust=True)
            if raw.empty:
                return jsonify({"error": "No data", "sectors": []}), 500
            closes = (raw['Close'] if 'Close' in raw.columns else raw).dropna(how='all')
            if benchmark not in closes.columns:
                return jsonify({"error": f"Benchmark {benchmark} not found", "sectors": []}), 500
            bm = closes[benchmark]
            n_pts = int(bm.dropna().count())
            ratio_span = max(5, min(n_pts // 4, 40))
            mom_span   = max(3, ratio_span // 2)

            for sector_id, members in sector_groups.items():
                rr_list, rm_list = [], []
                for sym in members:
                    if sym not in closes.columns:
                        continue
                    try:
                        rs_ratio, rs_momentum = _compute_rrg_for_sym(
                            closes[sym], bm, ratio_span, mom_span)
                        if rs_ratio is not None:
                            rr_list.append(rs_ratio)
                            rm_list.append(rs_momentum)
                    except Exception as e:
                        print(f"[RRG] {sector_id}/{sym}: {e}")

                if not rr_list:
                    print(f"[RRG] Sector {sector_id}: no members with data — skipping")
                    continue
                # Average aligned series across all available members
                rr_avg = pd.concat(rr_list, axis=1).mean(axis=1)
                rm_avg = pd.concat(rm_list, axis=1).mean(axis=1)
                result = _build_rrg_result(sector_id, rr_avg, rm_avg, tail_length)
                if result:
                    result['constituents'] = len(rr_list)
                    rrg_sectors.append(result)

        # ── Post-processing: normalize all 11 nodes into a consistent viewport ──
        rrg_sectors = _normalize_rrg_coords(rrg_sectors)

        print(f"[RRG] {country}/{rrg_period}: {len(rrg_sectors)} sectors")
        response = {
            "benchmark": benchmark,
            "country": country,
            "sectors": rrg_sectors,
            "tailLength": tail_length,
            "fetchedAt": datetime.now(US_EASTERN).strftime('%Y-%m-%dT%H:%M:%S'),
        }
        _rrg_caches[cache_key] = {"data": response, "timestamp": now}
        return jsonify(response)

    except Exception as e:
        print(f"[RRG] Fatal error: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e), "sectors": []}), 500


# ─── Sector Returns: 1-day weighted-average % change per sector ───────────────
_sector_returns_cache: dict = {}
SECTOR_RETURNS_CACHE_DURATION = 120  # 2 minutes

# Constituent stocks per sector per country (mirrors frontend sectorGroups)
SECTOR_CONSTITUENTS = {
    'us':  [(s, [s]) for s in ['XLK','XLF','XLV','XLE','XLY','XLP','XLI','XLB','XLRE','XLU','XLC']],
    'eu':  [(s, [s]) for s in ['EWG','EDEN','EWI','EWP','EWN','EWL','EWU','EWD','EWO','ENOR','EWK']],
    'kr': [
        ('KR_SEMI',    ['005930.KS','000660.KS','066570.KS','006400.KS']),
        ('KR_AUTO',    ['005380.KS','000270.KS','012330.KS']),
        ('KR_BIO',     ['068270.KS','207940.KS','128940.KS']),
        ('KR_FIN',     ['105560.KS','055550.KS','086790.KS']),
        ('KR_CHEM',    ['051910.KS','373220.KS','247540.KS']),
        ('KR_NET',     ['035420.KS','035720.KS','259960.KS']),
        ('KR_STEEL',   ['003670.KS','004020.KS','010120.KS']),
        ('KR_TELE',    ['017670.KS','030200.KS','032640.KS']),
        ('KR_CONDISC', ['069960.KS','023530.KS','139480.KS','004170.KS']),
        ('KR_UTIL',    ['015760.KS','036460.KS','018670.KS']),
        ('KR_RE',      ['012630.KS','000720.KS','006360.KS','000210.KS']),
    ],
    'jp': [
        ('JP_AUTO',     ['7203.T','7267.T','7270.T','7201.T']),
        ('JP_ELEC',     ['6758.T','6501.T','6752.T','7751.T','6701.T']),
        ('JP_FIN',      ['8306.T','8316.T','8411.T']),
        ('JP_PHARM',    ['4502.T','4503.T','4568.T']),
        ('JP_IT',       ['9984.T','4689.T','3659.T']),
        ('JP_RETAIL',   ['3382.T','8267.T','8028.T']),
        ('JP_RE',       ['8802.T','8801.T','8804.T']),
        ('JP_UTIL',     ['9501.T','9502.T','9503.T','4661.T']),
        ('JP_CHEM',     ['4063.T','4005.T','3402.T','3407.T']),
        ('JP_STEEL',    ['5401.T','5411.T','5406.T']),
        ('JP_CONSTAPLE',['2503.T','2502.T','2802.T','2269.T']),
    ],
}

@app.route('/sector-returns', methods=['GET'])
def get_sector_returns():
    """Compute equal-weighted % change for each sector over a given period."""
    import time
    now = time.time()

    country = request.args.get('country', 'us').lower()
    period_key = request.args.get('period', '1d').lower()

    # Map UI period to (yfinance fetch period, number of trading days back)
    _period_map = {
        '1d':  ('10d',  1),
        '1w':  ('30d',  5),
        '1m':  ('90d',  21),
        '3m':  ('180d', 63),
        '6m':  ('1y',   126),
        '1y':  ('2y',   252),
    }
    fetch_period, n_days = _period_map.get(period_key, ('10d', 1))

    cache_key = f"{country}_{period_key}"
    if cache_key in _sector_returns_cache:
        entry = _sector_returns_cache[cache_key]
        if entry.get("data") and (now - entry["timestamp"]) < SECTOR_RETURNS_CACHE_DURATION:
            return jsonify(entry["data"])

    constituents = SECTOR_CONSTITUENTS.get(country, SECTOR_CONSTITUENTS['us'])
    all_syms = list(set(sym for _, members in constituents for sym in members))

    try:
        raw = yf.download(all_syms, period=fetch_period, interval='1d', progress=False, auto_adjust=True)
        if raw.empty:
            return jsonify({"error": "No data", "sectors": []}), 500

        closes = raw['Close'] if 'Close' in raw.columns else raw
        closes = closes.dropna(how='all')

        results = []
        for sector_id, members in constituents:
            pct_changes = []
            for sym in members:
                col = closes.get(sym) if hasattr(closes, 'get') else (closes[sym] if sym in closes.columns else None)
                if col is None:
                    continue
                col = col.dropna()
                needed = n_days + 1
                if len(col) < needed:
                    continue
                prev = float(col.iloc[-needed])
                curr = float(col.iloc[-1])
                if prev != 0:
                    pct_changes.append((curr - prev) / prev * 100.0)
            if not pct_changes:
                continue
            avg_change = sum(pct_changes) / len(pct_changes)
            results.append({
                'symbol': sector_id,
                'changePercent': round(avg_change, 2),
                'constituents': len(pct_changes),
            })

        # Sort by % change descending
        results.sort(key=lambda x: x['changePercent'], reverse=True)
        response = {
            'country': country,
            'period': period_key,
            'sectors': results,
            'fetchedAt': datetime.now(US_EASTERN).strftime('%Y-%m-%dT%H:%M:%S'),
        }
        _sector_returns_cache[cache_key] = {"data": response, "timestamp": now}
        print(f"[SectorReturns] {country}/{period_key}: {len(results)} sectors computed")
        return jsonify(response)
    except Exception as e:
        print(f"[SectorReturns] Error for {country}/{period_key}: {e}")
        return jsonify({"error": str(e), "sectors": []}), 500


# ─── Sector Performance: 1D / 1W / 1M returns per sector ─────────────────────
_sector_perf_cache: dict = {}
SECTOR_PERF_CACHE_DURATION = 300  # 5 minutes

@app.route('/sector-performance', methods=['GET'])
def get_sector_performance():
    """Compute 1D, 1W, 1M cumulative returns for each sector."""
    import time
    now = time.time()

    country = request.args.get('country', 'us').lower()
    cache_key = country
    if cache_key in _sector_perf_cache:
        entry = _sector_perf_cache[cache_key]
        if entry.get("data") and (now - entry["timestamp"]) < SECTOR_PERF_CACHE_DURATION:
            return jsonify(entry["data"])

    constituents = SECTOR_CONSTITUENTS.get(country, SECTOR_CONSTITUENTS['us'])
    all_syms = list(set(sym for _, members in constituents for sym in members))

    try:
        raw = yf.download(all_syms, period='3mo', interval='1d', progress=False, auto_adjust=True)
        if raw.empty:
            return jsonify({"error": "No data", "sectors": []}), 500

        closes = raw['Close'] if 'Close' in raw.columns else raw
        closes = closes.dropna(how='all')

        def avg_return(members, n_days):
            changes = []
            for sym in members:
                col = closes.get(sym) if hasattr(closes, 'get') else (closes[sym] if sym in closes.columns else None)
                if col is None:
                    continue
                col = col.dropna()
                if len(col) < n_days + 1:
                    continue
                curr = float(col.iloc[-1])
                prev = float(col.iloc[-(n_days + 1)])
                if prev != 0:
                    changes.append((curr - prev) / prev * 100.0)
            if not changes:
                return None
            return round(sum(changes) / len(changes), 2)

        results = []
        for sector_id, members in constituents:
            r1d = avg_return(members, 1)
            r1w = avg_return(members, 5)
            r1m = avg_return(members, 22)
            if r1d is None and r1w is None and r1m is None:
                continue
            results.append({'symbol': sector_id, '1d': r1d, '1w': r1w, '1m': r1m})

        response = {
            'country': country,
            'sectors': results,
            'fetchedAt': datetime.now(US_EASTERN).strftime('%Y-%m-%dT%H:%M:%S'),
        }
        _sector_perf_cache[cache_key] = {"data": response, "timestamp": now}
        print(f"[SectorPerf] {country}: {len(results)} sectors")
        return jsonify(response)
    except Exception as e:
        print(f"[SectorPerf] Error for {country}: {e}")
        return jsonify({"error": str(e), "sectors": []}), 500


# ─── Ownership: insider trades + institutional/fund holders via yfinance ───────
_ownership_cache: dict = {}
OWNERSHIP_CACHE_DURATION = 3600  # 1 hour

@app.route('/ownership', methods=['GET'])
def get_ownership():
    """Get insider trades (Form 4), institutional holders, or fund holders."""
    import time
    now = time.time()

    ticker = request.args.get('ticker', 'NVDA').upper()
    type_  = request.args.get('type', 'insiders')

    cache_key = f"{ticker}:{type_}"
    if cache_key in _ownership_cache:
        entry = _ownership_cache[cache_key]
        if entry.get("data") and (now - entry["timestamp"]) < OWNERSHIP_CACHE_DURATION:
            return jsonify(entry["data"])

    try:
        stock = yf.Ticker(ticker)

        def safe_float(v, default=0.0):
            try:
                f = float(v)
                return default if (f != f) else f  # NaN check
            except:
                return default

        def safe_int(v, default=0):
            try:
                f = float(v)
                if f != f: return default
                return int(abs(f))
            except:
                return default

        def safe_str(v):
            s = str(v)
            return "" if s in ("nan", "None", "NaT", "<NA>") else s

        if type_ == 'insiders':
            df = stock.insider_transactions
            if df is None or (hasattr(df, 'empty') and df.empty):
                return jsonify({"ticker": ticker, "trades": []})

            import re as _re
            trades = []
            for _, row in df.iterrows():
                try:
                    owner    = safe_str(row.get('Insider', row.get('Name', '')))
                    position = safe_str(row.get('Position', row.get('Relationship', '')))
                    shares   = safe_int(row.get('Shares', 0))
                    value    = safe_int(row.get('Value', 0))
                    url      = safe_str(row.get('URL', row.get('Url', '')))

                    # Date: yfinance uses 'Start Date' (pandas Timestamp)
                    d_raw = row.get('Start Date', row.get('Date', ''))
                    if hasattr(d_raw, 'strftime'):
                        date_val = d_raw.strftime('%Y-%m-%d')
                    else:
                        date_val = safe_str(d_raw)[:10]

                    # Transaction type: from 'Text' description since 'Transaction' is often empty
                    text  = safe_str(row.get('Text', row.get('Transaction', '')))
                    txn_raw = safe_str(row.get('Transaction', ''))
                    combined = (text + ' ' + txn_raw).lower()
                    if _re.search(r'\bpurchase\b|\bbuy\b|\baquired\b', combined):
                        txn_type = 'Buy'
                    elif _re.search(r'\bsale\b|\bsell\b|\bsold\b|\bdispos', combined):
                        txn_type = 'Sale'
                    elif _re.search(r'option|exercise', combined):
                        txn_type = 'Option Exercise'
                    elif _re.search(r'award|grant', combined):
                        txn_type = 'Grant'
                    else:
                        txn_type = txn_raw or 'Other'

                    # Price: extract from Text "at price X.XX" or compute from value/shares
                    price = 0.0
                    m = _re.search(r'price ([\d,]+\.?\d*)', text, _re.I)
                    if m:
                        price = float(m.group(1).replace(',', ''))
                    elif shares > 0 and value > 0:
                        price = round(value / shares, 2)

                    trades.append({
                        'ticker': ticker, 'owner': owner, 'relationship': position,
                        'date': date_val, 'transactionType': txn_type,
                        'shares': shares, 'price': price, 'value': value, 'filingUrl': url,
                    })
                except Exception as e2:
                    print(f"[Ownership] Row error: {e2}")

            response = {"ticker": ticker, "trades": trades}
            _ownership_cache[cache_key] = {"data": response, "timestamp": now}
            print(f"[Ownership] {ticker}/insiders: {len(trades)} trades")
            return jsonify(response)

        elif type_ in ('managers', 'funds'):
            df = stock.institutional_holders if type_ == 'managers' else stock.mutualfund_holders
            if df is None or (hasattr(df, 'empty') and df.empty):
                return jsonify({"ticker": ticker, "holders": []})

            holders = []
            for _, row in df.iterrows():
                try:
                    pct_raw = safe_float(row.get('% Out', row.get('pctHeld', 0)))
                    # yfinance returns pct as fraction (0.05 = 5%) or already in %
                    pct = round(pct_raw * 100, 2) if pct_raw < 1.0 else round(pct_raw, 2)
                    holders.append({
                        'holder':       safe_str(row.get('Holder', '')),
                        'shares':       safe_int(row.get('Shares', 0)),
                        'dateReported': safe_str(row.get('Date Reported', row.get('dateReported', ''))),
                        'pctHeld':      pct,
                        'value':        safe_int(row.get('Value', 0)),
                    })
                except Exception as e2:
                    print(f"[Ownership] Holder row error: {e2}")

            response = {"ticker": ticker, "holders": holders}
            _ownership_cache[cache_key] = {"data": response, "timestamp": now}
            print(f"[Ownership] {ticker}/{type_}: {len(holders)} holders")
            return jsonify(response)

        return jsonify({"error": "Invalid type. Use insiders|managers|funds"}), 400

    except Exception as e:
        print(f"[Ownership] Error for {ticker}/{type_}: {e}")
        return jsonify({"error": str(e), "trades": [], "holders": []}), 500


# ─── Analyst Recommendations + Short Interest ─────────────────────────────────
_analyst_cache: dict = {}
ANALYST_CACHE_DURATION = 3600

@app.route('/analyst/<path:symbol>', methods=['GET'])
def get_analyst(symbol):
    """Get analyst recommendations summary, upgrades/downgrades, short interest, target price."""
    import time
    now = time.time()
    symbol = symbol.upper()

    if symbol in _analyst_cache:
        entry = _analyst_cache[symbol]
        if entry.get("data") and (now - entry["timestamp"]) < ANALYST_CACHE_DURATION:
            return jsonify(entry["data"])

    try:
        stock = yf.Ticker(symbol)

        summary = {"strongBuy": 0, "buy": 0, "hold": 0, "sell": 0, "strongSell": 0}
        try:
            rec_df = stock.recommendations_summary
            if rec_df is not None and not (hasattr(rec_df, 'empty') and rec_df.empty):
                latest = rec_df.iloc[0]
                for key in ("strongBuy", "buy", "hold", "sell", "strongSell"):
                    v = latest.get(key, 0)
                    try: summary[key] = int(float(v)) if v == v else 0
                    except: pass
        except Exception as e:
            print(f"[Analyst] rec_summary error {symbol}: {e}")

        recent_actions = []
        try:
            upgrades_df = stock.upgrades_downgrades
            if upgrades_df is not None and not (hasattr(upgrades_df, 'empty') and upgrades_df.empty):
                for idx, row in upgrades_df.head(8).iterrows():
                    try:
                        date_str = idx.strftime('%Y-%m-%d') if hasattr(idx, 'strftime') else str(idx)[:10]
                        recent_actions.append({
                            "date": date_str,
                            "firm": str(row.get("Firm", "") or ""),
                            "action": str(row.get("Action", "") or ""),
                            "fromGrade": str(row.get("FromGrade", "") or ""),
                            "toGrade": str(row.get("ToGrade", "") or ""),
                        })
                    except: pass
        except Exception as e:
            print(f"[Analyst] upgrades error {symbol}: {e}")

        info = stock.info
        def safe_float(v):
            try:
                f = float(v)
                return None if f != f else f
            except: return None

        result = {
            "symbol": symbol,
            "summary": summary,
            "recentActions": recent_actions,
            "shortRatio": safe_float(info.get("shortRatio")),
            "shortPctFloat": safe_float(info.get("shortPercentOfFloat")),
            "targetPrice": safe_float(info.get("targetMeanPrice")),
            "targetHigh": safe_float(info.get("targetHighPrice")),
            "targetLow": safe_float(info.get("targetLowPrice")),
            "currentPrice": safe_float(info.get("currentPrice") or info.get("regularMarketPrice")),
        }
        if result["shortPctFloat"] is not None:
            result["shortPctFloat"] = round(result["shortPctFloat"] * 100, 2)

        _analyst_cache[symbol] = {"data": result, "timestamp": now}
        print(f"[Analyst] {symbol}: buy={summary['buy']+summary['strongBuy']}, hold={summary['hold']}, sell={summary['sell']+summary['strongSell']}, target={result['targetPrice']}")
        return jsonify(result)

    except Exception as e:
        print(f"[Analyst] Error for {symbol}: {e}")
        return jsonify({"symbol": symbol, "summary": {}, "recentActions": [], "error": str(e)}), 500


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


_breadth_cache = {"data": None, "timestamp": 0}
BREADTH_CACHE_DURATION = 900  # 15 minutes

@app.route('/breadth', methods=['GET'])
def get_market_breadth():
    """Compute % of stocks above SMA50 and SMA200 for major US stocks."""
    import time
    now = time.time()
    if _breadth_cache["data"] and (now - _breadth_cache["timestamp"]) < BREADTH_CACHE_DURATION:
        return jsonify(_breadth_cache["data"])

    symbols = request.args.get(
        'symbols',
        'NVDA,TSLA,AAPL,MSFT,AMZN,META,GOOGL,AMD,NFLX,JPM,XOM,AVGO,CRM,COST,V'
    ).split(',')
    us_symbols = [s.strip() for s in symbols if s.strip() and '.' not in s]

    above_50 = 0
    above_200 = 0
    total = 0
    details = {}

    try:
        import pandas as pd
        raw = yf.download(us_symbols, period='1y', interval='1d',
                          auto_adjust=True, progress=False)
        closes = raw['Close'] if isinstance(raw.columns, pd.MultiIndex) else raw
        for sym in us_symbols:
            try:
                col = closes[sym] if sym in closes.columns else closes
                arr = col.dropna().values
                if len(arr) < 50:
                    continue
                current = float(arr[-1])
                sma50 = float(arr[-50:].mean())
                a50 = current > sma50
                a200 = False
                sma200 = None
                if len(arr) >= 200:
                    sma200 = float(arr[-200:].mean())
                    a200 = current > sma200
                    above_200 += (1 if a200 else 0)
                above_50 += (1 if a50 else 0)
                total += 1
                details[sym] = {
                    'aboveSMA50': a50,
                    'aboveSMA200': a200,
                    'price': round(current, 2),
                    'sma50': round(sma50, 2),
                    'sma200': round(sma200, 2) if sma200 else None,
                }
            except Exception:
                pass
    except Exception as e:
        return jsonify({'error': str(e), 'pctAboveSMA50': 0, 'pctAboveSMA200': 0, 'total': 0}), 200

    result = {
        'pctAboveSMA50': round((above_50 / total * 100) if total > 0 else 0),
        'pctAboveSMA200': round((above_200 / total * 100) if total > 0 else 0),
        'above50': above_50,
        'above200': above_200,
        'total': total,
        'details': details,
    }
    _breadth_cache["data"] = result
    _breadth_cache["timestamp"] = now
    return jsonify(result)



# ===== ECONOMIC ACTUALS (FRED + BLS) =====
_fred_raw_cache: dict = {}        # series_id -> [(date_str, float)]
_fred_raw_cache_ts: dict = {}     # series_id -> float (time.time)
FRED_CACHE_TTL = 5 * 60          # 5 minutes (faster refresh for live data)
FRED_BASE_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv"

# BLS Public API v1 (no API key) — updates within ~1 hr of official release
# Format: https://api.bls.gov/publicAPI/v1/timeseries/data/{series_id}
BLS_BASE_URL = "https://api.bls.gov/publicAPI/v1/timeseries/data"
_bls_cache: dict = {}       # series_id -> {year: str, period: "M01"…, value: float}[]
_bls_cache_ts: dict = {}    # series_id -> float
BLS_CACHE_TTL = 5 * 60      # 5 minutes

# BLS series: event_id -> (series_id, ref_year, ref_period "M01"…"M12", fmt)
# Only NFP and Unemployment are mapped here (BLS is faster than FRED for these)
EVENT_BLS_MAP = {
    # NFP: BLS CES0000000001 — all-nonfarm level in thousands; compute MoM change
    "2026-03-06-nfp":    ("CES0000000001", "2026", "M02", "bls_change_k"),
    "2026-04-03-nfp":    ("CES0000000001", "2026", "M03", "bls_change_k"),
    "2026-05-01-nfp":    ("CES0000000001", "2026", "M04", "bls_change_k"),
    "2026-06-05-nfp":    ("CES0000000001", "2026", "M05", "bls_change_k"),
    "2026-07-03-nfp":    ("CES0000000001", "2026", "M06", "bls_change_k"),
    "2026-08-07-nfp":    ("CES0000000001", "2026", "M07", "bls_change_k"),
    # Unemployment rate: BLS LNS14000000
    "2026-03-06-unemp":  ("LNS14000000", "2026", "M02", "bls_direct_pct"),
    "2026-04-03-unemp":  ("LNS14000000", "2026", "M03", "bls_direct_pct"),
    "2026-05-01-unemp":  ("LNS14000000", "2026", "M04", "bls_direct_pct"),
    "2026-06-05-unemp":  ("LNS14000000", "2026", "M05", "bls_direct_pct"),
    "2026-07-03-unemp":  ("LNS14000000", "2026", "M06", "bls_direct_pct"),
    "2026-08-07-unemp":  ("LNS14000000", "2026", "M07", "bls_direct_pct"),
    # CPI: BLS CUUR0000SA0 (All Urban Consumers, all items)
    "2026-03-11-cpi":    ("CUUR0000SA0", "2026", "M02", "bls_pct_mom"),
    "2026-04-10-cpi":    ("CUUR0000SA0", "2026", "M03", "bls_pct_mom"),
    "2026-05-13-cpi":    ("CUUR0000SA0", "2026", "M04", "bls_pct_mom"),
    "2026-06-11-cpi":    ("CUUR0000SA0", "2026", "M05", "bls_pct_mom"),
    "2026-07-15-cpi":    ("CUUR0000SA0", "2026", "M06", "bls_pct_mom"),
    "2026-08-12-cpi":    ("CUUR0000SA0", "2026", "M07", "bls_pct_mom"),
    # Core CPI: BLS CUUR0000SA0L1E (less food and energy)
    "2026-03-11-core-cpi": ("CUUR0000SA0L1E", "2026", "M02", "bls_pct_yoy"),
    "2026-04-10-core-cpi": ("CUUR0000SA0L1E", "2026", "M03", "bls_pct_yoy"),
    "2026-05-13-core-cpi": ("CUUR0000SA0L1E", "2026", "M04", "bls_pct_yoy"),
    "2026-06-11-core-cpi": ("CUUR0000SA0L1E", "2026", "M05", "bls_pct_yoy"),
    "2026-07-15-core-cpi": ("CUUR0000SA0L1E", "2026", "M06", "bls_pct_yoy"),
    "2026-08-12-core-cpi": ("CUUR0000SA0L1E", "2026", "M07", "bls_pct_yoy"),
    # PPI: BLS WPU00000000 (Producer Price Index, all commodities)
    "2026-03-12-ppi":    ("WPU00000000", "2026", "M02", "bls_pct_mom"),
    "2026-04-11-ppi":    ("WPU00000000", "2026", "M03", "bls_pct_mom"),
    "2026-05-14-ppi":    ("WPU00000000", "2026", "M04", "bls_pct_mom"),
    "2026-06-12-ppi":    ("WPU00000000", "2026", "M05", "bls_pct_mom"),
    "2026-07-14-ppi":    ("WPU00000000", "2026", "M06", "bls_pct_mom"),
    "2026-08-13-ppi":    ("WPU00000000", "2026", "M07", "bls_pct_mom"),
}

# Map: event_id -> (fred_series_id, obs_date "YYYY-MM-01", fmt)
# fmt: "direct_pct" | "direct_idx" | "change_k" | "pct_mom" | "pct_yoy"
EVENT_FRED_MAP = {
    "2026-02-27-pce":       ("PCEPILFE",        "2026-01-01", "pct_mom"),
    "2026-02-27-sentiment": ("UMCSENT",         "2026-02-01", "direct_idx"),
    "2026-03-17-retail":    ("RSXFS",           "2026-02-01", "pct_mom"),
    "2026-03-27-pce":       ("PCEPILFE",        "2026-02-01", "pct_mom"),
    "2026-03-31-conf-board":("CONCCONF",        "2026-03-01", "direct_idx"),
    "2026-04-01-ism-mfg":   (None, None, None),
    "2026-04-16-retail":    ("RSXFS",           "2026-03-01", "pct_mom"),
    "2026-04-30-gdp":       ("A191RL1Q225SBEA", "2026-01-01", "direct_pct"),
    "2026-04-30-pce":       ("PCEPILFE",        "2026-03-01", "pct_mom"),
    "2026-05-15-retail":    ("RSXFS",           "2026-04-01", "pct_mom"),
    "2026-05-30-pce":       ("PCEPILFE",        "2026-04-01", "pct_mom"),
    "2026-06-19-retail":    ("RSXFS",           "2026-05-01", "pct_mom"),
    "2026-06-27-pce":       ("PCEPILFE",        "2026-05-01", "pct_mom"),
    "2026-07-17-retail":    ("RSXFS",           "2026-06-01", "pct_mom"),
    "2026-07-31-gdp-q2":    ("A191RL1Q225SBEA", "2026-04-01", "direct_pct"),
    "2026-08-14-retail":    ("RSXFS",           "2026-07-01", "pct_mom"),
    "2026-08-28-pce":       ("PCEPILFE",        "2026-07-01", "pct_mom"),
    # ── Japan CPI (Statistics Bureau of Japan via FRED) ────────────────
    "2026-03-17-japan-cpi": ("JPNCPIALLMINMEI", "2026-02-01", "pct_yoy"),
    "2026-04-16-japan-cpi": ("JPNCPIALLMINMEI", "2026-03-01", "pct_yoy"),
    "2026-05-22-japan-cpi": ("JPNCPIALLMINMEI", "2026-04-01", "pct_yoy"),
    "2026-06-18-japan-cpi": ("JPNCPIALLMINMEI", "2026-05-01", "pct_yoy"),
    "2026-07-17-japan-cpi": ("JPNCPIALLMINMEI", "2026-06-01", "pct_yoy"),
    "2026-08-20-japan-cpi": ("JPNCPIALLMINMEI", "2026-07-01", "pct_yoy"),
    # ── South Korea CPI (Statistics Korea via FRED) ────────────────────
    "2026-03-26-korea-cpi": ("KORCPIALLMINMEI", "2026-02-01", "pct_yoy"),
    "2026-04-30-korea-cpi": ("KORCPIALLMINMEI", "2026-03-01", "pct_yoy"),
    "2026-05-28-korea-cpi": ("KORCPIALLMINMEI", "2026-04-01", "pct_yoy"),
    # ── China CPI (NBS via FRED) ────────────────────────────────────────
    "2026-03-11-china-cpi": ("CHNCPIALLMINMEI", "2026-02-01", "pct_yoy"),
    "2026-04-11-china-cpi": ("CHNCPIALLMINMEI", "2026-03-01", "pct_yoy"),
    "2026-05-11-china-cpi": ("CHNCPIALLMINMEI", "2026-04-01", "pct_yoy"),
    "2026-06-12-china-cpi": ("CHNCPIALLMINMEI", "2026-05-01", "pct_yoy"),
    "2026-07-11-china-cpi": ("CHNCPIALLMINMEI", "2026-06-01", "pct_yoy"),
    "2026-08-11-china-cpi": ("CHNCPIALLMINMEI", "2026-07-01", "pct_yoy"),
}

def _fetch_fred_series(series_id: str) -> list:
    """Fetch and cache FRED series observations from public CSV (no auth)."""
    import time as _time
    now = _time.time()
    if series_id in _fred_raw_cache and (now - _fred_raw_cache_ts.get(series_id, 0)) < FRED_CACHE_TTL:
        return _fred_raw_cache[series_id]
    try:
        resp = requests.get(f"{FRED_BASE_URL}?id={series_id}", timeout=12,
                            headers={"User-Agent": "Mozilla/5.0"})
        if not resp.ok:
            return []
        rows = []
        for line in resp.text.strip().split("\n")[1:]:
            parts = line.strip().split(",")
            if len(parts) != 2 or not parts[1].strip() or parts[1].strip() == ".":
                continue
            try:
                rows.append((parts[0].strip(), float(parts[1].strip())))
            except ValueError:
                pass
        _fred_raw_cache[series_id] = rows
        _fred_raw_cache_ts[series_id] = now
        return rows
    except Exception as e:
        print(f"[FRED] fetch error {series_id}: {e}")
        return []

def _get_fred_obs(series_id: str, target_date: str) -> tuple | None:
    """Get (value_at_target, value_at_prev_month) from FRED series."""
    rows = _fetch_fred_series(series_id)
    if not rows:
        return None
    obs_map = {r[0]: r[1] for r in rows}
    val = obs_map.get(target_date)
    if val is None:
        return None
    from datetime import datetime, timedelta
    dt = datetime.strptime(target_date, "%Y-%m-%d")
    prev_month_dt = (dt.replace(day=1) - timedelta(days=1)).replace(day=1)
    prev_date = prev_month_dt.strftime("%Y-%m-%d")
    prev_val = obs_map.get(prev_date)
    year_ago_dt = dt.replace(year=dt.year - 1)
    year_ago_date = year_ago_dt.strftime("%Y-%m-%d")
    year_ago_val = obs_map.get(year_ago_date)
    return (val, prev_val, year_ago_val)

def _format_fred_value(series_id: str, obs_date: str, fmt: str) -> str | None:
    """Compute the display string for a FRED observation."""
    result = _get_fred_obs(series_id, obs_date)
    if result is None:
        return None
    val, prev_val, year_ago_val = result
    try:
        if fmt == "direct_pct":
            return f"{val:.1f}%"
        elif fmt == "direct_idx":
            return f"{val:.1f}"
        elif fmt == "change_k":
            if prev_val is None:
                return None
            change = val - prev_val
            sign = "+" if change >= 0 else ""
            return f"{sign}{change:.0f}K"
        elif fmt == "pct_mom":
            if prev_val is None or prev_val == 0:
                return None
            pct = (val - prev_val) / prev_val * 100
            sign = "+" if pct >= 0 else ""
            return f"{sign}{pct:.1f}%"
        elif fmt == "pct_yoy":
            if year_ago_val is None or year_ago_val == 0:
                return None
            pct = (val - year_ago_val) / year_ago_val * 100
            sign = "+" if pct >= 0 else ""
            return f"{sign}{pct:.1f}%"
    except Exception:
        return None
    return None

def _fetch_bls_series(series_id: str) -> list:
    """Fetch BLS series observations (no API key, v1). Returns [{year, period, value}]."""
    import time as _t
    now = _t.time()
    if series_id in _bls_cache and (now - _bls_cache_ts.get(series_id, 0)) < BLS_CACHE_TTL:
        return _bls_cache[series_id]
    try:
        url = f"{BLS_BASE_URL}/{series_id}"
        resp = requests.get(url, timeout=12, headers={"User-Agent": "Mozilla/5.0"})
        if not resp.ok:
            return _bls_cache.get(series_id, [])
        data = resp.json()
        rows = []
        for obs in data.get("Results", {}).get("series", [{}])[0].get("data", []):
            try:
                period = obs.get("period", "")
                if not period.startswith("M"):
                    continue
                val_str = obs.get("value", "").strip()
                if val_str in ("-", ""):
                    continue
                rows.append({
                    "year": obs["year"],
                    "period": period,
                    "value": float(val_str),
                })
            except (ValueError, KeyError):
                pass
        _bls_cache[series_id] = rows
        _bls_cache_ts[series_id] = now
        return rows
    except Exception as e:
        print(f"[BLS] fetch error {series_id}: {e}")
        return _bls_cache.get(series_id, [])

def _format_bls_value(series_id: str, ref_year: str, ref_period: str, fmt: str) -> str | None:
    """Compute the display string from a BLS series."""
    rows = _fetch_bls_series(series_id)
    if not rows:
        return None
    obs_map = {(r["year"], r["period"]): r["value"] for r in rows}
    val = obs_map.get((ref_year, ref_period))
    if val is None:
        return None
    try:
        if fmt == "bls_direct_pct":
            return f"{val:.1f}%"
        elif fmt == "bls_direct_idx":
            return f"{val:.1f}"
        elif fmt == "bls_change_k":
            month_num = int(ref_period[1:])
            if month_num == 1:
                prev_year = str(int(ref_year) - 1)
                prev_period = "M12"
            else:
                prev_year = ref_year
                prev_period = f"M{month_num - 1:02d}"
            prev_val = obs_map.get((prev_year, prev_period))
            if prev_val is None:
                return None
            change = val - prev_val
            sign = "+" if change >= 0 else ""
            return f"{sign}{change:.0f}K"
        elif fmt == "bls_pct_mom":
            month_num = int(ref_period[1:])
            if month_num == 1:
                prev_year = str(int(ref_year) - 1)
                prev_period = "M12"
            else:
                prev_year = ref_year
                prev_period = f"M{month_num - 1:02d}"
            prev_val = obs_map.get((prev_year, prev_period))
            if prev_val is None or prev_val == 0:
                return None
            pct = (val - prev_val) / prev_val * 100
            sign = "+" if pct >= 0 else ""
            return f"{sign}{pct:.2f}%"
        elif fmt == "bls_pct_yoy":
            month_num = int(ref_period[1:])
            yoy_year = str(int(ref_year) - 1)
            yoy_val = obs_map.get((yoy_year, ref_period))
            if yoy_val is None or yoy_val == 0:
                return None
            pct = (val - yoy_val) / yoy_val * 100
            sign = "+" if pct >= 0 else ""
            return f"{sign}{pct:.1f}%"
    except Exception:
        return None
    return None

@app.route('/economic_actuals', methods=['GET'])
def get_economic_actuals():
    """Return actual values for economic events from BLS (primary) + FRED (fallback)."""
    import time as _time
    result = {}
    fetched_at = int(_time.time())

    # BLS source (faster — updates within ~1 hr of official release)
    for event_id, mapping in EVENT_BLS_MAP.items():
        series_id, ref_year, ref_period, fmt = mapping
        try:
            value = _format_bls_value(series_id, ref_year, ref_period, fmt)
            if value is not None:
                result[event_id] = value
        except Exception as e:
            print(f"[BLS actuals] error for {event_id}: {e}")

    # FRED source (fallback for non-BLS events: PCE, retail, GDP, Japan/Korea CPI)
    for event_id, mapping in EVENT_FRED_MAP.items():
        if event_id in result:
            continue
        series_id, obs_date, fmt = mapping
        if series_id is None:
            continue
        try:
            value = _format_fred_value(series_id, obs_date, fmt)
            if value is not None:
                result[event_id] = value
        except Exception as e:
            print(f"[FRED actuals] error for {event_id}: {e}")

    sources = {"bls": sum(1 for k in result if k in EVENT_BLS_MAP),
               "fred": sum(1 for k in result if k in EVENT_FRED_MAP)}
    print(f"[economic_actuals] {len(result)} actuals returned (BLS:{sources['bls']} FRED:{sources['fred']})")
    return jsonify({"actuals": result, "fetchedAt": fetched_at})



# ── Yahoo Finance Screener (Gainers / Losers / Most Active) ──────────
_screener_cache: dict = {}
_SCREENER_TTL = 300  # 5 minutes

def _fetch_yf_screener(scr_id: str) -> list:
    """Fetch a predefined Yahoo Finance screener list. Returns list of dicts."""
    import time as _t
    import requests as _req
    cached = _screener_cache.get(scr_id)
    if cached and (_t.time() - cached["ts"]) < _SCREENER_TTL:
        return cached["data"]
    url = (
        "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved"
        f"?formatted=false&lang=en-US&region=US&scrIds={scr_id}&start=0&count=25"
    )
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    try:
        resp = _req.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        raw = resp.json()
        quotes = raw.get("finance", {}).get("result", [{}])[0].get("quotes", [])
        data = [
            {
                "symbol": q.get("symbol", ""),
                "name":   q.get("longName") or q.get("shortName") or q.get("symbol", ""),
                "price":  q.get("regularMarketPrice", 0),
                "changePercent": q.get("regularMarketChangePercent", 0),
                "change": q.get("regularMarketChange", 0),
                "marketCap": q.get("marketCap", None),
                "isPenny": (q.get("regularMarketPrice", 0) or 0) < 5.0,
                "volatilityRank": abs(q.get("regularMarketChangePercent", 0) or 0),
            }
            for q in quotes if q.get("symbol")
        ]
        _screener_cache[scr_id] = {"data": data, "ts": _t.time()}
        return data
    except Exception as exc:
        print(f"[Screener] {scr_id} error: {exc}")
        return _screener_cache.get(scr_id, {}).get("data", [])


def _merge_screener_lists(*lists) -> list:
    """Merge multiple screener result lists, deduplicate by symbol, sort by volatilityRank desc."""
    seen = set()
    merged = []
    for lst in lists:
        for item in lst:
            sym = item.get("symbol", "")
            if sym and sym not in seen:
                seen.add(sym)
                merged.append(item)
    merged.sort(key=lambda x: x.get("volatilityRank", 0), reverse=True)
    return merged[:30]


@app.route('/screener/gainers', methods=['GET'])
def screener_gainers():
    main = _fetch_yf_screener("day_gainers")
    small = _fetch_yf_screener("small_cap_gainers")
    return jsonify(_merge_screener_lists(main, small))


@app.route('/screener/losers', methods=['GET'])
def screener_losers():
    main = _fetch_yf_screener("day_losers")
    return jsonify(main)


@app.route('/screener/actives', methods=['GET'])
def screener_actives():
    return jsonify(_fetch_yf_screener("most_actives"))


# ===== PEER COMPARISON =====
PEER_MAP: dict[str, list[str]] = {
    # ── US Big Tech ──
    "AAPL":      ["MSFT", "GOOGL", "META", "AMZN", "SONY"],
    "MSFT":      ["AAPL", "GOOGL", "ORCL", "SAP",  "CRM"],
    "GOOGL":     ["META", "MSFT",  "NFLX", "SNAP", "AAPL"],
    "GOOG":      ["META", "MSFT",  "NFLX", "SNAP", "AAPL"],
    "META":      ["GOOGL","SNAP",  "PINS", "NFLX", "MSFT"],
    "AMZN":      ["MSFT", "GOOGL", "AAPL", "WMT",  "SHOP"],
    "TSLA":      ["GM",   "F",     "NIO",  "RIVN", "LCID"],
    "NFLX":      ["DIS",  "PARA",  "WBD",  "AMZN", "SPOT"],
    # ── US Semiconductor ──
    "NVDA":      ["AMD",  "INTC",  "QCOM", "AVGO", "AMAT"],
    "AMD":       ["NVDA", "INTC",  "QCOM", "AVGO", "MRVL"],
    "INTC":      ["NVDA", "AMD",   "QCOM", "TSM",  "AVGO"],
    "QCOM":      ["NVDA", "AMD",   "AVGO", "MRVL", "ON"],
    "AVGO":      ["NVDA", "QCOM",  "AMD",  "MRVL", "TXN"],
    "TSM":       ["INTC", "NVDA",  "UMC",  "AVGO", "AMAT"],
    "AMAT":      ["LRCX", "KLAC",  "NVDA", "ASML", "TER"],
    "LRCX":      ["AMAT", "KLAC",  "TER",  "NVDA", "ASML"],
    "KLAC":      ["AMAT", "LRCX",  "TER",  "NVDA", "ASML"],
    "MU":        ["NVDA", "AMD",   "WDC",  "STX",  "INTC"],
    "MRVL":      ["NVDA", "AMD",   "AVGO", "QCOM", "ON"],
    "ON":        ["QCOM", "MRVL",  "SWKS", "TXN",  "NVDA"],
    "TXN":       ["AVGO", "QCOM",  "ON",   "MRVL", "ADI"],
    "COHR":      ["IIVI", "II",    "AAON", "LLTC", "OCLR"],
    "SMCI":      ["DELL", "HPE",   "NTAP", "PSTG", "PURE"],
    "ASML":      ["AMAT", "LRCX",  "KLAC", "TER",  "NVDA"],
    "ARM":       ["NVDA", "QCOM",  "AMD",  "INTC", "AVGO"],
    "WDC":       ["STX",  "MU",    "NVDA", "INTC", "NTAP"],
    "STX":       ["WDC",  "MU",    "NTAP", "PSTG", "DELL"],
    # ── US Software / Cloud ──
    "ORCL":      ["MSFT", "SAP",   "CRM",  "IBM",  "NOW"],
    "CRM":       ["ORCL", "SAP",   "MSFT", "NOW",  "WDAY"],
    "IBM":       ["MSFT", "ORCL",  "HPE",  "DELL", "ACN"],
    "NOW":       ["CRM",  "WDAY",  "ORCL", "MSFT", "SAP"],
    "WDAY":      ["CRM",  "NOW",   "ORCL", "SAP",  "ADBE"],
    "ADBE":      ["MSFT", "CRM",   "FIGM", "CANV", "WDAY"],
    "SNOW":      ["DDOG", "MDB",   "PLTR", "NET",  "ZS"],
    "PLTR":      ["AI",   "BBAI",  "SNOW", "DDOG", "MDB"],
    "NET":       ["ZS",   "PANW",  "CRWD", "FTNT", "OKTA"],
    "DDOG":      ["SNOW", "MDB",   "NET",  "ZS",   "SPLK"],
    "ZS":        ["NET",  "PANW",  "CRWD", "FTNT", "OKTA"],
    "CRWD":      ["PANW", "NET",   "ZS",   "FTNT", "OKTA"],
    "PANW":      ["CRWD", "NET",   "ZS",   "FTNT", "OKTA"],
    "FTNT":      ["PANW", "CRWD",  "NET",  "ZS",   "OKTA"],
    "OKTA":      ["CRWD", "PANW",  "ZS",   "NET",  "FTNT"],
    "SHOP":      ["AMZN", "MELI",  "UBER", "BKNG", "WMT"],
    "UBER":      ["LYFT", "DIDI",  "GRAB", "SHOP", "AMZN"],
    "SPOT":      ["NFLX", "DIS",   "AAPL", "AMZN", "PARA"],
    "RBLX":      ["EA",   "TTWO",  "ATVI", "MSFT", "NFLX"],
    "MSTR":      ["COIN", "MARA",  "RIOT", "CLSK", "BTBT"],
    "APP":       ["TTD",  "META",  "GOOGL","SNAP", "PINS"],
    "TTD":       ["APP",  "META",  "GOOGL","AMZN", "ROKU"],
    # ── US Financials ──
    "JPM":       ["BAC",  "WFC",   "GS",   "MS",   "C"],
    "BAC":       ["JPM",  "WFC",   "GS",   "MS",   "C"],
    "GS":        ["MS",   "JPM",   "BAC",  "BX",   "KKR"],
    "MS":        ["GS",   "JPM",   "BAC",  "SCHW", "BX"],
    "WFC":       ["JPM",  "BAC",   "USB",  "PNC",  "C"],
    "V":         ["MA",   "AXP",   "PYPL", "AFRM", "SOFI"],
    "MA":        ["V",    "AXP",   "PYPL", "AFRM", "SOFI"],
    "AXP":       ["V",    "MA",    "DFS",  "COF",  "SYF"],
    "PYPL":      ["V",    "MA",    "SQ",   "AFRM", "SOFI"],
    "COIN":      ["MARA", "RIOT",  "HOOD", "SOFI", "CLSK"],
    "BLK":       ["SCHW", "MS",    "IVZ",  "TROW", "BEN"],
    "SCHW":      ["MS",   "BLK",   "ETFC", "AMTD", "HOOD"],
    "AFRM":      ["PYPL", "V",     "MA",   "SQ",   "UPST"],
    "MCO":       ["SPGI", "MSCI",  "FDS",  "ICE",  "CME"],
    "SPGI":      ["MCO",  "MSCI",  "ICE",  "CME",  "FDS"],
    # ── US Healthcare ──
    "JNJ":       ["PFE",  "MRK",   "ABBV", "LLY",  "BMY"],
    "PFE":       ["JNJ",  "MRK",   "ABBV", "LLY",  "AMGN"],
    "LLY":       ["PFE",  "JNJ",   "MRK",  "ABBV", "NVO"],
    "MRK":       ["PFE",  "JNJ",   "ABBV", "LLY",  "BMY"],
    "ABBV":      ["JNJ",  "PFE",   "MRK",  "LLY",  "BMY"],
    "BMY":       ["PFE",  "JNJ",   "ABBV", "MRK",  "AMGN"],
    "AMGN":      ["GILD", "REGN",  "VRTX", "BIIB", "PFE"],
    "GILD":      ["AMGN", "REGN",  "VRTX", "BIIB", "ABBV"],
    "REGN":      ["AMGN", "GILD",  "VRTX", "BIIB", "SGEN"],
    "VRTX":      ["REGN", "AMGN",  "GILD", "BIIB", "MRNA"],
    "MRNA":      ["BNTX", "PFE",   "NVAX", "VRTX", "REGN"],
    "ISRG":      ["MDT",  "SYK",   "BSX",  "ZBH",  "ABMD"],
    "UNH":       ["CVS",  "CI",    "HUM",  "CNC",  "MOH"],
    "NVO":       ["LLY",  "PFE",   "AZN",  "SNY",  "NVS"],
    "AZN":       ["NVO",  "PFE",   "JNJ",  "NVS",  "SNY"],
    "ILMN":      ["PACB", "BNTX",  "CRSP", "BEAM", "EDIT"],
    "CRSP":      ["EDIT", "BEAM",  "NTLA", "ILMN", "MRNA"],
    # ── US Consumer / Retail ──
    "WMT":       ["AMZN", "TGT",   "COST", "HD",   "LOW"],
    "COST":      ["WMT",  "TGT",   "HD",   "LOW",  "AMZN"],
    "HD":        ["LOW",  "WMT",   "COST", "TGT",  "AMZN"],
    "TGT":       ["WMT",  "COST",  "HD",   "LOW",  "AMZN"],
    "MCD":       ["SBUX", "CMG",   "YUM",  "QSR",  "DPZ"],
    "SBUX":      ["MCD",  "CMG",   "YUM",  "QSR",  "DNKN"],
    "CMG":       ["MCD",  "SBUX",  "YUM",  "QSR",  "DPZ"],
    "NKE":       ["ADDYY","UAA",   "SKX",  "LULU", "VFC"],
    "LULU":      ["NKE",  "UAA",   "PVH",  "RL",   "VFC"],
    "KO":        ["PEP",  "KDP",   "MNST", "CELH", "PG"],
    "PEP":       ["KO",   "KDP",   "MNST", "CELH", "PG"],
    "BKNG":      ["EXPE", "ABNB",  "TRIP", "UBER", "LYFT"],
    "ABNB":      ["BKNG", "EXPE",  "TRIP", "VRBO", "HLT"],
    # ── US Energy ──
    "XOM":       ["CVX",  "COP",   "BP",   "SHEL", "TTE"],
    "CVX":       ["XOM",  "COP",   "BP",   "SHEL", "TTE"],
    "COP":       ["XOM",  "CVX",   "OXY",  "DVN",  "EOG"],
    "OXY":       ["COP",  "DVN",   "EOG",  "XOM",  "CVX"],
    "ENPH":      ["FSLR", "SEDG",  "RUN",  "SPWR", "ARRY"],
    "FSLR":      ["ENPH", "SEDG",  "RUN",  "CSIQ", "JKS"],
    "PLUG":      ["BLDP",  "FCEL",  "BE",   "HTOO", "HYLN"],
    # ── US Industrial / Defense ──
    "BA":        ["RTX",  "LMT",   "NOC",  "GD",   "HII"],
    "RTX":       ["BA",   "LMT",   "NOC",  "GD",   "HII"],
    "LMT":       ["RTX",  "BA",    "NOC",  "GD",   "HII"],
    "GE":        ["HON",  "RTX",   "MMM",  "EMR",  "ROK"],
    "CAT":       ["DE",   "CNH",   "HON",  "EMR",  "ROK"],
    "DE":        ["CAT",  "CNH",   "HON",  "EMR",  "AGCO"],
    "HON":       ["MMM",  "GE",    "EMR",  "ROK",  "CAT"],
    "UPS":       ["FDX",  "XPO",   "SAIA", "ODFL", "CHRW"],
    "FDX":       ["UPS",  "XPO",   "SAIA", "ODFL", "CHRW"],
    # ── US EV / Auto ──
    "GM":        ["F",    "TSLA",  "RIVN", "LCID", "STLA"],
    "F":         ["GM",   "TSLA",  "RIVN", "LCID", "STLA"],
    "RIVN":      ["LCID", "NIO",   "TSLA", "GM",   "F"],
    "LCID":      ["RIVN", "NIO",   "TSLA", "GM",   "F"],
    "NIO":       ["XPEV", "LI",    "TSLA", "RIVN", "LCID"],
    "XPEV":      ["NIO",  "LI",    "TSLA", "RIVN", "GM"],
    "LI":        ["NIO",  "XPEV",  "TSLA", "RIVN", "BYD"],
    # ── US Media ──
    "DIS":       ["NFLX", "PARA",  "WBD",  "CMCSA","SPOT"],
    "PARA":      ["DIS",  "WBD",   "NFLX", "AMZN", "CMCSA"],
    "WBD":       ["PARA", "DIS",   "NFLX", "AMZN", "CMCSA"],
    "EA":        ["TTWO", "ATVI",  "MSFT", "RBLX", "NCOFT"],
    "TTWO":      ["EA",   "ATVI",  "MSFT", "RBLX", "NTES"],
    # ── Chinese ADR ──
    "BABA":      ["JD",   "PDD",   "SE",   "BIDU", "TCEHY"],
    "BIDU":      ["BABA", "JD",    "PDD",  "NTES", "TCEHY"],
    "JD":        ["BABA", "PDD",   "SE",   "BIDU", "NTES"],
    "PDD":       ["BABA", "JD",    "SE",   "BIDU", "NTES"],

    # ── Korea KOSPI — Samsung Group ──
    "005930.KS": ["000660.KS","009150.KS","034220.KS","051910.KS","035420.KS"],
    "005935.KS": ["005930.KS","000660.KS","009150.KS","034220.KS","051910.KS"],
    "006400.KS": ["051910.KS","373220.KS","003670.KS","247540.KQ","086520.KQ"],
    "009150.KS": ["005930.KS","011070.KS","034220.KS","000660.KS","006400.KS"],
    "018260.KS": ["035420.KS","035720.KS","030200.KS","032640.KS","036570.KS"],
    "207940.KS": ["068270.KS","091990.KS","196170.KQ","145020.KQ","086900.KQ"],
    "016360.KS": ["105560.KS","055550.KS","086790.KS","071050.KS","039490.KS"],
    "032830.KS": ["000810.KS","088350.KS","082640.KS","138040.KS","105560.KS"],
    "000810.KS": ["032830.KS","088350.KS","082640.KS","138040.KS","105560.KS"],
    "010140.KS": ["329180.KS","047810.KS","012450.KS","064350.KS","010620.KS"],
    "028260.KS": ["139480.KS","004170.KS","069960.KS","023530.KS","282330.KS"],
    "028050.KS": ["000720.KS","034730.KS","096770.KS","009830.KS","078930.KS"],
    "029780.KS": ["105560.KS","055550.KS","071050.KS","016360.KS","039490.KS"],
    # ── Korea KOSPI — Hyundai Group ──
    "005380.KS": ["000270.KS","012330.KS","086280.KS","011210.KS","204320.KS"],
    "000270.KS": ["005380.KS","012330.KS","086280.KS","204320.KS","018880.KS"],
    "012330.KS": ["005380.KS","000270.KS","204320.KS","011210.KS","018880.KS"],
    "086280.KS": ["000120.KS","051500.KS","097500.KS","069260.KS","002150.KS"],
    "000720.KS": ["028050.KS","009830.KS","047050.KS","096760.KS","000140.KS"],
    "004020.KS": ["005490.KS","001230.KS","010130.KS","020000.KS","064960.KS"],
    "329180.KS": ["010140.KS","023160.KS","009540.KS","047810.KS","064350.KS"],
    "267250.KS": ["034730.KS","003550.KS","001040.KS","000880.KS","078930.KS"],
    "011210.KS": ["204320.KS","018880.KS","012330.KS","000270.KS","005380.KS"],
    "064350.KS": ["047810.KS","012450.KS","079550.KS","272210.KS","329180.KS"],
    "307950.KS": ["018260.KS","035420.KS","035720.KS","030200.KS","036570.KS"],
    "204320.KS": ["012330.KS","018880.KS","011210.KS","000270.KS","005380.KS"],
    # ── Korea KOSPI — LG Group ──
    "003550.KS": ["034730.KS","001040.KS","000880.KS","267250.KS","078930.KS"],
    "066570.KS": ["005930.KS","009150.KS","006400.KS","034220.KS","011070.KS"],
    "051910.KS": ["006400.KS","373220.KS","003670.KS","247540.KQ","086520.KQ"],
    "373220.KS": ["006400.KS","051910.KS","003670.KS","247540.KQ","086520.KQ"],
    "034220.KS": ["005930.KS","066570.KS","009150.KS","011070.KS","000660.KS"],
    "011070.KS": ["009150.KS","034220.KS","066570.KS","005930.KS","006400.KS"],
    "032640.KS": ["017670.KS","030200.KS","035420.KS","035720.KS","323410.KS"],
    "051900.KS": ["007310.KS","004370.KS","280360.KS","005300.KS","033780.KS"],
    # ── Korea KOSPI — SK Group ──
    "034730.KS": ["003550.KS","001040.KS","000880.KS","267250.KS","078930.KS"],
    "000660.KS": ["005930.KS","009150.KS","034220.KS","051910.KS","000990.KS"],
    "096770.KS": ["078930.KS","010950.KS","009830.KS","285130.KS","011070.KS"],
    "017670.KS": ["030200.KS","032640.KS","035420.KS","035720.KS","323410.KS"],
    "285130.KS": ["051910.KS","009830.KS","004000.KS","096770.KS","003670.KS"],
    "302440.KS": ["068270.KS","207940.KS","091990.KS","196170.KQ","145020.KQ"],
    "326030.KS": ["068270.KS","207940.KS","128940.KS","069620.KS","086900.KQ"],
    "402340.KS": ["034730.KS","018260.KS","035420.KS","035720.KS","030200.KS"],
    # ── Korea KOSPI — Financials ──
    "105560.KS": ["055550.KS","086790.KS","316140.KS","138040.KS","016360.KS"],
    "055550.KS": ["105560.KS","086790.KS","316140.KS","138040.KS","016360.KS"],
    "086790.KS": ["105560.KS","055550.KS","316140.KS","138040.KS","016360.KS"],
    "316140.KS": ["105560.KS","055550.KS","086790.KS","138040.KS","016360.KS"],
    "138040.KS": ["105560.KS","055550.KS","086790.KS","316140.KS","016360.KS"],
    "039490.KS": ["016360.KS","006800.KS","005940.KS","071050.KS","003540.KS"],
    "006800.KS": ["039490.KS","005940.KS","016360.KS","071050.KS","003540.KS"],
    "005940.KS": ["006800.KS","039490.KS","016360.KS","071050.KS","003540.KS"],
    "071050.KS": ["105560.KS","055550.KS","086790.KS","138040.KS","316140.KS"],
    # ── Korea KOSPI — Telecom & Internet ──
    "035420.KS": ["035720.KS","323410.KS","017670.KS","030200.KS","036570.KS"],
    "035720.KS": ["035420.KS","323410.KS","030200.KS","017670.KS","259960.KS"],
    "323410.KS": ["035420.KS","035720.KS","017670.KS","030200.KS","032640.KS"],
    "030200.KS": ["017670.KS","032640.KS","035420.KS","035720.KS","018260.KS"],
    # ── Korea KOSPI — Healthcare / Pharma ──
    "068270.KS": ["207940.KS","091990.KS","196170.KQ","145020.KQ","086900.KQ"],
    "000100.KS": ["006280.KS","001630.KS","128940.KS","069620.KS","003850.KS"],
    "006280.KS": ["000100.KS","001630.KS","128940.KS","069620.KS","185750.KS"],
    "001630.KS": ["000100.KS","006280.KS","128940.KS","069620.KS","003850.KS"],
    "128940.KS": ["000100.KS","006280.KS","001630.KS","069620.KS","086900.KQ"],
    "069620.KS": ["000100.KS","006280.KS","128940.KS","003850.KS","185750.KS"],
    # ── Korea KOSPI — Energy / Steel ──
    "005490.KS": ["004020.KS","001230.KS","003670.KS","010130.KS","020000.KS"],
    "003670.KS": ["006400.KS","051910.KS","373220.KS","247540.KQ","086520.KQ"],
    "015760.KS": ["036460.KS","010950.KS","078930.KS","096770.KS","052690.KS"],
    "036460.KS": ["015760.KS","010950.KS","078930.KS","052690.KS","096770.KS"],
    "010950.KS": ["096770.KS","078930.KS","036460.KS","015760.KS","285130.KS"],
    # ── Korea KOSPI — Consumer / Retail ──
    "139480.KS": ["004170.KS","069960.KS","023530.KS","282330.KS","007070.KS"],
    "004170.KS": ["139480.KS","069960.KS","023530.KS","007310.KS","051900.KS"],
    "069960.KS": ["139480.KS","004170.KS","023530.KS","282330.KS","007070.KS"],
    "033780.KS": ["007310.KS","004370.KS","280360.KS","005300.KS","051900.KS"],
    "007310.KS": ["004370.KS","005300.KS","033780.KS","280360.KS","051900.KS"],
    # ── Korea KOSPI — Entertainment ──
    "352820.KS": ["041510.KQ","950170.KQ","122870.KQ","036570.KS","251270.KS"],
    "036570.KS": ["259960.KS","251270.KS","293490.KS","112040.KQ","263750.KQ"],
    "259960.KS": ["036570.KS","251270.KS","293490.KS","112040.KQ","263750.KQ"],
    "251270.KS": ["036570.KS","259960.KS","293490.KS","112040.KQ","263750.KQ"],
    "293490.KS": ["036570.KS","251270.KS","259960.KS","112040.KQ","263750.KQ"],
    # ── Korea KOSDAQ ──
    "247540.KQ": ["086520.KQ","006400.KS","051910.KS","373220.KS","003670.KS"],
    "086520.KQ": ["247540.KQ","006400.KS","051910.KS","373220.KS","003670.KS"],
    "091990.KQ": ["068270.KS","207940.KS","196170.KQ","145020.KQ","086900.KQ"],
    "028300.KQ": ["068270.KS","207940.KS","091990.KQ","128940.KS","196170.KQ"],
    "086900.KQ": ["145020.KQ","214150.KQ","068270.KS","207940.KS","091990.KQ"],
    "145020.KQ": ["086900.KQ","214150.KQ","068270.KS","207940.KS","091990.KQ"],
    "214150.KQ": ["086900.KQ","145020.KQ","048260.KQ","068270.KS","091990.KQ"],
    "048260.KQ": ["214150.KQ","086900.KQ","145020.KQ","068270.KS","096530.KQ"],
    "096530.KQ": ["048260.KQ","064550.KQ","028300.KQ","091990.KQ","145020.KQ"],
    "196170.KQ": ["068270.KS","207940.KS","091990.KQ","145020.KQ","086900.KQ"],
    "041510.KQ": ["950170.KQ","122870.KQ","352820.KS","035760.KS","036570.KS"],
    "950170.KQ": ["041510.KQ","122870.KQ","352820.KS","035760.KS","036570.KS"],
    "122870.KQ": ["041510.KQ","950170.KQ","352820.KS","035760.KS","036570.KS"],
    "263750.KQ": ["036570.KS","251270.KS","259960.KS","293490.KS","112040.KQ"],
    "112040.KQ": ["036570.KS","251270.KS","259960.KS","293490.KS","263750.KQ"],
    "078340.KQ": ["095660.KQ","192080.KQ","036570.KS","259960.KS","112040.KQ"],
    "095660.KQ": ["078340.KQ","192080.KQ","036570.KS","259960.KS","263750.KQ"],
    # ── Japan TSE ──
    "7203.T":    ["7267.T","7201.T","7261.T","7270.T","7269.T"],
    "7267.T":    ["7203.T","7201.T","7261.T","7270.T","7269.T"],
    "7201.T":    ["7203.T","7267.T","7261.T","7270.T","3038.T"],
    "6758.T":    ["6501.T","6752.T","6971.T","6702.T","7974.T"],
    "6501.T":    ["6758.T","6752.T","6971.T","6702.T","6954.T"],
    "9984.T":    ["6702.T","6501.T","8306.T","6981.T","6367.T"],
    "8306.T":    ["8316.T","8411.T","8604.T","8591.T","8766.T"],
    "8316.T":    ["8306.T","8411.T","8604.T","8591.T","8766.T"],
    "8411.T":    ["8306.T","8316.T","8604.T","8591.T","8766.T"],
    "7974.T":    ["6758.T","9684.T","3765.T","7832.T","2432.T"],
    "9983.T":    ["2651.T","3382.T","8267.T","9843.T","3086.T"],
    "6861.T":    ["6954.T","6981.T","6367.T","7751.T","6762.T"],
    "6954.T":    ["6861.T","6981.T","6367.T","7751.T","6762.T"],
    "4568.T":    ["4523.T","4519.T","4540.T","4506.T","4507.T"],
}

# ── Sector-based fallback benchmarks for unlisted stocks ─────────────────────
# When a ticker is NOT in PEER_MAP, we fetch its sector from yfinance
# and compare against these sector representative stocks.
SECTOR_BENCHMARKS: dict[str, list[str]] = {
    "Technology":             ["NVDA", "AMD", "INTC", "QCOM", "AVGO"],
    "Financial Services":     ["JPM",  "BAC", "GS",   "MS",   "WFC"],
    "Healthcare":             ["JNJ",  "PFE", "LLY",  "ABBV", "MRK"],
    "Consumer Cyclical":      ["AMZN", "WMT", "COST", "HD",   "NKE"],
    "Consumer Defensive":     ["WMT",  "KO",  "PEP",  "PG",   "COST"],
    "Energy":                 ["XOM",  "CVX", "COP",  "OXY",  "SLB"],
    "Industrials":            ["CAT",  "HON", "GE",   "MMM",  "DE"],
    "Communication Services": ["META", "GOOGL","DIS",  "NFLX", "CMCSA"],
    "Basic Materials":        ["LIN",  "APD", "NEM",  "FCX",  "NUE"],
    "Real Estate":            ["AMT",  "PLD", "CCI",  "EQIX", "SPG"],
    "Utilities":              ["NEE",  "DUK", "SO",   "AEP",  "D"],
}

# Korean sector fallback benchmarks
KR_SECTOR_BENCHMARKS: dict[str, list[str]] = {
    "Semiconductors":   ["005930.KS","000660.KS","009150.KS","034220.KS","000990.KS"],
    "Battery":          ["006400.KS","051910.KS","373220.KS","003670.KS","247540.KQ"],
    "Biotechnology":    ["068270.KS","207940.KS","091990.KQ","196170.KQ","145020.KQ"],
    "Automobiles":      ["005380.KS","000270.KS","012330.KS","204320.KS","018880.KS"],
    "Banks":            ["105560.KS","055550.KS","086790.KS","316140.KS","138040.KS"],
    "Internet":         ["035420.KS","035720.KS","323410.KS","017670.KS","030200.KS"],
    "Steel":            ["005490.KS","004020.KS","001230.KS","010130.KS","020000.KS"],
    "Pharmaceuticals":  ["000100.KS","006280.KS","001630.KS","128940.KS","069620.KS"],
    "Games":            ["036570.KS","259960.KS","251270.KS","293490.KS","263750.KQ"],
    "Entertainment":    ["352820.KS","041510.KQ","950170.KQ","122870.KQ","035760.KS"],
    "_default":         ["005930.KS","000660.KS","035420.KS","005380.KS","051910.KS"],
}

# Japan sector fallback benchmarks
JP_SECTOR_BENCHMARKS: dict[str, list[str]] = {
    "Automobiles":      ["7203.T","7267.T","7201.T","7261.T","7270.T"],
    "Electronics":      ["6758.T","6501.T","6752.T","6971.T","6702.T"],
    "Banks":            ["8306.T","8316.T","8411.T","8604.T","8591.T"],
    "Pharmaceuticals":  ["4568.T","4523.T","4519.T","4506.T","4507.T"],
    "Technology":       ["6861.T","6954.T","6981.T","9984.T","9983.T"],
    "_default":         ["7203.T","6758.T","8306.T","9984.T","6861.T"],
}

_peers_cache: dict = {}
_peers_cache_ts: dict = {}
PEERS_CACHE_TTL = 15 * 60  # 15 minutes

def _fetch_single_peer(sym: str) -> dict:
    import time as _t
    try:
        ticker = yf.Ticker(sym)
        info = ticker.info
        price = (info.get("currentPrice") or info.get("regularMarketPrice")
                 or info.get("navPrice") or 0)
        return {
            "symbol": sym,
            "name": info.get("longName") or info.get("shortName") or sym,
            "price": price,
            "peRatio": info.get("trailingPE"),
            "pbRatio": info.get("priceToBook"),
            "dividendYield": _normalize_dividend_yield(info),
            "marketCap": info.get("marketCap"),
            "profitMargin": info.get("profitMargins"),
            "operatingMargin": info.get("operatingMargins"),
            "revenueGrowth": info.get("revenueGrowth"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
        }
    except Exception as e:
        return {"symbol": sym, "name": sym, "price": None, "error": str(e)}

def _get_sector_peers(sym: str) -> list[str]:
    """Sector-based fallback: fetch stock info to get sector, then return sector benchmarks."""
    import time as _t
    is_kr = sym.endswith(".KS") or sym.endswith(".KQ")
    is_jp = sym.endswith(".T")
    try:
        info = yf.Ticker(sym).info
        sector = info.get("sector") or info.get("industry") or ""
        industry = info.get("industry") or ""
        print(f"[peers-fallback] {sym}: sector={sector}, industry={industry}")

        if is_kr:
            # Map yfinance sector/industry to Korean benchmark group
            kr_map = {
                "Semiconductor": "Semiconductors",
                "Electronic Components": "Semiconductors",
                "Auto Parts": "Automobiles",
                "Auto Manufacturers": "Automobiles",
                "Drug Manufacturers": "Pharmaceuticals",
                "Biotechnology": "Biotechnology",
                "Banks": "Banks",
                "Insurance": "Banks",
                "Internet Content": "Internet",
                "Entertainment": "Entertainment",
                "Electronic Gaming": "Games",
                "Steel": "Steel",
                "Chemicals": "Battery",
            }
            matched = None
            for kw, group in kr_map.items():
                if kw.lower() in sector.lower() or kw.lower() in industry.lower():
                    matched = group
                    break
            benchmarks = KR_SECTOR_BENCHMARKS.get(matched or "_default", KR_SECTOR_BENCHMARKS["_default"])
            return [s for s in benchmarks if s != sym][:4]

        elif is_jp:
            jp_map = {
                "Auto": "Automobiles",
                "Electronic": "Electronics",
                "Bank": "Banks",
                "Pharmaceutical": "Pharmaceuticals",
                "Technology": "Technology",
            }
            matched = None
            for kw, group in jp_map.items():
                if kw.lower() in sector.lower() or kw.lower() in industry.lower():
                    matched = group
                    break
            benchmarks = JP_SECTOR_BENCHMARKS.get(matched or "_default", JP_SECTOR_BENCHMARKS["_default"])
            return [s for s in benchmarks if s != sym][:4]

        else:
            # US stock: map yfinance sector directly
            benchmarks = SECTOR_BENCHMARKS.get(sector, SECTOR_BENCHMARKS.get("Technology", []))
            return [s for s in benchmarks if s != sym][:4]
    except Exception as e:
        print(f"[peers-fallback] {sym}: sector fetch failed: {e}")
        if is_kr:
            return [s for s in KR_SECTOR_BENCHMARKS["_default"] if s != sym][:4]
        if is_jp:
            return [s for s in JP_SECTOR_BENCHMARKS["_default"] if s != sym][:4]
        return ["NVDA", "AMD", "INTC", "QCOM"]  # US tech default


@app.route('/peers/<symbol>', methods=['GET'])
def get_peers(symbol):
    import time as _t
    sym_upper = symbol.upper()
    now = _t.time()

    if sym_upper in _peers_cache and (now - _peers_cache_ts.get(sym_upper, 0)) < PEERS_CACHE_TTL:
        return jsonify(_peers_cache[sym_upper])

    peer_list = PEER_MAP.get(sym_upper, [])

    # ── Sector fallback: if no explicit peer list, derive from sector ──────────
    if not peer_list:
        print(f"[peers] {sym_upper}: not in PEER_MAP — using sector fallback")
        peer_list = _get_sector_peers(sym_upper)

    all_syms = [sym_upper] + peer_list[:4]  # main + up to 4 peers

    with ThreadPoolExecutor(max_workers=5) as ex:
        results = list(ex.map(_fetch_single_peer, all_syms))

    # Attach fallback source flag so frontend can show it
    is_fallback = sym_upper not in PEER_MAP
    payload = {
        "symbol": sym_upper,
        "peers": results,
        "count": len(results),
        "isSectorFallback": is_fallback,
    }
    _peers_cache[sym_upper] = payload
    _peers_cache_ts[sym_upper] = now
    src = "sector-fallback" if is_fallback else "peer-map"
    print(f"[peers] {sym_upper}: fetched {len(results)} peers ({src})")
    return jsonify(payload)


if __name__ == '__main__':
    print("[yfinance Stock Service] Starting on port 5001...")
    app.run(host='127.0.0.1', port=5001, debug=False)
