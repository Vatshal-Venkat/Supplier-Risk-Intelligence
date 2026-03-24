"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function ConfigPage() {
  const [weights, setWeights] = useState({
    sanctions_weight: 70,
    section889_fail_weight: 30,
    section889_conditional_weight: 15,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("http://localhost:8000/admin/scoring-config");
        if (res.ok) {
          const data = await res.json();
          setWeights({
            sanctions_weight: data.sanctions_weight,
            section889_fail_weight: data.section889_fail_weight,
            section889_conditional_weight: data.section889_conditional_weight,
          });
        }
      } catch (err) {
        console.error("Failed to fetch scoring config", err);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setMessage("");
    try {
      const res = await fetch("http://localhost:8000/admin/scoring-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(weights),
      });
      if (res.ok) {
        setMessage("Configuration saved successfully");
      } else {
        setMessage("Failed to save configuration");
      }
    } catch (err) {
      setMessage("Error saving configuration");
    }
  };

  if (loading) return null;

  return (
    <ProtectedRoute requireAdmin>
      <main className="min-h-screen px-16 py-24 bg-[#070b12] text-white">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Scoring Configuration</h1>
          <p className="text-zinc-500 mb-10">Adjust risk weights used across the platform.</p>

          {message && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/50 text-green-400 rounded">
              {message}
            </div>
          )}

          <div className="border border-zinc-800 p-8 space-y-8 bg-[#0c121d] rounded-lg shadow-xl">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                <div>
                  <label className="block font-medium">Sanctions Weight</label>
                  <p className="text-xs text-zinc-500">Weight applied when an entity matches a sanctions list.</p>
                </div>
                <input 
                  type="number"
                  value={weights.sanctions_weight}
                  onChange={(e) => setWeights({ ...weights, sanctions_weight: parseInt(e.target.value) || 0 })}
                  className="w-24 mt-2 px-4 py-2 bg-[#111a2a] border border-zinc-700 rounded text-right focus:outline-none focus:border-blue-500" 
                />
              </div>

              <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                <div>
                  <label className="block font-medium">Section 889 Fail Weight</label>
                  <p className="text-xs text-zinc-500">Weight applied for definitive non-compliance.</p>
                </div>
                <input 
                  type="number"
                  value={weights.section889_fail_weight}
                  onChange={(e) => setWeights({ ...weights, section889_fail_weight: parseInt(e.target.value) || 0 })}
                  className="w-24 mt-2 px-4 py-2 bg-[#111a2a] border border-zinc-700 rounded text-right focus:outline-none focus:border-blue-500" 
                />
              </div>

              <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                <div>
                  <label className="block font-medium">Section 889 Conditional Weight</label>
                  <p className="text-xs text-zinc-500">Weight applied for partial or conditional compliance risks.</p>
                </div>
                <input 
                  type="number"
                  value={weights.section889_conditional_weight}
                  onChange={(e) => setWeights({ ...weights, section889_conditional_weight: parseInt(e.target.value) || 0 })}
                  className="w-24 mt-2 px-4 py-2 bg-[#111a2a] border border-zinc-700 rounded text-right focus:outline-none focus:border-blue-500" 
                />
              </div>
            </div>

            <button 
              onClick={handleSave}
              className="w-full py-3 bg-white text-black font-semibold rounded hover:bg-zinc-200 transition-all shadow-lg active:scale-[0.98]"
            >
              Save Parameters
            </button>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
