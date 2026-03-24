"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";

interface User {
  id: number;
  username: str;
  role: str;
}

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await fetch("http://localhost:8000/admin/users", {
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(loading);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateRole = async (userId: number, newRole: string) => {
    try {
      const res = await fetch(`http://localhost:8000/admin/users/${userId}?role=${newRole}`, {
        method: "PUT",
      });
      if (res.ok) {
        setMessage("Role updated successfully");
        fetchUsers();
      } else {
        setMessage("Failed to update role");
      }
    } catch (err) {
      setMessage("Error updating role");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`http://localhost:8000/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage("User deleted successfully");
        fetchUsers();
      } else {
        setMessage("Failed to delete user");
      }
    } catch (err) {
      setMessage("Error deleting user");
    }
  };

  return (
    <ProtectedRoute requireAdmin>
      <main className="min-h-screen px-16 py-24 bg-[#070b12] text-white">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">User Management</h1>
          <p className="text-zinc-500 mb-10">Manage permissions and access for your organization.</p>

          {message && (
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/50 text-blue-400 rounded">
              {message}
            </div>
          )}

          <div className="border border-zinc-800 rounded-lg overflow-hidden bg-[#0c121d]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Username</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Role</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-800 hover:bg-white/5 transition">
                    <td className="px-6 py-4 font-medium">{u.username} {u.id === currentUser?.id && <span className="text-zinc-500 text-xs ml-2">(You)</span>}</td>
                    <td className="px-6 py-4">
                      <select 
                        value={u.role}
                        onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                        className="bg-[#111a2a] border border-zinc-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                        disabled={u.id === currentUser?.id}
                      >
                        <option value="VIEWER">VIEWER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u.id !== currentUser?.id && (
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-red-400 hover:text-red-300 transition text-sm font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
