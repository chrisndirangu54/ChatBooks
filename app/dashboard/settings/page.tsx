"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Sparkles, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useDashboard } from "@/lib/dashboard-context";
import { updateBusinessProfile } from "@/lib/data/business";
import { seedDemoData } from "@/lib/data/seed";
import { checkWhatsAppStatus } from "@/lib/whatsapp";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import type { BusinessProfile } from "@/types";

const CURRENCIES = ["USD", "KES", "NGN", "GHS", "UGX", "TZS", "ZAR"];

export default function SettingsPage() {
  const { user } = useAuth();
  const { profile, transactions, refreshProfile } = useDashboard();
  const [seeding, setSeeding] = useState(false);
  const [waStatus, setWaStatus] = useState<{
    reachable: boolean;
    connected: boolean;
    deviceId?: string;
  } | null>(null);
  const [waChecking, setWaChecking] = useState(true);

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedDemoData(user.uid);
    } finally {
      setSeeding(false);
    }
  };

  const checkWA = async () => {
    setWaChecking(true);
    try {
      const status = await checkWhatsAppStatus();
      setWaStatus(status);
    } finally {
      setWaChecking(false);
    }
  };

  // Auto-check on mount. waChecking already starts true, so this only ever
  // needs to flip it back to false once the promise settles — no setState
  // call happens synchronously within the effect itself.
  useEffect(() => {
    checkWhatsAppStatus()
      .then(setWaStatus)
      .finally(() => setWaChecking(false));
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      {profile ? (
        <BusinessProfileForm
          key={[profile.businessName, profile.ownerName, profile.currency, profile.ownerPhone, profile.kraPin].join("|")}
          profile={profile}
          onSaved={refreshProfile}
        />
      ) : (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 text-sm text-slate-400">
          Loading profile…
        </div>
      )}

      {/* WhatsApp Integration Panel */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-900">WhatsApp Integration</h2>
          {waStatus !== null && (
            <span
              className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                waStatus.connected
                  ? "bg-emerald-50 text-emerald-700"
                  : waStatus.reachable
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {waStatus.connected ? (
                <>
                  <Wifi size={11} /> Connected
                </>
              ) : waStatus.reachable ? (
                <>
                  <WifiOff size={11} /> Server reachable, no device logged in
                </>
              ) : (
                <>
                  <WifiOff size={11} /> Offline
                </>
              )}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Link ChatBooks to your Go WhatsApp Web server so messages and receipts sent
          on WhatsApp are saved here instantly.
        </p>

        {waStatus?.connected && waStatus.deviceId && (
          <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            ✅ Device <span className="font-mono font-semibold">{waStatus.deviceId}</span> is active.
            Incoming WhatsApp chats are reflected here in real-time.
          </div>
        )}

        <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-700">Webhook endpoint (set this in Go WhatsApp):</p>
          <code className="block rounded-lg bg-slate-100 px-3 py-2 text-xs font-mono text-slate-800 break-all">
            {typeof window !== "undefined" ? window.location.origin : "http://localhost:3001"}
            /api/webhook/whatsapp
          </code>
          <p className="text-xs text-slate-500">
            In your <code className="bg-slate-100 px-1 rounded">.env</code> file on the Go WhatsApp server, set:
          </p>
          <pre className="rounded-lg bg-slate-100 p-3 text-xs text-slate-700 overflow-x-auto">
{`WHATSAPP_CHATBOOKS_ENABLED=true
WHATSAPP_CHATBOOKS_WEBHOOK_URL=http://localhost:3001/api/webhook/whatsapp`}
          </pre>
        </div>

        <Button
          onClick={checkWA}
          disabled={waChecking}
          variant="secondary"
          className="mt-4"
        >
          {waChecking ? "Checking…" : "Refresh connection status"}
        </Button>
      </div>

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
  const [ownerPhone, setOwnerPhone] = useState(profile.ownerPhone ?? "");
  const [kraPin, setKraPin] = useState(profile.kraPin ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateBusinessProfile(user.uid, {
        businessName,
        ownerName,
        currency,
        ownerPhone: ownerPhone.trim(),
        kraPin: kraPin.trim(),
      });
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
        <div>
          <Label>Your WhatsApp number</Label>
          <Input
            value={ownerPhone}
            onChange={(e) => setOwnerPhone(e.target.value)}
            placeholder="0712345678"
          />
          {/* This one field is what splits the shop's single WhatsApp number
              into two behaviours, so it's worth spelling out. */}
          <p className="mt-1.5 text-xs text-slate-500">
            {ownerPhone.trim()
              ? "Messages from this number are treated as your bookkeeping. Everyone else who messages the shop gets the ordering menu."
              : "Leave blank and every message is treated as your bookkeeping. Fill it in to let customers order from the same number."}
          </p>
        </div>
        <div>
          <Label>KRA PIN</Label>
          <Input
            value={kraPin}
            onChange={(e) => setKraPin(e.target.value)}
            placeholder="P051234567M"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Printed on eTIMS invoices. Required before sales can be filed with KRA.
          </p>
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
