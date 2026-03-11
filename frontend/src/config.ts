const API_HOSTNAME = window.location.hostname;
const PROTOCOL = window.location.protocol;
const WS_PROTOCOL = PROTOCOL === "https:" ? "wss:" : "ws:";

const IS_MATISSE_DOMAIN = API_HOSTNAME.endsWith("matissetec.dev");
const IS_LOCAL_IP = API_HOSTNAME.startsWith("192.168.") || API_HOSTNAME === "localhost" || API_HOSTNAME === "127.0.0.1";

export interface Config {
  API_BASE: string;
  WS_BASE: string;
}

// Default assumption: if we are on matissetec.dev, use the wss subdomain (port 443)
// Otherwise, assume port 8000 on the current host.
const defaultConfig: Config = {
  API_BASE: (IS_MATISSE_DOMAIN && !IS_LOCAL_IP)
    ? `https://wss.matissetec.dev`
    : `${PROTOCOL}//${API_HOSTNAME}:8000`,
  WS_BASE: (IS_MATISSE_DOMAIN && !IS_LOCAL_IP)
    ? `wss://wss.matissetec.dev`
    : `${WS_PROTOCOL}//${API_HOSTNAME}:8000`
};

export const currentConfig: Config = { ...defaultConfig };

export const resolveConfig = async (): Promise<Config> => {
  if (IS_MATISSE_DOMAIN && !IS_LOCAL_IP) {
    console.log("[Config] Matisse domain detected, verifying wss.matissetec.dev...");
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000);
      
      // We check /health instead of /ping to ensure we get a valid response
      const res = await fetch(`https://wss.matissetec.dev/health`, { 
        mode: 'cors', // Explicitly use cors now that we fixed the backend
        signal: controller.signal 
      });
      clearTimeout(id);
      
      if (res.ok) {
        console.log("[Config] wss.matissetec.dev is reachable.");
      } else {
        throw new Error("Backend returned error status");
      }
    } catch (e) {
      console.warn("[Config] wss.matissetec.dev unreachable or CORS error, falling back to current host :8000");
      // Fallback: Use the same domain but port 8000
      currentConfig.API_BASE = `${PROTOCOL}//${API_HOSTNAME}:8000`;
      currentConfig.WS_BASE = `${WS_PROTOCOL}//${API_HOSTNAME}:8000`;
    }
  }
  
  console.log(`[Config] Resolved API_BASE: ${currentConfig.API_BASE}`);
  return currentConfig;
};

// For legacy support
export const API_BASE = currentConfig.API_BASE;
export const WS_BASE = currentConfig.WS_BASE;
