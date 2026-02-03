import fs from "fs";
import { getStoragePath } from "./paths";
import { isGoogleAuthRedirect, containsGoogleAuthRedirect } from "./url_utils";

const MINIMUM_REQUIRED_COOKIES = new Set(["SID"]);

const ALLOWED_COOKIE_DOMAINS = new Set([
  ".google.com",
  "notebooklm.google.com",
  ".googleusercontent.com",
]);

const GOOGLE_REGIONAL_CCTLDS = new Set([
  "com.sg", "com.au", "com.br", "com.mx", "com.ar", "com.hk", "com.tw", "com.my",
  "com.ph", "com.vn", "com.pk", "com.bd", "com.ng", "com.eg", "com.tr", "com.ua",
  "com.co", "com.pe", "com.sa", "com.ae",
  "co.uk", "co.jp", "co.in", "co.kr", "co.za", "co.nz", "co.id", "co.th", "co.il",
  "co.ve", "co.cr", "co.ke", "co.ug", "co.tz", "co.ma", "co.ao", "co.mz", "co.zw",
  "co.bw",
  "cn", "de", "fr", "it", "es", "nl", "pl", "ru", "ca", "be", "at", "ch", "se",
  "no", "dk", "fi", "pt", "gr", "cz", "ro", "hu", "ie", "sk", "bg", "hr", "si",
  "lt", "lv", "ee", "lu", "cl", "cat",
]);

export class AuthTokens {
  cookies: Record<string, string>;
  csrfToken: string;
  sessionId: string;

  constructor(cookies: Record<string, string>, csrfToken: string, sessionId: string) {
    this.cookies = cookies;
    this.csrfToken = csrfToken;
    this.sessionId = sessionId;
  }

  get cookieHeader(): string {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  static async fromStorage(pathStr?: string): Promise<AuthTokens> {
    const cookies = loadAuthFromStorage(pathStr);
    const [csrfToken, sessionId] = await fetchTokens(cookies);
    return new AuthTokens(cookies, csrfToken, sessionId);
  }
}

function isGoogleDomain(domain: string): boolean {
  if (domain === ".google.com") return true;
  if (domain.startsWith(".google.")) {
    const suffix = domain.substring(8);
    return GOOGLE_REGIONAL_CCTLDS.has(suffix);
  }
  return false;
}

function isAllowedAuthDomain(domain: string): boolean {
  return ALLOWED_COOKIE_DOMAINS.has(domain) || isGoogleDomain(domain);
}

function loadStorageState(pathStr?: string): any {
  if (pathStr) {
    if (!fs.existsSync(pathStr)) {
      throw new Error(`Storage file not found: ${pathStr}\nRun 'notebooklm login' to authenticate first.`);
    }
    return JSON.parse(fs.readFileSync(pathStr, "utf-8"));
  }

  if (process.env.NOTEBOOKLM_AUTH_JSON) {
    const authJson = process.env.NOTEBOOKLM_AUTH_JSON.trim();
    if (!authJson) {
      throw new Error("NOTEBOOKLM_AUTH_JSON environment variable is set but empty.");
    }
    try {
      const state = JSON.parse(authJson);
      if (!state.cookies) throw new Error("Missing 'cookies' key");
      return state;
    } catch (e: any) {
       throw new Error(`Invalid JSON in NOTEBOOKLM_AUTH_JSON: ${e.message}`);
    }
  }

  const storagePath = getStoragePath();
  if (!fs.existsSync(storagePath)) {
    throw new Error(`Storage file not found: ${storagePath}\nRun 'notebooklm login' to authenticate first.`);
  }
  return JSON.parse(fs.readFileSync(storagePath, "utf-8"));
}

export function loadAuthFromStorage(pathStr?: string): Record<string, string> {
  const storageState = loadStorageState(pathStr);
  return extractCookiesFromStorage(storageState);
}

export function extractCookiesFromStorage(storageState: any): Record<string, string> {
  const cookies: Record<string, string> = {};
  const cookieDomains: Record<string, string> = {};

  const stateCookies = storageState.cookies || [];
  for (const cookie of stateCookies) {
    const domain = cookie.domain || "";
    const name = cookie.name;
    
    if (!isAllowedAuthDomain(domain) || !name) continue;

    const isBaseDomain = domain === ".google.com";
    if (!(name in cookies) || isBaseDomain) {
      cookies[name] = cookie.value || "";
      cookieDomains[name] = domain;
    }
  }

  const missing = [...MINIMUM_REQUIRED_COOKIES].filter(c => !(c in cookies));
  if (missing.length > 0) {
    throw new Error(`Missing required cookies: ${missing.join(", ")}\nRun 'notebooklm login' to authenticate.`);
  }

  return cookies;
}

export function extractCsrfFromHtml(html: string, finalUrl = ""): string {
  const match = html.match(/"SNlM0e"\s*:\s*"([^"]+)"/);
  if (!match) {
    if (isGoogleAuthRedirect(finalUrl) || containsGoogleAuthRedirect(html)) {
      throw new Error("Authentication expired or invalid. Run 'notebooklm login' to re-authenticate.");
    }
    throw new Error(`CSRF token not found in HTML. Final URL: ${finalUrl}`);
  }
  return match[1] || "";
}

export function extractSessionIdFromHtml(html: string, finalUrl = ""): string {
  const match = html.match(/"FdrFJe"\s*:\s*"([^"]+)"/);
  if (!match) {
    if (isGoogleAuthRedirect(finalUrl) || containsGoogleAuthRedirect(html)) {
      throw new Error("Authentication expired or invalid. Run 'notebooklm login' to re-authenticate.");
    }
    throw new Error(`Session ID not found in HTML. Final URL: ${finalUrl}`);
  }
  return match[1] || "";
}

async function fetchTokens(cookies: Record<string, string>): Promise<[string, string]> {
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  
  const response = await fetch("https://notebooklm.google.com/", {
    headers: {
      "Cookie": cookieHeader,
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const html = await response.text();
  const finalUrl = response.url;

  if (isGoogleAuthRedirect(finalUrl)) {
    throw new Error("Authentication expired or invalid. Run 'notebooklm login' to re-authenticate.");
  }

  const csrf = extractCsrfFromHtml(html, finalUrl);
  const sessionId = extractSessionIdFromHtml(html, finalUrl);

  return [csrf, sessionId];
}
