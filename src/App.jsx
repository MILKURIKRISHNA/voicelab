import { useState, useEffect, useRef, useCallback } from "react";

const API = "https://voicelab-o2qp.onrender.com/voices";
const BARS = 36;

/* ── Waveform ── */
function Waveform({ active }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 48 }}>
      {Array.from({ length: BARS }).map((_, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 3,
          background: active
            ? `hsl(${18 + i * 2.5}, 92%, ${48 + Math.sin(i * 0.8) * 14}%)`
            : "rgba(255,255,255,0.06)",
          minHeight: 4,
          animation: active
            ? `wb${i % 6} ${0.45 + (i % 6) * 0.12}s ease-in-out infinite alternate`
            : "none",
          animationDelay: `${(i * 0.032).toFixed(3)}s`,
          transition: "background 0.3s",
        }} />
      ))}
      <style>{`
        @keyframes wb0{from{height:4px}to{height:12px}}
        @keyframes wb1{from{height:4px}to{height:24px}}
        @keyframes wb2{from{height:4px}to{height:40px}}
        @keyframes wb3{from{height:4px}to{height:30px}}
        @keyframes wb4{from{height:4px}to{height:18px}}
        @keyframes wb5{from{height:4px}to{height:8px}}
      `}</style>
    </div>
  );
}

/* ── Highlighted Text Display ── */
function HighlightedText({ text, wordTimings, currentTime, isPlaying }) {
  const activeIdx = wordTimings.findIndex(
    w => currentTime >= w.start && currentTime < w.start + w.duration + 0.05
  );

  // Build token list preserving punctuation/spaces
  const tokens = [];
  let timingIdx = 0;
  const words = text.split(/(\s+)/);
  words.forEach((token, i) => {
    if (/^\s+$/.test(token)) {
      tokens.push({ type: "space", text: token, idx: null });
    } else {
      // match to timing word
      const tIdx = timingIdx < wordTimings.length ? timingIdx : null;
      tokens.push({ type: "word", text: token, idx: tIdx });
      timingIdx++;
    }
  });

  return (
    <div style={{
      fontSize: 16, lineHeight: 2, color: "#9999bb",
      fontFamily: "'IBM Plex Mono', monospace",
      userSelect: "none",
    }}>
      {tokens.map((tok, i) => {
        if (tok.type === "space") return <span key={i}>{tok.text}</span>;
        const isActive = tok.idx !== null && tok.idx === activeIdx;
        const isPast = tok.idx !== null && tok.idx < activeIdx;
        return (
          <span key={i} style={{
            display: "inline-block",
            borderRadius: 4,
            padding: "0 2px",
            background: isActive ? "rgba(255,107,43,0.25)" : "transparent",
            color: isActive ? "#ff6b2b" : isPast ? "#e8e8f0" : "#9999bb",
            fontWeight: isActive ? 700 : 400,
            transform: isActive ? "scale(1.05)" : "scale(1)",
            transition: "all 0.08s ease",
            boxShadow: isActive ? "0 0 12px rgba(255,107,43,0.3)" : "none",
          }}>
            {tok.text}
          </span>
        );
      })}
    </div>
  );
}

/* ── Voice Card ── */
function VoiceCard({ voice, selected, onSelect, onPreview }) {
  const hue = (voice.ShortName.charCodeAt(3) * 17 + voice.ShortName.charCodeAt(4) * 11) % 360;
  const gender = voice.Gender === "Female" ? "♀" : "♂";
  return (
    <div onClick={() => onSelect(voice)} style={{
      background: selected
        ? "linear-gradient(135deg, rgba(255,107,43,0.1), rgba(255,149,0,0.05))"
        : "rgba(255,255,255,0.02)",
      border: selected
        ? "1.5px solid rgba(255,107,43,0.5)"
        : "1.5px solid rgba(255,255,255,0.05)",
      borderRadius: 10, padding: "9px 12px", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 10,
      transition: "all 0.18s",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: `linear-gradient(135deg, hsl(${hue},60%,35%), hsl(${hue + 30},55%,45%))`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, color: "#fff", fontWeight: 700,
      }}>{gender}</div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{
          color: selected ? "#ff6b2b" : "#ccc",
          fontSize: 11, fontFamily: "'Unbounded', sans-serif",
          fontWeight: 600, whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {voice.FriendlyName.replace("Microsoft ", "").replace(" Online (Natural)", "")}
        </div>
        <div style={{ color: "#444", fontSize: 10, marginTop: 2 }}>
          {voice.Locale} · {voice.Gender}
        </div>
      </div>
      <button onClick={e => { e.stopPropagation(); onPreview(voice); }} style={{
        background: "rgba(255,107,43,0.1)",
        border: "1px solid rgba(255,107,43,0.2)",
        borderRadius: 6, padding: "3px 8px",
        color: "#ff6b2b88", fontSize: 10,
        cursor: "pointer", flexShrink: 0,
        transition: "all 0.15s",
      }}
        onMouseEnter={e => { e.currentTarget.style.color = "#ff6b2b"; e.currentTarget.style.background = "rgba(255,107,43,0.2)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#ff6b2b88"; e.currentTarget.style.background = "rgba(255,107,43,0.1)"; }}
      >▶ try</button>
    </div>
  );
}

/* ── Main App ── */
export default function VoiceLab() {
  const [text, setText] = useState(
    "Welcome to VoiceLab — your free, private neural text-to-speech studio. Every word is highlighted as it is spoken, so you can follow along in real time."
  );
  const [voices, setVoices] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState("en");
  const [rate, setRate] = useState(0);
  const [pitch, setPitch] = useState(0);

  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [wordTimings, setWordTimings] = useState([]);
  const [error, setError] = useState("");
  const [view, setView] = useState("studio"); // "studio" | "reader"

  const audioRef = useRef(null);
  const rafRef = useRef(null);

  /* Load voices */
  useEffect(() => {
    fetch(`${API}/voices`)
      .then(r => r.json())
      .then(data => {
        setVoices(data);
        const jenny = data.find(v => v.ShortName === "en-US-JennyNeural");
        setSelected(jenny || data[0]);
      })
      .catch(() => setError("❌ Cannot connect to Python server on port 8000."));
  }, []);

  /* Filter voices */
  useEffect(() => {
    let list = voices;
    if (langFilter) list = list.filter(v => v.Locale.toLowerCase().startsWith(langFilter));
    if (search) list = list.filter(v =>
      v.FriendlyName.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(list);
  }, [voices, search, langFilter]);

  /* Build query params */
  const buildParams = (t, v) => ({
    text: t,
    voice: v.ShortName,
    rate: rate >= 0 ? `+${rate}%` : `${rate}%`,
    pitch: pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`,
  });

  /* Animate progress */
  const startRAF = useCallback((audio) => {
    const tick = () => {
      if (!audio.paused && !audio.ended) {
        setCurrentTime(audio.currentTime);
        setProgress((audio.currentTime / audio.duration) * 100 || 0);
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRAF = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  /* Speak */
  const speak = async (t, v) => {
    if (!t.trim() || !v) return;
    setError("");
    setLoading(true);
    setPaused(false);
    setProgress(0);
    setCurrentTime(0);
    setWordTimings([]);
    stopRAF();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    const params = buildParams(t, v);
    const qs = new URLSearchParams(params).toString();

    // Fetch word timings + audio in parallel
    try {
      const [timingRes] = await Promise.all([
        fetch(`${API}/timing?${qs}`).then(r => r.json()),
      ]);
      setWordTimings(timingRes);

      const audio = new Audio(`${API}/speak?${qs}`);
      audioRef.current = audio;

      audio.oncanplay = () => { setLoading(false); setPlaying(true); startRAF(audio); };
      audio.onended = () => {
        setPlaying(false); setPaused(false); stopRAF();
        setProgress(100); setCurrentTime(0);
        setTimeout(() => setProgress(0), 800);
      };
      audio.onerror = () => { setLoading(false); setPlaying(false); setError("❌ Playback failed."); };
      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
        setProgress((audio.currentTime / audio.duration) * 100 || 0);
      };

      await audio.play();
      setView("reader");
    } catch (e) {
      setLoading(false);
      setError("❌ Error: " + e.message);
    }
  };

  /* Pause */
  const pause = () => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      stopRAF();
      setPlaying(false);
      setPaused(true);
    }
  };

  /* Resume */
  const resume = () => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play();
      startRAF(audioRef.current);
      setPlaying(true);
      setPaused(false);
    }
  };

  /* Stop */
  const stop = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    stopRAF();
    setPlaying(false);
    setPaused(false);
    setProgress(0);
    setCurrentTime(0);
    setWordTimings([]);
  };

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const langs = ["en", "hi", "fr", "de", "es", "ja", "zh", "ar", "pt", "ko"];

  const rateStr = rate >= 0 ? `+${rate}%` : `${rate}%`;
  const pitchStr = pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#06060e",
      fontFamily: "'IBM Plex Mono', monospace",
      color: "#e8e8f0",
      boxSizing: "border-box",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&family=IBM+Plex+Mono:wght@300;400;500&display=swap" rel="stylesheet" />

      {/* ── TOP NAV ── */}
      <nav style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 32px",
        display: "flex", alignItems: "center", gap: 16,
        height: 58,
        background: "rgba(6,6,14,0.95)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "linear-gradient(135deg,#ff6b2b,#ff9500)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
          }}>🎙</div>
          <span style={{ fontFamily: "'Unbounded',sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: -0.5 }}>
            VOICE<span style={{ color: "#ff6b2b" }}>LAB</span>
          </span>
          <span style={{
            background: "rgba(255,107,43,0.12)", border: "1px solid rgba(255,107,43,0.2)",
            borderRadius: 20, padding: "2px 8px", fontSize: 9, color: "#ff6b2b", letterSpacing: 1,
          }}>NEURAL</span>
        </div>

        {/* Tab switcher */}
        <div style={{ marginLeft: 24, display: "flex", gap: 4 }}>
          {[["studio", "🎛 Studio"], ["reader", "📖 Reader"]].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? "rgba(255,107,43,0.12)" : "transparent",
              border: view === v ? "1px solid rgba(255,107,43,0.3)" : "1px solid transparent",
              borderRadius: 8, padding: "5px 14px",
              color: view === v ? "#ff6b2b" : "#555",
              fontSize: 11, cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace",
              transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#333", letterSpacing: 1 }}>FREE · PRIVATE · OFFLINE</span>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.07)" }} />
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg,#ff6b2b,#ff9500)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, cursor: "pointer",
          }}>👤</div>
        </div>
      </nav>

      {error && (
        <div style={{
          margin: "16px 32px 0",
          background: "rgba(255,60,60,0.07)", border: "1px solid rgba(255,60,60,0.2)",
          borderRadius: 10, padding: "10px 16px", color: "#ff6666", fontSize: 12,
        }}>{error}</div>
      )}

      {/* ── STUDIO VIEW ── */}
      {view === "studio" && (
        <div style={{ padding: "24px 32px", maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 310px", gap: 18 }}>
            {/* LEFT */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Text Input Panel */}
              <div style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16, overflow: "hidden",
                boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
              }}>
                <div style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "rgba(255,255,255,0.02)",
                }}>
                  <span style={{ fontSize: 10, color: "#444", letterSpacing: 1.5 }}>✏️ TEXT INPUT</span>
                  <div style={{ display: "flex", gap: 14, fontSize: 10 }}>
                    <span style={{ color: charCount > 4900 ? "#ff5555" : "#555" }}>{charCount} <span style={{ color: "#333" }}>chars</span></span>
                    <span style={{ color: "#555" }}>{wordCount} <span style={{ color: "#333" }}>words</span></span>
                  </div>
                </div>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Type or paste your text here…"
                  style={{
                    width: "100%", minHeight: 200,
                    background: "transparent", border: "none", outline: "none",
                    color: "#e0e0f0", fontSize: 15, fontFamily: "'IBM Plex Mono',monospace",
                    lineHeight: 1.8, padding: "16px", resize: "vertical", boxSizing: "border-box",
                  }}
                />
                <div style={{ height: 2, background: "rgba(255,255,255,0.03)", margin: "0 16px 14px" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min((charCount / 5000) * 100, 100)}%`,
                    background: charCount > 4900 ? "#ff5555" : "linear-gradient(90deg,#ff6b2b,#ff9500)",
                    borderRadius: 1, transition: "width 0.2s",
                  }} />
                </div>
              </div>

              {/* Waveform + Transport */}
              <div style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16, padding: "18px 22px",
                boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
              }}>
                <Waveform active={playing} />

                {/* Progress bar */}
                <div
                  style={{ marginTop: 12, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, cursor: "pointer", overflow: "hidden" }}
                  onClick={e => {
                    if (!audioRef.current) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    audioRef.current.currentTime = pct * audioRef.current.duration;
                  }}
                >
                  <div style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: "linear-gradient(90deg,#ff6b2b,#ff9500)",
                    borderRadius: 2, transition: "width 0.1s linear",
                  }} />
                </div>

                {/* Transport controls */}
                <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>

                  {/* Play button */}
                  <button onClick={() => speak(text, selected)}
                    disabled={loading || !text.trim()}
                    style={{
                      background: loading ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#ff6b2b,#ff9500)",
                      border: "none", borderRadius: "50%", width: 56, height: 56,
                      cursor: loading || !text.trim() ? "not-allowed" : "pointer",
                      fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: playing ? "0 0 28px rgba(255,107,43,0.5), 0 0 60px rgba(255,107,43,0.15)" : "0 4px 16px rgba(255,107,43,0.3)",
                      transition: "all 0.2s",
                      opacity: !text.trim() ? 0.35 : 1,
                    }}>
                    {loading ? <span style={{ fontSize: 14, animation: "spin 1s linear infinite" }}>⏳</span> : "▶"}
                  </button>

                  {/* Pause */}
                  {playing && (
                    <button onClick={pause} style={{
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "50%", width: 46, height: 46, cursor: "pointer",
                      fontSize: 18, color: "#ccc", display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                    }}>⏸</button>
                  )}

                  {/* Resume */}
                  {paused && (
                    <button onClick={resume} style={{
                      background: "rgba(255,107,43,0.12)", border: "1px solid rgba(255,107,43,0.3)",
                      borderRadius: "50%", width: 46, height: 46, cursor: "pointer",
                      fontSize: 18, color: "#ff6b2b", display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                    }}>▶</button>
                  )}

                  {/* Stop */}
                  {(playing || paused) && (
                    <button onClick={stop} style={{
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: "50%", width: 46, height: 46, cursor: "pointer",
                      fontSize: 18, color: "#666", display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                    }}>⏹</button>
                  )}

                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                    {(playing || paused) && (
                      <button onClick={() => setView("reader")} style={{
                        background: "rgba(255,107,43,0.08)", border: "1px solid rgba(255,107,43,0.2)",
                        borderRadius: 8, padding: "6px 12px", color: "#ff6b2b", fontSize: 10,
                        cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace",
                      }}>📖 Open Reader</button>
                    )}
                    <div style={{
                      fontSize: 11, letterSpacing: 2,
                      color: loading ? "#ff950088" : playing ? "#ff6b2b" : paused ? "#ff6b2b66" : "#2a2a3a",
                    }}>
                      {loading ? "⏳ GENERATING" : playing ? "● SPEAKING" : paused ? "⏸ PAUSED" : "■ READY"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Audio Controls */}
              <div style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16, padding: "16px 22px",
              }}>
                <div style={{ fontSize: 10, color: "#444", letterSpacing: 1.5, marginBottom: 18 }}>🎛 AUDIO CONTROLS</div>
                <div style={{ display: "flex", gap: 32 }}>
                  {[
                    { label: "Speed", val: rate, set: setRate, min: -50, max: 100, step: 5, fmt: v => v >= 0 ? `+${v}%` : `${v}%` },
                    { label: "Pitch", val: pitch, set: setPitch, min: -50, max: 50, step: 5, fmt: v => v >= 0 ? `+${v}Hz` : `${v}Hz` },
                  ].map(k => (
                    <div key={k.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5 }}>{k.label.toUpperCase()}</div>
                      <input type="range" min={k.min} max={k.max} step={k.step} value={k.val}
                        onChange={e => k.set(parseInt(e.target.value))}
                        style={{ width: "100%", accentColor: "#ff6b2b", cursor: "pointer", height: 4 }} />
                      <div style={{ color: "#ff6b2b", fontSize: 15, fontFamily: "'Unbounded',sans-serif", fontWeight: 700 }}>
                        {k.fmt(k.val)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT — Voices */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16, padding: 14, flex: 1,
                display: "flex", flexDirection: "column", overflow: "hidden",
                boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
              }}>
                <div style={{ fontSize: 10, color: "#444", letterSpacing: 1.5, marginBottom: 12 }}>
                  🎤 NEURAL VOICES <span style={{ color: "#2a2a3a" }}>({filtered.length})</span>
                </div>

                {/* Language pills */}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                  {langs.map(l => (
                    <button key={l} onClick={() => setLangFilter(langFilter === l ? "" : l)} style={{
                      background: langFilter === l ? "rgba(255,107,43,0.15)" : "rgba(255,255,255,0.03)",
                      border: langFilter === l ? "1px solid rgba(255,107,43,0.4)" : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 20, padding: "3px 9px", fontSize: 10,
                      color: langFilter === l ? "#ff6b2b" : "#444",
                      cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace",
                      transition: "all 0.15s",
                    }}>{l}</button>
                  ))}
                </div>

                {/* Search */}
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="🔍 Search voices…"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 8, padding: "7px 12px",
                    color: "#e8e8f0", fontSize: 11,
                    fontFamily: "'IBM Plex Mono',monospace",
                    outline: "none", marginBottom: 10,
                  }} />

                {/* Voice list */}
                <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 5, flex: 1, maxHeight: 370, paddingRight: 2 }}>
                  {voices.length === 0 && <div style={{ color: "#2a2a3a", fontSize: 11, textAlign: "center", padding: 32 }}>Connecting to server…</div>}
                  {filtered.map((v, i) => (
                    <VoiceCard key={i} voice={v}
                      selected={selected?.ShortName === v.ShortName}
                      onSelect={setSelected}
                      onPreview={v => speak("Hello! This is a preview of my neural voice.", v)}
                    />
                  ))}
                </div>
              </div>

              {/* Active voice badge */}
              {selected && (
                <div style={{
                  background: "linear-gradient(135deg, rgba(255,107,43,0.07), rgba(255,149,0,0.04))",
                  border: "1px solid rgba(255,107,43,0.18)",
                  borderRadius: 12, padding: "12px 14px",
                }}>
                  <div style={{ fontSize: 9, color: "#ff6b2b44", letterSpacing: 1.5, marginBottom: 5 }}>ACTIVE VOICE</div>
                  <div style={{ fontSize: 12, color: "#ff6b2b", fontFamily: "'Unbounded',sans-serif", fontWeight: 700 }}>
                    {selected.FriendlyName.replace("Microsoft ", "").replace(" Online (Natural)", "")}
                  </div>
                  <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>
                    {selected.Locale} · {selected.Gender} · Neural
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── READER VIEW ── */}
      {view === "reader" && (
        <div style={{ padding: "32px", maxWidth: 820, margin: "0 auto" }}>

          {/* Reader header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: "'Unbounded',sans-serif", fontSize: 18, fontWeight: 900, color: "#fff" }}>
                📖 Reader Mode
              </h2>
              <div style={{ color: "#444", fontSize: 10, marginTop: 4, letterSpacing: 1 }}>
                Words highlight as they are spoken
              </div>
            </div>
            <button onClick={() => setView("studio")} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "7px 14px", color: "#888", fontSize: 11,
              cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace",
            }}>← Back to Studio</button>
          </div>

          {/* Highlighted Text Box */}
          <div style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20, padding: "28px 32px",
            marginBottom: 24, minHeight: 200,
            boxShadow: "0 8px 48px rgba(0,0,0,0.4)",
          }}>
            {wordTimings.length > 0
              ? <HighlightedText text={text} wordTimings={wordTimings} currentTime={currentTime} isPlaying={playing} />
              : <div style={{ color: "#333", fontSize: 14, lineHeight: 2 }}>
                  Press ▶ in the Studio tab to start playback, then come back here to see word highlighting.
                </div>
            }
          </div>

          {/* Reader controls */}
          <div style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16, padding: "18px 24px",
          }}>
            <Waveform active={playing} />
            <div style={{ marginTop: 12, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#ff6b2b,#ff9500)", transition: "width 0.1s linear" }} />
            </div>
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>

              {/* Play fresh */}
              <button onClick={() => speak(text, selected)} disabled={loading || !text.trim()} style={{
                background: "linear-gradient(135deg,#ff6b2b,#ff9500)", border: "none", borderRadius: "50%",
                width: 54, height: 54, cursor: "pointer", fontSize: 20,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: playing ? "0 0 28px rgba(255,107,43,0.5)" : "0 4px 16px rgba(255,107,43,0.25)",
                transition: "all 0.2s", opacity: !text.trim() ? 0.35 : 1,
              }}>▶</button>

              {/* Pause */}
              {playing && (
                <button onClick={pause} style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "50%", width: 46, height: 46, cursor: "pointer",
                  fontSize: 18, color: "#ccc", display: "flex", alignItems: "center", justifyContent: "center",
                }}>⏸</button>
              )}

              {/* Resume */}
              {paused && (
                <button onClick={resume} style={{
                  background: "rgba(255,107,43,0.12)", border: "1px solid rgba(255,107,43,0.3)",
                  borderRadius: "50%", width: 46, height: 46, cursor: "pointer",
                  fontSize: 18, color: "#ff6b2b", display: "flex", alignItems: "center", justifyContent: "center",
                }}>▶</button>
              )}

              {/* Stop */}
              {(playing || paused) && (
                <button onClick={stop} style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "50%", width: 46, height: 46, cursor: "pointer",
                  fontSize: 18, color: "#666", display: "flex", alignItems: "center", justifyContent: "center",
                }}>⏹</button>
              )}

              <div style={{ marginLeft: "auto", fontSize: 11, letterSpacing: 2, color: playing ? "#ff6b2b" : paused ? "#ff6b2b66" : "#2a2a3a" }}>
                {loading ? "⏳ GENERATING" : playing ? "● SPEAKING" : paused ? "⏸ PAUSED" : "■ READY"}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,107,43,0.2); border-radius: 2px; }
        input[type=range] { height: 4px; }
        textarea::placeholder { color: #2a2a3a; }
        input::placeholder { color: #2a2a3a; }
      `}</style>
    </div>
  );
}