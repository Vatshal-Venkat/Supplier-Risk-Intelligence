"use client"

import { useEffect, useState } from "react"
import axios from "axios"

export default function Home() {
  const [status, setStatus] = useState("Checking...")

  useEffect(() => {
    axios.get("http://127.0.0.1:8000/health/")
      .then(res => setStatus(res.data.status))
      .catch(() => setStatus("Backend not reachable"))
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Supplier Risk PoC</h1>
        <p className="mt-4">Backend Status: {status}</p>
      </div>
    </main>
  )
}
