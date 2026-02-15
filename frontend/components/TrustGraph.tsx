"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ForceGraphProps } from "react-force-graph-2d";
import api from "@/lib/api";

const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d"),
  { ssr: false }
) as React.ComponentType<ForceGraphProps>;

export default function TrustGraph({ name }: { name: string }) {
  const [data, setData] = useState({
    nodes: [] as any[],
    links: [] as any[]
  });

  useEffect(() => {
    api.get(`/graph/${name}`).then(res => {
      setData({
        nodes: res.data.nodes,
        links: res.data.edges
      });
    });
  }, [name]);

  return (
    <div style={{ height: 500 }}>
      <ForceGraph2D
        graphData={data}
        nodeLabel="id"
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
      />
    </div>
  );
}
