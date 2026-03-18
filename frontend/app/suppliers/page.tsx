"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";

type Supplier = {
  id: number;
  name: string;
  country: string;
  industry: string;
  latest_status?: "PASS" | "CONDITIONAL" | "FAIL" | null;
  risk_score?: number | null;
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedNaics, setSelectedNaics] = useState("");
  const [selectedPart, setSelectedPart] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [sortKey, setSortKey] = useState<"name" | "country" | "industry">("name");
  const [sortAsc, setSortAsc] = useState(true);

  const router = useRouter();

  const fetchSuppliers = async () => {
    setIsSearching(true);
    try {
      let res;
      if (search.trim() || selectedCountry || selectedIndustry || selectedCity || selectedNaics) {
        res = await api.get("/suppliers/search", {
          params: {
            ...(search.trim().length >= 2 ? { query: search.trim() } : {}),
            country: selectedCountry || undefined,
            industry: selectedIndustry || undefined,
            city: selectedCity || undefined,
            naics_code: selectedNaics || undefined,
            part_number: selectedPart || undefined
          }
        });
        setSuppliers(res.data.map((r: any) => r[0] || r));
      } else {
        res = await api.get("/suppliers/with-status");
        setSuppliers(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error("Failed to fetch suppliers:", err);
      setSuppliers([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [search, selectedCountry, selectedIndustry, selectedCity, selectedNaics, selectedPart]);

  const toggleSelect = (id: number) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const filtered = useMemo(() => {
    return [...suppliers]
      .sort((a, b) => {
        const valA = a[sortKey]?.toLowerCase() || "";
        const valB = b[sortKey]?.toLowerCase() || "";
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [suppliers, search, sortKey, sortAsc]);

  const goToComparison = () => {
    router.push(`/comparison?ids=${selected.join(",")}`);
  };

  return (
    <main className="min-h-screen px-16 py-24 bg-[#070b12] text-white">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* Header Section with Button */}
        <div className="flex justify-between items-start">
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight">
              Suppliers
            </h1>
            <p className="text-gray-500 text-sm">
              Risk monitoring and assessment control panel.
            </p>
          </div>

          <button
            onClick={() => router.push("/suppliers/new")}
            className="px-6 py-3 rounded-xl border border-zinc-700 hover:border-white transition"
          >
            Register New Supplier
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex bg-[#111a2a] border border-zinc-700 rounded-xl overflow-hidden focus-within:border-white/50 transition-all">
            <div className="flex-1 flex items-center px-4">
              <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                placeholder="Search by name, NAICS, or location..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent outline-none py-3 text-sm w-full text-gray-300 placeholder-gray-600"
              />
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-1 mr-2 rounded-md text-[10px] uppercase font-bold tracking-widest transition-colors ${showFilters ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-gray-500 border border-white/10 hover:bg-white/10'}`}
              >
                {showFilters ? 'Hide Filters' : 'Filters'}
              </button>
            </div>
            {isSearching && (
              <div className="flex items-center pr-4">
                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <select 
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="bg-[#111a2a] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-white/30"
              >
                <option value="">All Regions</option>
                <option value="United States">United States</option>
                <option value="China">China</option>
                <option value="Germany">Germany</option>
                <option value="India">India</option>
                <option value="Japan">Japan</option>
              </select>
              
              <input 
                placeholder="City (e.g. Shenzhen)"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="bg-[#111a2a] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-white/30"
              />

              <select 
                value={selectedIndustry}
                onChange={(e) => setSelectedIndustry(e.target.value)}
                className="bg-[#111a2a] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-white/30"
              >
                <option value="">All Industries</option>
                <option value="331110">Iron and Steel Mills</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Technology">Technology</option>
                <option value="Logistics">Logistics</option>
              </select>

              <input 
                placeholder="NAICS Code"
                value={selectedNaics}
                onChange={(e) => setSelectedNaics(e.target.value)}
                className="bg-[#111a2a] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-white/30"
              />

              <div className="relative group">
                <input 
                  placeholder="Part #"
                  value={selectedPart}
                  onChange={(e) => setSelectedPart(e.target.value)}
                  disabled
                  className="w-full bg-[#111a2a]/50 text-gray-600 border border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none cursor-not-allowed"
                />
                <div className="absolute inset-y-0 right-3 flex items-center pr-2 pointer-events-none">
                  <span className="text-[9px] uppercase tracking-widest text-indigo-500/50 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded">Soon</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-[#0b111b]">

          <div className="grid grid-cols-12 px-8 py-4 text-xs uppercase tracking-widest text-gray-600 border-b border-zinc-800 bg-[#0a0f18]">
            <div className="col-span-4 cursor-pointer" onClick={() => handleSort("name")}>
              Name
            </div>
            <div className="col-span-3 cursor-pointer" onClick={() => handleSort("country")}>
              Country
            </div>
            <div className="col-span-3 cursor-pointer" onClick={() => handleSort("industry")}>
              Industry
            </div>
            <div className="col-span-2 text-right">
              Action
            </div>
          </div>

          {filtered.map((supplier) => {
            const isSelected = selected.includes(supplier.id);

            return (
              <div
                key={supplier.id}
                className={`grid grid-cols-12 items-center px-8 py-6 border-b border-zinc-800 last:border-none transition-all duration-200 group ${isSelected ? "bg-[#111a2a]" : "hover:bg-[#101726]"
                  }`}
              >
                <div className="col-span-4 flex items-center gap-4">
                  <div
                    onClick={() => toggleSelect(supplier.id)}
                    className={`w-4 h-4 border rounded-sm cursor-pointer transition ${isSelected
                        ? "bg-white border-white"
                        : "border-zinc-600 group-hover:border-zinc-400"
                      }`}
                  />

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {supplier.name}
                    </span>

                    {supplier.latest_status && (
                      <span
                        className={`text-[10px] tracking-widest px-2 py-0.5 border rounded ${supplier.latest_status === "PASS"
                            ? "border-green-500 text-green-400"
                            : supplier.latest_status === "CONDITIONAL"
                              ? "border-yellow-500 text-yellow-400"
                              : "border-red-500 text-red-400"
                          }`}
                      >
                        {supplier.latest_status}
                      </span>
                    )}
                  </div>
                </div>

                <div className="col-span-3 text-gray-500 text-sm">
                  {supplier.country}
                </div>

                <div className="col-span-3 text-gray-500 text-sm">
                  {supplier.industry}
                </div>

                <div className="col-span-2 text-right">
                  <button
                    onClick={() => router.push(`/suppliers/${supplier.id}`)}
                    className="px-4 py-1.5 text-xs tracking-wide border border-zinc-700 hover:border-white transition mr-2"
                  >
                    Profile
                  </button>
                  <button
                    onClick={() => router.push(`/assessment/${supplier.id}`)}
                    className="px-4 py-1.5 text-xs tracking-wide border border-zinc-700 hover:border-white transition"
                  >
                    Assess
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {selected.length > 1 && (
          <div className="flex justify-end">
            <button
              onClick={goToComparison}
              className="px-6 py-2 text-sm tracking-wide border border-white hover:bg-white hover:text-black transition"
            >
              Compare {selected.length}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
