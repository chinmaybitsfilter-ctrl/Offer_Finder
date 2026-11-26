// Fetches today's offers from each pizza chain's official website/app backend
// and writes data/offers.json. Run by .github/workflows/offers.yml every day.
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BRANDS } from "./brands.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "offers.json");
const ASSET_OUT = path.join(ROOT, "android", "app", "src", "main", "assets", "offers.json");
const MAX_OFFERS = 15;

const OFFER_RE = /(\d{1,2}\s?%\s?off|flat\s?(₹|rs\.?)?\s?\d+|(₹|rs\.?)\s?\d+\s?off|buy\s?\d+\s?get\s?\d+|b\dg\d|bogo|free\s+(pizza|delivery|garlic|pepsi|coke|dessert|side)|starting\s+(at|@)\s?(₹|rs)|@\s?(₹|rs\.?)\s?\d+|\bcoupon\b|\bpromo\s?code\b|\buse\s+code\b|\boffer\b|\bdeal\b|\bcombo\b)/i;
const STRONG_RE = /(\d{1,2}\s?%|₹\s?\d+|rs\.?\s?\d+|buy\s?\d|b\dg\d|free|code)/i;
const CODE_RE = /\b(?:code|coupon|use)\s*[:\-–]?\s*["“']?([A-Z][A-Z0-9]{3,14})\b/;
const JUNK_RE = /(cookie|privacy|terms|copyright|download the app|sign ?in|log ?in|careers|franchise|©)/i;

function todayIST() {
  return new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
}

function clean(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function toOffer(text, codeHint) {
  const t = clean(text);
  if (t.length < 8 || t.length > 260 || JUNK_RE.test(t)) return null;
  const code = clean(codeHint) || (t.match(CODE_RE) || [])[1] || "";
  const [first, ...rest] = t.split(/(?<=[.!|])\s+/);
  return { title: first.slice(0, 120), description: rest.join(" ").slice(0, 200), code };
}

// Walk JSON from the site's own API calls (same backend the official app uses).
function offersFromJson(obj, out, depth = 0) {
  if (!obj || depth > 8 || out.length > 60) return;
  if (Array.isArray(obj)) return obj.forEach((x) => offersFromJson(x, out, depth + 1));
  if (typeof obj !== "object") return;
  const keys = Object.keys(obj);
  const pick = (...names) => {
    for (const n of names) {
      const k = keys.find((k) => k.toLowerCase() === n);
      if (k && typeof obj[k] === "string" && obj[k].trim()) return obj[k];
    }
    return "";
  };
  const title = pick("title", "name", "offertitle", "offername", "heading", "headline", "displayname");
  const desc = pick("description", "desc", "subtitle", "subheading", "offerdescription", "shortdescription", "details", "text");
  const code = pick("couponcode", "coupon_code", "code", "promocode", "promo_code", "offercode", "voucher");
  const blob = `${title} ${desc}`;
  if ((code || OFFER_RE.test(blob)) && STRONG_RE.test(`${blob} ${code ? "code" : ""}`)) {
    const o = toOffer([title, desc].filter(Boolean).join(". "), /^[A-Z0-9]{4,15}$/i.test(code) ? code.toUpperCase() : "");
    if (o) out.push(o);
  }
  for (const k of keys) if (typeof obj[k] === "object") offersFromJson(obj[k], out, depth + 1);
}

async function offersFromDom(page) {
  return page.evaluate(({ offerSrc, strongSrc }) => {
    const OFFER = new RegExp(offerSrc, "i");
    const STRONG = new RegExp(strongSrc, "i");
    const res = [];
    const els = document.querySelectorAll("div, li, article, section, a, p, span, h2, h3, h4");
    for (const el of els) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const text = (el.innerText || "").replace(/\s+/g, " ").trim();
      if (text.length < 10 || text.length > 260) continue;
      if (!OFFER.test(text) || !STRONG.test(text)) continue;
      // keep the smallest element that still holds the whole offer
      const child = [...el.children].find((c) => {
        const ct = (c.innerText || "").replace(/\s+/g, " ").trim();
        return ct.length >= 10 && OFFER.test(ct) && STRONG.test(ct) && ct.length > text.length * 0.8;
      });
      if (child) continue;
      res.push(text);
      // images with alt text often carry the banner offer
    }
    for (const img of document.querySelectorAll("img[alt]")) {
      const a = img.alt.trim();
      if (a.length > 10 && OFFER.test(a) && STRONG.test(a)) res.push(a);
    }
    return res;
  }, { offerSrc: OFFER_RE.source, strongSrc: STRONG_RE.source });
}

function dedupe(offers) {
  const seen = new Set();
  const out = [];
  for (const o of offers) {
    if (!o) continue;
    const key = (o.code || o.title).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  // offers with a coupon code first
  return out.sort((a, b) => (b.code ? 1 : 0) - (a.code ? 1 : 0)).slice(0, MAX_OFFERS);
}

async function scrapeBrand(browser, brand) {
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    geolocation: { latitude: 28.3639, longitude: 75.587 },
    permissions: ["geolocation"],
  });
  let lastError = "";
  try {
    for (const url of brand.urls) {
      const page = await context.newPage();
      const jsonOffers = [];
      page.on("response", async (resp) => {
        try {
          const ct = resp.headers()["content-type"] || "";
          if (!ct.includes("json") || !/offer|coupon|deal|promo|banner|voucher/i.test(resp.url())) return;
          offersFromJson(await resp.json(), jsonOffers);
        } catch {}
      });
      try {
        const r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        if (r && r.status() >= 400) throw new Error(`HTTP ${r.status()}`);
        await page.waitForTimeout(6000);
        for (let i = 0; i < 4; i++) {
          await page.mouse.wheel(0, 1500);
          await page.waitForTimeout(1200);
        }
        const domTexts = await offersFromDom(page);
        const offers = dedupe([...jsonOffers, ...domTexts.map((t) => toOffer(t))]);
        if (offers.length) return { ok: true, source: url, offers };
        lastError = "no offers found on page";
      } catch (e) {
        lastError = String(e.message || e).split("\n")[0];
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
  }
  throw new Error(lastError);
}

async function main() {
  let previous = { brands: [] };
  try { previous = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch {}

  const browser = await chromium.launch();
  const date = todayIST();
  const brands = [];
  for (const b of BRANDS) {
    const base = { id: b.id, name: b.name, match: b.match, website: b.website };
    try {
      const r = await scrapeBrand(browser, b);
      console.log(`✓ ${b.name}: ${r.offers.length} offers`);
      brands.push({ ...base, ...r, date, stale: false });
    } catch (e) {
      console.log(`✗ ${b.name}: ${e.message}`);
      const old = previous.brands?.find((x) => x.id === b.id && x.offers?.length);
      brands.push(old
        ? { ...base, ok: false, stale: true, offers: old.offers, date: old.date, source: old.source, error: e.message }
        : { ...base, ok: false, stale: false, offers: [], date, error: e.message });
    }
  }
  await browser.close();

  const data = { date, generatedAt: new Date().toISOString(), brands };
  const json = JSON.stringify(data, null, 2) + "\n";
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, json);
  fs.mkdirSync(path.dirname(ASSET_OUT), { recursive: true });
  fs.writeFileSync(ASSET_OUT, json);
  console.log(`Wrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
