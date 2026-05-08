'use client';

import { useLocation } from './LocationProvider';

export default function LocationPermissionModal() {
  const { permission, error, requestPermission } = useLocation();

  // Don't show if permission is granted
  if (permission === 'granted') {
    return null;
  }

  const isRequesting = permission === 'prompt';
  const isDenied = permission === 'denied';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/95 backdrop-blur-sm">
      <div 
        className="w-full max-w-sm mx-4 p-6 bg-surface-1"
        style={{ clipPath: 'var(--clip-tactical)' }}
      >
        <div className="text-center mb-6">
          <div className={`w-16 h-16 mx-auto mb-4 bg-orange/20 flex items-center justify-center ${isRequesting ? 'animate-pulse' : ''}`}>
            {isRequesting ? (
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#FF6B2B" 
                strokeWidth="2"
                className="animate-spin"
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
              </svg>
            ) : isDenied ? (
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#EF4444" 
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="8" y1="8" x2="16" y2="16" />
                <line x1="16" y1="8" x2="8" y2="16" />
              </svg>
            ) : (
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#FF6B2B" 
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" fill="#FF6B2B" />
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
              </svg>
            )}
          </div>
          
          <h2 className="font-display text-xl font-bold text-ink uppercase tracking-wider mb-2">
            {isRequesting ? 'Waiting for Permission...' : 
             isDenied ? 'Location Access Blocked' : 
             'Location Access Required'}
          </h2>
          
          <p className="font-body text-sm text-muted">
            {isRequesting 
              ? 'Please click "Allow" when your browser asks for location permission.'
              : isDenied
              ? 'Your browser has blocked location access for this site.'
              : 'RescueGrid needs your location to assign you to nearby missions and track your safety during operations.'
            }
          </p>
        </div>

        <div className="space-y-4">
          {/* Instructions for denied state */}
          {isDenied && (
            <div className="bg-alert/10 border border-alert/30 p-4 space-y-3">
              <p className="font-mono text-[11px] text-alert font-semibold">
                To enable location access:
              </p>
              <ol className="font-mono text-[10px] text-ink space-y-2 list-decimal list-inside">
                <li>Click the 🔒 lock icon in your browser's address bar</li>
                <li>Find "Location" in the permissions list</li>
                <li>Change it from "Block" to "Allow"</li>
                <li>Refresh this page</li>
              </ol>
              <p className="font-mono text-[9px] text-dim mt-2 pt-2 border-t border-alert/20">
                Or go to Chrome Settings → Privacy & Security → Site Settings → Location
              </p>
            </div>
          )}

          {/* Feature list - only show when not denied */}
          {!isDenied && !isRequesting && (
            <div className="bg-surface-2 p-3 space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-orange text-lg">📍</span>
                <div>
                  <p className="font-display text-sm text-ink">Mission Assignment</p>
                  <p className="font-mono text-[10px] text-dim">Get assigned to nearby rescue operations</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-orange text-lg">🛟</span>
                <div>
                  <p className="font-display text-sm text-ink">Safety Tracking</p>
                  <p className="font-mono text-[10px] text-dim">DMA can monitor your location for emergency support</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-orange text-lg">⚡</span>
                <div>
                  <p className="font-display text-sm text-ink">Real-time Coordination</p>
                  <p className="font-mono text-[10px] text-dim">Coordinate with your task force effectively</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-caution/10 border border-caution/30 p-3">
              <p className="font-mono text-[11px] text-caution">{error}</p>
            </div>
          )}

          {/* Action buttons */}
          {isDenied ? (
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-surface-3 text-ink font-display text-sm font-bold uppercase tracking-wider hover:bg-surface-2 transition-colors"
              style={{ clipPath: 'var(--clip-tactical)' }}
            >
              Refresh Page After Enabling →
            </button>
          ) : (
            <button
              onClick={requestPermission}
              disabled={isRequesting}
              className={`w-full py-4 font-display text-sm font-bold uppercase tracking-wider transition-colors ${
                isRequesting 
                  ? 'bg-surface-3 text-dim cursor-not-allowed' 
                  : 'bg-orange text-void hover:bg-orange/90'
              }`}
              style={{ clipPath: 'var(--clip-tactical)' }}
            >
              {isRequesting ? 'Waiting for browser...' : 'Allow Location Access →'}
            </button>
          )}
        </div>

        <p className="font-mono text-[9px] text-dim text-center mt-4 uppercase tracking-wider">
          Your location is only shared with authorized DMA personnel
        </p>
      </div>
    </div>
  );
}
