const API_HOSTNAME = window.location.hostname;
const PROTOCOL = window.location.protocol;
const WS_PROTOCOL = PROTOCOL === "https:" ? "wss:" : "ws:";

const IS_MATISSE_DOMAIN = API_HOSTNAME.endsWith("matissetec.dev");

export interface Config {
  API_BASE: string;
  WS_BASE: string;
}

const defaultConfig: Config = {
  API_BASE: (IS_MATISSE_DOMAIN && API_HOSTNAME !== "localhost")
    ? `https://wss.matissetec.dev`
    : `${PROTOCOL}//${API_HOSTNAME}:8000`,
  WS_BASE: (IS_MATISSE_DOMAIN && API_HOSTNAME !== "localhost")
    ? `wss://wss.matissetec.dev`
    : `${WS_PROTOCOL}//${API_HOSTNAME}:8000`
};

// We use a mutable object that components can read from,
// and a promise that they can await if they want to be sure.
export const currentConfig: Config = { ...defaultConfig };

export const resolveConfig = async (): Promise<Config> => {
  if (IS_MATISSE_DOMAIN && API_HOSTNAME !== "localhost") {
    console.log("[Config] Verifying wss.matissetec.dev...");
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000);
      
      await fetch(`https://wss.matissetec.dev/ping`, { 
        mode: 'no-cors',
        signal: controller.signal 
      });
      clearTimeout(id);
      console.log("[Config] wss.matissetec.dev is UP.");
    } catch (e) {
      console.warn("[Config] wss.matissetec.dev unreachable, falling back to local backend.");
      currentConfig.API_BASE = `${PROTOCOL}//${API_HOSTNAME}:8000`;
      currentConfig.WS_BASE = `${WS_PROTOCOL}//${API_HOSTNAME}:8000`;
    }
  }
  return currentConfig;
};

// For legacy support while we migrate
export const API_BASE = currentConfig.API_BASE;
export const WS_BASE = currentConfig.WS_BASE;
