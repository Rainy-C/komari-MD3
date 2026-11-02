/** Retarget from the current value; never replay a counter from zero. */
export class LiveNumber extends HTMLElement {
  private target?: number;
  private current?: number;
  private frame = 0;
  private queued = false;
  private formatter: (value: number | undefined) => string = (v) =>
    v == null ? "—" : String(v);
  private reduce = matchMedia("(prefers-reduced-motion: reduce)");
  set value(v: number | undefined) {
    const n = v != null && Number.isFinite(v) ? v : undefined;
    if (n === this.target && this.current != null) return;
    this.target = n;
    this.schedule();
  }
  set format(fn: (value: number | undefined) => string) {
    this.formatter = fn;
    this.schedule();
  }
  connectedCallback() {
    this.schedule();
    this.reduce.addEventListener("change", this.reduced);
  }
  disconnectedCallback() {
    cancelAnimationFrame(this.frame);
    this.reduce.removeEventListener("change", this.reduced);
  }
  private reduced = () => {
    if (this.reduce.matches) {
      cancelAnimationFrame(this.frame);
      this.current = this.target;
      this.textContent = this.formatter(this.target);
    }
  };
  private schedule() {
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      this.update();
    });
  }
  private update() {
    cancelAnimationFrame(this.frame);
    if (!this.isConnected) return;
    const end = this.target,
      start = this.current;
    if (end == null || start == null || start === end || this.reduce.matches) {
      this.current = end;
      this.textContent = this.formatter(end);
      return;
    }
    const at = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - at) / 320);
      this.current = start + (end - start) * (1 - (1 - t) ** 3);
      this.textContent = this.formatter(this.current);
      if (t < 1) this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
}
customElements.define("live-number", LiveNumber);
