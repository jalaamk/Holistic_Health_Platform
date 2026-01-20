export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between text-sm">
        <h1 className="text-4xl font-bold mb-4">WellnessOS</h1>
        <p className="text-lg mb-8">Enterprise-grade holistic health platform</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Architecture</h2>
            <p className="text-sm text-gray-600">
              OS-first design with Profile Spine, Event Bus, and BFF layer
            </p>
          </div>
          
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Compliance</h2>
            <p className="text-sm text-gray-600">
              HIPAA/GDPR ready with consent gates and audit logging
            </p>
          </div>
          
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Portable</h2>
            <p className="text-sm text-gray-600">
              Provider abstractions for identity, data, and AI
            </p>
          </div>
        </div>

        <div className="mt-12">
          <h3 className="text-xl font-semibold mb-4">API Endpoints</h3>
          <ul className="space-y-2">
            <li><code className="bg-gray-100 px-2 py-1 rounded">GET /api/bff/screens/today</code></li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">GET /api/bff/screens/nutrition-dashboard</code></li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">GET /api/bff/screens/habits</code></li>
          </ul>
        </div>
      </div>
    </main>
  );
}
