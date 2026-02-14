"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

type Supplier = {
  id: number;
  name: string;
  country: string;
  industry: string;
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const router = useRouter();

  useEffect(() => {
    axios
      .get("http://127.0.0.1:8000/suppliers/")
      .then(res => setSuppliers(res.data));
  }, []);

  const toggleSelect = (id: number) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  const goToComparison = () => {
    router.push(`/comparison?ids=${selected.join(",")}`);
  };

  return (
    <main className="min-h-screen px-10 py-16">
      <div className="max-w-7xl mx-auto space-y-10">

        <div>
          <h1 className="text-4xl font-semibold mb-3">
            Suppliers
          </h1>
          <p className="text-[var(--text-secondary)]">
            Manage and initiate supplier risk assessments.
          </p>
        </div>

        <div className="surface overflow-hidden">

          {suppliers.map((supplier, index) => (
            <div
              key={supplier.id}
              className={`flex justify-between items-center px-8 py-6 ${
                index !== suppliers.length - 1
                  ? "border-b border-[var(--border-subtle)]"
                  : ""
              }`}
            >
              <div>
                <p className="font-semibold text-lg">
                  {supplier.name}
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  {supplier.country} • {supplier.industry}
                </p>
              </div>

              <div className="flex items-center gap-6">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-blue-500"
                  onChange={() => toggleSelect(supplier.id)}
                />

                <button
                  onClick={() =>
                    router.push(`/assessment/${supplier.id}`)
                  }
                  className="btn-secondary"
                >
                  Assess
                </button>
              </div>
            </div>
          ))}

        </div>

        {selected.length > 1 && (
          <div className="flex justify-end">
            <button
              onClick={goToComparison}
              className="btn-primary"
            >
              Compare Selected
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
