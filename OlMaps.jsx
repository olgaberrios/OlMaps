import { useState, useEffect, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const GIST_FILENAME = "olmaps_routes.json";
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const ACTIVITIES = [
  { value: "bici", label: "🚲 Bici" },
  { value: "correr", label: "🏃🏾‍♀️ Correr" },
  { value: "senderismo", label: "🚶🏾‍♀️ Senderismo" },
];
const STATES = [
  { value: "pendiente", label: "🔭 Pendiente" },
  { value: "hecha", label: "✅ Hecha" },
  { value: "favorita", label: "⭐ Favorita" },
];
const DIFFICULTIES = [
  { value: "baja", label: "🟢 Baja" },
  { value: "media", label: "🟠 Media" },
  { value: "alta", label: "🔴 Alta" },
];
const SHADOWS = ["Poca", "Media", "Mucha"];
const CROWDS = ["Poca", "Media", "Mucha"];

const emptyRoute = () => ({
  id: Date.now(),
  nombre: "",
  enlace: "",
  estado: "pendiente",
  estacion: "",
  actividad: "senderismo",
  kms: "",
  dificultad: "media",
  mes: "",
  fuentes: false,
  sombra: "Media",
  masificacion: "Media",
  notas: "",
});

// ─── GitHub Gist helpers ──────────────────────────────────────────────────────
async function fetchGist(token, gistId) {
  const r = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!r.ok) throw new Error(`Error ${r.status}`);
  const data = await r.json();
  const file = data.files[GIST_FILENAME];
  return file ? JSON.parse(file.content) : [];
}

async function saveGist(token, gistId, routes) {
  const body = { files: { [GIST_FILENAME]: { content: JSON.stringify(routes, null, 2) } } };
  const r = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Error ${r.status}`);
}

async function createGist(token) {
  const body = {
    description: "OlMaps — mis rutas",
    public: false,
    files: { [GIST_FILENAME]: { content: JSON.stringify([], null, 2) } },
  };
  const r = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Error ${r.status}`);
  const data = await r.json();
  return data.id;
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function stateColor(s) {
  return s === "favorita" ? "#f59e0b" : s === "hecha" ? "#22c55e" : "#94a3b8";
}
function diffColor(d) {
  return d === "alta" ? "#ef4444" : d === "media" ? "#f97316" : "#22c55e";
}
function actIcon(a) {
  return a === "bici" ? "🚲" : a === "correr" ? "🏃🏾‍♀️" : "🚶🏾‍♀️";
}

// ─── Components ───────────────────────────────────────────────────────────────

function Tag({ children, color = "#334155" }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}44`,
      borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600,
      letterSpacing: 0.3, whiteSpace: "nowrap"
    }}>{children}</span>
  );
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", background: "#0f172a", borderRadius: 8, padding: 3, gap: 2 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          flex: 1, padding: "6px 10px", border: "none", borderRadius: 6, cursor: "pointer",
          fontSize: 12, fontWeight: 600, transition: "all .15s",
          background: value === o.value ? "#3b82f6" : "transparent",
          color: value === o.value ? "#fff" : "#64748b",
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#1e293b", borderRadius: 16, padding: 24, width: "100%",
        maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
        border: "1px solid #334155", boxShadow: "0 24px 64px #000a",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#f1f5f9" }}>{title}</h2>
          <button onClick={onClose} style={{
            background: "#334155", border: "none", color: "#94a3b8",
            borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", color: "#64748b", fontSize: 11, fontWeight: 700,
        letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8,
  color: "#f1f5f9", padding: "8px 12px", fontSize: 14, outline: "none",
  boxSizing: "border-box", fontFamily: "inherit",
};

function RouteForm({ initial, allEstaciones, onSave, onCancel }) {
  const [r, setR] = useState(initial);
  const set = (k, v) => setR(p => ({ ...p, [k]: v }));
  const [estSugg, setEstSugg] = useState(false);

  const filteredEst = allEstaciones.filter(e =>
    e.toLowerCase().includes((r.estacion || "").toLowerCase()) && e !== r.estacion
  );

  return (
    <div>
      <Field label="Nombre de la ruta">
        <input style={inputStyle} value={r.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Ej: Camino del Norte" />
      </Field>
      <Field label="🔗 Enlace">
        <input style={inputStyle} value={r.enlace} onChange={e => set("enlace", e.target.value)} placeholder="https://..." />
      </Field>
      <Field label="Estado">
        <SegmentedControl options={STATES} value={r.estado} onChange={v => set("estado", v)} />
      </Field>
      <Field label="Actividad">
        <SegmentedControl options={ACTIVITIES} value={r.actividad} onChange={v => set("actividad", v)} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Kms">
          <input style={inputStyle} type="number" value={r.kms} onChange={e => set("kms", e.target.value)} placeholder="0" />
        </Field>
        <Field label="Dificultad">
          <select style={inputStyle} value={r.dificultad} onChange={e => set("dificultad", e.target.value)}>
            {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Estación / temporada">
        <div style={{ position: "relative" }}>
          <input style={inputStyle} value={r.estacion}
            onChange={e => { set("estacion", e.target.value); setEstSugg(true); }}
            onFocus={() => setEstSugg(true)} onBlur={() => setTimeout(() => setEstSugg(false), 150)}
            placeholder="Ej: Primavera, Verano…" />
          {estSugg && filteredEst.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, background: "#1e293b",
              border: "1px solid #334155", borderRadius: 8, zIndex: 10, marginTop: 4,
            }}>
              {filteredEst.map(e => (
                <div key={e} onMouseDown={() => { set("estacion", e); setEstSugg(false); }}
                  style={{ padding: "8px 12px", cursor: "pointer", color: "#f1f5f9", fontSize: 14,
                    borderBottom: "1px solid #0f172a" }}
                  onMouseEnter={el => el.target.style.background = "#334155"}
                  onMouseLeave={el => el.target.style.background = "transparent"}
                >{e}</div>
              ))}
            </div>
          )}
        </div>
      </Field>

      <div style={{ borderTop: "1px solid #334155", margin: "16px 0", paddingTop: 16 }}>
        <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 1,
          textTransform: "uppercase", marginBottom: 12 }}>🌿 Entorno</p>
        <Field label="🗓️ Mes en que hice la ruta">
          <select style={inputStyle} value={r.mes} onChange={e => set("mes", e.target.value)}>
            <option value="">— Sin especificar —</option>
            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="🌳 Sombra">
            <select style={inputStyle} value={r.sombra} onChange={e => set("sombra", e.target.value)}>
              {SHADOWS.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="🧑‍🧑‍🧒‍🧒 Masificación">
            <select style={inputStyle} value={r.masificacion} onChange={e => set("masificacion", e.target.value)}>
              {CROWDS.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="⛲ ¿Hay fuentes?">
          <div style={{ display: "flex", gap: 8 }}>
            {[true, false].map(v => (
              <button key={String(v)} onClick={() => set("fuentes", v)} style={{
                flex: 1, padding: "8px", border: `2px solid ${r.fuentes === v ? "#3b82f6" : "#334155"}`,
                borderRadius: 8, background: r.fuentes === v ? "#1d4ed822" : "transparent",
                color: r.fuentes === v ? "#3b82f6" : "#64748b", cursor: "pointer",
                fontSize: 13, fontWeight: 600, transition: "all .15s",
              }}>{v ? "⛲ Sí" : "🚫 No"}</button>
            ))}
          </div>
        </Field>
        <Field label="📝 Notas">
          <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
            value={r.notas} onChange={e => set("notas", e.target.value)}
            placeholder="Observaciones, detalles del terreno, consejos…" />
        </Field>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={onCancel} style={{
          padding: "9px 20px", background: "#334155", border: "none", borderRadius: 8,
          color: "#94a3b8", cursor: "pointer", fontWeight: 600,
        }}>Cancelar</button>
        <button onClick={() => onSave(r)} style={{
          padding: "9px 20px", background: "#3b82f6", border: "none", borderRadius: 8,
          color: "#fff", cursor: "pointer", fontWeight: 700,
        }}>💾 Guardar</button>
      </div>
    </div>
  );
}

function RouteCard({ route, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: "#1e293b", border: "1px solid #334155", borderRadius: 12,
      overflow: "hidden", transition: "box-shadow .2s",
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 24px #0006"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
    >
      <div style={{ padding: "14px 16px", cursor: "pointer" }} onClick={() => setExpanded(p => !p)}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>{actIcon(route.actividad)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 15 }}>{route.nombre || "Sin nombre"}</span>
              <Tag color={stateColor(route.estado)}>{STATES.find(s=>s.value===route.estado)?.label}</Tag>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {route.kms && <Tag color="#64748b">📏 {route.kms} km</Tag>}
              <Tag color={diffColor(route.dificultad)}>{DIFFICULTIES.find(d=>d.value===route.dificultad)?.label}</Tag>
              {route.mes && <Tag color="#8b5cf6">🗓️ {route.mes}</Tag>}
              {route.estacion && <Tag color="#0891b2">🌤️ {route.estacion}</Tag>}
            </div>
          </div>
          <span style={{ color: "#475569", fontSize: 12, flexShrink: 0, marginTop: 2 }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #1e293b", background: "#0f172a", padding: "14px 16px" }}>
          {route.enlace && (
            <a href={route.enlace} target="_blank" rel="noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 6, color: "#3b82f6",
              fontSize: 13, marginBottom: 12, wordBreak: "break-all",
            }}>🔗 Abrir ruta</a>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <Tag color={route.fuentes ? "#22c55e" : "#ef4444"}>
              {route.fuentes ? "⛲ Fuentes" : "🚫 Sin fuentes"}
            </Tag>
            <Tag color="#f59e0b">🌳 Sombra: {route.sombra}</Tag>
            <Tag color="#8b5cf6">🧑‍🧑‍🧒‍🧒 Masif: {route.masificacion}</Tag>
          </div>
          {route.notas && (
            <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6,
              background: "#1e293b", borderRadius: 8, padding: "10px 12px",
              margin: "0 0 12px", whiteSpace: "pre-wrap" }}>📝 {route.notas}</p>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => onEdit(route)} style={{
              padding: "6px 14px", background: "#334155", border: "none",
              borderRadius: 8, color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}>✏️ Editar</button>
            <button onClick={() => onDelete(route.id)} style={{
              padding: "6px 14px", background: "#450a0a", border: "none",
              borderRadius: 8, color: "#f87171", cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}>🗑️ Borrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function GistSetup({ onSave }) {
  const [token, setToken] = useState("");
  const [gistId, setGistId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    setLoading(true); setError("");
    try {
      const id = await createGist(token);
      onSave(token, id);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  const handleConnect = async () => {
    setLoading(true); setError("");
    try {
      await fetchGist(token, gistId);
      onSave(token, gistId);
    } catch (e) { setError("No se pudo conectar. Revisa el token y el ID."); }
    setLoading(false);
  };

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{
        background: "#0f172a", borderRadius: 10, padding: "14px 16px",
        border: "1px solid #1e3a5f", marginBottom: 20,
      }}>
        <p style={{ color: "#38bdf8", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
          <strong>¿Cómo obtener el token?</strong><br />
          GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → New token → marca solo el permiso <code>gist</code> → Genera y copia el token.
        </p>
      </div>
      <Field label="GitHub Token (con permiso gist)">
        <input style={inputStyle} type="password" value={token}
          onChange={e => setToken(e.target.value)} placeholder="ghp_…" />
      </Field>
      <button onClick={handleCreate} disabled={!token || loading} style={{
        width: "100%", padding: "10px", background: "#3b82f6", border: "none",
        borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 700,
        marginBottom: 16, opacity: (!token || loading) ? 0.5 : 1,
      }}>
        {loading ? "Creando…" : "✨ Crear nuevo Gist para OlMaps"}
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 1, background: "#334155" }} />
        <span style={{ color: "#475569", fontSize: 12 }}>o conectar uno existente</span>
        <div style={{ flex: 1, height: 1, background: "#334155" }} />
      </div>
      <Field label="ID del Gist existente">
        <input style={inputStyle} value={gistId}
          onChange={e => setGistId(e.target.value)} placeholder="abc123def456…" />
      </Field>
      <button onClick={handleConnect} disabled={!token || !gistId || loading} style={{
        width: "100%", padding: "10px", background: "#334155", border: "1px solid #475569",
        borderRadius: 8, color: "#94a3b8", cursor: "pointer", fontWeight: 700,
        opacity: (!token || !gistId || loading) ? 0.5 : 1,
      }}>
        {loading ? "Conectando…" : "🔗 Conectar Gist existente"}
      </button>
      {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 10, textAlign: "center" }}>{error}</p>}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function OlMaps() {
  const [routes, setRoutes] = useState([]);
  const [token, setToken] = useState(() => localStorage.getItem("olmaps_token") || "");
  const [gistId, setGistId] = useState(() => localStorage.getItem("olmaps_gist") || "");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncError, setSyncError] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRoute, setEditRoute] = useState(null);
  const [filterState, setFilterState] = useState("all");
  const [filterActivity, setFilterActivity] = useState("all");
  const [search, setSearch] = useState("");
  const dirty = useRef(false);

  const connected = !!(token && gistId);

  // Load from Gist on mount
  useEffect(() => {
    if (connected) loadFromGist();
    else if (!token && !gistId) setShowSetup(true);
  }, []);

  async function loadFromGist() {
    setSyncing(true); setSyncError("");
    try {
      const data = await fetchGist(token, gistId);
      setRoutes(data);
      setLastSync(new Date());
    } catch (e) { setSyncError("Error al cargar: " + e.message); }
    setSyncing(false);
  }

  async function pushToGist(newRoutes) {
    if (!connected) return;
    setSyncing(true); setSyncError("");
    try {
      await saveGist(token, gistId, newRoutes);
      setLastSync(new Date());
    } catch (e) { setSyncError("Error al guardar: " + e.message); }
    setSyncing(false);
  }

  function handleSetupSave(t, g) {
    localStorage.setItem("olmaps_token", t);
    localStorage.setItem("olmaps_gist", g);
    setToken(t); setGistId(g);
    setShowSetup(false);
    loadFromGist();
  }

  function handleSaveRoute(route) {
    let next;
    if (editRoute) {
      next = routes.map(r => r.id === route.id ? route : r);
    } else {
      next = [{ ...route, id: Date.now() }, ...routes];
    }
    setRoutes(next);
    pushToGist(next);
    setShowForm(false); setEditRoute(null);
  }

  function handleDelete(id) {
    if (!confirm("¿Borrar esta ruta?")) return;
    const next = routes.filter(r => r.id !== id);
    setRoutes(next);
    pushToGist(next);
  }

  // All unique estaciones
  const allEstaciones = [...new Set(routes.map(r => r.estacion).filter(Boolean))];

  // Filtered routes
  const filtered = routes.filter(r => {
    if (filterState !== "all" && r.estado !== filterState) return false;
    if (filterActivity !== "all" && r.actividad !== filterActivity) return false;
    if (search && !r.nombre.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: routes.length,
    hechas: routes.filter(r => r.estado === "hecha").length,
    favoritas: routes.filter(r => r.estado === "favorita").length,
    kms: routes.filter(r=>r.kms).reduce((a,r) => a + Number(r.kms), 0),
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1e", color: "#f1f5f9",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        background: "#0f172a", borderBottom: "1px solid #1e293b",
        padding: "16px 20px", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
              🗺️ <span style={{ color: "#3b82f6" }}>Ol</span>Maps
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: "#475569", marginTop: 1 }}>
              {connected ? (
                syncing ? "⏳ Sincronizando…" :
                syncError ? <span style={{color:"#f87171"}}>⚠️ {syncError}</span> :
                lastSync ? `✅ Sync ${lastSync.toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"})}` :
                "🔗 Conectado a Gist"
              ) : "⚠️ Sin conexión a Gist"}
            </p>
          </div>
          <button onClick={connected ? loadFromGist : () => setShowSetup(true)} style={{
            background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
            color: "#64748b", padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600,
          }}>
            {connected ? "↻ Sync" : "⚙️ Config"}
          </button>
          {connected && (
            <button onClick={() => setShowSetup(true)} style={{
              background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
              color: "#64748b", padding: "6px 12px", cursor: "pointer", fontSize: 12,
            }}>⚙️</button>
          )}
          <button onClick={() => { setEditRoute(null); setShowForm(true); }} style={{
            background: "#3b82f6", border: "none", borderRadius: 8,
            color: "#fff", padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700,
          }}>+ Nueva</button>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px" }}>
        {/* Stats */}
        {routes.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20,
          }}>
            {[
              { label: "Total", value: stats.total, icon: "🗺️", color: "#3b82f6" },
              { label: "Hechas", value: stats.hechas, icon: "✅", color: "#22c55e" },
              { label: "Favoritas", value: stats.favoritas, icon: "⭐", color: "#f59e0b" },
              { label: "Kms", value: stats.kms > 0 ? stats.kms : "—", icon: "📏", color: "#8b5cf6" },
            ].map(s => (
              <div key={s.label} style={{
                background: "#1e293b", borderRadius: 10, padding: "10px 12px",
                border: "1px solid #334155", textAlign: "center",
              }}>
                <div style={{ fontSize: 18 }}>{s.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, letterSpacing: 0.5 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          <input style={inputStyle} value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Buscar por nombre…" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[{value:"all",label:"Todas"}, ...STATES].map(s => (
              <button key={s.value} onClick={() => setFilterState(s.value)} style={{
                padding: "5px 12px", border: "none", borderRadius: 20, cursor: "pointer",
                fontSize: 12, fontWeight: 600, transition: "all .15s",
                background: filterState === s.value ? "#3b82f6" : "#1e293b",
                color: filterState === s.value ? "#fff" : "#64748b",
              }}>{s.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{value:"all",label:"🗂️ Todas"}, ...ACTIVITIES].map(a => (
              <button key={a.value} onClick={() => setFilterActivity(a.value)} style={{
                padding: "5px 12px", border: "none", borderRadius: 20, cursor: "pointer",
                fontSize: 12, fontWeight: 600, transition: "all .15s",
                background: filterActivity === a.value ? "#0891b2" : "#1e293b",
                color: filterActivity === a.value ? "#fff" : "#64748b",
              }}>{a.label}</button>
            ))}
          </div>
        </div>

        {/* Route list */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
            <p style={{ color: "#475569", fontSize: 16 }}>
              {routes.length === 0
                ? "Aún no hay rutas guardadas.\n¡Añade tu primera ruta!"
                : "No hay rutas con estos filtros."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(r => (
              <RouteCard key={r.id} route={r}
                onEdit={route => { setEditRoute(route); setShowForm(true); }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <Modal title={editRoute ? "✏️ Editar ruta" : "✨ Nueva ruta"}
          onClose={() => { setShowForm(false); setEditRoute(null); }}>
          <RouteForm
            initial={editRoute || emptyRoute()}
            allEstaciones={allEstaciones}
            onSave={handleSaveRoute}
            onCancel={() => { setShowForm(false); setEditRoute(null); }}
          />
        </Modal>
      )}

      {showSetup && (
        <Modal title="⚙️ Configurar sincronización" onClose={() => setShowSetup(false)}>
          {connected && (
            <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
              <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>
                Gist actual: <code style={{color:"#3b82f6"}}>{gistId}</code>
              </p>
              <button onClick={() => {
                localStorage.removeItem("olmaps_token");
                localStorage.removeItem("olmaps_gist");
                setToken(""); setGistId(""); setRoutes([]);
              }} style={{
                marginTop: 8, padding: "5px 12px", background: "#450a0a",
                border: "none", borderRadius: 6, color: "#f87171",
                cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}>Desconectar</button>
            </div>
          )}
          <GistSetup onSave={handleSetupSave} />
        </Modal>
      )}
    </div>
  );
}
