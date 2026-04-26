import React, { useMemo, useState } from "react";
import { Crosshair, Save, RotateCcw, CheckCircle2 } from "lucide-react";

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  backgroundColor: "var(--bg-main)",
  border: "1px solid var(--border-color)",
  borderRadius: "6px",
  color: "white",
  fontFamily: "var(--font-mono)",
  fontSize: "0.95rem",
  boxSizing: "border-box",
};

const parseCoordinate = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const CoordinatesWizardView = ({ coordinates, onSave }) => {
  const [draft, setDraft] = useState({
    xMin: String(coordinates?.xMin ?? 0),
    xMax: String(coordinates?.xMax ?? 200),
    yMin: String(coordinates?.yMin ?? 0),
    yMax: String(coordinates?.yMax ?? 200),
  });
  const [message, setMessage] = useState("");

  const parsed = useMemo(
    () => ({
      xMin: parseCoordinate(draft.xMin),
      xMax: parseCoordinate(draft.xMax),
      yMin: parseCoordinate(draft.yMin),
      yMax: parseCoordinate(draft.yMax),
    }),
    [draft],
  );

  const isValid =
    parsed.xMin !== null &&
    parsed.xMax !== null &&
    parsed.yMin !== null &&
    parsed.yMax !== null &&
    parsed.xMax > parsed.xMin &&
    parsed.yMax > parsed.yMin;

  const width = isValid ? (parsed.xMax - parsed.xMin).toFixed(2) : "--";
  const height = isValid ? (parsed.yMax - parsed.yMin).toFixed(2) : "--";

  const updateField = (field, value) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setMessage("");
  };

  const handleReset = () => {
    setDraft({
      xMin: "0",
      xMax: "200",
      yMin: "0",
      yMax: "200",
    });
    setMessage("Wizard reset to default plotting area.");
  };

  const handleSave = () => {
    if (!isValid) {
      setMessage("Enter valid coordinates where max is greater than min.");
      return;
    }

    onSave(parsed);
    setMessage("Coordinate bounds saved. New plots will use this area.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="page-header">
        <div>
          <div className="page-title">Coordinates_Wizard</div>
          <div className="breadcrumbs">
            Plot_Area <span>&gt;</span> Bounds_Setup
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleReset}
            style={{
              padding: "10px 16px",
              backgroundColor: "transparent",
              color: "white",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "10px 16px",
              backgroundColor: "var(--accent-cyan)",
              color: "black",
              border: "none",
              borderRadius: "4px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Save size={14} /> Save Bounds
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: "16px",
          padding: "16px",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div
          style={{
            backgroundColor: "var(--bg-panel)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Plotting Bounds
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            <div>
              <div
                style={{
                  marginBottom: "8px",
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                }}
              >
                X Minimum
              </div>
              <input
                value={draft.xMin}
                onChange={(event) => updateField("xMin", event.target.value)}
                style={inputStyle}
                placeholder="0"
              />
            </div>
            <div>
              <div
                style={{
                  marginBottom: "8px",
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                }}
              >
                X Maximum
              </div>
              <input
                value={draft.xMax}
                onChange={(event) => updateField("xMax", event.target.value)}
                style={inputStyle}
                placeholder="200"
              />
            </div>
            <div>
              <div
                style={{
                  marginBottom: "8px",
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                }}
              >
                Y Minimum
              </div>
              <input
                value={draft.yMin}
                onChange={(event) => updateField("yMin", event.target.value)}
                style={inputStyle}
                placeholder="0"
              />
            </div>
            <div>
              <div
                style={{
                  marginBottom: "8px",
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                }}
              >
                Y Maximum
              </div>
              <input
                value={draft.yMax}
                onChange={(event) => updateField("yMax", event.target.value)}
                style={inputStyle}
                placeholder="200"
              />
            </div>
          </div>

          <div
            style={{
              padding: "16px",
              backgroundColor: "var(--bg-main)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              fontSize: "0.78rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            The image-to-G-code page will map every generated move into this
            box:
            <br />
            `X = xMin ... xMax`
            <br />
            `Y = yMin ... yMax`
            <br />
            Use this when you want the plot to fit a known drawing area on your
            machine.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "20px",
            }}
          >
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                marginBottom: "16px",
              }}
            >
              Active Area
            </div>

            <div
              style={{
                aspectRatio: "1 / 1",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                background:
                  "linear-gradient(180deg, rgba(0,240,255,0.05), rgba(0,0,0,0.05))",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: "12%",
                  border: "1px dashed var(--accent-cyan)",
                  borderRadius: "6px",
                }}
              ></div>
              <Crosshair size={36} color="var(--accent-cyan)" />
              <div
                style={{
                  position: "absolute",
                  top: "10px",
                  left: "10px",
                  fontSize: "0.68rem",
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-secondary)",
                }}
              >
                ({draft.xMin}, {draft.yMax})
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: "10px",
                  right: "10px",
                  fontSize: "0.68rem",
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-secondary)",
                }}
              >
                ({draft.xMax}, {draft.yMin})
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
              }}
            >
              <CheckCircle2 size={16} color={isValid ? "var(--accent-cyan)" : "var(--accent-red)"} />
              Bounds Summary
            </div>
            <div style={{ fontSize: "0.85rem", color: "white" }}>
              Width: <span style={{ color: "var(--accent-cyan)" }}>{width}</span>
            </div>
            <div style={{ fontSize: "0.85rem", color: "white" }}>
              Height: <span style={{ color: "var(--accent-cyan)" }}>{height}</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              {message ||
                "Save these bounds to make all new generated plots fit inside this area."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoordinatesWizardView;
