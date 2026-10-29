import sys
import os
import json
import time
import pickle
import tempfile
import argparse
import requests
import urllib3
from datetime import datetime

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

COOKIE_FILE = os.path.join(tempfile.gettempdir(), "nse_session_cookies.pkl")

def get_nse_session():
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nseindia.com/',
    }
    session = requests.Session()
    session.headers.update(headers)

    # Reuse cookies across Python worker invocations (5 minute TTL)
    loaded_cache = False
    if os.path.exists(COOKIE_FILE):
        try:
            mtime = os.path.getmtime(COOKIE_FILE)
            if time.time() - mtime < 300:
                with open(COOKIE_FILE, 'rb') as f:
                    session.cookies.update(pickle.load(f))
                loaded_cache = True
        except Exception:
            pass

    if not loaded_cache:
        try:
            session.get("https://www.nseindia.com", timeout=10, verify=False)
            with open(COOKIE_FILE, 'wb') as f:
                pickle.dump(session.cookies, f)
        except Exception:
            pass

    return session

def fetch_quote(symbol):
    symbol = symbol.replace('.NS', '').replace('.BO', '').upper()
    try:
        session = get_nse_session()
        # Add referer specific to the stock
        session.headers.update({'Referer': f'https://www.nseindia.com/get-quotes/equity?symbol={symbol}'})
        r = session.get(f"https://www.nseindia.com/api/quote-equity?symbol={symbol}", timeout=15, verify=False)
        
        if r.status_code == 200:
            data = r.json()
            price_info = data.get('priceInfo', {})
            trade_info = data.get('marketDeptOrderBook', {}).get('tradeInfo', {})
            security_info = data.get('securityWiseDP', {}).get('quantityInfo', {})
            
            price = price_info.get('lastPrice', 0.0)
            change = price_info.get('change', 0.0)
            change_pct = price_info.get('pChange', 0.0)
            volume = trade_info.get('totalTradedVolume', 0)
            delivery_pct = security_info.get('deliveryToTradedQuantity', 0.0)
            
            return {
                "success": True,
                "price": price,
                "change": change,
                "changePercent": change_pct,
                "volume": volume,
                "deliveryPct": delivery_pct
            }
        else:
            return get_mock_quote(symbol)
    except Exception as e:
        return get_mock_quote(symbol, error=str(e))

def get_mock_quote(symbol, error=None):
    # Try fetching authentic quote via yfinance fallback rather than fake random numbers
    try:
        import yfinance as yf
        ticker = f"{symbol}.NS" if not symbol.endswith(('.NS', '.BO')) else symbol
        t = yf.Ticker(ticker)
        fast = t.fast_info
        price = float(fast.get('last_price') or fast.get('regular_market_price') or 0.0)
        prev = float(fast.get('previous_close') or 0.0)
        if price > 0:
            change = round(price - prev, 2) if prev > 0 else 0.0
            change_pct = round((change / prev) * 100, 2) if prev > 0 else 0.0
            vol = int(fast.get('last_volume') or 0)
            return {
                "success": True,
                "price": price,
                "change": change,
                "changePercent": change_pct,
                "volume": vol,
                "deliveryPct": None,
                "source": "YahooFinance-Authentic",
                "mocked": False
            }
    except Exception:
        pass
    return {
        "success": False,
        "error": error or f"Live quote unavailable for {symbol}",
        "mocked": False
    }

def fetch_option_chain(symbol):
    symbol = symbol.replace('.NS', '').replace('.BO', '').upper()
    try:
        session = get_nse_session()
        session.headers.update({'Referer': f'https://www.nseindia.com/get-quotes/derivatives?symbol={symbol}'})
        r = session.get(f"https://www.nseindia.com/api/option-chain-equity?symbol={symbol}", timeout=15, verify=False)
        
        if r.status_code == 200:
            data = r.json()
            records = data.get('records', {})
            underlying_value = records.get('underlyingValue', 0.0)
            expiry_dates = records.get('expiryDates', [])
            
            raw_data = records.get('data', [])
            calls = []
            puts = []
            
            # Extract basic option chain columns
            for row in raw_data:
                strike = row.get('strikePrice')
                expiry = row.get('expiryDate')
                
                ce = row.get('CE')
                pe = row.get('PE')
                
                if ce:
                    calls.append({
                        "strike": strike,
                        "expiry": expiry,
                        "ltp": ce.get('lastPrice', 0.0),
                        "oi": ce.get('openInterest', 0),
                        "oiChg": ce.get('changeinOpenInterest', 0),
                        "iv": ce.get('impliedVolatility', 0.0)
                    })
                if pe:
                    puts.append({
                        "strike": strike,
                        "expiry": expiry,
                        "ltp": pe.get('lastPrice', 0.0),
                        "oi": pe.get('openInterest', 0),
                        "oiChg": pe.get('changeinOpenInterest', 0),
                        "iv": pe.get('impliedVolatility', 0.0)
                    })
            
            return {
                "success": True,
                "underlyingValue": underlying_value,
                "expiryDates": expiry_dates,
                "calls": calls,
                "puts": puts
            }
        else:
            return get_mock_option_chain(symbol)
    except Exception as e:
        return get_mock_option_chain(symbol, error=str(e))

def get_mock_option_chain(symbol, error=None):
    return {
        "success": False,
        "underlyingValue": None,
        "expiryDates": [],
        "calls": [],
        "puts": [],
        "mocked": False,
        "error": error or f"Live option chain unavailable for {symbol}"
    }

def fetch_bulk_deals(date_str=None):
    try:
        # We can use nselib if installed
        import pandas as pd
        from nselib import capital_market
        df = capital_market.bulk_deal_data(period='1D')
        deals = []
        if not df.empty:
            for _, row in df.iterrows():
                deals.append({
                    "symbol": str(row.get('Symbol', '')),
                    "name": str(row.get('Security Name', '')),
                    "clientName": str(row.get('Client Name', '')),
                    "dealType": 'Buy' if 'BUY' in str(row.get('Buy/Sell', '')).upper() else 'Sell',
                    "quantity": int(row.get('Quantity Traded', 0)),
                    "price": float(row.get('Trade Price / Wght. Avg. Price', 0.0)),
                    "date": str(row.get('Date', ''))
                })
            return {"success": True, "deals": deals}
        else:
            return get_mock_bulk_deals()
    except Exception as e:
        return get_mock_bulk_deals(error=str(e))

def get_mock_bulk_deals(error=None):
    return {
        "success": False,
        "deals": [],
        "mocked": False,
        "error": error or "Live bulk deals unavailable from exchange"
    }

def fetch_insider_trades():
    try:
        session = get_nse_session()
        session.headers.update({'Referer': 'https://www.nseindia.com/companies-listing/corporate-filings-insider-trading'})
        # Pit table API from NSE
        r = session.get("https://www.nseindia.com/api/corporates-pit?period=1M", timeout=15, verify=False)
        
        trades = []
        if r.status_code == 200:
            data = r.json()
            rows = data.get('data', [])
            for row in rows:
                qty = 0
                try:
                    qty = int(row.get('secAcq', row.get('noOfSecurities', 0)))
                except: pass
                
                price = 0.0
                try:
                    price = float(row.get('secVal', row.get('value', 0.0))) / max(1, qty)
                except: pass
                
                txn_type = 'Buy'
                try:
                    mode = str(row.get('tdpTransactionType', row.get('acqMode', ''))).upper()
                    if 'SELL' in mode or 'DISPOSAL' in mode:
                        txn_type = 'Sell'
                except: pass
                
                date_val = row.get('dateOfIntimation', row.get('dateOfAcquisitionTo', ''))
                
                trades.append({
                    "symbol": row.get('symbol', ''),
                    "company": row.get('company', row.get('symbol', '')),
                    "insider": row.get('acquirorName', row.get('personName', 'Unknown')),
                    "relation": row.get('categoryOfPerson', 'Promoter/Director'),
                    "txnType": txn_type,
                    "quantity": qty,
                    "price": round(price, 2) if price else 0.0,
                    "value": int(row.get('secVal', 0)) if row.get('secVal') else int(qty * price),
                    "date": date_val,
                    "holdingChange": 0.0 # Standard fallback
                })
            
            return {"success": True, "trades": trades}
        else:
            return get_mock_insider_trades()
    except Exception as e:
        return get_mock_insider_trades(error=str(e))

def get_mock_insider_trades(error=None):
    return {
        "success": False,
        "trades": [],
        "mocked": False,
        "error": error or "Live insider trades filings unavailable from exchange"
    }

def fetch_fiidii():
    try:
        from curl_cffi import requests as cffi_requests
        s = cffi_requests.Session(impersonate='chrome120')
        s.get('https://www.nseindia.com', timeout=10)
        r = s.get('https://www.nseindia.com/api/fiidiiTradeReact', timeout=10)
        if r.status_code == 200:
            return {"success": True, "data": r.json()}
    except Exception:
        pass
    try:
        session = get_nse_session()
        r = session.get('https://www.nseindia.com/api/fiidiiTradeReact', timeout=10, verify=False)
        if r.status_code == 200:
            return {"success": True, "data": r.json()}
    except Exception as e:
        return {"success": False, "error": str(e)}
    return {"success": False, "error": "Failed to fetch FII/DII from NSE"}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='NSE India Data Fetcher')
    parser.add_argument('--action', required=True, choices=['quote', 'option-chain', 'bulk-deals', 'insider-trades', 'fiidii', 'quant-forecast', 'alpha158', 'sentiment', 'chartink'])
    parser.add_argument('--symbol', help='Stock symbol')
    parser.add_argument('--text', help='Headline text or scan clause')
    parser.add_argument('--horizon', type=int, default=10, help='Forecast horizon')
    
    args = parser.parse_args()
    
    if args.action == 'quote':
        if not args.symbol:
            print(json.dumps({"success": False, "error": "Symbol required for quote action"}))
            sys.exit(1)
        result = fetch_quote(args.symbol)
    elif args.action == 'option-chain':
        if not args.symbol:
            print(json.dumps({"success": False, "error": "Symbol required for option-chain action"}))
            sys.exit(1)
        result = fetch_option_chain(args.symbol)
    elif args.action == 'bulk-deals':
        result = fetch_bulk_deals()
    elif args.action == 'insider-trades':
        result = fetch_insider_trades()
    elif args.action == 'fiidii':
        result = fetch_fiidii()
    elif args.action in ['quant-forecast', 'alpha158', 'sentiment', 'chartink']:
        try:
            import quant_models
            sub_act = 'full_ensemble' if args.action == 'quant-forecast' else args.action
            sym = (args.symbol or 'RELIANCE').replace('.NS', '').replace('.BO', '').upper()
            if sub_act in ['full_ensemble', 'quant-forecast']:
                result = quant_models.run_full_quant_analysis(sym)
            elif sub_act == 'alpha158':
                df_d = quant_models.fetch_ohlcv(sym, period="1y", interval="1d")
                result = quant_models.QlibAlpha158Engine.compute_factors(df_d)
            elif sub_act == 'chartink':
                clause = args.text or ""
                result = quant_models.ChartinkReverseEngine.execute_scan(clause)
            elif sub_act == 'sentiment':
                text_input = args.text or ""
                pos_words = ["surge", "growth", "profit", "gain", "dividend", "breakout", "bullish", "record", "expansion", "order win"]
                neg_words = ["plunge", "loss", "crash", "fall", "fraud", "probe", "downgrade", "bearish", "miss", "default"]
                txt_lower = text_input.lower()
                p_score = sum(1 for w in pos_words if w in txt_lower)
                n_score = sum(1 for w in neg_words if w in txt_lower)
                diff = p_score - n_score
                sentiment_label = "POSITIVE" if diff > 0 else ("NEGATIVE" if diff < 0 else "NEUTRAL")
                result = {
                    "text": text_input,
                    "sentiment": sentiment_label,
                    "score": round(max(-1.0, min(1.0, diff / 3.0)), 2)
                }
            else:
                result = {"success": False, "error": f"Unknown quant action: {sub_act}"}
        except Exception as e:
            result = {"success": False, "error": str(e)}
        
    def json_default(obj):
        if hasattr(obj, "item"):
            val = obj.item()
            if isinstance(val, (int, float, bool, str)):
                return val
        if hasattr(obj, "tolist"):
            return obj.tolist()
        if hasattr(obj, "isoformat"):
            return obj.isoformat()
        try:
            import numpy as _np
            if isinstance(obj, _np.bool_):
                return bool(obj)
            if isinstance(obj, (_np.integer, _np.floating)):
                return obj.item()
            if isinstance(obj, _np.ndarray):
                return obj.tolist()
        except Exception:
            pass
        return str(obj)

    print(json.dumps(result, default=json_default))
