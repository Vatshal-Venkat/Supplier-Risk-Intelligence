"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { ForceGraphProps } from "react-force-graph-2d";
import api from "@/lib/api";

const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d"),
  { ssr: false }
) as React.ComponentType<ForceGraphProps>;

type GraphNode = {
  id: string;
  type?: string;
  tier?: number;
  risk_score?: number;
  risk_level?: "GREEN" | "YELLOW" | "RED";
  sanctioned?: boolean;
};

type GraphLink = {
  source: string | any;
  target: string | any;
  type?: string;
};

type GraphResponse = {
  nodes: GraphNode[];
  links: GraphLink[];
  sanction_paths?: string[][];
};

export default function TrustGraph({ name }: { name: string }) {
  const [data, setData] = useState<GraphResponse>({
    nodes: [],
    links: [],
    sanction_paths: [],
  });

  const [activeFilters, setActiveFilters] = useState({
    GREEN: true,
    YELLOW: true,
    RED: true,
    UNKNOWN: true,
  });

  const [selectedPath, setSelectedPath] = useState<string[] | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const toggleFilter = (filterKey: keyof typeof activeFilters) => {
    setActiveFilters((prev) => ({ ...prev, [filterKey]: !prev[filterKey] }));
  };

  const isVisibleLink = (link: any) => {
    const source = typeof link.source === "object" ? link.source : data.nodes.find(n => n.id === link.source);
    const target = typeof link.target === "object" ? link.target : data.nodes.find(n => n.id === link.target);
    if (!source || !target) return false;
    return isVisibleNode(source) && isVisibleNode(target);
  };

  const isVisibleNode = (node: any) => {
    if (node.tier === 0) return true; // Primary supplier always visible
    const risk = node.risk_level as "GREEN" | "YELLOW" | "RED" | undefined;
    if (risk && activeFilters[risk] !== undefined) {
      return activeFilters[risk];
    }
    return activeFilters.UNKNOWN;
  };

  // -----------------------------------------
  // Fetch Graph
  // -----------------------------------------
  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const res = await api.get(`/graph/${name}`);
        setData({
          nodes: res.data.nodes || [],
          links: res.data.links || [],
          sanction_paths: res.data.sanction_paths || [],
        });
      } catch (err) {
        console.error("Graph fetch error:", err);
        setData({ nodes: [], links: [], sanction_paths: [] });
      }
    };

    if (name) {
      fetchGraph();
    }
  }, [name]);

  // -----------------------------------------
  // Risk Filtering
  // -----------------------------------------
  // No longer filtering nodes out of the graph data, just visually fading them
  const filteredGraph = useMemo(() => {
    return data;
  }, [data]);

  // -----------------------------------------
  // Sanction Path Highlight Check
  // -----------------------------------------
  const isSanctionLink = (link: any) => {
    if (!selectedPath) return false;
    const sourceId =
      typeof link.source === "object" ? link.source.id : link.source;
    const targetId =
      typeof link.target === "object" ? link.target.id : link.target;

    for (let i = 0; i < selectedPath.length - 1; i++) {
       if (selectedPath[i] === sourceId && selectedPath[i + 1] === targetId) {
         return true;
       }
    }
    return false;
  };

  const handleNodeClick = (node: any) => {
    if (!node.sanctioned) {
      setSelectedPath(null);
      setAlertMsg(null);
      return;
    }

    const path = data.sanction_paths?.find((p) => p.includes(node.id));
    if (path) {
      setSelectedPath(path);
      setAlertMsg(null);
    } else {
      setSelectedPath(null);
      setAlertMsg(`No indirect exposure path found connecting primary supplier to ${node.id}`);
      setTimeout(() => setAlertMsg(null), 4000);
    }
  };

  const nodeCount = filteredGraph.nodes.length;
  const linkCount = filteredGraph.links.length;
  const sanctionedCount = filteredGraph.nodes.filter((n) => n.sanctioned).length;

  return (
    <div>
      {/* ---------------- CONTROLS + STATS ROW ---------------- */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
            Filters:
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFilter("GREEN")}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                activeFilters.GREEN
                  ? "bg-green-500/10 border-green-500/50 text-green-400"
                  : "bg-transparent border-gray-700 text-gray-500 hover:border-gray-500"
              }`}
            >
              Low Risk
            </button>
            <button
              onClick={() => toggleFilter("YELLOW")}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                activeFilters.YELLOW
                  ? "bg-yellow-500/10 border-yellow-500/50 text-yellow-400"
                  : "bg-transparent border-gray-700 text-gray-500 hover:border-gray-500"
              }`}
            >
              Medium Risk
            </button>
            <button
              onClick={() => toggleFilter("RED")}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                activeFilters.RED
                  ? "bg-red-500/10 border-red-500/50 text-red-400"
                  : "bg-transparent border-gray-700 text-gray-500 hover:border-gray-500"
              }`}
            >
              High Risk
            </button>
            <button
              onClick={() => toggleFilter("UNKNOWN")}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                activeFilters.UNKNOWN
                  ? "bg-gray-500/10 border-gray-500/50 text-gray-300"
                  : "bg-transparent border-gray-700 text-gray-500 hover:border-gray-500"
              }`}
            >
              Unknown
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-gray-500">
          <span>{nodeCount} nodes</span>
          <span className="text-zinc-700">·</span>
          <span>{linkCount} connections</span>
          {sanctionedCount > 0 && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-red-500 font-bold">{sanctionedCount} sanctioned</span>
            </>
          )}
        </div>
      </div>

      {/* ---------------- LEGEND & ALERTS ---------------- */}
      <div className="flex items-center justify-between mb-3 text-[10px] text-gray-500">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
            Low Risk
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#facc15]" />
            Medium Risk
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
            High / Sanctioned
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#9ca3af]" />
            Unknown
          </div>
          <div className="flex items-center gap-1.5 ml-4">
            <span className="inline-block w-5 h-0.5 bg-[#dc2626]" />
            Sanction Path
          </div>
          <div className="flex items-center gap-1.5 ml-2 text-gray-400 italic">
            *Click sanctioned nodes to trace path
          </div>
        </div>
        {alertMsg && (
          <div className="text-red-400 font-semibold bg-red-500/10 px-3 py-1 rounded">
            {alertMsg}
          </div>
        )}
      </div>

      {/* ---------------- GRAPH ---------------- */}
      <div style={{ height: 550 }} className="border border-zinc-800/50 rounded-md overflow-hidden bg-[#060a11] relative">
        {selectedPath && (
           <button 
             className="absolute top-4 right-4 z-10 bg-zinc-800/80 hover:bg-zinc-700 text-gray-200 px-3 py-1.5 rounded text-xs transition-colors backdrop-blur-sm shadow-lg border border-zinc-700/50"
             onClick={() => setSelectedPath(null)}
           >
             Clear Path Highlight
           </button>
        )}
        <ForceGraph2D
          graphData={filteredGraph}
          onNodeClick={handleNodeClick}
          nodeLabel={(node: any) =>
            `${node.id}\nTier: ${node.tier ?? "-"}\nRisk Score: ${node.risk_score ?? 0}\nRisk Level: ${node.risk_level ?? "N/A"}\nSanctioned: ${node.sanctioned ? "Yes" : "No"}`
          }
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const colorMap: any = {
              GREEN: "#22c55e",
              YELLOW: "#facc15",
              RED: "#ef4444",
            };

            const size = node.tier === 0 ? 12 : node.tier === 1 ? 8 : 6;
            const color = colorMap[node.risk_level] || "#9ca3af";
            
            const visible = isVisibleNode(node);
            const isSelected = selectedPath ? selectedPath.includes(node.id) : false;

            // Optional fade if user has a selection active or if it's filtered
            ctx.globalAlpha = visible ? (selectedPath ? (isSelected ? 1.0 : 0.2) : 1.0) : 0.15;

            // Glow for sanctioned nodes
            if (node.sanctioned) {
              ctx.beginPath();
              ctx.arc(node.x!, node.y!, size + 5, 0, 2 * Math.PI);
              ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
              ctx.fill();
            }

            // Node circle
            ctx.beginPath();
            ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();

            // Label for tier 0 and tier 1 nodes
            if (node.tier <= 1 || isSelected || node.sanctioned) {
              const label = node.id;
              const fontSize = Math.max(10 / globalScale, 3);
              ctx.font = `${fontSize}px Inter, sans-serif`;
              ctx.fillStyle = isSelected && node.sanctioned ? "#ef4444" : "#d1d5db";
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillText(label, node.x!, node.y! + size + 3);
            }
            
            // Reset alpha
            ctx.globalAlpha = 1.0;
          }}
          linkDirectionalArrowLength={5}
          linkDirectionalArrowRelPos={1}
          linkWidth={(link: any) => (isSanctionLink(link) ? 2.5 : 1)}
          linkColor={(link: any) => {
            const visible = isVisibleLink(link);
            if (!visible) return "rgba(156, 163, 175, 0.05)";
            if (selectedPath) {
              return isSanctionLink(link) ? "#dc2626" : "rgba(156, 163, 175, 0.1)";
            }
            return "rgba(156, 163, 175, 0.3)";
          }}
          linkCanvasObjectMode={() => "after"}
          linkCanvasObject={(link: any, ctx, globalScale) => {
            // Render relationship type labels on links
            if (!link.type) return;

            const start = link.source;
            const end = link.target;

            if (typeof start !== "object" || typeof end !== "object") return;
            
            const visible = isVisibleLink(link);
            if (!visible) return; // Don't show text for faded out links
            
            ctx.globalAlpha = selectedPath && !isSanctionLink(link) ? 0.2 : 1.0;

            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;

            const fontSize = Math.max(8 / globalScale, 2);
            ctx.font = `${fontSize}px Inter, sans-serif`;
            ctx.fillStyle = "rgba(156, 163, 175, 0.5)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(link.type, midX, midY);
            
            ctx.globalAlpha = 1.0;
          }}
        />
      </div>
    </div>
  );
}