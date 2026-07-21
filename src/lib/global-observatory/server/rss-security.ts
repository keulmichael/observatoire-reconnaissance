import type { GlobalSourceConnector } from "../../types";

const allowedHosts = new Set([
  "feeds.bbci.co.uk",
  "www.france24.com",
  "www.theguardian.com"
]);

export function validateRssEndpoint(source: GlobalSourceConnector) {
  if (source.type !== "rss") throw new Error(`Connecteur non RSS: ${source.name}`);
  if (!source.endpoint) throw new Error(`Endpoint manquant: ${source.name}`);
  const url = new URL(source.endpoint);
  if (url.protocol !== "https:") throw new Error(`Endpoint non HTTPS refuse: ${source.name}`);
  if (!allowedHosts.has(url.hostname)) throw new Error(`Hote RSS non autorise: ${url.hostname}`);
  if (isPrivateHost(url.hostname)) throw new Error(`Hote prive refuse: ${url.hostname}`);
  return url;
}

function isPrivateHost(hostname: string) {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "0.0.0.0"
    || hostname.startsWith("10.")
    || hostname.startsWith("192.168.")
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}
