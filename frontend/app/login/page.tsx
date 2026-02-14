"use client";

import { useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { login } = useAuth();

   const handleLogin = async () => {
    await login(username, password);
   };


  return (
    <main className="min-h-screen flex items-center justify-center bg-[#070b12] text-white">
      <div className="w-96 space-y-6">
        <h1 className="text-2xl font-semibold">Login</h1>

        <input
          className="w-full px-4 py-2 bg-[#111a2a] border border-zinc-700"
          placeholder="Username"
          onChange={e => setUsername(e.target.value)}
        />

        <input
          type="password"
          className="w-full px-4 py-2 bg-[#111a2a] border border-zinc-700"
          placeholder="Password"
          onChange={e => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="w-full px-4 py-2 border border-white hover:bg-white hover:text-black transition"
        >
          Login
        </button>
      </div>
    </main>
  );
}
