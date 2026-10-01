import http from "node:http";
import https from "node:https";
import tls from "node:tls";

const ENDPOINT = new URL("https://dns.google/resolve");
const TYPES = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16 };

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

function proxyForDnsGoogle(env) {
  const raw = env.HTTPS_PROXY || env.https_proxy;
  if (!raw) return null;
  const excluded = (env.NO_PROXY || env.no_proxy || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (excluded.some((entry) => entry === "*" || entry === "dns.google" ||
    (entry.startsWith(".") && "dns.google".endsWith(entry)))) return null;
  const proxy = new URL(raw);
  if (!["http:", "https:"].includes(proxy.protocol)) {
    throw codedError("EPROXY", "HTTPS_PROXY must use http:// or https://");
  }
  return proxy;
}

function proxyAgent(proxy, timeoutMs) {
  const agent = new https.Agent({ keepAlive: false });
  agent.createConnection = (_options, callback) => {
      let done = false;
      let secure;
      const finish = (error, socket) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        callback(error, socket);
      };
      const client = proxy.protocol === "https:" ? https : http;
      const headers = {};
      if (proxy.username || proxy.password) {
        headers["Proxy-Authorization"] = `Basic ${Buffer.from(
          `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`,
        ).toString("base64")}`;
      }
      const request = client.request({
        hostname: proxy.hostname,
        port: proxy.port || (proxy.protocol === "https:" ? 443 : 80),
        method: "CONNECT",
        path: "dns.google:443",
        headers,
      });
      const timer = setTimeout(() => {
        const error = codedError("ETIMEOUT", "Proxy timeout");
        request.destroy(error);
        secure?.destroy(error);
        finish(error);
      }, timeoutMs);
      request.once("connect", (response, socket, head) => {
        if (response.statusCode !== 200 || head.length) {
          socket.destroy();
          finish(codedError("EPROXY", `proxy CONNECT returned ${response.statusCode}`));
          return;
        }
        secure = tls.connect({ socket, servername: "dns.google" });
        secure.once("secureConnect", () => finish(null, secure));
        secure.once("error", finish);
      });
      request.once("error", finish);
      request.end();
  };
  return agent;
}

async function requestJson(url, timeoutMs, env) {
  const proxy = proxyForDnsGoogle(env);
  const agent = proxy ? proxyAgent(proxy, timeoutMs) : undefined;
  return new Promise((resolve, reject) => {
    const request = https.get(url, { agent, headers: { Accept: "application/dns-json" } },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
          if (body.length > 1_000_000) response.destroy(codedError("EBADRESP", "DoH response too large"));
        });
        response.on("error", reject);
        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(codedError("EHTTP", `DoH HTTP ${response.statusCode}`));
            return;
          }
          try { resolve(JSON.parse(body)); }
          catch { reject(codedError("EBADRESP", "Invalid DoH JSON")); }
        });
      });
    const deadline = setTimeout(() => request.destroy(codedError("ETIMEOUT", "DoH timeout")), timeoutMs);
    request.once("close", () => clearTimeout(deadline));
    request.setTimeout(timeoutMs, () => request.destroy(codedError("ETIMEOUT", "DoH timeout")));
    request.once("error", reject);
  });
}

export function parseDohTxt(data) {
  if (typeof data !== "string") throw codedError("EBADRESP", "Invalid TXT answer");
  if (!data.startsWith('"')) return [data];
  const chunks = [];
  const pattern = /"((?:\\.|[^"\\])*)"/gy;
  let position = 0;
  while (position < data.length) {
    while (data[position] === " ") position += 1;
    pattern.lastIndex = position;
    const match = pattern.exec(data);
    if (!match) throw codedError("EBADRESP", "Invalid quoted TXT answer");
    chunks.push(match[1].replace(/\\(\d{3}|.)/g, (_escape, value) => {
      if (/^\d{3}$/.test(value)) {
        const byte = Number(value);
        if (byte > 255) throw codedError("EBADRESP", "Invalid TXT escape");
        return String.fromCharCode(byte);
      }
      return value;
    }));
    position = pattern.lastIndex;
  }
  return chunks;
}

export function parseDohResponse(body, name, type) {
  if (!body || typeof body !== "object" || !Number.isInteger(body.Status)) {
    throw codedError("EBADRESP", "Invalid DoH response");
  }
  if (body.Status === 3) throw codedError("ENOTFOUND", "DNS name not found");
  if (body.Status !== 0) throw codedError("ESERVFAIL", `DNS status ${body.Status}`);
  if (body.Answer !== undefined && !Array.isArray(body.Answer)) {
    throw codedError("EBADRESP", "Invalid DoH answers");
  }
  const answers = (body.Answer ?? []).filter((answer) =>
    answer && answer.type === TYPES[type] &&
    typeof answer.name === "string" &&
    answer.name.replace(/\.$/, "").toLowerCase() === name.replace(/\.$/, "").toLowerCase(),
  );
  if (!answers.length) throw codedError("ENODATA", "No DNS answer");
  return answers.map(({ data }) => {
    if (typeof data !== "string") throw codedError("EBADRESP", "Invalid DoH answer");
    if (type === "TXT") return parseDohTxt(data);
    if (type === "MX") {
      const match = /^(\d{1,5})\s+(\S+)$/.exec(data);
      if (!match || Number(match[1]) > 65535) throw codedError("EBADRESP", "Invalid MX answer");
      return { priority: Number(match[1]), exchange: match[2].replace(/\.$/, "") };
    }
    return data.replace(/\.$/, "");
  });
}

export function createDohResolver({ timeoutMs, env = process.env, request = requestJson }) {
  async function resolve(name, type) {
    const url = new URL(ENDPOINT);
    url.searchParams.set("name", name);
    url.searchParams.set("type", type);
    const body = await request(url, timeoutMs, env);
    return parseDohResponse(body, name, type);
  }
  return {
    resolveMx: (name) => resolve(name, "MX"),
    resolveTxt: (name) => resolve(name, "TXT"),
    resolveNs: (name) => resolve(name, "NS"),
    resolveCname: (name) => resolve(name, "CNAME"),
  };
}
