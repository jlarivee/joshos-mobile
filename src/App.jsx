import { useState, useEffect, useRef, useCallback } from "react";

// ── API helper ──────────────────────────────────────────────────────────────

function getToken() { return localStorage.getItem("joshos_token"); }
function setToken(t) { localStorage.setItem("joshos_token", t); localStorage.setItem("joshos_last", Date.now().toString()); }
function clearToken() { localStorage.removeItem("joshos_token"); localStorage.removeItem("joshos_last"); }

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json();
  if (res.status === 401) { clearToken(); window.location.reload(); }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ── Colors ──────────────────────────────────────────────────────────────────

const C = {
  bg: "#08080c", card: "#111118", border: "#1a1a24", accent: "#6366f1",
  accentDim: "#6366f122", text: "#e4e4ec", muted: "#64648a", dim: "#2a2a3a",
  green: "#22c55e", amber: "#f59e0b", red: "#ef4444", blue: "#3b82f6",
  surface: "#0d0d14",
};

const STATUS_COLOR = { "Done": C.green, "Needs Research": C.amber, "In Progress": C.blue, "Error": C.red };

// ── Shared styles ───────────────────────────────────────────────────────────

const cardStyle = {
  background: C.card, borderRadius: 14, border: `1px solid ${C.border}`,
  padding: "16px 18px", marginBottom: 10,
};

// ── Lock Screen ─────────────────────────────────────────────────────────────

function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(null);
  const [locked, setLocked] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const t = setInterval(() => setRetryAfter(r => { if (r <= 1) { setLocked(false); return 0; } return r - 1; }), 1000);
    return () => clearInterval(t);
  }, [retryAfter]);

  const submit = async (fullPin) => {
    if (locked || loading) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetch("/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: fullPin }),
      }).then(r => r.json());

      if (data.token) { setToken(data.token); onUnlock(); }
      else if (data.locked) { setLocked(true); setRetryAfter(data.retry_after || 1800); setPin(""); }
      else { setError(data.error || "Invalid PIN"); setAttempts(data.attempts_left); setPin(""); }
    } catch { setError("Connection failed"); setPin(""); }
    setLoading(false);
  };

  const tap = (n) => {
    if (pin.length >= 6) return;
    const next = pin + n;
    setPin(next);
    if (next.length >= 4) submit(next);
  };

  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  return (
    <div style={{
      position: "fixed", inset: 0, background: C.bg, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "0 40px",
    }}>
      <div style={{ letterSpacing: "0.3em", fontSize: 13, color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>JoshOS</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: "0.08em", marginBottom: 40 }}>Enter PIN</div>

      <div style={{ display: "flex", gap: 14, marginBottom: 32 }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: "50%",
            background: i < pin.length ? C.accent : "transparent",
            border: `2px solid ${i < pin.length ? C.accent : C.dim}`,
            transition: "all 0.15s",
          }} />
        ))}
      </div>

      {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 12, textAlign: "center" }}>
        {error}{attempts !== null && ` (${attempts} left)`}
      </div>}
      {locked && <div style={{ color: C.amber, fontSize: 13, marginBottom: 12 }}>
        Locked — {Math.floor(retryAfter/60)}:{(retryAfter%60).toString().padStart(2,"0")}
      </div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 72px)", gap: 12 }}>
        {keys.map((k, i) => (
          <button key={i} disabled={!k || locked} onClick={() => k === "⌫" ? setPin(p => p.slice(0,-1)) : tap(k)}
            style={{
              width: 72, height: 56, borderRadius: 12, border: "none", fontSize: 22, fontWeight: 500,
              background: k ? C.card : "transparent", color: C.text, cursor: k ? "pointer" : "default",
              opacity: k ? (locked ? 0.3 : 1) : 0, transition: "all 0.1s",
            }}
          >{k}</button>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Today ──────────────────────────────────────────────────────────────

function TodayTab() {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => { api("/api/today").then(setData).catch(() => {}); }, []);

  const runAction = async (script) => {
    setConfirm(null);
    try { await api("/api/actions/run", { method: "POST", body: { script, confirmed: true } }); }
    catch {}
  };

  const actions = [
    { label: "Run Morning", script: "briefing", icon: "☀️" },
    { label: "Run Evening", script: "evening", icon: "🌙" },
    { label: "Add Contact", script: null, icon: "👤" },
    { label: "Ask JoshOS", script: null, icon: "💬" },
  ];

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ fontSize: 13, color: C.muted, letterSpacing: "0.15em", textTransform: "uppercase" }}>Today</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: C.text, marginTop: 4, letterSpacing: "-0.02em" }}>
        {data ? new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Loading..."}
      </div>

      {data?.morning && (
        <div style={{ ...cardStyle, marginTop: 20, cursor: "pointer", borderLeft: `3px solid ${C.accent}` }}
          onClick={() => setExpanded(expanded === "morning" ? null : "morning")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: C.accent, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>☀️ Morning Briefing</span>
            <span style={{ color: C.muted, fontSize: 11 }}>{expanded === "morning" ? "▲" : "▼"}</span>
          </div>
          <div style={{ color: C.text, fontSize: 14, marginTop: 8, lineHeight: 1.6,
            maxHeight: expanded === "morning" ? "none" : 80, overflow: "hidden" }}>
            {data.morning.content.slice(0, expanded === "morning" ? undefined : 300)}
          </div>
        </div>
      )}

      {data?.evening && (
        <div style={{ ...cardStyle, cursor: "pointer", borderLeft: `3px solid ${C.red}` }}
          onClick={() => setExpanded(expanded === "evening" ? null : "evening")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: C.red, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>🌙 Evening Intel</span>
            <span style={{ color: C.muted, fontSize: 11 }}>{expanded === "evening" ? "▲" : "▼"}</span>
          </div>
          <div style={{ color: C.text, fontSize: 14, marginTop: 8, lineHeight: 1.6,
            maxHeight: expanded === "evening" ? "none" : 80, overflow: "hidden" }}>
            {data.evening.content.slice(0, expanded === "evening" ? undefined : 300)}
          </div>
        </div>
      )}

      {!data?.morning && !data?.evening && data && (
        <div style={{ ...cardStyle, marginTop: 20 }}>
          <div style={{ color: C.muted, fontSize: 14, textAlign: "center", padding: 20 }}>
            No briefings yet today. Run one below.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
        {actions.map(a => (
          <button key={a.label} onClick={() => a.script ? setConfirm(a) : null}
            style={{ ...cardStyle, border: `1px solid ${C.border}`, cursor: "pointer", textAlign: "center", padding: "16px 12px" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{a.icon}</div>
            <div style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{a.label}</div>
          </button>
        ))}
      </div>

      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100,
          display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 16 }}>
          <div style={{ background: C.card, borderRadius: 16, padding: 24, width: "100%", maxWidth: 360 }}>
            <div style={{ color: C.text, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Run {confirm.label}?</div>
            <div style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>This will trigger the script on the server.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => runAction(confirm.script)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Briefings ──────────────────────────────────────────────────────────

function BriefingsTab() {
  const [briefings, setBriefings] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [content, setContent] = useState("");

  useEffect(() => { api("/api/briefings").then(d => setBriefings(d.briefings)).catch(() => {}); }, []);

  const open = async (b) => {
    setSelected(b);
    const d = await api(`/api/briefings/${b.id}`);
    setContent(d.content);
  };

  const typeColor = { morning: C.accent, evening: C.red, capabilities: C.green, roadmap: C.amber };
  const filtered = briefings.filter(b => !search || b.filename.toLowerCase().includes(search.toLowerCase()) || b.type.includes(search.toLowerCase()));

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ fontSize: 13, color: C.muted, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>Briefings</div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search briefings..."
        style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          color: C.text, padding: "10px 14px", fontSize: 14, outline: "none", marginBottom: 16 }} />

      {filtered.map(b => (
        <div key={b.id} onClick={() => open(b)} style={{ ...cardStyle, cursor: "pointer", borderLeft: `3px solid ${typeColor[b.type] || C.muted}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ color: typeColor[b.type] || C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{b.type}</span>
            <span style={{ color: C.muted, fontSize: 11 }}>{b.date?.join("-")}</span>
          </div>
          <div style={{ color: C.text, fontSize: 13, lineHeight: 1.5, maxHeight: 40, overflow: "hidden" }}>{b.preview}</div>
        </div>
      ))}

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 100, overflow: "auto", padding: "20px 16px" }}>
          <button onClick={() => setSelected(null)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, padding: "8px 16px", cursor: "pointer", fontSize: 13, marginBottom: 16 }}>← Back</button>
          <div style={{ fontSize: 12, color: typeColor[selected.type] || C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{selected.type}</div>
          <pre style={{ color: C.text, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "'SF Mono', 'Menlo', monospace" }}>{content}</pre>
        </div>
      )}
    </div>
  );
}

// ── Tab: Contacts ───────────────────────────────────────────────────────────

function ContactsTab() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => { api("/api/contacts").then(d => setContacts(d.contacts)).catch(() => {}); }, []);

  const filtered = contacts.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return `${c.first_name} ${c.last_name} ${c.company} ${c.title}`.toLowerCase().includes(s);
  });

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ fontSize: 13, color: C.muted, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>Contacts</div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..."
        style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          color: C.text, padding: "10px 14px", fontSize: 14, outline: "none", marginBottom: 16 }} />

      {filtered.map(c => (
        <div key={c.id} onClick={() => setSelected(c)} style={{ ...cardStyle, cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: C.text, fontSize: 15, fontWeight: 600 }}>{c.first_name} {c.last_name}</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{c.title}{c.company ? ` · ${c.company}` : ""}</div>
            </div>
            <span style={{
              fontSize: 10, padding: "3px 8px", borderRadius: 6, fontWeight: 600, letterSpacing: "0.04em",
              background: (STATUS_COLOR[c.status] || C.muted) + "22",
              color: STATUS_COLOR[c.status] || C.muted,
            }}>{c.status || "—"}</span>
          </div>
        </div>
      ))}

      {contacts.length === 0 && (
        <div style={{ color: C.muted, textAlign: "center", padding: 40, fontSize: 14 }}>
          No contacts synced yet. Upload EMS-Template.xlsx via the sync endpoint.
        </div>
      )}

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 100, overflow: "auto", padding: "20px 16px" }}>
          <button onClick={() => setSelected(null)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, padding: "8px 16px", cursor: "pointer", fontSize: 13, marginBottom: 16 }}>← Back</button>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>{selected.first_name} {selected.last_name}</div>
          <div style={{ color: C.muted, fontSize: 14, marginBottom: 16 }}>{selected.title}{selected.company ? ` · ${selected.company}` : ""}</div>

          {[["Account", selected.account], ["Status", selected.status], ["Date Generated", selected.date_generated]].filter(([,v]) => v).map(([k,v]) => (
            <div key={k} style={{ ...cardStyle, padding: "10px 14px" }}>
              <div style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</div>
              <div style={{ color: C.text, fontSize: 14, marginTop: 2 }}>{v}</div>
            </div>
          ))}

          {selected.notes && (
            <div style={{ ...cardStyle, padding: "10px 14px" }}>
              <div style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Notes</div>
              <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>{selected.notes}</div>
            </div>
          )}

          {selected.linkedin && selected.linkedin !== "None" && (
            <a href={selected.linkedin} target="_blank" rel="noopener" style={{
              display: "block", ...cardStyle, textAlign: "center", color: C.blue, fontSize: 14, fontWeight: 600, textDecoration: "none",
            }}>View LinkedIn Profile →</a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Ask ────────────────────────────────────────────────────────────────

function AskTab() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const q = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", text: q }]);
    setLoading(true);

    try {
      const d = await api("/api/ask", { method: "POST", body: { question: q } });
      setMessages(m => [...m, { role: "assistant", text: d.answer }]);
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", text: `Error: ${e.message}` }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 70px)", padding: "20px 16px 0" }}>
      <div style={{ fontSize: 13, color: C.muted, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>Ask JoshOS</div>

      <div style={{ flex: 1, overflow: "auto", paddingBottom: 16 }}>
        {messages.length === 0 && (
          <div style={{ color: C.dim, textAlign: "center", padding: "60px 20px", fontSize: 14, lineHeight: 1.8 }}>
            Ask anything about your accounts, contacts, briefings, or ideas.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            ...cardStyle, marginBottom: 8,
            borderLeft: m.role === "user" ? `3px solid ${C.accent}` : `3px solid ${C.green}`,
            background: m.role === "user" ? C.card : C.surface,
          }}>
            <div style={{ color: m.role === "user" ? C.accent : C.green, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
              {m.role === "user" ? "You" : "JoshOS"}
            </div>
            <div style={{ color: C.text, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div style={{ ...cardStyle, borderLeft: `3px solid ${C.green}` }}>
            <div style={{ color: C.green, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>JoshOS</div>
            <div style={{ color: C.muted, fontSize: 14 }}>Thinking...</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "12px 0 20px", borderTop: `1px solid ${C.border}` }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask anything..."
          style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
            color: C.text, padding: "12px 14px", fontSize: 14, outline: "none" }} />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ background: C.accent, border: "none", borderRadius: 10, color: "#fff",
            padding: "12px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.5 : 1 }}>→</button>
      </div>
    </div>
  );
}

// ── Tab: Apps ───────────────────────────────────────────────────────────────

function AppsTab() {
  const apps = [
    { name: "EMS", desc: "Executive Messaging System", icon: "📧", url: "NEEDS_URL", live: true },
    { name: "GreenThumb", desc: "Plant Intelligence", icon: "🌱", url: "NEEDS_URL", live: true },
    { name: "Italy Trip", desc: "June 2026 · Metallica Bologna", icon: "🇮🇹", url: "NEEDS_URL", live: true },
    { name: "Email Generator", desc: "Executive outreach drafts", icon: "✉️", url: "NEEDS_URL", live: true },
    { name: "Fitness Tracker", desc: "2026 fitness data", icon: "💪", url: "NEEDS_URL", live: true },
    { name: "Goal Planning", desc: "Strategic goals", icon: "🎯", url: "NEEDS_URL", live: true },
    { name: "LifeX SCA", desc: "SCA Builder tool", icon: "📊", url: "NEEDS_URL", live: true },
    { name: "Health Dashboard", desc: "Apple Health + weekly email", icon: "❤️", url: null, live: false },
    { name: "Three Rivers Slab", desc: "Inventory + pricing", icon: "🪵", url: null, live: false },
    { name: "MadSprings", desc: "Orders + social content", icon: "🍪", url: null, live: false },
    { name: "To-Do App", desc: "Front end on EMS engine", icon: "✅", url: null, live: false },
  ];

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ fontSize: 13, color: C.muted, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>Apps</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {apps.map(a => (
          <a key={a.name} href={a.url || "#"} target={a.url ? "_blank" : undefined} rel="noopener"
            style={{
              ...cardStyle, textDecoration: "none", textAlign: "center", padding: "20px 12px",
              opacity: a.live ? 1 : 0.4, position: "relative",
            }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{a.icon}</div>
            <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{a.name}</div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{a.desc}</div>
            {!a.live && (
              <div style={{
                position: "absolute", top: 8, right: 8, fontSize: 9, padding: "2px 6px",
                background: C.dim, color: C.muted, borderRadius: 4, letterSpacing: "0.05em",
              }}>SOON</div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Life OS ────────────────────────────────────────────────────────────

function LifeTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedThesis, setExpandedThesis] = useState(null);
  const [restForm, setRestForm] = useState(false);
  const [restName, setRestName] = useState("");
  const [restCity, setRestCity] = useState("");
  const [restNotes, setRestNotes] = useState("");
  const [restRating, setRestRating] = useState(3);

  useEffect(() => {
    api("/api/life").then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const refresh = async () => {
    setLoading(true);
    try { const d = await api("/api/life/refresh", { method: "POST" }); setData(d); }
    catch {}
    setLoading(false);
  };

  const logRestaurant = async () => {
    if (!restName || !restCity) return;
    try {
      await api("/api/life/restaurant", { method: "POST", body: { name: restName, city: restCity, notes: restNotes, rating: restRating } });
      setRestForm(false); setRestName(""); setRestCity(""); setRestNotes("");
    } catch {}
  };

  const r = data?.readiness || {};
  const dimColor = (v) => v >= 70 ? C.green : v >= 40 ? C.amber : C.red;

  const dims = [
    ["Financial", r.financial, "35%"],
    ["Health", r.health, "25%"],
    ["Identity", r.identity, "20%"],
    ["Professional", r.professional, "10%"],
    ["Time", r.time, "10%"],
  ];

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.muted, letterSpacing: "0.15em", textTransform: "uppercase" }}>Life OS</div>
        <button onClick={refresh} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, padding: "6px 12px", cursor: "pointer", fontSize: 11 }}>
          {loading ? "..." : "↻ Refresh"}
        </button>
      </div>

      {/* Readiness Score */}
      <div style={{ ...cardStyle, textAlign: "center", padding: "24px 18px", borderLeft: `3px solid ${dimColor(r.composite || 0)}` }}>
        <div style={{ fontSize: 56, fontWeight: 700, color: dimColor(r.composite || 0), letterSpacing: "-0.03em", lineHeight: 1 }}>
          {r.composite || "—"}
        </div>
        <div style={{ fontSize: 12, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 8 }}>Life Readiness</div>

        <div style={{ marginTop: 20, textAlign: "left" }}>
          {dims.map(([name, val, weight]) => (
            <div key={name} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: C.muted }}>{name} <span style={{ opacity: 0.5 }}>({weight})</span></span>
                <span style={{ fontSize: 12, color: dimColor(val || 0), fontWeight: 600 }}>{val || "—"}</span>
              </div>
              <div style={{ height: 4, background: C.dim, borderRadius: 2 }}>
                <div style={{ height: 4, borderRadius: 2, background: dimColor(val || 0), width: `${val || 0}%`, transition: "width 0.5s" }} />
              </div>
            </div>
          ))}
        </div>

        {r.question_of_week && (
          <div style={{ marginTop: 16, padding: "10px 14px", background: C.surface, borderRadius: 8, borderLeft: `2px solid ${C.amber}` }}>
            <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6, fontStyle: "italic" }}>{r.question_of_week}</div>
          </div>
        )}

        {data?.last_updated && (
          <div style={{ fontSize: 10, color: C.dim, marginTop: 10 }}>Updated: {new Date(data.last_updated).toLocaleString()}</div>
        )}
      </div>

      {/* Wealth + Health */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <div style={{ ...cardStyle, borderLeft: `3px solid ${C.green}` }}>
          <div style={{ fontSize: 10, color: C.green, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Wealth</div>
          {data?.portfolio_summary?.total_value && (
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>${Number(data.portfolio_summary.total_value).toLocaleString()}</div>
          )}
          {data?.portfolio_summary?.total_pnl_pct !== undefined && (
            <div style={{ fontSize: 12, color: data.portfolio_summary.total_pnl_pct >= 0 ? C.green : C.red, marginTop: 2 }}>
              {data.portfolio_summary.total_pnl_pct >= 0 ? "+" : ""}{data.portfolio_summary.total_pnl_pct}%
            </div>
          )}
          {data?.wealth_pulse && <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>{data.wealth_pulse.slice(0, 150)}...</div>}
        </div>

        <div style={{ ...cardStyle, borderLeft: `3px solid ${C.blue}` }}>
          <div style={{ fontSize: 10, color: C.blue, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Health</div>
          {data?.health_pulse && <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{data.health_pulse.slice(0, 200)}...</div>}
          {!data?.health_pulse && <div style={{ fontSize: 11, color: C.dim }}>No health data yet</div>}
        </div>
      </div>

      {/* Theses */}
      {data?.thesis_verdicts?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Active Theses</div>
          {data.thesis_verdicts.map((t, i) => {
            const vc = t.verdict === "On Track" ? C.green : t.verdict === "Drifting" ? C.amber : C.red;
            return (
              <div key={i} onClick={() => setExpandedThesis(expandedThesis === i ? null : i)}
                style={{ ...cardStyle, cursor: "pointer", borderLeft: `3px solid ${vc}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{t.ticker}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: t.pnl_pct >= 0 ? C.green : C.red }}>{t.pnl_pct >= 0 ? "+" : ""}{t.pnl_pct?.toFixed(1)}%</span>
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: vc + "22", color: vc, fontWeight: 600 }}>{t.verdict}</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{t.remaining_days}d remaining</div>
                {expandedThesis === i && (
                  <div style={{ fontSize: 12, color: C.text, marginTop: 8, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>{t.summary}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Restaurant Log */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>Recent Experiences</div>
          <button onClick={() => setRestForm(!restForm)} style={{ background: C.accent, border: "none", borderRadius: 8, color: "#fff", padding: "6px 12px", cursor: "pointer", fontSize: 11 }}>+ Log Restaurant</button>
        </div>

        {restForm && (
          <div style={{ ...cardStyle, padding: 16 }}>
            <input value={restName} onChange={e => setRestName(e.target.value)} placeholder="Restaurant name"
              style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 10px", fontSize: 13, outline: "none", marginBottom: 8 }} />
            <input value={restCity} onChange={e => setRestCity(e.target.value)} placeholder="City"
              style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 10px", fontSize: 13, outline: "none", marginBottom: 8 }} />
            <input value={restNotes} onChange={e => setRestNotes(e.target.value)} placeholder="Notes"
              style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 10px", fontSize: 13, outline: "none", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setRestForm(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 13 }}>Cancel</button>
              <button onClick={logRestaurant} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: C.accent, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Save</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "today", label: "Today", icon: "☀️" },
  { id: "briefings", label: "Briefings", icon: "📄" },
  { id: "contacts", label: "Contacts", icon: "👤" },
  { id: "life", label: "Life OS", icon: "◎" },
  { id: "ask", label: "Ask", icon: "💬" },
  { id: "apps", label: "Apps", icon: "⊞" },
];

const INACTIVITY_MS = 15 * 60 * 1000; // 15 minutes

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState("today");
  const lastActivity = useRef(Date.now());

  // Check existing token
  useEffect(() => {
    const token = getToken();
    const last = parseInt(localStorage.getItem("joshos_last") || "0");
    if (token && Date.now() - last < INACTIVITY_MS) {
      setAuthed(true);
    } else {
      clearToken();
    }
  }, []);

  // Inactivity lock
  useEffect(() => {
    if (!authed) return;
    const handler = () => { lastActivity.current = Date.now(); localStorage.setItem("joshos_last", Date.now().toString()); };
    const check = setInterval(() => {
      if (Date.now() - lastActivity.current > INACTIVITY_MS) { clearToken(); setAuthed(false); }
    }, 30000);
    window.addEventListener("touchstart", handler);
    window.addEventListener("click", handler);
    return () => { clearInterval(check); window.removeEventListener("touchstart", handler); window.removeEventListener("click", handler); };
  }, [authed]);

  if (!authed) return <LockScreen onUnlock={() => setAuthed(true)} />;

  const TabContent = { today: TodayTab, briefings: BriefingsTab, contacts: ContactsTab, life: LifeTab, ask: AskTab, apps: AppsTab }[tab];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      <TabContent />

      {/* Bottom nav */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: C.surface, borderTop: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-around", padding: "8px 0 env(safe-area-inset-bottom, 8px)",
        zIndex: 50,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 12px",
              color: tab === t.id ? C.accent : C.muted, transition: "color 0.15s",
            }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 10, letterSpacing: "0.04em" }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
