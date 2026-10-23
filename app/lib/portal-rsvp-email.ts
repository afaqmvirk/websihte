import { createHash } from "node:crypto";
import QRCode from "qrcode";
import { getApplicationEmailConfig } from "./application-email";
import { OTTAWA_EVENT } from "./ottawa-event";
import { getPortalUrl, RSVP_ATTENDANCE_NOTE, type PortalMember, type PortalRsvp } from "./portal";

export function rsvpTicketCode(token: string) { return `sih:ottawa-2026:${token}`; }

export async function rsvpQrPng(token: string) {
  return QRCode.toBuffer(rsvpTicketCode(token), {width:320,margin:4,errorCorrectionLevel:"M",color:{dark:"#000000",light:"#ffffff"}});
}

export async function createRsvpEmail(member: PortalMember, rsvp: PortalRsvp) {
  const escape = (text: string) => text.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
  const cancelled = Boolean(rsvp.cancelled_at);
  if (!cancelled && !rsvp.qr_token) throw new Error("RSVP ticket is not available");
  const portalUrl = getPortalUrl().toString();
  const paragraphs = [
    `Hi ${member.full_name.trim() || "there"},`,
    cancelled ? "Your RSVP for Stupid Ideas Hackathon Ottawa is cancelled. You're no longer marked as attending." : "Your RSVP for Stupid Ideas Hackathon Ottawa is saved. You're confirmed as attending. This email reflects your latest submitted answers.",
    `${OTTAWA_EVENT.dateLabel} · ${OTTAWA_EVENT.hoursLabel}. Closing ceremonies start at 19:00 EST.`,
    `${OTTAWA_EVENT.venue} · ${OTTAWA_EVENT.address}`,
    ...(cancelled ? [] : [
      `Local to Ottawa: ${rsvp.is_local ? "yes" : "no"}.`,
      ...(!rsvp.is_local ? [`Travel + accommodation plan:\n${rsvp.travel_plan || ""}`] : []),
      "Show the QR code below to an organizer at check-in. Scanning reveals your RSVP; the organizer confirms check-in separately.",
      `Check-in code: ${rsvpTicketCode(rsvp.qr_token!)}`,
      RSVP_ATTENDANCE_NOTE,
    ]),
    cancelled ? "You can RSVP again before your original deadline in the portal. For help after the deadline, reply to this email." : "You can review or edit your RSVP before your deadline in the portal. You can cancel even after the deadline.",
    portalUrl,
    "Best,\n-the stupid ideas hackathon community",
  ];
  const image = cancelled ? null : await rsvpQrPng(rsvp.qr_token!);
  return {
    to:[member.email], subject:cancelled?"Your Stupid Ideas Hackathon Ottawa RSVP is cancelled":"Your Stupid Ideas Hackathon Ottawa RSVP confirmation",
    text:paragraphs.join("\n\n"),
    html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><style>:root{color-scheme:light dark}@media(prefers-color-scheme:dark){body,.email-background{background:#000!important;color:#fff!important}.email-content{color:#fff!important}.email-button{background:#fff!important;color:#000!important;border-color:#fff!important}}[data-ogsc] .email-background,[data-ogsb] .email-background{background:#000!important;color:#fff!important}[data-ogsc] .email-content,[data-ogsb] .email-content{color:#fff!important}[data-ogsc] .email-button,[data-ogsb] .email-button{background:#fff!important;color:#000!important;border-color:#fff!important}</style></head><body class="email-background" style="margin:0;background:#fff;color:#000"><div class="email-background" style="padding:28px 16px;background:#fff;color:#000;font-family:Arial,sans-serif;line-height:1.6"><div class="email-content" style="max-width:600px;margin:auto;color:#000"><p>stupid ideas hackathon / ottawa</p><h1 style="font-size:30px;line-height:1.2">${cancelled?"RSVP cancelled":"RSVP saved"}</h1>${paragraphs.map(paragraph=>paragraph===portalUrl?`<p><a class="email-button" href="${escape(portalUrl)}" style="display:inline-block;padding:12px 20px;background:#000;color:#fff;border:2px solid #000;font-weight:700;text-decoration:none">manage RSVP</a></p>`:`<p style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(paragraph).replace(/\n/g,"<br>")}</p>${paragraph.startsWith("Show the QR code")?'<p><img src="cid:rsvp-qr" width="240" height="240" alt="Your personal check-in QR code" style="display:block;background:#fff;max-width:100%;height:auto"></p>':""}`).join("")}</div></div></body></html>`,
    ...(image?{attachments:[{filename:"ottawa-check-in.png",content:image.toString("base64"),content_type:"image/png",content_id:"rsvp-qr"}]}:{}),
  };
}

export async function sendRsvpEmail(member: PortalMember, rsvp: PortalRsvp) {
  try {
    const config = getApplicationEmailConfig();
    if (!config) return false;
    const body = JSON.stringify({...await createRsvpEmail(member,rsvp),from:`Stupid Ideas Hackathon <${config.from}>`,reply_to:config.replyTo});
    const key = `rsvp-${createHash("sha256").update(member.id).update(rsvp.updated_at).update(body).digest("hex")}`;
    for (let attempt=0;attempt<3;attempt++) {
      try {
        const response = await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${config.apiKey}`,"Content-Type":"application/json","Idempotency-Key":key},body,cache:"no-store",signal:AbortSignal.timeout(8_000)});
        const result = await response.json().catch(()=>null);
        if(response.ok && typeof result?.id === "string") return true;
        if(response.status!==429 && response.status<500 && result?.name!=="concurrent_idempotent_requests") return false;
      } catch { /* Retry the identical payload and key. The saved RSVP remains valid. */ }
      if(attempt<2) await new Promise(resolve=>setTimeout(resolve,300*(attempt+1)));
    }
  } catch { /* Confirmation delivery never undoes a saved RSVP or cancellation. */ }
  return false;
}
