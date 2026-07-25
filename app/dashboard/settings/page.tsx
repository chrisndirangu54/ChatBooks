"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useDashboard } from "@/lib/dashboard-context";
import { updateBusinessProfile } from "@/lib/data/business";
import { seedDemoData } from "@/lib/data/seed";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import type { BusinessProfile } from "@/types";

const CURRENCIES = ["USD", "KES", "NGN", "GHS", "UGX", "TZS", "ZAR"];

export default function SettingsPage() {
  const { user } = useAuth();
  const { profile, transactions, refreshProfile } = useDashboard();
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedDemoData(user.uid);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {profile ? (
        <BusinessProfileForm
          key={profile.businessName + profile.ownerName + profile.currency}
          profile={profile}
          onSaved={refreshProfile}
        />
      ) : (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 text-sm text-slate-400">
          Loading profile…
        </div>
      )}

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-900">Demo data</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Load a week of sample transactions to preview the dashboard, charts, and reports.
        </p>
        <Button onClick={handleSeed} disabled={seeding} variant="secondary" className="mt-4">
          {seeding ? "Loading…" : "Load demo data"}
        </Button>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h2 className="text-sm font-semibold text-slate-900">Account</h2>
        <p className="mt-1 text-sm text-slate-500">{transactions.length} transactions logged in total.</p>
        <p className="mt-1 text-sm text-slate-500">Signed in as {user?.email}</p>
      </div>
    </div>
  );
}

function BusinessProfileForm({
  profile,
  onSaved,
}: {
  profile: BusinessProfile;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [businessName, setBusinessName] = useState(profile.businessName);
  const [ownerName, setOwnerName] = useState(profile.ownerName);
  const [currency, setCurrency] = useState(profile.currency);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateBusinessProfile(user.uid, { businessName, ownerName, currency });
      onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Business profile</h2>
      <div className="space-y-3.5">
        <div>
          <Label>Business name</Label>
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div>
          <Label>Owner name</Label>
          <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </div>
        <div>
          <Label>Currency</Label>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {saved && <span className="text-sm text-emerald-600">Saved ✅</span>}
        </div>
      </div>
    </div>
  );
}
