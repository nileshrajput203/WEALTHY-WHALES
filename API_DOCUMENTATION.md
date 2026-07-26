# GenAI-Stock API Documentation

## Free Stock Data & News APIs Implementation

### Overview
Your GenAI-Stock application now includes multiple free APIs for real-time stock data and financial news. The system automatically falls back to mock data if APIs are unavailable.

## Free API Sources Used

### 1. Yahoo Finance (No API Key Required)
- **Base URL**: `https://query1.finance.yahoo.com/v8/finance/chart`
- **News URL**: `https://feeds.finance.yahoo.com/rss/2.0/headline`
- **Features**: Real-time stock quotes, market indices, financial news
- **Rate Limit**: No official limit (respectful usage)
- **Coverage**: Global markets including NSE/BSE

### 2. Alpha Vantage (Free Tier)
- **Base URL**: `https://www.alphavantage.co/query`
- **Free Tier**: 5 calls per minute, 500 calls per day
- **Features**: Technical indicators, fundamental data
- **Sign Up**: https://www.alphavantage.co/

### 3. IEX Cloud (Free Tier)
- **Base URL**: `https://cloud.iexapis.com/stable`
- **Free Tier**: 500,000 calls per month
- **Features**: Real-time data, company info
- **Sign Up**: https://iexcloud.io/

### 4. Financial Modeling Prep (Free Tier)
- **Base URL**: `https://financialmodelingprep.com/api/v3`
- **Free Tier**: 250 calls per day
- **Features**: Financial statements, market data
- **Sign Up**: https://financialmodelingprep.com/

## API Endpoints

### Stock Data Endpoints

#### 1. Get Stock Recommendations
```http
GET /api/recommendations
```
**Response:**
```json
{
  "realTimeStocks": [
    {
      "symbol": "RELIANCE.NS",
      "name": "Reliance Industries Limited",
      "price": 2456.50,
      "change": 23.40,
      "changePercent": 0.96,
      "volume": 1234567,
      "marketCap": 16650000000000,
      "high": 2467.80,
      "low": 2433.10,
      "open": 2440.20,
      "previousClose": 2433.10,
      "timestamp": "2024-01-15T10:30:00Z",
      "source": "Yahoo Finance"
    }
  ],
  "adminRecommendations": [],
  "lastUpdated": "2024-01-15T10:30:00Z",
  "dataSource": "Live API"
}
```

#### 2. Get Specific Stock Quote
```http
GET /api/stock/{symbol}
```
**Example:** `GET /api/stock/RELIANCE.NS`

#### 3. Search Stocks
```http
GET /api/search/stocks?q={query}
```
**Example:** `GET /api/search/stocks?q=RELIANCE`

### Market Data Endpoints

#### 4. Get Market Indices
```http
GET /api/indices
```
**Response:**
```json
{
  "indices": [
    {
      "name": "NIFTY 50",
      "symbol": "^NSEI",
      "value": 24850.50,
      "change": 125.30,
      "changePercent": 0.51,
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ],
  "lastUpdated": "2024-01-15T10:30:00Z",
  "dataSource": "Live API"
}
```

#### 5. Get Market Summary
```http
GET /api/market/summary
```
**Response:**
```json
{
  "indices": [...],
  "topStocks": [...],
  "latestNews": [...],
  "lastUpdated": "2024-01-15T10:30:00Z",
  "marketStatus": "open"
}
```

### News Endpoints

#### 6. Get Financial News
```http
GET /api/news?limit={number}
```
**Response:**
```json
{
  "realTimeNews": [
    {
      "title": "Indian Markets Show Strong Performance",
      "description": "NSE and BSE indices reached new highs...",
      "url": "https://example.com/news/indian-markets",
      "publishedAt": "2024-01-15T08:00:00Z",
      "source": "Yahoo Finance",
      "sentiment": "positive"
    }
  ],
  "adminNews": [],
  "lastUpdated": "2024-01-15T10:30:00Z",
  "dataSource": "Live API"
}
```

## Indian Stock Coverage

### Supported Indian Stocks (NSE)
- RELIANCE (Reliance Industries)
- TCS (Tata Consultancy Services)
- HDFC (HDFC Bank)
- INFY (Infosys)
- HINDUNILVR (Hindustan Unilever)
- ITC (ITC Limited)
- KOTAKBANK (Kotak Mahindra Bank)
- BHARTIARTL (Bharti Airtel)
- ASIANPAINT (Asian Paints)
- MARUTI (Maruti Suzuki)

### Supported Market Indices
- NIFTY 50 (^NSEI)
- SENSEX (^BSESN)
- BANK NIFTY (^NSEBANK)
- NIFTY IT (^CNXIT)
- NIFTY PHARMA (^CNXPHARMA)

## Setup Instructions

### 1. Basic Setup (No API Keys Required)
The application works out-of-the-box with Yahoo Finance data (no API key needed).

### 2. Enhanced Setup (Optional API Keys)
For better data quality and higher rate limits, you can add free API keys:

#### Alpha Vantage
1. Sign up at https://www.alphavantage.co/
2. Get your free API key
3. Add to environment variables:
```bash
ALPHA_VANTAGE_API_KEY=your_key_here
```

#### IEX Cloud
1. Sign up at https://iexcloud.io/
2. Get your free API key
3. Add to environment variables:
```bash
IEX_CLOUD_API_KEY=your_key_here
```

#### Financial Modeling Prep
1. Sign up at https://financialmodelingprep.com/
2. Get your free API key
3. Add to environment variables:
```bash
FMP_API_KEY=your_key_here
```

### 3. Environment Variables
Update your `start-dev.ps1` or environment:
```powershell
$env:ALPHA_VANTAGE_API_KEY = "your_alpha_vantage_key"
$env:IEX_CLOUD_API_KEY = "your_iex_cloud_key"
$env:FMP_API_KEY = "your_fmp_key"
```

## Error Handling & Fallbacks

### Automatic Fallbacks
1. **Primary**: Yahoo Finance (no API key required)
2. **Secondary**: Alpha Vantage (if API key provided)
3. **Tertiary**: Mock data (always available)

### Rate Limiting
- Yahoo Finance: No official limit (use respectfully)
- Alpha Vantage: 5 calls/minute, 500 calls/day
- IEX Cloud: 500,000 calls/month
- FMP: 250 calls/day

### Error Responses
```json
{
  "message": "Failed to fetch stock data",
  "error": "API_ERROR",
  "fallback": "mock_data_used"
}
```

## Usage Examples

### Frontend Integration
```javascript
// Fetch stock recommendations
const response = await fetch('/api/recommendations');
const data = await response.json();
console.log(data.realTimeStocks);

// Search for stocks
const searchResponse = await fetch('/api/search/stocks?q=TCS');
const searchData = await searchResponse.json();
console.log(searchData.stocks);

// Get market summary
const summaryResponse = await fetch('/api/market/summary');
const summaryData = await summaryResponse.json();
console.log(summaryData);
```

### cURL Examples
```bash
# Get stock recommendations
curl http://localhost:5000/api/recommendations

# Get specific stock
curl http://localhost:5000/api/stock/RELIANCE.NS

# Search stocks
curl "http://localhost:5000/api/search/stocks?q=RELIANCE"

# Get market indices
curl http://localhost:5000/api/indices

# Get financial news
curl "http://localhost:5000/api/news?limit=10"

# Get market summary
curl http://localhost:5000/api/market/summary
```

## Performance Considerations

### Caching Strategy
- Stock data is fetched in real-time
- Consider implementing Redis cache for production
- News data can be cached for 15-30 minutes

### Batch Processing
- Stock quotes are fetched in batches of 5
- 1-second delay between batches to respect rate limits
- Parallel processing for independent data sources

### Monitoring
- All API calls are logged with timestamps
- Error rates are tracked
- Fallback usage is monitored

## Production Deployment

### Environment Variables for Production
```bash
DATABASE_URL=your_production_database_url
SESSION_SECRET=your_secure_session_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GEMINI_API_KEY=your_gemini_api_key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
IEX_CLOUD_API_KEY=your_iex_cloud_key
FMP_API_KEY=your_fmp_key
NODE_ENV=production
```

### Scaling Considerations
- Implement Redis caching
- Use multiple API keys for higher rate limits
- Consider paid tiers for production workloads
- Monitor API usage and costs

## Troubleshooting

### Common Issues
1. **Empty responses**: Check if APIs are accessible
2. **Rate limit errors**: Implement proper delays or get API keys
3. **CORS errors**: Ensure proper headers in production
4. **Timeout errors**: Increase timeout values for slow APIs

### Debug Mode
Enable debug logging by setting:
```bash
DEBUG=stockapi:*
```

This comprehensive setup provides your GenAI-Stock application with robust, real-time financial data using multiple free APIs with automatic fallbacks.
