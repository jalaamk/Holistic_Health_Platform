"use client";

import { useEffect, useState } from "react";
import { TodayViewModel } from "@/types/view-models";

export default function TodayPage() {
  const [data, setData] = useState<TodayViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch("/api/bff/today?tenantId=demo-tenant");
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error?.message || "Failed to fetch data");
        }

        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold text-lg mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">No data available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {data.greeting}!
            </h1>
            <p className="text-gray-600">
              {new Date(data.date).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                Total Requests
              </h2>
              <p className="text-4xl font-bold text-blue-600">
                {data.stats.totalRequests}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                Active Users
              </h2>
              <p className="text-4xl font-bold text-green-600">
                {data.stats.activeUsers}
              </p>
            </div>
          </div>

          {/* Quota Status */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              API Quota Status
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Resource Type:</span>
                <span className="font-semibold text-gray-800">
                  {data.quotaStatus.resourceType}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Used:</span>
                <span className="font-semibold text-gray-800">
                  {data.quotaStatus.used}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Limit:</span>
                <span className="font-semibold text-gray-800">
                  {data.quotaStatus.limit}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Remaining:</span>
                <span className="font-semibold text-green-600">
                  {data.quotaStatus.remaining}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="pt-2">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all"
                    style={{
                      width: `${
                        (data.quotaStatus.used / data.quotaStatus.limit) * 100
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Tenant Info */}
          <div className="mt-6 bg-gray-100 rounded-lg p-4 text-sm text-gray-600">
            <div className="flex justify-between items-center">
              <span>Tenant ID:</span>
              <code className="bg-white px-2 py-1 rounded">{data.tenantId}</code>
            </div>
            {data.userId && (
              <div className="flex justify-between items-center mt-2">
                <span>User ID:</span>
                <code className="bg-white px-2 py-1 rounded">{data.userId}</code>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
