'use client';

import { CheckCircle2, Clock, MapPin, Truck, ShieldCheck, Flag } from 'lucide-react';

interface StatusTimelineProps {
  status: string;
  createdAt: string;
}

const STEPS = [
  { id: 'open', label: 'Reported', icon: Clock },
  { id: 'verified', label: 'Verified', icon: ShieldCheck },
  { id: 'assigned', label: 'Task Force Assigned', icon: Flag },
  { id: 'en_route', label: 'En Route', icon: Truck },
  { id: 'arrived', label: 'Arrived on Scene', icon: MapPin },
  { id: 'resolved', label: 'Mission Completed', icon: CheckCircle2 },
];

export default function StatusTimeline({ status, createdAt }: StatusTimelineProps) {
  const getStepIndex = (s: string) => {
    switch (s) {
      case 'open': return 0;
      case 'verified': return 1;
      case 'assigned': return 2;
      case 'en_route': return 3;
      case 'arrived': return 4;
      case 'resolved': return 5;
      default: return 0;
    }
  };

  const currentIndex = getStepIndex(status);

  return (
    <div className="w-full px-4 py-6 bg-gray-50 border-y border-gray-200">
      <div className="relative flex justify-between">
        <div className="absolute top-4 left-0 w-full h-0.5 bg-gray-200 -z-0">
          <div 
            className="h-full bg-orange transition-all duration-500" 
            style={{ width: `${(currentIndex / (STEPS.length - 1)) * 100}%` }}
          />
        </div>

        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < currentIndex;
          const isActive = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted ? 'bg-orange text-white' : 
                  isActive ? 'bg-orange text-white animate-pulse shadow-lg shadow-orange/30' : 
                  'bg-gray-100 text-gray-400 border border-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className={`font-mono text-[8px] uppercase tracking-wider text-center w-12 ${
                isActive ? 'text-orange font-bold' : 'text-gray-400'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
