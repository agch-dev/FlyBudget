import { useEffect, useState } from "react";

export default function Dashboard() {
  const [serverStatus, setServerStatus] = useState<string>("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setServerStatus(data.status))
      .catch(() => setServerStatus("offline"));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
      <p className="mt-2 text-gray-600">Budgeting info will be here!</p>
      <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-sm border border-gray-200">
        <span className="text-sm text-gray-500">Server:</span>
        <span
          className={`text-sm font-medium ${serverStatus === "ok" ? "text-green-600" : "text-red-500"}`}
        >
          {serverStatus}
        </span>
      </div>
    </div>
  );
}
