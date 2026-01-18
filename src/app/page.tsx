import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-800 mb-4">
          Holistic Health Platform
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Enterprise Next.js Starter with TypeScript, Firebase, and Quotas
        </p>
        <div className="space-x-4">
          <Link
            href="/today"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Go to Today Page
          </Link>
          <a
            href="/api/bff/today?tenantId=demo-tenant"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition-colors"
          >
            View API Response
          </a>
        </div>
        <div className="mt-12 text-sm text-gray-500">
          <p>✅ TypeScript (Strict Mode)</p>
          <p>✅ Typed Environment Variables (Zod)</p>
          <p>✅ Standard API Handler</p>
          <p>✅ Firebase Auth + Firestore Interfaces</p>
          <p>✅ Repository Layer</p>
          <p>✅ EntitlementsService + Quotas</p>
          <p>✅ Tenant ID Context</p>
        </div>
      </div>
    </div>
  );
}
