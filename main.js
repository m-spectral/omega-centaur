'use strict';
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 ( B Munoz)
const { Plugin, ItemView, PluginSettingTab, Setting } = require('obsidian');

const VIEW_TYPE    = 'omega-centaur';


/* ---- search helpers (hand-rolled: no npm in this vault, so no fuse.js) ---- */
function debounce(fn, ms) {
  let t = null;
  const d = function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  d.cancel = () => clearTimeout(t);
  return d;
}

/* Subsequence fuzzy match. Returns a score (higher = better) or -1 for no match.
   Rewards: consecutive runs, matches at word boundaries, early first hit,
   and an exact-substring shortcut so literal queries always win. */
function fuzzyScore(needle, hay) {
  const n = needle.toLowerCase().trim();
  if (!n) return 0;
  const h = hay.toLowerCase();
  const sub = h.indexOf(n);
  if (sub === 0) return 1000 - h.length * 0.05;
  if (sub > 0)   return 700 - sub * 2 - h.length * 0.05;

  let at = 0, score = 0, first = -1, prevEnd = -1;
  for (let i = 0; i < n.length; i++) {
    const c = n[i];
    let found = -1;
    for (let k = at; k < h.length; k++) { if (h[k] === c) { found = k; break; } }
    if (found < 0) return -1;
    if (first < 0) first = found;
    score += 1;
    if (found === prevEnd) score += 4;                              // consecutive
    if (found === 0 || /[\s\-_/&.,()\[\]]/.test(h[found - 1])) score += 6; // word start
    prevEnd = found + 1;
    at = found + 1;
  }
  score += Math.max(0, 10 - first);
  score -= Math.max(0, h.length - n.length) * 0.04;
  return score;
}

const DEFAULTS = {
  groupBy: 'moc',          // 'moc' | 'folder' | any frontmatter key
  showLinks: true,
  autoRotate: true,
  spinSpeed: 0.10,
  nodeScale: 1.0,
  labels: 'hover',         // 'hover' | 'always' | 'none'
  physics: true,
  linkForce: 0.055,
  repelForce: 0.011,
  gridMeridians: 6,
  gridParallels: 4,
  excludeFolders: '',
};

/* ================= math ================= */
const norm = v => { const l = Math.hypot(v[0],v[1],v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; };
const dot  = (a,b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

function slerp(a, b, t) {
  let d = Math.max(-1, Math.min(1, dot(a,b)));
  const o = Math.acos(d);
  if (o < 1e-6) return a.slice();
  const s = Math.sin(o), w1 = Math.sin((1-t)*o)/s, w2 = Math.sin(t*o)/s;
  return [a[0]*w1 + b[0]*w2, a[1]*w1 + b[1]*w2, a[2]*w1 + b[2]*w2];
}

/* ================= graph model ================= */
async function buildModel(app, s) {
  const ex = (s.excludeFolders || '').split(',').map(x => x.trim()).filter(Boolean);
  const files = app.vault.getMarkdownFiles()
    .filter(f => !ex.some(d => f.path === d || f.path.startsWith(d + '/')));
  const idx = new Map();
  files.forEach((f, i) => idx.set(f.path, i));

  const cacheOf = f => app.metadataCache.getFileCache(f) || {};
  const fmOf    = f => cacheOf(f).frontmatter || {};
  const isMoc   = f => {
    const t = fmOf(f).type;
    return t === 'moc' || f.basename === 'Index' || /\bMOC$/.test(f.basename);
  };
  const resolve = (link, from) => app.metadataCache.getFirstLinkpathDest(
    (link || '').split('#')[0].split('|')[0], from);
  const firstLinkedMoc = f => {
    for (const l of (cacheOf(f).links || [])) {
      const t = resolve(l.link, f.path);
      if (t && t.path !== f.path && isMoc(t)) return t;
    }
    return null;
  };

  /* parent comes from the note's own breadcrumb, never from its first link
     (Index's first link is a child, which would make a cycle) */
  const mocs = files.filter(isMoc);
  const parent = new Map();
  for (const m of mocs) {
    let par = null;
    try {
      const txt = await app.vault.cachedRead(m);
      const mm = txt.match(/\u2191\s*\[\[([^\]|#]+)/);
      if (mm) {
        const t = resolve(mm[1].trim(), m.path);
        if (t && t.path !== m.path && isMoc(t)) par = t.basename;
      }
    } catch (e) { /* unreadable: treat as a root */ }
    parent.set(m.basename, par);
  }

  /* notes a MOC links down to but which never link back (templates) */
  const claimedBy = new Map();
  for (const m of mocs) {
    for (const l of (cacheOf(m).links || [])) {
      const t = resolve(l.link, m.path);
      if (!t || t.path === m.path || isMoc(t)) continue;
      if (!claimedBy.has(t.path)) claimedBy.set(t.path, m.basename);
    }
  }

  const nodes = files.map(f => {
    let g;
    if (s.groupBy === 'moc') {
      g = isMoc(f) ? f.basename : (firstLinkedMoc(f) || {}).basename;
      if (!g) g = claimedBy.get(f.path);
      if (!g) g = 'Unfiled';
    } else if (s.groupBy === 'folder') {
      g = (f.parent && f.parent.path !== '/') ? f.parent.name : 'vault root';
    } else {
      let v = fmOf(f)[s.groupBy];
      if (Array.isArray(v)) v = v[0];
      g = (v == null || v === '') ? 'uncategorised' : String(v);
    }
    return { file: f, name: f.basename, group: g, deg: 0, v: [0,0,0], pinned: false };
  });

  const links = [], adj = new Map(), seen = new Set();
  const resolved = app.metadataCache.resolvedLinks || {};
  for (const src in resolved) {
    const si = idx.get(src); if (si === undefined) continue;
    for (const dst in resolved[src]) {
      const ti = idx.get(dst);
      if (ti === undefined || ti === si) continue;
      const key = si < ti ? si + ':' + ti : ti + ':' + si;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ s: si, t: ti });
      nodes[si].deg++; nodes[ti].deg++;
      if (!adj.has(si)) adj.set(si, new Set());
      if (!adj.has(ti)) adj.set(ti, new Set());
      adj.get(si).add(ti); adj.get(ti).add(si);
    }
  }

  const counts = new Map();
  for (const nd of nodes) counts.set(nd.group, (counts.get(nd.group) || 0) + 1);

  let ordered = [];
  if (s.groupBy === 'moc') {
    const kids = new Map();
    for (const m of mocs) {
      const par = parent.get(m.basename);
      if (!kids.has(par)) kids.set(par, []);
      kids.get(par).push(m.basename);
    }
    const total = (name, seenT) => {
      seenT = seenT || new Set();
      if (seenT.has(name)) return 0;
      seenT.add(name);
      let t = counts.get(name) || 0;
      for (const k of (kids.get(name) || [])) t += total(k, seenT);
      return t;
    };
    for (const arr of kids.values())
      arr.sort((a, b) => total(b) - total(a) || a.localeCompare(b));
    const seenW = new Set();
    const walk = (name, d, main) => {
      if (seenW.has(name) || d > 6) return;
      seenW.add(name);
      ordered.push({ name, depth: d, main,
                     count: d === 0 ? total(name) : (counts.get(name) || 0) });
      for (const k of (kids.get(name) || [])) walk(k, d + 1, main);
    };
    const roots = mocs.filter(m => !parent.get(m.basename)).map(m => m.basename);
    const mains = [];
    for (const r of roots) for (const k of (kids.get(r) || [])) mains.push(k);
    mains.sort((a, b) => total(b) - total(a) || a.localeCompare(b));
    for (const m of mains) walk(m, 0, m);
    const listed = new Set(ordered.map(o => o.name));
    for (const r of roots)
      if (!listed.has(r)) { ordered.push({ name: r, depth: 0, main: r, count: counts.get(r) || 0 }); listed.add(r); }
    for (const g of counts.keys())
      if (!listed.has(g)) ordered.push({ name: g, depth: 0, main: g, count: counts.get(g) });
  } else {
    ordered = [...counts.keys()]
      .sort((a, b) => counts.get(b) - counts.get(a))
      .map(g => ({ name: g, depth: 0, main: g, count: counts.get(g) }));
  }
  ordered = ordered.filter(o => (counts.get(o.name) || 0) > 0 || o.count > 0);

  /* one hue family per main group, spread by lightness inside it */
  const mains2 = [...new Set(ordered.map(o => o.main))];
  const color = new Map();
  mains2.forEach((m, mi) => {
    const fam = ordered.filter(o => o.main === m), k = Math.max(1, fam.length);
    const base = (205 + mi * (360 / Math.max(1, mains2.length))) % 360;
    fam.forEach((o, j) => {
      const h = (base + (j / k) * 54 - 27 + 360) % 360;
      color.set(o.name, `hsl(${h.toFixed(0)}, ${(52 - (j / k) * 10).toFixed(0)}%, ${(74 - (j / k) * 30).toFixed(0)}%)`);
    });
  });
  color.set('Unfiled', 'hsl(0,0%,52%)');
  for (const nd of nodes) nd.color = color.get(nd.group) || 'hsl(0,0%,52%)';

  return { nodes, links, adj, ordered, counts, color };
}

/* ================= the view ================= */
class GlobeView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin  = plugin;
    this.yaw = 0; this.pitch = -0.28; this.zoom = 1;
    this.nodes = []; this.links = [];
    this.adj = new Map();
    this.hover = null; this.dragNode = null; this.rotDrag = null; this.selectedNode = null;
    this.selectedGroup = null;
    this.alpha = 1; this.last = 0;
    this.buildVersion = 0;
    this.closed = false;
  }
  getViewType()    { return VIEW_TYPE; }
  getDisplayText() { return 'Omega Centaur'; }
  getIcon()        { return 'globe'; }

  async onOpen() {
    this.closed = false;
    const root = this.contentEl;
    root.empty();
    root.addClass('omega-centaur-root');

    const hd = root.createDiv({ cls: 'mg-header' });
    hd.createDiv({ cls: 'mg-title', text: 'Omega Centaur' });
    this.countEl = hd.createDiv({ cls: 'mg-count' });
    hd.createDiv({ cls: 'mg-tagline', text: 'Build your cluster of ideas.' });

    this.legendEl = root.createDiv({ cls: 'mg-legend' });
    this.canvas   = root.createEl('canvas', { cls: 'mg-canvas' });
    this.ctx      = this.canvas.getContext('2d');
    this.canvas.setAttribute('tabindex', '0');
    this.canvas.setAttribute('aria-label', 'Interactive globe. Drag empty space to rotate. Drag a note to move it. Arrow keys rotate; Shift and arrow keys nudge the selected note.');

    /* floating search bar, bottom-centre */
    const sb      = root.createDiv({ cls: 'mg-search' });
    this.searchEl = sb.createEl('input', { cls: 'mg-search-input', type: 'text' });
    this.searchEl.placeholder = 'Search notes\u2026';
    this.searchEl.spellcheck  = false;
    this.searchEl.setAttribute('aria-label', 'Search notes');
    this.hitEl    = sb.createDiv({ cls: 'mg-search-hits' });
    this.hitEl.setAttribute('aria-live', 'polite');
    this.clearEl  = sb.createEl('button', { cls: 'mg-search-clear', type: 'button', text: '\u00d7' });
    this.clearEl.setAttribute('aria-label', 'Clear search');
    this.bindSearch();

    await this.build();
    if (this.closed) return;
    this.bind();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(root);
    this.resize();
    this.watchChanges();

    const tick = t => {
      const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0;
      this.last = t;
      if (this.plugin.settings.autoRotate && !this.rotDrag && !this.dragNode
          && !this.cam && !this.hits && !this.selectedGroup)
        this.yaw += this.plugin.settings.spinSpeed * dt;
      this.stepCamera(dt);
      if (this.plugin.settings.physics) this.step();
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  watchChanges() {
    /* Vault events update the page list even when links have not changed. Debounce
       bursts from Obsidian's indexer so one edit causes one graph rebuild. */
    this.scheduleBuild = debounce(() => { if (!this.closed) void this.build(); }, 200);
    this.registerEvent(this.app.metadataCache.on('resolved', () => this.scheduleBuild()));
    this.registerEvent(this.app.vault.on('create', file => {
      if (this.app.workspace.layoutReady !== false && file.extension === 'md') this.scheduleBuild();
    }));
    this.registerEvent(this.app.vault.on('rename', () => this.scheduleBuild()));
    this.registerEvent(this.app.vault.on('delete', () => this.scheduleBuild()));
  }

  async onClose() {
    this.closed = true;
    this.buildVersion++;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect();
    if (this.runSearch) this.runSearch.cancel();
    if (this.scheduleBuild) this.scheduleBuild.cancel();
  }

  /* ---------- search ---------- */
  bindSearch() {
    this.hits = null;                  // null = not searching; Set = matching indices
    this.cam  = null;                  // active camera tween target

    this.runSearch = debounce(q => this.applySearch(q), 250);

    this.registerDomEvent(this.searchEl, 'input', () => {
      this.runSearch(this.searchEl.value);
    });
    this.registerDomEvent(this.searchEl, 'keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); this.clearSearch(); this.searchEl.blur(); }
      if (e.key === 'Enter')  { e.preventDefault(); this.runSearch.cancel();
                                this.applySearch(this.searchEl.value); }
    });
    this.registerDomEvent(this.clearEl, 'click', () => { this.clearSearch(); this.searchEl.focus(); });
  }

  clearSearch() {
    this.runSearch.cancel();
    this.searchEl.value = '';
    this.hits = null;
    this.cam  = null;
    if (this.hitEl) { this.hitEl.setText(''); }
    this.contentEl.removeClass('mg-searching');
  }

  applySearch(raw, moveCam) {
    const q = (raw || '').trim();
    if (!q) { this.clearSearch(); return; }
    if (this.selectedGroup) this.clearGroupFocus();

    const scored = [];
    for (let i = 0; i < this.nodes.length; i++) {
      const sc = fuzzyScore(q, this.nodes[i].name);
      if (sc >= 0) scored.push({ i, sc });
    }
    scored.sort((a, b) => b.sc - a.sc);

    this.hits = new Set(scored.map(o => o.i));
    this.contentEl.addClass('mg-searching');
    if (this.hitEl)
      this.hitEl.setText(scored.length ? scored.length + (scored.length === 1 ? ' match' : ' matches')
                                       : 'no matches');
    if (!scored.length) { this.hits = new Set(); this.cam = null; return; }

    /* Aim at the centroid of the matches on the sphere. If they are spread
       right around the globe the centroid collapses toward the origin and has
       no direction, so fall back to the single best match. */
    let cx = 0, cy = 0, cz = 0;
    const top = scored.slice(0, 12);
    for (const o of top) {
      const w = o.sc, p = this.nodes[o.i].p;
      cx += p[0]*w; cy += p[1]*w; cz += p[2]*w;
    }
    let len = Math.hypot(cx, cy, cz);
    if (len < 1e-3) { const p = this.nodes[scored[0].i].p; cx = p[0]; cy = p[1]; cz = p[2]; len = 1; }
    if (moveCam !== false)
      this.faceTo([cx/len, cy/len, cz/len], scored.length === 1 ? 1.45 : 1.15);
  }

  /* pointOfView equivalent: rotate so model-space unit vector p faces the camera.
     Solving rot(p) = [0,0,1] gives these two angles exactly. */
  faceTo(p, zoom) {
    let yaw = Math.atan2(-p[0], p[2]);
    const pitch = Math.atan2(p[1], Math.hypot(p[0], p[2]));
    while (yaw - this.yaw >  Math.PI) yaw -= Math.PI * 2;   // take the short way round
    while (yaw - this.yaw < -Math.PI) yaw += Math.PI * 2;
    this.cam = { yaw, pitch, zoom: zoom == null ? this.zoom : zoom };
  }

  /* Legend entries are locations. A MOC entry aims at its MOC note;
     other groupings aim at the centre of their member notes. */
  clearGroupFocus() {
    if (!this.selectedGroup) return;
    this.selectedGroup = null;
    this.selectedNode = null;
    this.groupHover = null;
    this.cam = null;
    if (this.zoomBeforeGroup != null) this.zoom = this.zoomBeforeGroup;
    this.zoomBeforeGroup = null;
    for (const row of (this.legendRows || new Map()).values()) {
      row.toggleClass('mg-selected', false);
      row.setAttribute('aria-pressed', 'false');
    }
  }

  focusGroup(name) {
    if (this.selectedGroup === name) { this.clearGroupFocus(); return; }
    const members = this.nodes.filter(n => n.group === name);
    if (!members.length) return;
    if (this.searchEl && this.searchEl.value) this.clearSearch();
    if (!this.selectedGroup) this.zoomBeforeGroup = this.zoom;
    this.selectedGroup = name;
    for (const [group, row] of (this.legendRows || [])) {
      row.toggleClass('mg-selected', group === name);
      row.setAttribute('aria-pressed', String(group === name));
    }
    const moc = this.plugin.settings.groupBy === 'moc'
      ? members.find(n => n.name === name) : null;
    if (moc) {
      this.selectedNode = this.nodes.indexOf(moc);
      this.faceTo(moc.p, 1.35);
      return;
    }
    let sum = [0, 0, 0];
    for (const n of members) for (let k = 0; k < 3; k++) sum[k] += n.p[k];
    const length = Math.hypot(...sum);
    const target = length < 1e-3
      ? members.reduce((best, n) => n.deg > best.deg ? n : best).p
      : sum.map(v => v / length);
    const representative = members.reduce((best, n) => dot(n.p, target) > dot(best.p, target) ? n : best);
    this.selectedNode = this.nodes.indexOf(representative);
    this.faceTo(target, 1.15);
  }

  stepCamera(dt) {
    if (!this.cam) return;
    if (this.rotDrag || this.dragNode) { this.cam = null; return; }  // user input wins
    const k  = 1 - Math.pow(0.004, dt);                              // frame-rate independent
    const dy = this.cam.yaw - this.yaw;
    const dp = this.cam.pitch - this.pitch;
    const dz = this.cam.zoom - this.zoom;
    this.yaw += dy*k; this.pitch += dp*k; this.zoom += dz*k;
    if (Math.abs(dy) < 0.002 && Math.abs(dp) < 0.002 && Math.abs(dz) < 0.003) {
      this.yaw = this.cam.yaw; this.pitch = this.cam.pitch; this.zoom = this.cam.zoom;
      this.cam = null;
    }
  }

  /* ---------- input ---------- */
  bind() {
    const c = this.canvas;

    this.registerDomEvent(c, 'pointerdown', e => {
      const q = this.nearest(e);
      if (q != null) {
        this.clearFocusOnClick = this.selectedGroup != null && q.i === this.selectedNode;
        this.dragNode = q.i;
        this.selectedNode = q.i;
        c.focus({ preventScroll: true });
        this.dragMoved = false;
        this.downAt = { x: e.clientX, y: e.clientY };
        this.nodes[q.i].pinned = true;
        this.alpha = Math.max(this.alpha, 0.55);
      } else {
        this.clearFocusOnClick = false;
        this.rotDrag = { x: e.clientX, y: e.clientY };
      }
      this.cam = null;
      c.setPointerCapture(e.pointerId);
    });

    this.registerDomEvent(c, 'pointermove', e => {
      if (this.dragNode != null) {
        if (this.downAt &&
            Math.abs(e.clientX - this.downAt.x) + Math.abs(e.clientY - this.downAt.y) > 4)
          this.dragMoved = true;
        const p = this.unproject(e);
        if (p) {
          const n = this.nodes[this.dragNode];
          n.p = p; n.v = [0,0,0];
          this.alpha = Math.max(this.alpha, 0.5);
        }
        this.hover = this.dragNode;
      } else if (this.rotDrag) {
        this.yaw   += (e.clientX - this.rotDrag.x) * 0.006;
        this.pitch += (e.clientY - this.rotDrag.y) * 0.006;
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
        this.rotDrag.x = e.clientX; this.rotDrag.y = e.clientY;
      } else {
        const q = this.nearest(e);
        this.hover = q ? q.i : null;
        c.toggleClass('mg-grabbable', q != null);
      }
    });

    const end = e => {
      if (this.dragNode != null) {
        const i = this.dragNode;
        this.nodes[i].pinned = false;
        this.alpha = Math.max(this.alpha, 0.4);
        if (!this.dragMoved && e && e.type === 'pointerup') {
          if (this.clearFocusOnClick) this.clearGroupFocus();
          else this.app.workspace.getLeaf(false).openFile(this.nodes[i].file);
        }
      }
      this.dragNode = null; this.rotDrag = null; this.downAt = null;
      this.clearFocusOnClick = false;
    };
    this.registerDomEvent(c, 'pointerup', end);
    this.registerDomEvent(c, 'pointercancel', end);
    this.registerDomEvent(c, 'pointerleave', () => { this.hover = null; });

    this.registerDomEvent(c, 'keydown', e => {
      if (e.key === 'Escape' && this.selectedGroup) {
        e.preventDefault(); this.clearGroupFocus(); return;
      }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      const dy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      this.cam = null;
      if (e.shiftKey && this.selectedNode != null && this.nodes[this.selectedNode]) {
        const n = this.nodes[this.selectedNode];
        const q = this.rot(n.p);
        n.p = norm(this.unrot(norm([q[0] + dx * 0.08, q[1] - dy * 0.08, q[2]])));
        n.v = [0, 0, 0];
        this.alpha = Math.max(this.alpha, 0.5);
      } else {
        this.yaw += dx * 0.08;
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + dy * 0.08));
      }
    });

    this.registerDomEvent(c, 'wheel', e => {
      e.preventDefault();
      this.zoom = Math.max(0.55, Math.min(3.5, this.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
    }, { passive: false });
  }

  /* ---------- physics ---------- */
  step() {
    const s = this.plugin.settings, n = this.nodes.length;
    if (!n) return;
    this.alpha = Math.max(0.015, this.alpha * 0.992);
    const a = this.alpha;

    const f = [];
    for (let i = 0; i < n; i++) f.push([0,0,0]);

    for (const l of this.links) {
      const A = this.nodes[l.s].p, B = this.nodes[l.t].p;
      for (let k = 0; k < 3; k++) {
        const d = (B[k] - A[k]) * s.linkForce;
        f[l.s][k] += d; f[l.t][k] -= d;
      }
    }
    for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) {
      const A = this.nodes[i].p, B = this.nodes[j].p;
      const dx = A[0]-B[0], dy = A[1]-B[1], dz = A[2]-B[2];
      const rep = s.repelForce / (dx*dx + dy*dy + dz*dz + 1e-3);
      f[i][0]+=dx*rep; f[i][1]+=dy*rep; f[i][2]+=dz*rep;
      f[j][0]-=dx*rep; f[j][1]-=dy*rep; f[j][2]-=dz*rep;
    }

    for (let i = 0; i < n; i++) {
      const nd = this.nodes[i];
      if (nd.pinned) { nd.v = [0,0,0]; continue; }
      const v = nd.v || (nd.v = [0,0,0]);
      for (let k = 0; k < 3; k++) v[k] = (v[k] + f[i][k] * a) * 0.72;
      // keep motion tangent to the sphere, then snap back onto it
      const rad = dot(v, nd.p);
      for (let k = 0; k < 3; k++) v[k] -= rad * nd.p[k];
      nd.p = norm([nd.p[0]+v[0], nd.p[1]+v[1], nd.p[2]+v[2]]);
    }
  }

  /* ---------- data ---------- */
  async build() {
    const version = ++this.buildVersion;
    const m = await buildModel(this.app, this.plugin.settings);
    if (this.closed || version !== this.buildVersion) return;
    const previous = new Map(this.nodes.filter(n => n.p).map(n => [n.file.path, n.p]));
    const selectedPath = this.selectedNode == null ? null : this.nodes[this.selectedNode]?.file.path;
    this.model = m;
    this.nodes = m.nodes; this.links = m.links; this.adj = m.adj;
    for (const nd of this.nodes) { nd.v = [0,0,0]; nd.pinned = false; }
    this.seedLayout(m.ordered);
    for (const nd of this.nodes) if (previous.has(nd.file.path)) nd.p = previous.get(nd.file.path).slice();
    this.selectedNode = selectedPath == null ? null
      : this.nodes.findIndex(n => n.file.path === selectedPath);
    if (this.selectedNode < 0) this.selectedNode = null;
    this.alpha = 1;

    this.countEl.setText(this.nodes.length + (this.nodes.length === 1 ? ' page' : ' pages'));
    this.legendEl.empty();
    this.legendRows = new Map();
    if (this.selectedGroup && !m.ordered.some(o => o.name === this.selectedGroup)) this.clearGroupFocus();
    for (const o of m.ordered) {
      const row = this.legendEl.createEl('button', {
        cls: 'mg-legend-row mg-d' + Math.min(3, o.depth), type: 'button'
      });
      if (o.depth === 0) row.addClass('mg-main');
      row.setAttribute('aria-label', 'Show ' + o.name + ' on globe');
      row.setAttribute('aria-pressed', String(this.selectedGroup === o.name));
      row.toggleClass('mg-selected', this.selectedGroup === o.name);
      row.setAttribute('title', o.name);
      row.createSpan({ cls: 'mg-dot' }).style.background = m.color.get(o.name);
      row.createSpan({ cls: 'mg-legend-label', text: o.name.replace(/\s+MOC$/, '') });
      row.createSpan({ cls: 'mg-legend-n', text: String(o.count) });
      row.onmouseenter = () => { this.groupHover = o.name; };
      row.onmouseleave = () => { this.groupHover = null; };
      row.onclick = () => this.focusGroup(o.name);
      row.onkeydown = e => {
        if (e.key === 'Escape' && this.selectedGroup) {
          e.preventDefault(); this.clearGroupFocus();
        }
      };
      this.legendRows.set(o.name, row);
    }

    /* node indices just changed, so any live hit set is stale */
    if (this.searchEl) {
      if (this.searchEl.value.trim()) this.applySearch(this.searchEl.value, false);
      else if (this.hits) this.clearSearch();
    }
  }

  /* start each group as a cluster so physics has a sane starting point */
  seedLayout(ordered) {
    const n = this.nodes.length;
    if (!n) return;
    const ga = Math.PI * (3 - Math.sqrt(5));
    const anchor = new Map();
    ordered.forEach((o, i) => {
      const y = ordered.length === 1 ? 0 : 1 - (i / (ordered.length - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y*y));
      const th = ga * i;
      anchor.set(o.name, [Math.cos(th)*r, y, Math.sin(th)*r]);
    });
    this.nodes.forEach((nd, i) => {
      const a = anchor.get(nd.group) || [0,1,0];
      const jx = (Math.sin(i*12.9898)*43758.5453) % 1;
      const jy = (Math.sin(i*78.233 )*43758.5453) % 1;
      const jz = (Math.sin(i*37.719 )*43758.5453) % 1;
      nd.p = norm([a[0]+jx*0.5, a[1]+jy*0.5, a[2]+jz*0.5]);
      nd.v = [0,0,0];
    });
  }

  /* ---------- projection ---------- */
  resize() {
    const r = this.contentEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width  = Math.max(1, Math.floor(r.width  * dpr));
    this.canvas.height = Math.max(1, Math.floor(r.height * dpr));
    this.canvas.style.width  = r.width  + 'px';
    this.canvas.style.height = r.height + 'px';
    this.dpr = dpr;
  }
  geom() {
    const w = this.canvas.width / this.dpr, h = this.canvas.height / this.dpr;
    const legendSpace = w >= 600 ? 240 : 0;
    const globeWidth = w - legendSpace;
    const scale = legendSpace ? 0.44 : 0.40;
    return { w, h, cx: globeWidth/2, cy: h/2,
      R: Math.min(Math.min(globeWidth,h) * scale * this.zoom,
        Math.max(1, globeWidth/2 - 18), Math.max(1, h/2 - 18)), legendSpace };
  }
  rot(p) {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const x =  p[0]*cy + p[2]*sy;
    let   z = -p[0]*sy + p[2]*cy;
    const y =  p[1]*cp - z*sp;
    z       =  p[1]*sp + z*cp;
    return [x,y,z];
  }
  unrot(w) {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const p1 =  w[1]*cp + w[2]*sp;
    const z1 = -w[1]*sp + w[2]*cp;
    return [ w[0]*cy - z1*sy, p1, w[0]*sy + z1*cy ];
  }
  proj(p, g) {
    const r = this.rot(p);
    return { x: g.cx + r[0]*g.R, y: g.cy - r[1]*g.R, z: r[2] };
  }
  /* screen point -> model-space point on the sphere (front face) */
  unproject(e) {
    const g = this.geom(), r = this.canvas.getBoundingClientRect();
    let nx = (e.clientX - r.left - g.cx) / g.R;
    let ny = -(e.clientY - r.top  - g.cy) / g.R;
    const d = nx*nx + ny*ny;
    let nz;
    if (d >= 1) { const k = 1/Math.sqrt(d); nx *= k; ny *= k; nz = 0; }
    else nz = Math.sqrt(1 - d);
    return norm(this.unrot([nx, ny, nz]));
  }

  nearest(e) {
    if (!this.pts) return null;
    const r = this.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = null, bd = 18*18;
    for (const q of this.pts) {
      if (q.z < -0.25) continue;
      const dx = q.x-mx, dy = q.y-my, d = dx*dx + dy*dy;
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }

  /* ---------- render ---------- */
  draw() {
    const ctx = this.ctx, g = this.geom(), s = this.plugin.settings;
    const theme = getComputedStyle(this.contentEl);
    const textColor = theme.getPropertyValue('--text-normal').trim();
    const mutedColor = theme.getPropertyValue('--text-muted').trim();
    const backgroundColor = theme.getPropertyValue('--background-primary').trim();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, g.w, g.h);
    ctx.globalAlpha = 1;

    /* grid */
    ctx.lineWidth = 0.7;
    const rings = [];
    for (let m = 0; m < s.gridMeridians; m++) {
      const a = (m/s.gridMeridians)*Math.PI, ring = [];
      for (let k = 0; k <= 72; k++) { const t=(k/72)*Math.PI*2;
        ring.push([Math.cos(a)*Math.cos(t), Math.sin(t), Math.sin(a)*Math.cos(t)]); }
      rings.push(ring);
    }
    for (let q = 1; q <= s.gridParallels; q++) {
      const y = -1 + (2*q)/(s.gridParallels+1), rr = Math.sqrt(Math.max(0,1-y*y)), ring = [];
      for (let k = 0; k <= 72; k++) { const t=(k/72)*Math.PI*2;
        ring.push([Math.cos(t)*rr, y, Math.sin(t)*rr]); }
      rings.push(ring);
    }
    for (const ring of rings) for (let k = 0; k < ring.length-1; k++) {
      const a = this.proj(ring[k], g), b = this.proj(ring[k+1], g);
      const zm = (a.z+b.z)/2;
      ctx.strokeStyle = 'rgba(150,160,175,' + (0.04 + 0.09*(zm+1)/2).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const hv = this.hover != null ? this.hover : this.selectedNode;
    const nbr = hv != null ? (this.adj.get(hv) || new Set()) : null;
    const gh = this.groupHover || this.selectedGroup;

    /* links */
    if (s.showLinks) {
      for (const l of this.links) {
        const both = this.hits ? (this.hits.has(l.s) && this.hits.has(l.t)) : false;
        const lit = both || (hv != null && (l.s === hv || l.t === hv));
        const dim = (this.hits && !both) || (hv != null && !lit) ||
                    (gh && this.nodes[l.s].group !== gh && this.nodes[l.t].group !== gh);
        ctx.lineWidth = lit ? 1.7 : 0.9;
        const A = this.nodes[l.s].p, B = this.nodes[l.t].p;
        let prev = null;
        for (let k = 0; k <= 14; k++) {
          const cur = this.proj(slerp(A,B,k/14), g);
          if (prev) {
            const zm = (prev.z+cur.z)/2;
            if (zm > -0.85) {
              const base = 0.06 + 0.22*(zm+1)/2;
              const al = lit ? Math.min(1, base*3.4) : (dim ? base*0.25 : base);
              ctx.strokeStyle = lit
                ? 'rgba(235,240,250,' + al.toFixed(3) + ')'
                : 'rgba(150,170,190,' + al.toFixed(3) + ')';
              ctx.beginPath(); ctx.moveTo(prev.x,prev.y); ctx.lineTo(cur.x,cur.y); ctx.stroke();
            }
          }
          prev = cur;
        }
      }
    }
    ctx.globalAlpha = 1;

    /* nodes, back to front */
    const pts = this.nodes.map((n,i) => { const q = this.proj(n.p,g); q.i = i; return q; })
                          .sort((a,b) => a.z - b.z);
    this.pts = pts;

    const labels = [];
    for (const q of pts) {
      const n = this.nodes[q.i];
      const depth = (q.z+1)/2;
      const isH = q.i === hv, isN = nbr && nbr.has(q.i);
      const inG = !gh || n.group === gh;
      const base = (2.6 + Math.min(4.4, Math.sqrt(n.deg)*1.5)) * s.nodeScale;
      const rad = base * (0.55 + 0.45*depth) * Math.min(1.8, this.zoom);

      let al = 0.26 + 0.74*depth;
      if (hv != null && !isH && !isN) al *= 0.3;
      if (!inG) al *= 0.22;
      if (isH || isN) al = 1;

      const hit = this.hits ? this.hits.has(q.i) : null;
      if (hit === false) al = Math.min(al, 0.10);
      if (hit === true)  al = 1;

      ctx.globalAlpha = al;
      ctx.fillStyle = n.color;
      if (hit === true) {
        ctx.save();
        ctx.shadowColor = n.color;
        ctx.shadowBlur  = (15 + 12*depth) * Math.min(1.6, this.zoom);
        ctx.beginPath(); ctx.arc(q.x, q.y, rad*1.3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(q.x, q.y, rad*1.3, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 0.55 + 0.45*depth;
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(q.x, q.y, rad*2.3, 0, Math.PI*2); ctx.stroke();
        ctx.globalAlpha = al;
        ctx.fillStyle = n.color;
      }
      ctx.beginPath(); ctx.arc(q.x, q.y, isH ? rad*1.65 : (hit === true ? rad*1.3 : rad), 0, Math.PI*2); ctx.fill();

      if (isH) {
        ctx.globalAlpha = 0.9; ctx.lineWidth = 1.5; ctx.strokeStyle = n.color;
        ctx.beginPath(); ctx.arc(q.x, q.y, rad*3.1, 0, Math.PI*2); ctx.stroke();
      }
      let wantLabel = s.labels === 'always' ? (q.z > 0.05 && inG)
                    : s.labels === 'hover'  ? (isH || isN)
                    : false;
      if (hit === true)       wantLabel = q.z > -0.25;   // name every match that is visible
      else if (hit === false) wantLabel = isH || isN;
      if (wantLabel) labels.push({ q, n, rad, isH, depth });
    }

    /* labels last so nothing paints over them */
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'middle';
    labels.sort((a, b) => Number(b.isH) - Number(a.isH) ||
      Number(!!this.hits && this.hits.has(b.q.i)) - Number(!!this.hits && this.hits.has(a.q.i)) ||
      b.depth - a.depth);
    const occupied = [];
    const labelRight = g.w - g.legendSpace - 8;
    for (const L of labels) {
      ctx.font = (L.isH ? '600 12.5px ' : '11.5px ') +
        '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      let tx = L.q.x + L.rad + 6;
      const ty = L.q.y;
      const w = ctx.measureText(L.n.name).width;
      if (tx + w + 3 > labelRight) tx = L.q.x - L.rad - 6 - w;
      if (tx - 3 < 8 || tx + w + 3 > labelRight || ty < 12 || ty > g.h - 60) continue;
      const box = { left: tx - 3, right: tx + w + 3, top: ty - 9, bottom: ty + 9 };
      if (occupied.some(other => box.left < other.right + 4 && box.right + 4 > other.left &&
        box.top < other.bottom + 4 && box.bottom + 4 > other.top)) continue;
      occupied.push(box);
      ctx.globalAlpha = L.isH ? 0.92 : 0.55 + 0.35*L.depth;
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(tx-3, ty-8, w+6, 16);
      ctx.globalAlpha = L.isH ? 1 : 0.6 + 0.4*L.depth;
      ctx.fillStyle = L.isH ? textColor : mutedColor;
      ctx.fillText(L.n.name, tx, ty);
    }
    ctx.globalAlpha = 1;
  }
}

/* ================= settings ================= */
class GlobeSettings extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const c = this.containerEl; c.empty();
    const save = async rebuild => {
      await this.plugin.saveData(this.plugin.settings);
      this.plugin.refresh(rebuild);
    };
    new Setting(c).setName('Group by')
      .setDesc("'moc' builds the legend from your MOC hierarchy. Also accepts 'folder' or any frontmatter key.")
      .addText(t => t.setValue(this.plugin.settings.groupBy)
        .onChange(async v => { this.plugin.settings.groupBy = v.trim() || 'moc'; await save(true); }));
    new Setting(c).setName('Labels')
      .addDropdown(d => d.addOptions({ hover:'On hover', always:'Always', none:'Never' })
        .setValue(this.plugin.settings.labels)
        .onChange(async v => { this.plugin.settings.labels = v; await save(false); }));
    new Setting(c).setName('Physics')
      .setDesc('Nodes settle and neighbours follow when you drag one.')
      .addToggle(t => t.setValue(this.plugin.settings.physics)
        .onChange(async v => { this.plugin.settings.physics = v; await save(false); }));
    new Setting(c).setName('Exclude folders')
      .setDesc('Comma-separated vault folders to leave out, e.g. Templates.')
      .addText(t => t.setValue(this.plugin.settings.excludeFolders)
        .onChange(async v => { this.plugin.settings.excludeFolders = v; await save(true); }));

    new Setting(c).setName('Show links')
      .addToggle(t => t.setValue(this.plugin.settings.showLinks)
        .onChange(async v => { this.plugin.settings.showLinks = v; await save(false); }));
    new Setting(c).setName('Auto-rotate')
      .addToggle(t => t.setValue(this.plugin.settings.autoRotate)
        .onChange(async v => { this.plugin.settings.autoRotate = v; await save(false); }));
    new Setting(c).setName('Spin speed')
      .addSlider(sl => sl.setLimits(0, 0.5, 0.02).setDynamicTooltip()
        .setValue(this.plugin.settings.spinSpeed)
        .onChange(async v => { this.plugin.settings.spinSpeed = v; await save(false); }));
    new Setting(c).setName('Node size')
      .addSlider(sl => sl.setLimits(0.4, 2.5, 0.1).setDynamicTooltip()
        .setValue(this.plugin.settings.nodeScale)
        .onChange(async v => { this.plugin.settings.nodeScale = v; await save(false); }));
    new Setting(c).setName('Link force')
      .addSlider(sl => sl.setLimits(0.01, 0.15, 0.005).setDynamicTooltip()
        .setValue(this.plugin.settings.linkForce)
        .onChange(async v => { this.plugin.settings.linkForce = v; await save(false); }));
    new Setting(c).setName('Repel force')
      .addSlider(sl => sl.setLimits(0.002, 0.04, 0.001).setDynamicTooltip()
        .setValue(this.plugin.settings.repelForce)
        .onChange(async v => { this.plugin.settings.repelForce = v; await save(false); }));
  }
}

module.exports = class OmegaCentaur extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.registerView(VIEW_TYPE, leaf => new GlobeView(leaf, this));
    this.addRibbonIcon('globe', 'Open Omega Centaur', () => this.activate());
    this.addCommand({ id: 'open', name: 'Open globe view', callback: () => this.activate() });
    this.addSettingTab(new GlobeSettings(this.app, this));
  }

  // No onunload teardown: Obsidian detaches a plugin's own views on unload, and
  // doing it here would destroy the user's pane layout on every update.

  refresh(rebuild) {
    if (!rebuild) return;
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof GlobeView) void leaf.view.build();
    }
  }

  async activate() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) { leaf = workspace.getLeaf('tab'); await leaf.setViewState({ type: VIEW_TYPE, active: true }); }
    workspace.revealLeaf(leaf);
  }
};
