import dns from "node:dns/promises";
import net from "node:net";
import { HttpError } from "./errors.js";
import { normalizeUrl } from "./businessService.js";
import type { AuditKey, AuditValue } from "./constants.js";

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const lower = ip.toLowerCase();
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80") || lower.startsWith("::ffff:");
}

/** Refuses to fetch anything that resolves to a private/internal address. */
async function assertPublicUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new HttpError(400, "Only http(s) websites can be checked");
  const addresses = await dns.lookup(url.hostname, { all: true }).catch(() => {
    throw new HttpError(400, `Couldn't find ${url.hostname}. Is the website address right?`);
  });
  if (addresses.some((a) => isPrivateIp(a.address))) throw new HttpError(400, "That address isn't a public website");
}

async function fetchPage(startUrl: string) {
  let url = new URL(normalizeUrl(startUrl));
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: {
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BusinessOutreachBoard/1.0",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    const html = (await res.text()).slice(0, 2_000_000);
    return { finalUrl: url, status: res.status, html };
  }
  throw new HttpError(400, "The website redirected too many times");
}

const SOCIAL_PATTERNS: Record<string, RegExp> = {
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/[^"'\s<>]+/i,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[^"'\s<>]+/i,
  tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@[^"'\s<>]+/i,
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"'\s<>]+/i,
  youtube: /https?:\/\/(?:www\.)?youtube\.com\/[^"'\s<>]+/i,
  yelp: /https?:\/\/(?:www\.)?yelp\.com\/biz\/[^"'\s<>]+/i,
};

export async function checkWebsite(website: string) {
  const findings: string[] = [];
  const audit: Partial<Record<AuditKey, AuditValue>> = {};
  const socials: Record<string, string> = {};

  let page: Awaited<ReturnType<typeof fetchPage>>;
  try {
    page = await fetchPage(website);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    audit.hasWebsite = "no";
    findings.push("Website did not load (timed out or refused connection). Treating it as no working website.");
    return { audit, socials, findings };
  }

  if (page.status >= 400) {
    audit.hasWebsite = "no";
    findings.push(`Website returned an error (HTTP ${page.status}).`);
    return { audit, socials, findings };
  }

  const html = page.html;
  const lower = html.toLowerCase();
  audit.hasWebsite = "yes";

  const https = page.finalUrl.protocol === "https:";
  audit.ssl = https ? "yes" : "no";
  findings.push(https ? "Uses HTTPS (secure)." : "No HTTPS. Browsers show 'Not secure'.");

  const viewport = /<meta[^>]+name=["']?viewport["'\s>]/i.test(html);
  audit.mobileResponsive = viewport ? "yes" : "no";
  findings.push(viewport ? "Has a mobile viewport tag." : "No mobile viewport tag, so it's likely not mobile friendly.");

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  const description = /<meta[^>]+name=["']?description["']?[^>]+content=["']?[^"'>]{20,}/i.test(html) ||
    /<meta[^>]+content=["'][^"']{20,}["'][^>]+name=["']?description/i.test(html);
  const h1 = /<h1[\s>]/i.test(html);
  const seoOk = title.length >= 10 && description && h1;
  audit.seoBasics = seoOk ? "yes" : "no";
  findings.push(
    `SEO basics: title ${title ? `"${title.slice(0, 70)}"` : "missing"}, meta description ${description ? "present" : "missing"}, H1 ${h1 ? "present" : "missing"}.`,
  );

  const emailInput = /<input[^>]+type=["']?email["'\s>/]/i.test(html);
  const newsletter = /newsletter|subscribe|mailchimp|klaviyo|convertkit|join (our|the) (list|email)/i.test(lower);
  if (emailInput || newsletter) {
    audit.emailCapture = "yes";
    findings.push("Found an email signup / capture form.");
  } else {
    findings.push("No email signup form found on the homepage.");
  }

  if (/free (guide|download|ebook|e-book|checklist|consultation|quote|estimate)|lead magnet|coupon|% off|download (our|the)/i.test(lower)) {
    audit.leadMagnet = "yes";
    findings.push("Found what looks like a lead magnet or offer.");
  } else {
    findings.push("No obvious lead magnet (free guide, coupon, quote offer).");
  }

  if (/book (now|online|an appointment)|schedule|get a quote|call (us )?now|order online|contact us/i.test(lower)) {
    findings.push("Has at least one clear call-to-action.");
  } else {
    findings.push("No clear call-to-action found (Book / Call / Get a quote).");
  }

  for (const [network, pattern] of Object.entries(SOCIAL_PATTERNS)) {
    const match = html.match(pattern)?.[0];
    if (match && !/sharer|share\.php|intent|plugins/.test(match)) socials[network] = match;
  }
  const found = Object.keys(socials);
  if (found.length) {
    audit.socialMedia = "yes";
    findings.push(`Links to social profiles: ${found.join(", ")}.`);
  } else {
    findings.push("No social media links on the homepage.");
  }

  if (/wix\.com|squarespace|godaddy|weebly/i.test(lower)) {
    findings.push("Built on a DIY site builder (Wix / Squarespace / GoDaddy / Weebly).");
  }
  const year = lower.match(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/)?.[1];
  if (year && Number(year) < new Date().getFullYear() - 1) {
    findings.push(`Copyright year is ${year}, so the site may be outdated.`);
  }

  return { audit, socials, findings };
}
