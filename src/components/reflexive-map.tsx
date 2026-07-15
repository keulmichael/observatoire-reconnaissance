"use client";

import { useCallback, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node
} from "@xyflow/react";
import { Download, Filter, Plus, Trash2 } from "lucide-react";
import { Badge, Panel } from "./ui";
import type { Study } from "@/lib/types";
import { downloadJson } from "@/lib/analytics";

const nodeTypes = [
  "manifestation",
  "personne",
  "événement",
  "texte",
  "symbole",
  "émotion",
  "catalyseur",
  "reconnaissance",
  "état",
  "transmission"
];

const typeColors: Record<string, string> = {
  manifestation: "#7dd3fc",
  personne: "#f0d990",
  événement: "#a7f3d0",
  texte: "#c4b5fd",
  symbole: "#f9a8d4",
  émotion: "#fb7185",
  catalyseur: "#facc15",
  reconnaissance: "#fbbf24",
  état: "#93c5fd",
  transmission: "#86efac"
};

export function ReflexiveMap({
  study,
  onChange
}: {
  study: Study;
  onChange: (nodes: Node[], edges: Edge[]) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(study.map.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(study.map.edges);
  const [filter, setFilter] = useState("tous");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const visibleNodes = useMemo(
    () => (filter === "tous" ? nodes : nodes.filter((node) => node.data?.kind === filter)),
    [filter, nodes]
  );
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    [edges, visibleNodeIds]
  );

  const persist = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      onChange(nextNodes, nextEdges);
    },
    [onChange]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const nextEdges = addEdge({ ...connection, label: "relation observée" }, edges);
      setEdges(nextEdges);
      persist(nodes, nextEdges);
    },
    [edges, nodes, persist, setEdges]
  );

  function addNode() {
    const id = `node-${crypto.randomUUID()}`;
    const nextNodes = [
      ...nodes,
      {
        id,
        position: { x: 120 + nodes.length * 24, y: 120 + nodes.length * 18 },
        data: { label: "Nouveau nœud", kind: "manifestation" }
      }
    ];
    setNodes(nextNodes);
    persist(nextNodes, edges);
  }

  function deleteSelected() {
    if (!selectedNodeId) return;
    const nextNodes = nodes.filter((node) => node.id !== selectedNodeId);
    const nextEdges = edges.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId);
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeId(null);
    persist(nextNodes, nextEdges);
  }

  function updateSelected(label: string, kind: string) {
    if (!selectedNodeId) return;
    const nextNodes = nodes.map((node) =>
      node.id === selectedNodeId ? { ...node, data: { ...node.data, label, kind } } : node
    );
    setNodes(nextNodes);
    persist(nextNodes, edges);
  }

  const selected = nodes.find((node) => node.id === selectedNodeId);

  return (
    <div className="grid gap-4">
      <Panel title="Carte réflexive">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button className="rounded-md bg-gold px-3 py-2 text-sm font-semibold text-night" onClick={addNode}>
            <Plus className="mr-2 inline h-4 w-4" aria-hidden /> Nœud
          </button>
          <button className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={deleteSelected}>
            <Trash2 className="mr-2 inline h-4 w-4" aria-hidden /> Supprimer
          </button>
          <button className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={() => downloadJson(`${study.id}-map.json`, { nodes, edges })}>
            <Download className="mr-2 inline h-4 w-4" aria-hidden /> Export JSON
          </button>
          <label className="ml-auto flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-stone-200">
            <Filter className="h-4 w-4" aria-hidden />
            <select className="bg-transparent text-sm text-white" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option className="bg-ink" value="tous">Tous</option>
              {nodeTypes.map((type) => (
                <option className="bg-ink" key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="h-[620px] overflow-hidden rounded-lg border border-white/10 bg-[#081321]">
          <ReactFlow
            nodes={visibleNodes.map((node) => ({
              ...node,
              style: { borderColor: typeColors[String(node.data?.kind)] ?? "#f0d990" }
            }))}
            edges={visibleEdges}
            onNodesChange={(changes) => {
              onNodesChange(changes);
              window.setTimeout(() => persist(nodes, edges), 0);
            }}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
          >
            <Background color="rgba(240,217,144,0.14)" />
            <MiniMap pannable zoomable nodeColor={(node) => typeColors[String(node.data?.kind)] ?? "#d6b25e"} />
            <Controls />
          </ReactFlow>
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Panel title="Édition du nœud">
          {selected ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm text-stone-200">Libellé</span>
                <input
                  className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
                  value={String(selected.data?.label ?? "")}
                  onChange={(event) => updateSelected(event.target.value, String(selected.data?.kind ?? "manifestation"))}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-stone-200">Type</span>
                <select
                  className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
                  value={String(selected.data?.kind ?? "manifestation")}
                  onChange={(event) => updateSelected(String(selected.data?.label ?? ""), event.target.value)}
                >
                  {nodeTypes.map((type) => (
                    <option className="bg-ink" key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <div className="md:col-span-2 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-stone-300">
                <p><span className="text-stone-500">Observation source :</span> {String(selected.data?.sourceObservationId ?? "Non renseignee")}</p>
                <p className="mt-1"><span className="text-stone-500">Extrait :</span> {String(selected.data?.sourceExcerpt ?? "Non renseigne")}</p>
                <p className="mt-1"><span className="text-stone-500">Statut :</span> donnees validees ou ajoutees manuellement selon provenance du noeud.</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-400">Sélectionnez un nœud pour modifier son type ou son libellé.</p>
          )}
        </Panel>
        <Panel title="Légende">
          <div className="flex flex-wrap gap-2">
            {nodeTypes.map((type) => (
              <Badge key={type}>
                <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: typeColors[type] }} />
                {type}
              </Badge>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
