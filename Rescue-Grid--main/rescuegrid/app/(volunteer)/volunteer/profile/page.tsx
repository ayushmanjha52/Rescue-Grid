'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import { useVolunteerSession } from '@/components/volunteer/VolunteerSessionProvider';
import { useLocation } from '@/components/volunteer/LocationProvider';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { EQUIPMENT_OPTIONS, parseList, type SkillCategory } from '@/lib/skills';
import { hasPlaceholderName } from '@/lib/volunteers';

interface ChecklistStep {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  action?: { label: string; onClick: () => void };
}

/** First-run setup: everything Command needs before it can send someone missions. */
function ReadyChecklist({ steps }: { steps: ChecklistStep[] }) {
  const remaining = steps.filter((s) => !s.done).length;
  return (
    <div className="mb-4 p-4 bg-orange/10 border border-orange/30">
      <p className="font-display text-sm font-semibold text-ink uppercase">
        {remaining === 0 ? '✓ You are ready to help' : 'Welcome — get mission-ready'}
      </p>
      <p className="font-body text-[13px] text-muted mt-1 mb-3">
        {remaining === 0
          ? 'Command can see you and send you missions. New missions appear in the Missions tab and as notifications.'
          : `${remaining} step${remaining === 1 ? '' : 's'} left so Command can find you and send you the right missions.`}
      </p>
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li key={step.key} className="flex items-start gap-3">
            <span
              className={`w-5 h-5 shrink-0 flex items-center justify-center font-mono text-[10px] ${
                step.done ? 'bg-ops text-white' : 'bg-surface-3 text-dim'
              }`}
              aria-hidden="true"
            >
              {step.done ? '✓' : i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`font-body text-[13px] ${step.done ? 'text-muted line-through' : 'text-ink font-semibold'}`}>{step.label}</p>
              {!step.done && <p className="font-mono text-[10px] text-dim">{step.hint}</p>}
            </div>
            {!step.done && step.action && (
              <button
                type="button"
                onClick={step.action.onClick}
                className="shrink-0 px-2 py-1 bg-orange text-white font-mono text-[10px] uppercase tracking-wider"
              >
                {step.action.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

interface ResourceAllocation {
  id: string;
  quantity_allocated: number;
  status: string;
  resource: { name: string; type: string; unit: string } | null;
  assignment?: { task: string } | null;
}

const STATUS_DISPLAY: Record<string, { label: string; className: string; icon: string }> = {
  active: { label: 'AVAILABLE', className: 'bg-orange text-white', icon: '🟢' },
  'on-mission': { label: 'ON MISSION', className: 'bg-ops text-white', icon: '🚑' },
  standby: { label: 'STANDBY', className: 'bg-caution text-white', icon: '🟡' },
  offline: { label: 'OFFLINE', className: 'bg-surface-3 text-dim', icon: '⚫' },
};

function typeLabel(type: string | null) {
  switch (type?.toLowerCase()) {
    case 'police': return 'POLICE';
    case 'ndrf': return 'NDRF';
    case 'ngo': return 'NGO';
    default: return 'INDIVIDUAL';
  }
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get('welcome') === '1';
  const { volunteer, loading, setVolunteer } = useVolunteerSession();
  const push = usePushNotifications();
  const location = useLocation();

  const [updating, setUpdating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEquipment, setEditEquipment] = useState<string[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);
  const [saveError, setSaveError] = useState('');
  const [skillCategories, setSkillCategories] = useState<SkillCategory[]>([]);
  const [resources, setResources] = useState<ResourceAllocation[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [pinMessage, setPinMessage] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    fetch('/api/skills')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSkillCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const fetchResources = useCallback(async () => {
    try {
      const res = await fetch('/api/volunteer/resources', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setResources(data.mine || []);
      }
    } catch {
      // offline
    } finally {
      setResourcesLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchResources();
  }, [fetchResources]);

  const volunteerId = volunteer?.id;
  useEffect(() => {
    if (!volunteerId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`profile-resources-${volunteerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_allocation', filter: `volunteer_id=eq.${volunteerId}` }, () => {
        void fetchResources();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [volunteerId, fetchResources]);

  const startEditing = () => {
    if (!volunteer) return;
    // Don't make people delete the "Volunteer 1234" placeholder before typing.
    setEditName(hasPlaceholderName(volunteer.name) ? '' : volunteer.name);
    setEditEquipment(parseList(volunteer.equipment));
    setSelectedSkillIds(volunteer.skill_ids || []);
    setSaveError('');
    setEditMode(true);
  };

  // New sign-ups land here with ?welcome=1: open the form straight away if
  // their name or skills are still missing.
  const [welcomeHandled, setWelcomeHandled] = useState(false);
  if (isWelcome && volunteer && !welcomeHandled) {
    setWelcomeHandled(true);
    if (hasPlaceholderName(volunteer.name) || (volunteer.skill_ids || []).length === 0) {
      setEditName(hasPlaceholderName(volunteer.name) ? '' : volunteer.name);
      setEditEquipment(parseList(volunteer.equipment));
      setSelectedSkillIds(volunteer.skill_ids || []);
      setEditMode(true);
    }
  }

  const toggleStatus = async () => {
    if (!volunteer) return;
    const goOffline = volunteer.status !== 'offline';
    if (goOffline && volunteer.status === 'on-mission' && !window.confirm('You are on a mission. Go offline anyway?')) return;

    setUpdating(true);
    try {
      const res = await fetch('/api/volunteer/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: goOffline ? 'offline' : 'active' }),
      });
      if (res.ok) {
        const data = await res.json();
        setVolunteer({ ...volunteer, status: data.status });
      }
    } catch {
      // offline
    }
    setUpdating(false);
  };

  const handleSave = async () => {
    if (!volunteer) return;
    if (editName.trim().length < 2) {
      setSaveError('Please enter your full name');
      return;
    }
    setSaveError('');
    setUpdating(true);

    try {
      const res = await fetch('/api/volunteer/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          equipment: editEquipment.join(', '),
          skill_ids: selectedSkillIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error || 'Failed to save');
      } else {
        setVolunteer(data);
        setEditMode(false);
      }
    } catch {
      setSaveError('Network error. Please try again.');
    }
    setUpdating(false);
  };

  const toggleSkill = (skillId: number) => {
    setSelectedSkillIds((prev) => (prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]));
  };

  const toggleEquipment = (label: string) => {
    setEditEquipment((prev) => (prev.includes(label) ? prev.filter((e) => e !== label) : [...prev, label]));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="font-mono text-dim text-sm">LOADING...</span>
      </div>
    );
  }

  if (!volunteer) {
    return (
      <div className="p-4">
        <p className="font-mono text-dim text-sm">Unable to load profile. Check your connection.</p>
      </div>
    );
  }

  const statusDisplay = STATUS_DISPLAY[volunteer.status] || STATUS_DISPLAY.offline;
  const skillNames = skillCategories
    .flatMap((c) => c.skill_definitions)
    .filter((s) => (volunteer.skill_ids || []).includes(s.id))
    .map((s) => s.name);
  const customEquipment = editEquipment.filter((e) => !EQUIPMENT_OPTIONS.some((o) => o.label === e));

  const profileComplete = !hasPlaceholderName(volunteer.name) && (volunteer.skill_ids || []).length > 0;
  const pushOk = push.state === 'subscribed' || push.state === 'unsupported' || push.state === 'unconfigured';
  const locationOk = location.permission === 'granted' || location.latitude !== null;
  const checklist: ChecklistStep[] = [
    {
      key: 'profile',
      label: 'Your name and skills',
      hint: 'Command matches missions to skills: first aid, swimming, driving…',
      done: profileComplete,
      action: editMode ? undefined : { label: 'Fill in', onClick: startEditing },
    },
    {
      key: 'alerts',
      label: 'Mission alerts on this phone',
      hint: push.state === 'denied' ? 'Blocked — allow notifications for this site in your browser settings.' : 'So you hear about a mission even when the app is closed.',
      done: pushOk,
      action: push.state === 'default' ? { label: 'Turn on', onClick: () => void push.enable() } : undefined,
    },
    {
      key: 'location',
      label: 'Share your location',
      hint: location.permission === 'denied' ? 'Blocked — allow location for this site in your browser settings.' : 'Command sends the nearest volunteers first.',
      done: locationOk,
      action: location.permission === 'denied' ? undefined : { label: 'Share', onClick: () => void location.requestPermission() },
    },
    {
      key: 'available',
      label: "Mark yourself available",
      hint: 'You can switch to offline any time below.',
      done: volunteer.status !== 'offline',
      action: { label: 'Go available', onClick: () => void toggleStatus() },
    },
  ];
  // Shown on first sign-in, and to anyone Command can't match to missions yet.
  const showChecklist = isWelcome || !profileComplete;

  return (
    <div className="p-4">
      {showChecklist && <ReadyChecklist steps={checklist} />}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-16 h-16 bg-surface-3 flex items-center justify-center font-display text-2xl font-bold text-orange clip-path-tactical shrink-0">
            {volunteer.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold text-ink uppercase truncate">{volunteer.name}</h1>
            <p className="font-mono text-[10px] text-muted">
              {typeLabel(volunteer.type)} · TIER {volunteer.tier ?? 1}
            </p>
          </div>
        </div>

        {!editMode && (
          <button
            onClick={startEditing}
            className="px-3 py-2 bg-surface-3 text-dim font-mono text-[10px] uppercase tracking-wider hover:text-ink transition-colors clip-path-tactical-sm"
          >
            EDIT
          </button>
        )}
      </div>

      <div className="mb-6">
        <p className="font-mono text-[10px] text-dim uppercase mb-2">AVAILABILITY</p>
        <button
          onClick={toggleStatus}
          disabled={updating || editMode}
          className={`w-full flex items-center justify-between p-4 transition-colors clip-path-tactical disabled:opacity-70 ${statusDisplay.className}`}
        >
          <span className="font-display text-sm font-semibold uppercase tracking-wider">{statusDisplay.label}</span>
          <span className="font-mono text-[10px] uppercase">
            {volunteer.status === 'offline' ? 'Tap to go available' : 'Tap to go offline'} {statusDisplay.icon}
          </span>
        </button>
      </div>

      <div className="bg-surface-2 p-4 mb-4 clip-path-tactical">
        <div className="space-y-4">
          {editMode && (
            <div>
              <label htmlFor="profile-name" className="font-mono text-[10px] text-dim uppercase mb-1 block">NAME</label>
              <input
                id="profile-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={80}
                className="w-full px-3 py-2 bg-surface-3 border border-border text-ink font-body text-sm focus:border-orange focus:outline-none"
              />
            </div>
          )}

          <div>
            <p className="font-mono text-[10px] text-dim uppercase mb-1">SKILLS</p>
            {!editMode ? (
              skillNames.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {skillNames.map((name) => (
                    <span key={name} className="px-2 py-1 bg-orange/20 text-orange font-mono text-[10px] uppercase">
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-ink font-body text-sm">{volunteer.skills || 'Not specified'}</p>
              )
            ) : (
              <div className="space-y-3">
                {skillCategories.map((cat) => (
                  <div key={cat.id}>
                    <p className="font-mono text-[9px] text-dim uppercase mb-1.5">{cat.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.skill_definitions.map((skill) => (
                        <button
                          key={skill.id}
                          type="button"
                          aria-pressed={selectedSkillIds.includes(skill.id)}
                          onClick={() => toggleSkill(skill.id)}
                          className={`px-2 py-1 font-mono text-[10px] uppercase transition-colors ${
                            selectedSkillIds.includes(skill.id) ? 'bg-orange text-white' : 'bg-surface-3 text-dim hover:text-ink'
                          }`}
                        >
                          {skill.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="font-mono text-[10px] text-dim uppercase mb-1">EQUIPMENT</p>
            {editMode ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {EQUIPMENT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={editEquipment.includes(option.label)}
                      onClick={() => toggleEquipment(option.label)}
                      className={`px-2 py-1 font-mono text-[10px] uppercase transition-colors ${
                        editEquipment.includes(option.label) ? 'bg-intel text-white' : 'bg-surface-3 text-dim hover:text-ink'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <input
                  aria-label="Other equipment"
                  placeholder="Other equipment (comma separated)"
                  defaultValue={customEquipment.join(', ')}
                  onBlur={(e) => {
                    const custom = parseList(e.target.value);
                    setEditEquipment((prev) => [
                      ...prev.filter((item) => EQUIPMENT_OPTIONS.some((o) => o.label === item)),
                      ...custom,
                    ]);
                  }}
                  className="mt-2 w-full px-3 py-2 bg-surface-3 border border-border text-ink font-body text-sm focus:border-orange focus:outline-none"
                />
              </>
            ) : (
              <p className="text-ink font-body text-sm">{volunteer.equipment || 'Not specified'}</p>
            )}
          </div>

          <div>
            <p className="font-mono text-[10px] text-dim uppercase mb-1">MOBILE</p>
            <p className="text-ink font-body text-sm">{volunteer.mobile_no || 'Not provided'}</p>
          </div>
        </div>
      </div>

      {editMode && (
        <div className="space-y-3 mb-4">
          {saveError && <p className="font-mono text-[11px] text-alert" role="alert">{saveError}</p>}
          <div className="flex gap-2">
            <Button variant="primary" onClick={handleSave} disabled={updating} className="flex-1">
              {updating ? 'SAVING...' : 'SAVE CHANGES'}
            </Button>
            <Button variant="ghost" onClick={() => setEditMode(false)} disabled={updating} className="flex-1">
              CANCEL
            </Button>
          </div>
        </div>
      )}

      <div className="bg-surface-2 p-4 clip-path-tactical">
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[10px] text-dim uppercase">MY RESOURCES</p>
          {resources.length > 0 && (
            <span className="font-mono text-[10px] text-orange">{resources.length} ACTIVE</span>
          )}
        </div>

        {resourcesLoading ? (
          <p className="text-center py-4 font-mono text-[10px] text-dim">Loading resources...</p>
        ) : resources.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-mono text-[10px] text-dim">No active resource allocations</p>
            <Link href="/volunteer/resources" className="font-mono text-[10px] text-orange hover:underline mt-2 inline-block">
              View Resources Page →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {resources.slice(0, 5).map((allocation) => (
              <div key={allocation.id} className="flex items-center justify-between p-2 bg-surface-3">
                <div className="min-w-0">
                  <p className="font-display text-[13px] text-ink truncate">{allocation.resource?.name}</p>
                  <p className="font-mono text-[9px] text-dim truncate">
                    {allocation.quantity_allocated} {allocation.resource?.unit}
                    {allocation.assignment?.task && ` · ${allocation.assignment.task}`}
                  </p>
                </div>
                <span className={`font-mono text-[9px] uppercase px-2 py-1 shrink-0 ${
                  allocation.status === 'in_use' ? 'bg-orange/20 text-orange' : 'bg-ops/20 text-ops'
                }`}>
                  {allocation.status === 'in_use' ? 'IN USE' : 'ALLOCATED'}
                </span>
              </div>
            ))}
            <Link
              href="/volunteer/resources"
              className="block w-full text-center py-2 font-mono text-[10px] text-orange border border-orange/30 hover:bg-orange/10 transition-colors"
            >
              VIEW ALL RESOURCES →
            </Link>
          </div>
        )}
      </div>

      <div className="bg-surface-2 p-4 mt-4 clip-path-tactical">
        <p className="font-mono text-[10px] text-dim uppercase mb-2">PUSH NOTIFICATIONS</p>
        <p className="font-body text-[13px] text-muted mb-3">
          Get alerted about new missions, DMA messages and emergency broadcasts — even when the app is closed.
        </p>
        {push.state === 'subscribed' ? (
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-ops">● ENABLED ON THIS DEVICE</span>
            <button onClick={push.disable} className="font-mono text-[10px] text-dim underline">Turn off</button>
          </div>
        ) : push.state === 'default' ? (
          <Button size="small" onClick={push.enable}>ENABLE NOTIFICATIONS</Button>
        ) : (
          <p className="font-mono text-[10px] text-caution">
            {push.state === 'denied'
              ? 'Notifications are blocked. Allow them in your browser site settings.'
              : push.state === 'unconfigured'
                ? 'Push notifications are not configured on this server.'
                : push.state === 'loading'
                  ? 'Checking...'
                  : 'This browser does not support push notifications. Install the app to your home screen.'}
          </p>
        )}
        {push.error && <p className="mt-2 font-mono text-[10px] text-alert">{push.error}</p>}
      </div>

      <button
        onClick={async () => {
          if (window.confirm('Logout from RescueGrid?')) {
            await fetch('/api/volunteer/logout', { method: 'POST' });
            router.replace('/volunteer/login');
            router.refresh();
          }
        }}
        className="w-full mt-4 py-3 bg-surface-2 text-alert font-mono text-[11px] uppercase tracking-wider hover:bg-alert/10 transition-colors clip-path-tactical"
      >
        LOGOUT
      </button>

      <form
        className="mt-4 p-4 bg-surface-2 clip-path-tactical space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setPinMessage('');
          setPinSaving(true);
          try {
            const res = await fetch('/api/volunteer/pin', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not change your PIN');
            setCurrentPin('');
            setNewPin('');
            setPinMessage('✓ PIN changed');
          } catch (err) {
            setPinMessage(err instanceof Error ? err.message : 'Network error — please try again');
          }
          setPinSaving(false);
        }}
      >
        <p className="font-mono text-[10px] text-dim uppercase">Change PIN</p>
        <input
          type="password"
          value={currentPin}
          onChange={(e) => setCurrentPin(e.target.value)}
          placeholder="Current PIN"
          aria-label="Current PIN"
          autoComplete="current-password"
          className="w-full px-3 py-2 bg-surface-3 border border-border text-ink font-body text-sm focus:border-orange focus:outline-none"
        />
        <input
          type="password"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          placeholder="New PIN (6+ characters)"
          aria-label="New PIN"
          autoComplete="new-password"
          maxLength={72}
          className="w-full px-3 py-2 bg-surface-3 border border-border text-ink font-body text-sm focus:border-orange focus:outline-none"
        />
        {pinMessage && (
          <p className={`font-mono text-[11px] ${pinMessage.startsWith('✓') ? 'text-ops' : 'text-alert'}`} role="status">{pinMessage}</p>
        )}
        <Button type="submit" size="small" disabled={pinSaving || !currentPin || newPin.length < 6}>
          {pinSaving ? 'SAVING…' : 'CHANGE PIN'}
        </Button>
      </form>

      <div className="mt-6 p-4 border border-alert/30">
        <p className="font-mono text-[10px] text-alert uppercase mb-1">Delete my account</p>
        <p className="font-body text-[12px] text-muted mb-3">
          Removes your profile, skills, location and your direct messages with Command. Messages you posted in team chats stay,
          without your name. Finish any mission and return supplies first.
        </p>
        {deleteError && <p className="mb-2 font-mono text-[11px] text-alert" role="alert">{deleteError}</p>}
        <button
          type="button"
          disabled={deleting}
          onClick={async () => {
            const typed = window.prompt('This cannot be undone. Type DELETE to delete your account.');
            if (typed !== 'DELETE') return;
            setDeleting(true);
            setDeleteError('');
            try {
              const res = await fetch('/api/volunteer/me', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: 'DELETE' }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.error || 'Could not delete your account');
              router.replace('/');
              router.refresh();
            } catch (err) {
              setDeleteError(err instanceof Error ? err.message : 'Network error — please try again');
              setDeleting(false);
            }
          }}
          className="font-mono text-[11px] text-alert underline disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete my account and data'}
        </button>
      </div>
    </div>
  );
}

export default function VolunteerProfilePage() {
  return (
    <Suspense fallback={<div className="p-4 font-mono text-dim text-sm">LOADING...</div>}>
      <ProfileContent />
    </Suspense>
  );
}
