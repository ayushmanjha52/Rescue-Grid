"use client";

import { useEffect, useState } from "react";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import Button from "@/components/ui/Button";
import { EQUIPMENT_OPTIONS, type SkillCategory } from "@/lib/skills";
import { VOLUNTEER_TYPES, type VolunteerType } from "@/lib/volunteers";

export interface RegisteredVolunteer {
  id: string;
  name: string;
  mobile_no: string;
  type: string | null;
  status: string;
}

interface RegisterVolunteerModalProps {
  onClose: () => void;
  onRegistered: (volunteer: RegisteredVolunteer, assignNow: boolean) => void;
}

/** Command registers someone who turned up to help but doesn't have the app. */
export default function RegisterVolunteerModal({ onClose, onRegistered }: RegisterVolunteerModalProps) {
  useEscapeKey(onClose);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<VolunteerType>("Individual");
  const [skillIds, setSkillIds] = useState<number[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [skillCategories, setSkillCategories] = useState<SkillCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ volunteer: RegisteredVolunteer; pin: string; assignNow: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/skills")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSkillCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const submit = async (assignNow: boolean) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/dma/volunteers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, type, skill_ids: skillIds, equipment: equipment.join(", ") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not register the volunteer");
      // Show the temporary PIN first; it isn't shown again.
      setCreated({ volunteer: data, pin: data.temp_pin, assignNow });
      setSaving(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — please try again");
      setSaving(false);
    }
  };

  const canSubmit = name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10 && !saving;
  const inputClass =
    "w-full px-3 py-2 bg-surface-3 border-b border-border-dim border-l-3 border-l-orange font-body text-sm text-ink placeholder:text-dim focus:outline-none focus:bg-surface-4";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="register-volunteer-title">
      <div className="w-[560px] max-w-full max-h-[90vh] overflow-y-auto bg-surface-2 border-t-2 border-orange clip-path-tactical">
        <div className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 id="register-volunteer-title" className="font-display text-[22px] font-bold uppercase tracking-wide text-ink">
              REGISTER WALK-IN VOLUNTEER
            </h2>
            <button onClick={onClose} className="font-mono text-[11px] text-dim uppercase tracking-wider hover:text-ink">
              ✕ CLOSE
            </button>
          </div>
          <p className="font-body text-[13px] text-muted mb-5">
            For people who turn up to help without the app. You can task them right away and reach them by phone. They also get
            a PIN, so they can sign in to the volunteer app later with this number.
          </p>

          {created && (
            <div className="p-4 bg-ops/10 border border-ops/40" role="status">
              <p className="font-display text-[15px] font-semibold text-ink uppercase">✓ {created.volunteer.name} is registered</p>
              <p className="font-body text-[13px] text-muted mt-2">
                Give them this PIN (it won&apos;t be shown again). They sign in at <strong>/volunteer/login</strong> with{" "}
                <strong>{created.volunteer.mobile_no}</strong> and this PIN, then can change it in their profile.
              </p>
              <p className="mt-3 font-mono text-[32px] font-bold tracking-[0.3em] text-ink" aria-label="Temporary PIN">
                {created.pin}
              </p>
              <div className="flex gap-3 mt-4">
                <Button type="button" variant="primary" onClick={() => onRegistered(created.volunteer, created.assignNow)}>
                  {created.assignNow ? "CONTINUE TO ASSIGN TASK →" : "DONE"}
                </Button>
              </div>
            </div>
          )}

          {!created && error && (
            <div className="mb-4 p-3 bg-alert/10 border border-alert/30 font-mono text-[11px] text-alert" role="alert">
              {error}
            </div>
          )}

          {!created && (
          <>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="walkin-name" className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">NAME *</label>
                <input id="walkin-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Full name" className={inputClass} />
              </div>
              <div>
                <label htmlFor="walkin-phone" className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">MOBILE *</label>
                <input id="walkin-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" className={inputClass} />
              </div>
            </div>

            <div>
              <span className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">TYPE</span>
              <div className="flex gap-2 flex-wrap">
                {VOLUNTEER_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={type === t}
                    onClick={() => setType(t)}
                    className={`px-2 py-1 font-mono text-[10px] uppercase ${type === t ? "bg-orange text-white" : "bg-surface-3 text-dim hover:text-ink"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">SKILLS</span>
              {skillCategories.length === 0 ? (
                <p className="font-mono text-[10px] text-dim">Loading skills…</p>
              ) : (
                <div className="space-y-2">
                  {skillCategories.map((cat) => (
                    <div key={cat.id}>
                      <p className="font-mono text-[9px] text-dim uppercase mb-1">{cat.name}</p>
                      <div className="flex flex-wrap gap-1">
                        {cat.skill_definitions.map((skill) => (
                          <button
                            key={skill.id}
                            type="button"
                            aria-pressed={skillIds.includes(skill.id)}
                            onClick={() => setSkillIds((prev) => toggle(prev, skill.id))}
                            className={`px-2 py-0.5 font-mono text-[9px] uppercase ${
                              skillIds.includes(skill.id) ? "bg-ops text-white" : "bg-surface-3 text-dim hover:text-ink"
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
              <span className="font-mono text-[10px] text-orange uppercase tracking-[0.2em] block mb-1">EQUIPMENT</span>
              <div className="flex flex-wrap gap-1">
                {EQUIPMENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={equipment.includes(option.label)}
                    onClick={() => setEquipment((prev) => toggle(prev, option.label))}
                    className={`px-2 py-0.5 font-mono text-[9px] uppercase ${
                      equipment.includes(option.label) ? "bg-intel text-white" : "bg-surface-3 text-dim hover:text-ink"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>CANCEL</Button>
            <Button type="button" variant="secondary" onClick={() => submit(false)} disabled={!canSubmit}>
              {saving ? "SAVING…" : "REGISTER"}
            </Button>
            <Button type="button" variant="primary" onClick={() => submit(true)} disabled={!canSubmit}>
              REGISTER &amp; ASSIGN TASK →
            </Button>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
