import { useState, useEffect } from 'react';

export function App() {
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState('');
  const [vibe, setVibe] = useState(25);
  const [saved, setSaved] = useState(false);

  // Load interests from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('aura_interests');
    if (stored) {
      setInterests(JSON.parse(stored));
    }
  }, []);

  // Save interests to localStorage
  const saveInterests = () => {
    localStorage.setItem('aura_interests', JSON.stringify(interests));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    setInterests(interests.filter(i => i !== interest));
  };

  const getVibeLabel = () => {
    if (vibe < 33) return 'Icebreaker';
    if (vibe < 66) return 'Deep-Dive';
    return 'The Close';
  };

  const getVibeDescription = () => {
    if (vibe < 33) return 'High energy, curious, low pressure';
    if (vibe < 66) return 'Philosophical, slower-paced, empathetic';
    return 'Direct, confident, with a call to action';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white p-6">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
              <svg
                className="h-7 w-7 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Aura</h1>
          <p className="text-purple-300 text-sm">The Cognitive Bridge for Authentic Connection</p>
        </div>

        {/* Status Card */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-sm text-gray-300">Extension Active</span>
            <span className="ml-auto text-xs text-purple-300 bg-purple-500/20 px-2 py-1 rounded">
              WhatsApp / Instagram / Dating Apps
            </span>
          </div>
        </div>

        {/* Interests Section */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-purple-200">Your Interests</h2>
            <span className="text-xs text-gray-400">{interests.length} saved</span>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addInterest()}
              placeholder="Add interest (e.g., Radiohead)"
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:border-purple-400"
            />
            <button
              onClick={addInterest}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition-colors"
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {interests.map((interest) => (
              <span
                key={interest}
                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-xs text-purple-200"
              >
                {interest}
                <button
                  onClick={() => removeInterest(interest)}
                  className="hover:text-red-300 transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
            {interests.length === 0 && (
              <span className="text-xs text-gray-500 italic">No interests yet. Add some to enable Interest-Sync!</span>
            )}
          </div>

          <button
            onClick={saveInterests}
            className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium transition-colors"
          >
            {saved ? '✓ Saved!' : 'Save Interests'}
          </button>
        </div>

        {/* Vibe Calibration */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-3">
          <h2 className="font-semibold text-purple-200">Social Calibration</h2>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Icebreaker</span>
              <span>Deep-Dive</span>
              <span>The Close</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={vibe}
              onChange={(e) => setVibe(parseInt(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          <div className="bg-purple-500/10 rounded-lg p-3">
            <div className="text-sm font-medium text-purple-200">{getVibeLabel()}</div>
            <div className="text-xs text-gray-400 mt-1">{getVibeDescription()}</div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-3">
          <h2 className="font-semibold text-purple-200">How Aura Works</h2>
          
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <div>
                <div className="font-medium text-gray-200">Intent-Based Drafting</div>
                <div className="text-xs text-gray-400">Type your raw thought, get socially calibrated output</div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <div>
                <div className="font-medium text-gray-200">Interest-Sync Engine</div>
                <div className="text-xs text-gray-400">Auto-detects shared interests and suggests hooks</div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <div>
                <div className="font-medium text-gray-200">Chat Revival</div>
                <div className="text-xs text-gray-400">Detects stalled conversations and suggests re-engagement</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-gradient-to-r from-violet-600/20 to-purple-600/20 rounded-xl p-4 border border-violet-500/30">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">65%</div>
            <div className="text-sm text-violet-200">of introverts report texting anxiety</div>
            <div className="text-xs text-violet-300/70 mt-2">
              Aura removes the "Digital Bottleneck" - the first 10 messages where small talk feels like a performance.
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-3">
          <h2 className="font-semibold text-purple-200">How to Use</h2>
          <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
            <li>Click the Aura button in any chat app</li>
            <li>Type your raw thought in the overlay</li>
            <li>Adjust the vibe slider for the right tone</li>
            <li>Click "Generate Response" and then "Insert"</li>
            <li>Use "Revive Dead Chat" for stalled conversations</li>
          </ol>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500">
          <p>Aura v1.0.0 • The Cognitive Bridge</p>
          <p className="mt-1">Never let a great personality get stuck behind a "Hey"</p>
        </div>
      </div>
    </div>
  );
}
