import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── Color palette by record type ────────────────────────────────────────────

export const RECORD_TYPE_COLORS: Record<string, string> = {
  "311_request":        "#3B82F6", // blue
  permit:               "#10B981", // green
  inspection:           "#8B5CF6", // purple
  violation:            "#EF4444", // red
  work_order:           "#F97316", // orange
  project:              "#14B8A6", // teal
  legislative_action:   "#F59E0B", // amber
  business:             "#6366F1", // indigo
  contractor:           "#EC4899", // pink
  utility_account:      "#64748B", // slate
  property:             "#1E293B", // dark slate
  asset:                "#0EA5E9", // sky
  planning_application: "#A855F7", // violet
  tax_abatement:        "#22C55E", // light green
  field_job:            "#EAB308", // yellow
};

export const RECORD_TYPE_LABELS: Record<string, string> = {
  "311_request":        "311 Request",
  permit:               "Permit",
  inspection:           "Inspection",
  violation:            "Violation",
  work_order:           "Work Order",
  project:              "Project",
  legislative_action:   "Legislative Action",
  business:             "Business",
  contractor:           "Contractor",
  utility_account:      "Utility Account",
  property:             "Property",
  asset:                "Asset",
  planning_application: "Planning Application",
  tax_abatement:        "Tax Abatement",
  field_job:            "Field Job",
};

export type GISMarker = {
  id: string;
  record_type: string;
  latitude: number;
  longitude: number;
  raw_address: string;
  normalized_address?: string | null;
  source_module?: string;
  related_record_id?: string | null;
  geocode_status?: string;
};

// ─── Custom colored circle marker ────────────────────────────────────────────

function makeIcon(color: string, pulse = false) {
  const pulseStyle = pulse
    ? `box-shadow:0 0 0 4px ${color}33;`
    : "";
  return L.divIcon({
    html: `<div style="background:${color};width:13px;height:13px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35);${pulseStyle}"></div>`,
    className: "",
    iconSize: [13, 13],
    iconAnchor: [6, 6],
    popupAnchor: [0, -10],
  });
}

// ─── Auto-fit bounds when markers change ─────────────────────────────────────

function BoundsController({ markers }: { markers: GISMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (!markers.length) return;
    const latlngs = markers
      .filter((m) => m.latitude && m.longitude)
      .map((m) => [m.latitude, m.longitude] as [number, number]);
    if (latlngs.length === 1) {
      map.setView(latlngs[0], 16);
    } else if (latlngs.length > 1) {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [32, 32] });
    }
  }, [map, markers]);
  return null;
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend({ types }: { types: Set<string> }) {
  if (!types.size) return null;
  return (
    <div className="absolute bottom-3 right-3 z-[1000] bg-white rounded-lg border border-slate-200 shadow-sm p-2 flex flex-col gap-1 text-xs max-w-[160px]">
      {[...types].map((rt) => (
        <div key={rt} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-full border border-white shrink-0"
            style={{ background: RECORD_TYPE_COLORS[rt] ?? "#64748B" }}
          />
          <span className="text-slate-700 truncate">
            {RECORD_TYPE_LABELS[rt] ?? rt}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main map component ───────────────────────────────────────────────────────

type GISMapProps = {
  markers: GISMarker[];
  height?: string;
  center?: [number, number];
  zoom?: number;
  highlightId?: string | null;
};

// Newark, NJ city center
const NEWARK_CENTER: [number, number] = [40.7357, -74.1724];

export default function GISMap({
  markers,
  height = "400px",
  center = NEWARK_CENTER,
  zoom = 13,
  highlightId,
}: GISMapProps) {
  const types = new Set(markers.map((m) => m.record_type));

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-200" style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <BoundsController markers={markers} />

        {markers
          .filter((m) => m.latitude && m.longitude)
          .map((m) => {
            const color = RECORD_TYPE_COLORS[m.record_type] ?? "#64748B";
            const isHighlighted = highlightId === m.id;
            return (
              <Marker
                key={m.id}
                position={[m.latitude, m.longitude]}
                icon={makeIcon(color, isHighlighted)}
              >
                <Popup>
                  <div className="min-w-[140px]">
                    <div
                      className="text-xs font-semibold mb-0.5"
                      style={{ color }}
                    >
                      {RECORD_TYPE_LABELS[m.record_type] ?? m.record_type}
                    </div>
                    <div className="text-xs text-slate-800 leading-snug">
                      {m.normalized_address ?? m.raw_address}
                    </div>
                    {m.source_module && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        {m.source_module}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>

      <Legend types={types} />
    </div>
  );
}
