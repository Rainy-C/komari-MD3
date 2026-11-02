export const number = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const percent = (used, total) =>
  number(total) > 0
    ? Math.max(0, Math.min(100, (number(used) / number(total)) * 100))
    : 0;
export function bytes(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  if (Number(value) < 0) return "—";
  const n = number(value);
  const i =
    n > 0
      ? Math.max(0, Math.min(4, Math.floor(Math.log(n) / Math.log(1024))))
      : 0;
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${["B", "KiB", "MiB", "GiB", "TiB"][i]}`;
}
export function duration(seconds) {
  if (seconds == null) return "—";
  const s = Math.max(0, number(seconds));
  return s >= 86400
    ? `${Math.floor(s / 86400)} 天 ${Math.floor((s % 86400) / 3600)} 小时`
    : s >= 3600
      ? `${Math.floor(s / 3600)} 小时 ${Math.floor((s % 3600) / 60)} 分钟`
      : `${Math.floor(s / 60)} 分钟`;
}
export function normalizeReport(raw = {}) {
  return {
    cpu: reading(raw.cpu?.usage ?? raw.cpu),
    ram: reading(raw.ram?.used ?? raw.ram),
    ram_total: reading(raw.ram?.total ?? raw.ram_total),
    disk: reading(raw.disk?.used ?? raw.disk),
    disk_total: reading(raw.disk?.total ?? raw.disk_total),
    net_in: reading(raw.network?.down ?? raw.net_in),
    net_out: reading(raw.network?.up ?? raw.net_out),
    net_total_up: reading(raw.network?.totalUp ?? raw.net_total_up),
    net_total_down: reading(raw.network?.totalDown ?? raw.net_total_down),
    uptime: raw.uptime,
    load: reading(raw.load?.load1 ?? raw.load),
    process: reading(raw.process),
    time: raw.updated_at ?? raw.time,
  };
}
export function unpackLive(message) {
  if (
    message?.status !== "success" ||
    !message.data ||
    !Array.isArray(message.data.online) ||
    typeof message.data.data !== "object" ||
    message.data.data === null
  )
    throw new Error("实时数据格式不兼容");
  return {
    online: new Set(message.data.online),
    reports: Object.fromEntries(
      Object.entries(message.data.data).map(([id, r]) => [
        id,
        normalizeReport(r),
      ]),
    ),
  };
}

export function reading(value) {
  return value !== null &&
    value !== undefined &&
    value !== "" &&
    typeof value !== "object" &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0
    ? Number(value)
    : undefined;
}
export function capacity(used, total) {
  if (reading(total) == null || total <= 0) return "—";
  const i = Math.max(
    0,
    Math.min(4, Math.floor(Math.log(total) / Math.log(1024))),
  );
  const unit = ["B", "KiB", "MiB", "GiB", "TiB"][i];
  const format = (n) => (n / 1024 ** i).toFixed(i ? 1 : 0).replace(/\.0$/, "");
  return `${reading(used) == null ? "—" : format(used)} / ${format(total)} ${unit}`;
}
export function aggregate(reports, ids, key, mean = false) {
  const values = ids
    .map((id) => reports[id]?.[key])
    .filter((v) => reading(v) != null);
  return values.length
    ? values.reduce((a, b) => a + b, 0) / (mean ? values.length : 1)
    : undefined;
}
