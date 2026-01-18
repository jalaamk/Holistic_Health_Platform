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
                <span>Phase 0: Foundation & Gates (In Progress)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-400">○</span>
                <span>Phase 1: Tier A Backbone</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-400">○</span>
                <span>Phase 2: Domain Migration</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-400">○</span>
                <span>Phase 3: AI Orchestrator</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-400">○</span>
                <span>Phase 4: Tier C Suites</span>
              </li>
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
