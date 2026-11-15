// ONTRIX — live network map (canvas). Real wallets as nodes, real transactions as packets.
import { CFG, net, bus, activeNetworks, short, fmtUsd } from "./util.js";
import { state } from "./stream.js";

const PHOSPHOR = "#65F5C1";
const icons = {};
function icon(k) {
  if (!icons[k]) { const im = new Image(); im.src = net(k).icon; icons[k] = im; }
  return icons[k];
}

export class NetMap {
  constructor(canvas, { onPick, onHover } = {}) {
    this.c = canvas; this.ctx = canvas.getContext("2d");
    this.onPick = onPick; this.onHover = onHover;
    this.cam = { x: 0, y: 0, s: 1 };
    this.packets = [];
    this.hover = null;
    this.t = 0;
    this.running = true;
    this.keys = activeNetworks();
    this.resize = this.resize.bind(this);
    window.addEventListener("resize", this.resize);
    this.resize();
    this.offPacket = bus.on("packet", (p) => { if (this.packets.length < 400) this.packets.push({ ...p, t: 0, sp: p.whale ? 0.010 : 0.018 + Math.random() * 0.01 }); });
    this.bindInput();
    const tick = () => { if (!this.running) return; this.step(); this.draw(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  destroy() { this.running = false; window.removeEventListener("resize", this.resize); this.offPacket(); this.ro?.disconnect(); }

  resize() {
    const r = this.c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width; this.h = r.height; this.dpr = dpr;
    this.c.width = Math.max(1, r.width * dpr); this.c.height = Math.max(1, r.height * dpr);
    const usableW = this.w > 900 ? this.w - 480 : this.w;
    const R = Math.max(90, Math.min(usableW, this.h - 160) * 0.34);
    this.anchors = {};
    const n = this.keys.length;
    this.keys.forEach((k, i) => {
      if (n === 1) this.anchors[k] = { x: 0, y: 0 };
      else { const a = -Math.PI * 3 / 4 + (i * 2 * Math.PI) / n; this.anchors[k] = { x: Math.cos(a) * R * (this.w < 700 ? 0.8 : 1.35), y: Math.sin(a) * R * 1.0 }; }
    });
    this.R = n === 1 ? R * 1.1 : R * 0.5;
  }

  visible(k) { return state.focus === "all" || state.focus === k; }

  step() {
    this.t++;
    const nodes = [...state.nodes.values()];
    // init positions
    for (const n of nodes) {
      if (n.x == null) {
        const a = this.anchors[n.k] || { x: 0, y: 0 };
        const ang = Math.random() * Math.PI * 2, rr = this.R * (0.4 + Math.random() * 0.7);
        n.x = a.x + Math.cos(ang) * rr; n.y = a.y + Math.sin(ang) * rr; n.vx = 0; n.vy = 0;
      }
    }
    // springs
    for (const e of state.edges.values()) {
      const a = state.nodes.get(e.a), b = state.nodes.get(e.b);
      if (!a || !b || a.x == null || b.x == null) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const f = (d - 34) * 0.0025;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    // repulsion via spatial hash
    const cell = 28, grid = new Map();
    for (const n of nodes) { const key = ((n.x / cell) | 0) + "," + ((n.y / cell) | 0); (grid.get(key) || grid.set(key, []).get(key)).push(n); }
    for (const n of nodes) {
      const cx = (n.x / cell) | 0, cy = (n.y / cell) | 0;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const g = grid.get(cx + i + "," + (cy + j)); if (!g) continue;
        for (const m of g) {
          if (m === n) continue;
          const dx = n.x - m.x, dy = n.y - m.y, d2 = dx * dx + dy * dy;
          if (d2 > 0 && d2 < cell * cell) { const f = 0.6 / d2; n.vx += dx * f; n.vy += dy * f; }
        }
      }
    }
    // anchor gravity + integrate
    for (const n of nodes) {
      const a = this.anchors[n.k] || { x: 0, y: 0 };
      const dx = a.x - n.x, dy = a.y - n.y, d = Math.hypot(dx, dy);
      const g = d > this.R ? 0.0016 : 0.0004;
      n.vx += dx * g; n.vy += dy * g;
      n.vx *= 0.86; n.vy *= 0.86;
      n.x += n.vx; n.y += n.vy;
    }
    for (const p of this.packets) p.t += p.sp;
    this.packets = this.packets.filter((p) => p.t < 1);
  }

  w2s(x, y) { return [(x - this.cam.x) * this.cam.s + this.w / 2, (y - this.cam.y) * this.cam.s + this.h / 2]; }
  s2w(x, y) { return [(x - this.w / 2) / this.cam.s + this.cam.x, (y - this.h / 2) / this.cam.s + this.cam.y]; }

  draw() {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const now = Date.now();

    // anchors: rings, labels
    for (const k of this.keys) {
      const a = this.anchors[k], n = net(k);
      const [sx, sy] = this.w2s(a.x, a.y);
      const r = this.R * this.cam.s;
      const vis = this.visible(k);
      ctx.save();
      ctx.globalAlpha = vis ? 1 : 0.25;
      ctx.strokeStyle = n.color + "33"; ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx, sy, r * 0.55, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // rotating arc
      ctx.strokeStyle = n.color + "88"; ctx.lineWidth = 1.5;
      const rot = this.t * 0.004 + this.keys.indexOf(k);
      ctx.beginPath(); ctx.arc(sx, sy, r + 6, rot, rot + 0.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx, sy, r + 6, rot + Math.PI, rot + Math.PI + 0.35); ctx.stroke();
      // label
      const im = icon(k);
      const ly = sy - r - 20;
      if (im.complete && im.naturalWidth) ctx.drawImage(im, sx - 52, ly - 9, 18, 18);
      ctx.font = "600 11px 'JetBrains Mono', monospace"; ctx.fillStyle = n.color; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(n.name.toUpperCase(), sx - 30, ly);
      const st = state.nets[k];
      ctx.fillStyle = "#8aa3a0"; ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillText(st?.height ? `#${st.height.toLocaleString("en-US")}` : st?.err ? "UPLINK LOST" : "CONNECTING…", sx - 30, ly + 13);
      ctx.restore();
    }

    // radar sweep from center
    {
      const [cx, cy] = this.w2s(0, 0);
      const rr = Math.hypot(this.w, this.h) * 0.6;
      const ang = (this.t * 0.012) % (Math.PI * 2);
      const grad = ctx.createConicGradient ? ctx.createConicGradient(ang - 0.6, cx, cy) : null;
      if (grad) {
        grad.addColorStop(0, "rgba(101,245,193,0)");
        grad.addColorStop(0.09, "rgba(101,245,193,0.07)");
        grad.addColorStop(0.0955, "rgba(101,245,193,0)");
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
      }
    }

    // edges
    ctx.lineWidth = 1;
    for (const e of state.edges.values()) {
      const a = state.nodes.get(e.a), b = state.nodes.get(e.b);
      if (!a || !b || a.x == null || b.x == null || !this.visible(e.k)) continue;
      const age = (now - e.last) / 1000;
      const alpha = Math.max(0.06, 0.5 - age / 240);
      const [x1, y1] = this.w2s(a.x, a.y), [x2, y2] = this.w2s(b.x, b.y);
      ctx.strokeStyle = hexA(net(e.k).color, alpha * (e.usd >= CFG.intel.whaleUsd ? 1.6 : 1));
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }

    // packets
    for (const p of this.packets) {
      const a = state.nodes.get(p.from), b = state.nodes.get(p.to);
      if (!a || !b || a.x == null || b.x == null || !this.visible(p.k)) continue;
      const x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t;
      const [sx, sy] = this.w2s(x, y);
      const col = p.whale ? "#FF4D6D" : p.token ? "#FFFFFF" : net(p.k).color;
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = p.whale ? 16 : 8;
      ctx.beginPath(); ctx.arc(sx, sy, p.whale ? 3.2 : 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // nodes
    let hov = null;
    for (const n of state.nodes.values()) {
      if (n.x == null || !this.visible(n.k)) continue;
      const [sx, sy] = this.w2s(n.x, n.y);
      if (sx < -20 || sy < -20 || sx > this.w + 20 || sy > this.h + 20) continue;
      const age = (now - n.last) / 1000;
      const r = (n.whale ? 4.5 : 1.6 + Math.min(3, Math.log10(1 + n.usd) * 0.45) + Math.min(2, n.deg * 0.25)) * Math.max(0.7, Math.min(1.6, this.cam.s));
      const col = n.whale ? "#FF4D6D" : net(n.k).color;
      ctx.fillStyle = hexA(col, age < 10 ? 1 : Math.max(0.35, 1 - age / 300));
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      if (n.whale) {
        const pr = r + 4 + ((this.t * 0.4) % 14);
        ctx.strokeStyle = hexA("#FF4D6D", Math.max(0, 0.8 - ((this.t * 0.4) % 14) / 14));
        ctx.beginPath(); ctx.arc(sx, sy, pr, 0, Math.PI * 2); ctx.stroke();
      }
      if (this.mouse && Math.hypot(this.mouse[0] - sx, this.mouse[1] - sy) < Math.max(6, r + 3)) hov = n;
    }
    if (hov) {
      const [sx, sy] = this.w2s(hov.x, hov.y);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 9, sy); ctx.lineTo(sx + 22, sy - 14); ctx.lineTo(sx + 120, sy - 14); ctx.stroke();
      ctx.fillStyle = "#E8F1F2"; ctx.font = "11px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
      ctx.fillText(short(hov.addr, 5), sx + 26, sy - 22);
      ctx.fillStyle = "#8aa3a0";
      ctx.fillText(`${net(hov.k).short} · ${hov.txs} tx · ${fmtUsd(hov.usd)}${hov.whale ? " · WHALE" : ""}`, sx + 26, sy - 4);
      this.c.style.cursor = "pointer";
    } else this.c.style.cursor = this.drag ? "grabbing" : "crosshair";
    if (hov !== this.hover) { this.hover = hov; this.onHover?.(hov); }

    // center hub
    {
      const [cx, cy] = this.w2s(0, 0);
      if (this.keys.length > 1) {
        ctx.strokeStyle = "rgba(101,245,193,.25)"; ctx.lineWidth = 1;
        for (const k of this.keys) { const a = this.anchors[k]; const [ax, ay] = this.w2s(a.x, a.y); ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ax, ay); ctx.stroke(); }
        ctx.setLineDash([]);
        ctx.fillStyle = "#fff"; ctx.shadowColor = PHOSPHOR; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(cx, cy, 5 + Math.sin(this.t * 0.05) * 1.2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.strokeStyle = PHOSPHOR; ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; const px = cx + Math.cos(a) * 16, py = cy + Math.sin(a) * 16; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath(); ctx.stroke();
      }
    }
  }

  bindInput() {
    const c = this.c;
    c.addEventListener("mousemove", (e) => {
      const r = c.getBoundingClientRect(); this.mouse = [e.clientX - r.left, e.clientY - r.top];
      if (this.drag) { this.cam.x -= (e.clientX - this.drag[0]) / this.cam.s; this.cam.y -= (e.clientY - this.drag[1]) / this.cam.s; this.drag = [e.clientX, e.clientY]; this.moved = true; }
    });
    c.addEventListener("mouseleave", () => { this.mouse = null; this.drag = null; });
    c.addEventListener("mousedown", (e) => { this.drag = [e.clientX, e.clientY]; this.moved = false; });
    window.addEventListener("mouseup", () => { this.drag = null; });
    c.addEventListener("click", () => { if (!this.moved && this.hover) this.onPick?.(this.hover); });
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = c.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
      const [wx, wy] = this.s2w(mx, my);
      this.cam.s = Math.min(4, Math.max(0.4, this.cam.s * (e.deltaY < 0 ? 1.12 : 0.89)));
      const [wx2, wy2] = this.s2w(mx, my); this.cam.x += wx - wx2; this.cam.y += wy - wy2;
    }, { passive: false });
    c.addEventListener("dblclick", () => { this.cam = { x: 0, y: 0, s: 1 }; });
    // touch pan
    c.addEventListener("touchstart", (e) => { const t = e.touches[0]; this.drag = [t.clientX, t.clientY]; }, { passive: true });
    c.addEventListener("touchmove", (e) => { const t = e.touches[0]; if (!this.drag) return; this.cam.x -= (t.clientX - this.drag[0]) / this.cam.s; this.cam.y -= (t.clientY - this.drag[1]) / this.cam.s; this.drag = [t.clientX, t.clientY]; }, { passive: true });
    c.addEventListener("touchend", () => { this.drag = null; });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(c);
  }
}

export function hexA(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
