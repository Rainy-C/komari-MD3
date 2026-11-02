export const number = v => Number.isFinite(Number(v)) ? Number(v) : 0;
export const percent = (used, total) => number(total) > 0 ? Math.max(0, Math.min(100, number(used) / number(total) * 100)) : 0;
export function bytes(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Math.max(0, number(value));
  const i = n > 0 ? Math.min(4, Math.floor(Math.log(n) / Math.log(1024))) : 0;
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${['B','KiB','MiB','GiB','TiB'][i]}`;
}
export function duration(seconds) {
  if (seconds == null) return '—';
  const s = Math.max(0, number(seconds));
  return s >= 86400 ? `${Math.floor(s/86400)} 天 ${Math.floor(s%86400/3600)} 小时` : s >= 3600 ? `${Math.floor(s/3600)} 小时 ${Math.floor(s%3600/60)} 分钟` : `${Math.floor(s/60)} 分钟`;
}
export function normalizeReport(raw = {}) {
  return {cpu:number(raw.cpu?.usage ?? raw.cpu), ram:number(raw.ram?.used ?? raw.ram),ram_total:number(raw.ram?.total ?? raw.ram_total),
    disk:number(raw.disk?.used ?? raw.disk),disk_total:number(raw.disk?.total ?? raw.disk_total),
    net_in:number(raw.network?.down ?? raw.net_in),net_out:number(raw.network?.up ?? raw.net_out),
    net_total_up:number(raw.network?.totalUp ?? raw.net_total_up),net_total_down:number(raw.network?.totalDown ?? raw.net_total_down),
    uptime:raw.uptime,load:number(raw.load?.load1 ?? raw.load),process:number(raw.process),time:raw.updated_at ?? raw.time};
}
export function unpackLive(message) {
  if (message?.status !== 'success' || !message.data || !Array.isArray(message.data.online) || typeof message.data.data !== 'object' || message.data.data === null) throw new Error('实时数据格式不兼容');
  return {online:new Set(message.data.online),reports:Object.fromEntries(Object.entries(message.data.data).map(([id,r])=>[id,normalizeReport(r)]))};
}
