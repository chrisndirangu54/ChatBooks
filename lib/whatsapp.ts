const GOWA_URL = process.env.NEXT_PUBLIC_GOWA_URL || "http://localhost:3000";

export interface SendWhatsAppMessageOptions {
  /** WhatsApp JID e.g. "254700000000@s.whatsapp.net" or just the phone number "254700000000" */
  phone: string;
  message: string;
  /** Optional Device ID when the Go WhatsApp server is running multi-device */
  deviceId?: string;
}

/**
 * Send a WhatsApp message via the Go WhatsApp Web Multi-Device REST API.
 * The server must be running at NEXT_PUBLIC_GOWA_URL (default: http://localhost:3000).
 * Routes are unprefixed on that server (no /api/v1) unless APP_BASE_PATH is set there.
 */
export async function sendWhatsAppMessage({
  phone,
  message,
  deviceId,
}: SendWhatsAppMessageOptions): Promise<boolean> {
  try {
    const formattedPhone = phone.replace(/[^0-9]/g, "");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (deviceId) {
      headers["X-Device-Id"] = deviceId;
    }

    const response = await fetch(`${GOWA_URL}/send/message`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: formattedPhone,
        message,
      }),
    });

    if (!response.ok) {
      console.error(
        "[ChatBooks] Failed to send WhatsApp message:",
        response.status,
        await response.text()
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("[ChatBooks] Error sending WhatsApp message via GoWA API:", error);
    return false;
  }
}

/**
 * Send a weekly/monthly report summary as a WhatsApp text message
 * (e.g. from the Reports page "Send to WhatsApp" action).
 */
export async function sendWhatsAppReport(phone: string, reportSummary: string): Promise<boolean> {
  return sendWhatsAppMessage({ phone, message: reportSummary });
}

/**
 * Check if the Go WhatsApp server is reachable and has at least one
 * paired (logged-in) device. GET /app/devices returns every registered
 * device as { name, device, jid } — a device counts as "connected" once
 * it has a non-empty jid (i.e. it has completed pairing).
 */
export async function checkWhatsAppStatus(): Promise<{
  reachable: boolean;
  connected: boolean;
  deviceId?: string;
}> {
  try {
    const response = await fetch(`${GOWA_URL}/app/devices`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    // Even a 4xx here (e.g. "device id required" when zero devices exist
    // yet) means the server itself is reachable.
    if (!response.ok) {
      return { reachable: true, connected: false };
    }

    const data = await response.json();
    const devices: Array<{ name?: string; device?: string; jid?: string }> = data?.results ?? [];
    const pairedDevice = devices.find((d) => !!d.jid);

    return {
      reachable: true,
      connected: !!pairedDevice,
      deviceId: pairedDevice?.device,
    };
  } catch {
    return { reachable: false, connected: false };
  }
}
