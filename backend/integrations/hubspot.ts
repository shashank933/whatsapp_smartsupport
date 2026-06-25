const HUBSPOT_BASE = "https://api.hubapi.com";

function getToken(): string | null {
  return process.env.HUBSPOT_ACCESS_TOKEN || null;
}

function detectContactReason(messageText: string): string {
  const lower = messageText.toLowerCase();

  const emergency = [
    "bleeding", "blood", "emergency", "urgent", "severe pain", "accident",
    "trauma", "abscess", "infection", "hospital", "نزيف", "طوارئ",
    "حادث", "ألم شديد", "ورم",
  ];
  if (emergency.some((kw) => lower.includes(kw))) return "emergency";

  const medical = [
    "diagnose", "sick", "pain", "hurt", "cavity", "sensitive",
    "prescribe", "medicine", "antibiotic", "مرض", "تشخيص", "ألم",
    "تسوس", "حساسية", "عندي", "أعاني",
  ];
  if (medical.some((kw) => lower.includes(kw))) return "medical_advice";

  const booking = [
    "book", "appointment", "schedule", "reserve", "حجز", "موعد",
    "احجز", "أريد", "ابي",
  ];
  if (booking.some((kw) => lower.includes(kw))) return "booking";

  const pricing = [
    "price", "cost", "kwd", "how much", "سعر", "تكلفة", "كم", "بكم",
  ];
  if (pricing.some((kw) => lower.includes(kw))) return "pricing";

  const hoursLocation = [
    "open", "hours", "time", "where", "location", "address",
    "friday", "ساعات", "مفتوح", "أين", "موقع", "عنوان", "الجمعة",
  ];
  if (hoursLocation.some((kw) => lower.includes(kw))) return "hours_location";

  const greeting = [
    "hi", "hello", "hey", "salam", "مرحبا", "السلام", "هلا",
  ];
  if (greeting.some((kw) => lower.includes(kw))) return "greeting";

  return "general_enquiry";
}

async function searchHubSpotContact(phone: string): Promise<string | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: "phone",
                operator: "EQ",
                value: phone,
              },
            ],
          },
        ],
        properties: ["phone", "firstname", "lastname"],
        limit: 1,
      }),
    });

    if (!res.ok) {
      console.warn(`[HubSpot] Search failed for ${phone}: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    if (data.results?.length > 0) {
      return data.results[0].id;
    }
    return null;
  } catch (err) {
    console.error(`[HubSpot] Search error for ${phone}:`, err);
    return null;
  }
}

export async function syncContactToHubSpot(
  phone: string,
  fullName: string,
  messageText?: string
): Promise<void> {
  const token = getToken();
  if (!token) {
    console.log("[HubSpot] No HUBSPOT_ACCESS_TOKEN configured. Skipping sync.");
    return;
  }

  const nameParts = fullName.split(" ");
  const firstname = nameParts[0] || fullName;
  const lastname = nameParts.slice(1).join(" ") || "";
  const reason = messageText ? detectContactReason(messageText) : undefined;

  const properties: Record<string, string> = { phone, firstname, lastname };
  if (reason) {
    properties["whatsapp_contact_reason"] = reason;
  }

  try {
    const existingId = await searchHubSpotContact(phone);

    if (existingId) {
      const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts/${existingId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ properties }),
      });

      if (res.ok) {
        console.log(`[HubSpot] Contact updated: ${fullName} (${phone})`);
      } else {
        const errText = await res.text();
        console.warn(`[HubSpot] Update failed for ${phone}: ${res.status}`, errText);
      }
    } else {
      const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ properties }),
      });

      if (res.ok) {
        console.log(`[HubSpot] Contact created: ${fullName} (${phone}) reason: ${reason || "unknown"}`);
      } else {
        const errText = await res.text();
        console.warn(`[HubSpot] Create failed for ${phone}: ${res.status}`, errText);
      }
    }
  } catch (err) {
    console.error(`[HubSpot] Sync error for ${phone}:`, err);
  }
}
