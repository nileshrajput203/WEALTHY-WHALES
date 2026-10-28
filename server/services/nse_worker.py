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
    # Generates a realistic quote if API is blocked or offline
    import random
    seed_str = f"{symbol}_{datetime.now().strftime('%Y-%m-%d-%H')}"
    random.seed(seed_str)
    base_prices = {
        "RELIANCE": 2450.0, "TCS": 3800.0, "INFY": 1420.0, "HDFCBANK": 1550.0,
        "ICICIBANK": 1100.0, "SBIN": 820.0, "BHARTIARTL": 1350.0, "ITC": 430.0,
        "CIPLA": 1450.0, "LUMAXIND": 2600.0
    }
    base = base_prices.get(symbol, 500.0)
    change = round(random.uniform(-15.0, 15.0), 2)
    change_pct = round((change / base) * 100, 2)
    return {
        "success": True,
        "price": base + change,
        "change": change,
        "changePercent": change_pct,
        "volume": random.randint(100000, 2000000),
        "deliveryPct": round(random.uniform(35.0, 65.0), 2),
        "mocked": True,
        "error": error
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
    import random
    seed_str = f"{symbol}_{datetime.now().strftime('%Y-%m-%d-%H')}_options"
    random.seed(seed_str)
    underlying = 1500.0
    strikes = [underlying + i*20 for i in range(-5, 6)]
    calls = []
    puts = []
    expiry = datetime.now().strftime("%d-%b-%Y")
    for s in strikes:
        calls.append({
            "strike": s, "expiry": expiry, "ltp": max(1.0, round(underlying - s + random.uniform(5, 15), 2)),
            "oi": random.randint(100, 10000), "oiChg": random.randint(-500, 2000), "iv": round(random.uniform(12.0, 25.0), 2)
        })
        puts.append({
            "strike": s, "expiry": expiry, "ltp": max(1.0, round(s - underlying + random.uniform(5, 15), 2)),
            "oi": random.randint(100, 10000), "oiChg": random.randint(-500, 2000), "iv": round(random.uniform(12.0, 25.0), 2)
        })
    return {
        "success": True,
        "underlyingValue": underlying,
        "expiryDates": [expiry],
        "calls": calls,
        "puts": puts,
        "mocked": True,
        "error": error
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
    import random
    mock_deals = [
        {"symbol": "RELIANCE", "name": "Reliance Industries Ltd", "clientName": "SOCIETE GENERALE", "dealType": "Buy", "quantity": 1450000, "price": 2465.20, "date": datetime.now().strftime("%d-%b-%Y")},
        {"symbol": "TCS", "name": "Tata Consultancy Services", "clientName": "VANGUARD GROUP", "dealType": "Buy", "quantity": 890000, "price": 3810.50, "date": datetime.now().strftime("%d-%b-%Y")},
        {"symbol": "INFY", "name": "Infosys Ltd", "clientName": "NOMURA INDIA", "dealType": "Sell", "quantity": 1200000, "price": 1412.00, "date": datetime.now().strftime("%d-%b-%Y")},
        {"symbol": "SBIN", "name": "State Bank of India", "clientName": "SBI MUTUAL FUND", "dealType": "Buy", "quantity": 3100000, "price": 818.40, "date": datetime.now().strftime("%d-%b-%Y")},
        {"symbol": "CIPLA", "name": "Cipla Ltd", "clientName": "BLACKROCK FUND", "dealType": "Sell", "quantity": 620000, "price": 1455.00, "date": datetime.now().strftime("%d-%b-%Y")}
    ]
    return {"success": True, "deals": mock_deals, "mocked": True, "error": error}

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
    import random
    mock_insiders = [
        {"symbol": "RELIANCE", "company": "Reliance Industries Ltd", "insider": "Anant Ambani", "relation": "Promoter Group", "txnType": "Buy", "quantity": 150000, "price": 2450.00, "value": 367500000, "date": "2026-05-20", "holdingChange": 0.05},
        {"symbol": "TCS", "company": "Tata Consultancy Services", "insider": "Tata Sons Pvt Ltd", "relation": "Promoter", "txnType": "Buy", "quantity": 450000, "price": 3812.30, "value": 1715535000, "date": "2026-05-19", "holdingChange": 0.12},
        {"symbol": "INFY", "company": "Infosys Ltd", "insider": "Nandan Nilekani", "relation": "Promoter/Director", "txnType": "Buy", "quantity": 80000, "price": 1422.00, "value": 113760000, "date": "2026-05-18", "holdingChange": 0.02},
        {"symbol": "LUMAXIND", "company": "Lumax Industries Ltd", "insider": "Deepak Jain", "relation": "Promoter/Director", "txnType": "Buy", "quantity": 15000, "price": 2610.00, "value": 39150000, "date": "2026-05-15", "holdingChange": 0.08},
        {"symbol": "CIPLA", "company": "Cipla Ltd", "insider": "MK Hamied", "relation": "Promoter Group", "txnType": "Sell", "quantity": 50000, "price": 1460.00, "value": 73000000, "date": "2026-05-14", "holdingChange": -0.04}
    ]
    return {"success": True, "trades": mock_insiders, "mocked": True, "error": error}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='NSE India Data Fetcher')
    parser.add_argument('--action', required=True, choices=['quote', 'option-chain', 'bulk-deals', 'insider-trades', 'quant-forecast', 'alpha158', 'sentiment', 'chartink'])
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
        
    print(json.dumps(result))
