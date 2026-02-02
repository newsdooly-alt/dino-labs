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

def is_market_open():
    """Check if US stock market is currently open."""
    now = datetime.now(US_EASTERN)
    # Market hours: 9:30 AM - 4:00 PM ET, Monday-Friday
    if now.weekday() >= 5:  # Saturday or Sunday
        return False
    market_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now.replace(hour=16, minute=0, second=0, microsecond=0)
    return market_open <= now <= market_close


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "yfinance-stock-service"})


@app.route('/quote/<symbol>', methods=['GET'])
def get_quote(symbol):
    """Get real-time quote for a single stock using fast_info for latest prices."""
    try:
        ticker = yf.Ticker(symbol.upper())
        market_open = is_market_open()
        now_et = datetime.now(US_EASTERN)
        
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
            "lastUpdated": now_et.strftime('%Y-%m-%dT%H:%M:%S'),
            "lastUpdatedFormatted": now_et.strftime('%I:%M %p ET')
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
    market_open = is_market_open()
    now_et = datetime.now(US_EASTERN)
    
    print(f"[yfinance] Batch quotes request for: {symbols}, market_open={market_open}")
    
    # Process each symbol - prioritize fast_info for speed
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            price = 0
            prev_close = 0
            name = _name_cache.get(symbol, symbol)  # Use cached name or symbol
            
            # Use fast_info ONLY for real-time price (avoids slow info call)
            try:
                fast = ticker.fast_info
                # Prefer lastPrice (most current) over regularMarketPrice
                price = float(fast.get('lastPrice', 0) or 0)
                if price == 0:
                    price = float(fast.get('regularMarketPrice', 0) or 0)
                prev_close = float(fast.get('previousClose', 0) or 0)
                
                # Validate: if market is open and price equals prev_close, might be stale
                if market_open and price == prev_close and price > 0:
                    print(f"[yfinance] {symbol} Warning: price equals prev_close during market hours")
                
                print(f"[yfinance] {symbol} fast_info: price={price}, prev_close={prev_close}")
            except Exception as e:
                print(f"[yfinance] {symbol} fast_info failed: {e}")
                price = 0
                prev_close = 0
            
            # Only fetch info for name if not cached and price is valid
            if price > 0 and name == symbol:
                try:
                    info = ticker.info
                    fetched_name = info.get('shortName') or info.get('longName') or symbol
                    _name_cache[symbol] = fetched_name
                    name = fetched_name
                except Exception as e:
                    print(f"[yfinance] {symbol} info for name failed: {e}")
            
            # Calculate change with validation
            change = price - prev_close if price > 0 and prev_close > 0 else 0
            change_percent = (change / prev_close * 100) if prev_close > 0 else 0
            
            # Validate price - mark as stale if zero or negative
            is_stale = price <= 0
            if is_stale:
                print(f"[yfinance] Warning: {symbol} has invalid price={price}")
            
            results.append({
                "symbol": symbol,
                "name": name,
                "price": round(price, 2),
                "change": round(change, 2),
                "changePercent": round(change_percent, 2),
                "isMarketOpen": market_open,
                "isStale": is_stale,
                "lastUpdated": now_et.strftime('%Y-%m-%dT%H:%M:%S'),
                "lastUpdatedFormatted": now_et.strftime('%I:%M %p ET')
            })
        except Exception as e:
            print(f"[yfinance] Error fetching {symbol}: {e}")
            results.append({
                "symbol": symbol,
                "name": _name_cache.get(symbol, symbol),
                "price": 0,
                "change": 0,
                "changePercent": 0,
                "isMarketOpen": market_open,
                "isStale": True,
                "error": str(e),
                "lastUpdated": now_et.strftime('%Y-%m-%dT%H:%M:%S'),
                "lastUpdatedFormatted": now_et.strftime('%I:%M %p ET')
            })
    
    print(f"[yfinance] Batch quotes complete: {len(results)} results")
    
    return jsonify({
        "quotes": results,
        "isMarketOpen": market_open,
        "fetchedAt": now_et.strftime('%Y-%m-%dT%H:%M:%S'),
        "fetchedAtFormatted": now_et.strftime('%I:%M %p ET')
    })


@app.route('/search', methods=['GET'])
def search_stocks():
    """Search for stocks by symbol or name."""
    query = request.args.get('q', '').strip().upper()
    if not query or len(query) < 1:
        return jsonify({"results": []})
    
    # Common US stocks mapping for quick search
    # yfinance doesn't have a built-in search, so we use a curated list
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
    
    results = []
    
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
    
    # If no matches found and query looks like a valid symbol, try to look it up
    if not results and len(query) <= 5 and query.isalpha():
        try:
            ticker = yf.Ticker(query)
            info = ticker.info
            name = info.get('shortName') or info.get('longName')
            if name:
                results.append({
                    "symbol": query,
                    "name": name,
                    "type": info.get('quoteType', 'Equity'),
                    "region": "United States"
                })
        except:
            pass
    
    return jsonify({"results": results[:10]})


@app.route('/history/<symbol>', methods=['GET'])
def get_history(symbol):
    """Get historical price data for charts."""
    period = request.args.get('period', '1mo')  # 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max
    interval = request.args.get('interval', '1d')  # 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo
    
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


@app.route('/info/<symbol>', methods=['GET'])
def get_info(symbol):
    """Get detailed stock information."""
    try:
        ticker = yf.Ticker(symbol.upper())
        info = ticker.info
        
        return jsonify({
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
            "dividendYield": info.get('dividendYield'),
            "52WeekHigh": info.get('fiftyTwoWeekHigh'),
            "52WeekLow": info.get('fiftyTwoWeekLow'),
            "avgVolume": info.get('averageVolume'),
            "beta": info.get('beta')
        })
    except Exception as e:
        return jsonify({"error": str(e), "symbol": symbol}), 500


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


if __name__ == '__main__':
    print("[yfinance Stock Service] Starting on port 5001...")
    # Bind to localhost only for security (Node.js proxies requests)
    app.run(host='127.0.0.1', port=5001, debug=False)
