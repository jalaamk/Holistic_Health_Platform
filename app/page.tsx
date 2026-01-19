export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <main className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold mb-4">WellnessOS v3</h1>
        <p className="text-xl mb-8">Enterprise Holistic Health Platform</p>
        
        <div className="grid gap-4">
          <div className="border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-2">Architecture Status</h2>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Phase 0: Foundation & Gates (Complete)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Phase 1: Tier A Backbone (Complete)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-400">○</span>
                <span>Phase 2: Domain Migration (Planned)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-400">○</span>
                <span>Phase 3: AI Orchestrator (Planned)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-400">○</span>
                <span>Phase 4: Tier C Suites (Planned)</span>
              </li>
            </ul>
          </div>

          <div className="border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-2">Phase 1 Features</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-lg">Event Bus</h3>
                <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                  <li>Outbox pattern for reliable publishing</li>
                  <li>Idempotency store (deduplication)</li>
                  <li>Dead-letter queue for failed events</li>
                  <li>Replay capability for event sourcing</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Profile Spine OS</h3>
                <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                  <li>Versioned canonical user profile</li>
                  <li>JSON Patch operations with optimistic concurrency</li>
                  <li>Consent management (grant/revoke)</li>
                  <li>Event-driven updates</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Policy & Consent OS</h3>
                <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                  <li>Policy Decision Point (PDP)</li>
                  <li>Priority-based evaluation engine</li>
                  <li>Consent scope checking</li>
                  <li>DSR workflow foundation</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-2">API Endpoints</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><code className="bg-gray-100 px-2 py-1 rounded">/api/health</code> - Health check</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">/api/bff/screens/today</code> - Today screen ViewModel</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">/api/bff/screens/habits</code> - Habits dashboard ViewModel</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">/api/bff/screens/nutrition-dashboard</code> - Nutrition ViewModel</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">/api/bff/screens/weekly-review</code> - Weekly review ViewModel</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">/api/spine/[userId]</code> - Profile Spine (GET/PATCH)</li>
            </ul>
          </div>

          <div className="border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-2">Core Principles</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Profile Spine is canonical for identity/intent/preferences</li>
              <li>Module ownership: each domain owns its logs/time-series</li>
              <li>Compose via Contracts + Events (not cross-DB queries)</li>
              <li>Consent gates everywhere</li>
              <li>Explainability by default</li>
            </ul>
          </div>

          <div className="border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-2">Provider Abstraction</h2>
            <p className="mb-2">Shipping fast with:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Firebase Auth (behind IdentityProvider interface)</li>
              <li>Firestore (behind DataStore interface)</li>
              <li>OpenAI (behind AIProvider interface)</li>
            </ul>
            <p className="mt-2 text-sm text-gray-600">
              Ready to migrate to enterprise providers without rewrites
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
