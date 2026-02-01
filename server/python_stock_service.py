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
CORS(app)

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
    """Get real-time quote for a single stock."""
    try:
        ticker = yf.Ticker(symbol.upper())
        info = ticker.info
        
        # Get current price data
        price = info.get('regularMarketPrice') or info.get('currentPrice') or 0
        prev_close = info.get('previousClose') or info.get('regularMarketPreviousClose') or price
        change = price - prev_close if price and prev_close else 0
        change_percent = (change / prev_close * 100) if prev_close else 0
        
        return jsonify({
            "symbol": symbol.upper(),
            "name": info.get('shortName') or info.get('longName') or symbol.upper(),
            "price": round(price, 2),
            "change": round(change, 2),
            "changePercent": round(change_percent, 2),
            "previousClose": round(prev_close, 2),
            "open": info.get('regularMarketOpen') or info.get('open'),
            "high": info.get('regularMarketDayHigh') or info.get('dayHigh'),
            "low": info.get('regularMarketDayLow') or info.get('dayLow'),
            "volume": info.get('regularMarketVolume') or info.get('volume'),
            "marketCap": info.get('marketCap'),
            "isMarketOpen": is_market_open(),
            "lastUpdated": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e), "symbol": symbol}), 500


@app.route('/quotes', methods=['GET'])
def get_batch_quotes():
    """Get quotes for multiple symbols at once (batch request)."""
    symbols_param = request.args.get('symbols', '')
    if not symbols_param:
        return jsonify({"error": "No symbols provided"}), 400
    
    symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
    
    if not symbols:
        return jsonify({"error": "No valid symbols provided"}), 400
    
    results = []
    market_open = is_market_open()
    
    # Use yfinance batch download for efficiency
    try:
        # Download data for all tickers at once
        tickers = yf.Tickers(' '.join(symbols))
        
        for symbol in symbols:
            try:
                ticker = tickers.tickers.get(symbol)
                if not ticker:
                    results.append({
                        "symbol": symbol,
                        "name": symbol,
                        "price": 0,
                        "change": 0,
                        "changePercent": 0,
                        "isMarketOpen": market_open,
                        "isStale": True,
                        "lastUpdated": datetime.now().isoformat()
                    })
                    continue
                
                info = ticker.info
                price = info.get('regularMarketPrice') or info.get('currentPrice') or 0
                prev_close = info.get('previousClose') or info.get('regularMarketPreviousClose') or price
                change = price - prev_close if price and prev_close else 0
                change_percent = (change / prev_close * 100) if prev_close else 0
                
                results.append({
                    "symbol": symbol,
                    "name": info.get('shortName') or info.get('longName') or symbol,
                    "price": round(price, 2),
                    "change": round(change, 2),
                    "changePercent": round(change_percent, 2),
                    "isMarketOpen": market_open,
                    "isStale": price == 0,
                    "lastUpdated": datetime.now().isoformat()
                })
            except Exception as e:
                results.append({
                    "symbol": symbol,
                    "name": symbol,
                    "price": 0,
                    "change": 0,
                    "changePercent": 0,
                    "isMarketOpen": market_open,
                    "isStale": True,
                    "error": str(e),
                    "lastUpdated": datetime.now().isoformat()
                })
        
        return jsonify({
            "quotes": results,
            "isMarketOpen": market_open,
            "fetchedAt": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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

if __name__ == '__main__':
    print("[yfinance Stock Service] Starting on port 5001...")
    app.run(host='0.0.0.0', port=5001, debug=False)
