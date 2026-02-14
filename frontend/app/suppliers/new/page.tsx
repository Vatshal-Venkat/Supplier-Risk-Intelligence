"use client";

import { useState } from "react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";

export default function NewSupplierPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [industry, setIndustry] = useState("");

  const handleSubmit = async () => {
    await api.post("/suppliers", {
      name,
      country,
      industry,
    });

    router.push("/suppliers");
  };

  return (
    <main className="min-h-screen bg-[#070b12] text-white p-10">
      <h1 className="text-3xl font-semibold mb-6">Register New Vendor</h1>

      <div className="space-y-4 max-w-md">
        <input
          className="w-full px-4 py-2 bg-[#111a2a] border border-zinc-700"
          placeholder="Vendor Name"
          onChange={e => setName(e.target.value)}
        />

        <input
          className="w-full px-4 py-2 bg-[#111a2a] border border-zinc-700"
          placeholder="Country"
          onChange={e => setCountry(e.target.value)}
        />

        <input
          className="w-full px-4 py-2 bg-[#111a2a] border border-zinc-700"
          placeholder="Industry"
          onChange={e => setIndustry(e.target.value)}
        />

        <button
          onClick={handleSubmit}
          className="px-6 py-2 border border-white hover:bg-white hover:text-black transition"
        >
          Create Vendor
        </button>
      </div>
    </main>
  );
}
