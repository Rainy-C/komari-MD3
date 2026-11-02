export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    signal: init.signal ?? AbortSignal.timeout(15000),
  });
  let json;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(
      "服务器返回了非 JSON 内容，请确认 Komari 接口可用",
      response.status,
    );
  }
  if (!response.ok || json.status === "error")
    throw new ApiError(
      json.message || `请求失败（${response.status}）`,
      response.status,
    );
  return (json.status === "success" && "data" in json ? json.data : json) as T;
}
export class LiveClient {
  private socket?: WebSocket;
  private poll?: ReturnType<typeof setInterval>;
  private retry?: ReturnType<typeof setTimeout>;
  private watchdog?: ReturnType<typeof setInterval>;
  private last = 0;
  private stopped = true;
  private attempts = 0;
  constructor(
    private interval: number,
    private onData: (data: unknown) => void,
    private onState: (state: string) => void,
  ) {}
  start() {
    this.stop();
    this.stopped = false;
    this.connect();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.retry);
    clearInterval(this.poll);
    clearInterval(this.watchdog);
    this.socket?.close();
  }
  private connect() {
    if (this.stopped) return;
    this.onState("connecting");
    const ws = new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/clients`,
    );
    this.socket = ws;
    ws.onopen = () => {
      if (this.stopped) {
        ws.close();
        return;
      }
      this.last = Date.now();
      ws.send("get");
      this.poll = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("get");
      }, this.interval * 1000);
      this.watchdog = setInterval(() => {
        if (Date.now() - this.last > Math.max(20000, this.interval * 3000))
          ws.close();
      }, 5000);
    };
    ws.onmessage = (e) => {
      try {
        this.onData(JSON.parse(e.data));
        this.last = Date.now();
        this.attempts = 0;
        this.onState("live");
      } catch {
        this.onState("error");
        ws.close();
      }
    };
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      clearInterval(this.poll);
      clearInterval(this.watchdog);
      if (!this.stopped) {
        this.onState("retrying");
        this.retry = setTimeout(
          () => this.connect(),
          Math.min(30000, 1000 * 2 ** Math.min(5, this.attempts++)),
        );
      }
    };
  }
}
