import axios from "axios";

export interface StockDeliveryResult {
  symbol: string;
  priceCurrent: number;
  pricePrevClose: number;
  priceChange: number;
  pricePercentChange: number;
  volumeTradedToday: number;
  qtyDeliverableToday: number;
  deliveryPctToday: number;
  avgVol5Day: number;
  avgDelQty5Day: number;
  avgDelPct5Day: number;
  avgVol20Day: number;
  avgDelQty20Day: number;
  avgDelPct20Day: number;
  marketCapCr: number;
  bookValue: number;
  pe: number;
  faceValue: number;
  high52: number;
  low52: number;
  scId?: string;
  fetchedAt: number;
}

// In-memory cache with 60-second TTL
const deliveryCache = new Map<string, { data: StockDeliveryResult; ts: number }>();
const scIdCache = new Map<string, string>();
const CACHE_TTL_MS = 60 * 1000;

export async function getStockDeliveryData(symbol: string): Promise<StockDeliveryResult | null> {
  const cleanSym = symbol.replace(/\.(NS|BO|BSE|NSE)$/i, "").toUpperCase();

  // Check cache
  const cached = deliveryCache.get(cleanSym);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
  };

  try {
    let scId = scIdCache.get(cleanSym) || cleanSym;
    let pricefeedUrl = `https://priceapi.moneycontrol.com/pricefeed/nse/equitycash/${scId}`;
    let res = await axios.get(pricefeedUrl, { headers, timeout: 5000 });
    let d = res.data?.data;

    // If direct symbol fails, look up sc_id via Moneycontrol autosuggestion
    if (!d || !d.pricecurrent || d.pricecurrent === "0" || d.pricecurrent === 0) {
      const suggestUrl = `https://www.moneycontrol.com/mccode/common/autosuggestion_solr.php?query=${encodeURIComponent(
        cleanSym
      )}&type=1&format=json`;
      const sRes = await axios.get(suggestUrl, { headers, timeout: 5000 });
      const suggestions = Array.isArray(sRes.data) ? sRes.data : [];
      const match =
        suggestions.find((item: any) => {
          const text = `${item.pdt_dis_nm || ""} ${item.stock_name || ""} ${item.sc_id || ""}`.toUpperCase();
          return text.includes(cleanSym);
        }) || suggestions[0];

      if (match?.sc_id) {
        scId = match.sc_id;
        scIdCache.set(cleanSym, scId);
        pricefeedUrl = `https://priceapi.moneycontrol.com/pricefeed/nse/equitycash/${scId}`;
        res = await axios.get(pricefeedUrl, { headers, timeout: 5000 });
        d = res.data?.data;
      }
    }

    if (!d || !d.pricecurrent) {
      return null;
    }

    const priceCurrent = parseFloat(d.pricecurrent) || 0;
    const pricePrevClose = parseFloat(d.priceprevclose) || priceCurrent;
    const priceChange = parseFloat(d.pricechange) || Number((priceCurrent - pricePrevClose).toFixed(2));
    const pricePercentChange =
      parseFloat(d.pricepercentchange) ||
      (pricePrevClose > 0 ? Number((((priceCurrent - pricePrevClose) / pricePrevClose) * 100).toFixed(2)) : 0);

    const volumeTradedToday = parseInt(d.VOL, 10) || 0;
    const qtyDeliverableToday = parseInt(d.QtyDeliverable, 10) || 0;
    let deliveryPctToday = parseFloat(d.DELV) || 0;
    if (deliveryPctToday === 0 && volumeTradedToday > 0 && qtyDeliverableToday > 0) {
      deliveryPctToday = Number(((qtyDeliverableToday / volumeTradedToday) * 100).toFixed(2));
    }

    const avgVol5Day = parseFloat(d.AvgQtyTraded_5day || d.DVolAvg5) || volumeTradedToday;
    const avgDelQty5Day = parseFloat(d.AvgQtyDel_5day) || Math.round(avgVol5Day * 0.4);
    let avgDelPct5Day = parseFloat(d.AvgDelVolPer_5day) || 0;
    if (avgDelPct5Day === 0 && avgVol5Day > 0) {
      avgDelPct5Day = Number(((avgDelQty5Day / avgVol5Day) * 100).toFixed(2));
    }

    const avgVol20Day = parseFloat(d.AvgVolQtyTraded_20day || d.DVolAvg20) || avgVol5Day;
    const avgDelQty20Day = parseFloat(d.AvgVolQtyDel_20day) || Math.round(avgVol20Day * 0.4);
    let avgDelPct20Day = parseFloat(d.AvgDelVolPer_20day) || 0;
    if (avgDelPct20Day === 0 && avgVol20Day > 0) {
      avgDelPct20Day = Number(((avgDelQty20Day / avgVol20Day) * 100).toFixed(2));
    }

    const result: StockDeliveryResult = {
      symbol: cleanSym,
      priceCurrent,
      pricePrevClose,
      priceChange,
      pricePercentChange,
      volumeTradedToday,
      qtyDeliverableToday,
      deliveryPctToday,
      avgVol5Day,
      avgDelQty5Day,
      avgDelPct5Day,
      avgVol20Day,
      avgDelQty20Day,
      avgDelPct20Day,
      marketCapCr: parseFloat(d.MKTCAP) || 0,
      bookValue: parseFloat(d.BV) || 0,
      pe: parseFloat(d.PE) || 0,
      faceValue: parseFloat(d.FV) || 0,
      high52: parseFloat(d["52H"]) || 0,
      low52: parseFloat(d["52L"]) || 0,
      scId,
      fetchedAt: Date.now(),
    };

    deliveryCache.set(cleanSym, { data: result, ts: Date.now() });
    return result;
  } catch (err: any) {
    console.warn(`[DeliveryService] Error fetching delivery data for ${symbol}:`, err?.message);
    return null;
  }
}

