/**
 * Official WhatsApp Business Cloud API (Meta). Used only when the shop owner turns on automatic
 * sending and presses Send. Marketing messages outside a customer-started chat must use a template
 * that Meta has approved, and the customer must have opted in (WhatsApp Business Messaging Policy).
 */

export const GRAPH_VERSION = 'v21.0';

export interface CloudApiConfig {
  phoneNumberId: string; // from Meta Business Manager → WhatsApp → API setup
  accessToken: string;
  templateName: string; // an APPROVED template whose body uses {{1}} = customer name
  languageCode: string; // e.g. "en" or "bn"
  includeCode: boolean; // template body also uses {{2}} = discount code
}

export interface Recipient {
  phone: string; // E.164 digits, e.g. 8801711234567
  name: string;
  code?: string;
}

export interface SendResult {
  phone: string;
  name: string;
  ok: boolean;
  error?: string;
}

export function configProblem(cfg: CloudApiConfig): string | null {
  if (!/^\d{5,20}$/.test(cfg.phoneNumberId.trim())) return 'Phone number ID must be the numeric ID from Meta (not your phone number).';
  if (cfg.accessToken.trim().length < 20) return 'Paste the access token from Meta.';
  if (!/^[a-z0-9_]+$/.test(cfg.templateName.trim())) return 'Template name: lower-case letters, numbers and underscores, exactly as approved in Meta.';
  if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(cfg.languageCode.trim())) return 'Language code like "en", "bn" or "en_US".';
  return null;
}

export function buildTemplatePayload(cfg: CloudApiConfig, r: Recipient) {
  const params = [{ type: 'text', text: r.name }];
  if (cfg.includeCode) params.push({ type: 'text', text: r.code || '-' });
  return {
    messaging_product: 'whatsapp',
    to: r.phone.replace(/\D/g, ''),
    type: 'template',
    template: {
      name: cfg.templateName.trim(),
      language: { code: cfg.languageCode.trim() },
      components: [{ type: 'body', parameters: params }],
    },
  };
}

export async function sendTemplate(cfg: CloudApiConfig, r: Recipient, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  try {
    const res = await fetchImpl(`https://graph.facebook.com/${GRAPH_VERSION}/${cfg.phoneNumberId.trim()}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.accessToken.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildTemplatePayload(cfg, r)),
    });
    if (res.ok) return { phone: r.phone, name: r.name, ok: true };
    const body = await res.json().catch(() => ({}));
    return { phone: r.phone, name: r.name, ok: false, error: body?.error?.message || `HTTP ${res.status}` };
  } catch (e: any) {
    return { phone: r.phone, name: r.name, ok: false, error: e?.message || 'Network error' };
  }
}

/**
 * Send one by one with a pause between messages. Stops early if the first messages all fail
 * (wrong token or template), so a bad setting does not fail hundreds of times.
 * shortcut: fixed delay instead of reading Meta's rate-limit headers; fine for small shops, upgrade for >1,000 messages/day.
 */
export async function sendAll(
  cfg: CloudApiConfig,
  recipients: Recipient[],
  onResult: (r: SendResult, done: number) => void,
  shouldStop: () => boolean = () => false,
  delayMs = 1000,
  fetchImpl: typeof fetch = fetch
): Promise<SendResult[]> {
  const results: SendResult[] = [];
  for (const r of recipients) {
    if (shouldStop()) break;
    const res = await sendTemplate(cfg, r, fetchImpl);
    results.push(res);
    onResult(res, results.length);
    if (results.length === 3 && results.every((x) => !x.ok)) break;
    if (delayMs) await new Promise((ok) => setTimeout(ok, delayMs));
  }
  return results;
}
