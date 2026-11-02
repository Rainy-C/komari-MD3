export interface NodeInfo {uuid:string;name:string;group?:string;region?:string;os?:string;cpu_name?:string;cpu_cores?:number;arch?:string;mem_total?:number;disk_total?:number;public_remark?:string;tags?:string;weight?:number;virtualization?:string;kernel_version?:string;traffic_limit?:number;expired_at?:string;}
export interface Report {cpu:number;ram:number;ram_total:number;disk:number;disk_total:number;net_in:number;net_out:number;net_total_up:number;net_total_down:number;uptime?:number;load:number;process:number;time?:string;}
export interface Settings {seed_color?:string;headline?:string;description?:string;default_appearance?:string;show_traffic?:boolean;show_uptime?:boolean;refresh_seconds?:number;}
export interface HistoryRecord {time:string;cpu?:number;ram?:number;ram_total?:number;net_in?:number;net_out?:number;value?:number;task_id?:number;}
export interface PingTask {id:number;name:string;}
