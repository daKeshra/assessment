/**
 * Optional transactional email adapter.
 *
 * Set EMAIL_PROVIDER_API_KEY to enable Resend-compatible delivery. When it is
 * absent, messages are logged as skipped so local/demo submissions still work.
 * Email failures never block a candidate's saved assessment result.
 */

export interface CandidateEmail {
  to: string;
  name: string;
  reportUrl: string;
}

function provider() {
  return {
    apiKey: process.env.EMAIL_PROVIDER_API_KEY,
    endpoint: process.env.EMAIL_PROVIDER_URL ?? "https://api.resend.com/emails",
    from: process.env.EMAIL_FROM ?? "Africinnovate <notifications@africinnovate.com>",
  };
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ sent: boolean; skipped?: boolean }> {
  const { apiKey, endpoint, from } = provider();
  if (!apiKey) {
    console.info(`[email] skipped (not configured): ${input.subject} -> ${input.to}`);
    return { sent: false, skipped: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`[email] provider returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error("[email] delivery failed", error);
    return { sent: false };
  } finally {
    clearTimeout(timeout);
  }
}

function logoUrl(): string | null {
  const base = process.env.APP_URL;
  if (!base) return null;
  try {
    return new URL("/africinnovate_logo.png", base).toString();
  } catch {
    return null;
  }
}

function emailHeader(): string {
  const logo = logoUrl();
  return logo
    ? `<p><img src="${escapeHtml(logo)}" alt="Africinnovate" height="42" /></p>`
    : "<p><strong>Africinnovate</strong></p>";
}

export function sendCandidateSubmittedEmail({ to, name, reportUrl }: CandidateEmail) {
  return sendEmail({
    to,
    subject: "Your Africinnovate assessment is complete",
    text: `Hi ${name},\n\nYour Technology Career Aptitude Assessment has been received. Your report is available now and will be updated if written answers need staff review:\n${reportUrl}\n\nThis is an aptitude-based learning suggestion, not a guarantee of career success.`,
    html: `${emailHeader()}<p>Hi ${escapeHtml(name)},</p><p>Your Technology Career Aptitude Assessment has been received. Your report is available now and will be updated if written answers need staff review.</p><p><a href="${escapeHtml(reportUrl)}">View your technology profile</a></p><p><small>This is an aptitude-based learning suggestion, not a guarantee of career success.</small></p>`,
  });
}

export function sendCandidateProfileEmail({ to, name, reportUrl }: CandidateEmail) {
  return sendEmail({
    to,
    subject: "Your updated Africinnovate technology profile is ready",
    text: `Hi ${name},\n\nA staff reviewer has completed the review of your written response and your updated profile is ready:\n${reportUrl}`,
    html: `${emailHeader()}<p>Hi ${escapeHtml(name)},</p><p>A staff reviewer has completed the review of your written response.</p><p><a href="${escapeHtml(reportUrl)}">View your updated profile</a></p>`,
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
}
