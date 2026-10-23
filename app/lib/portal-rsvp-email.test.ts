import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createRsvpEmail, sendRsvpEmail } from "./portal-rsvp-email";
import { RSVP_ATTENDANCE_NOTE, type PortalRsvp } from "./portal";

const originalFetch=globalThis.fetch;
const keys=["APPLICATION_EMAIL_API_KEY","APPLICATION_EMAIL_FROM","APPLICATION_EMAIL_TO","APPLICATION_EMAIL_REPLY_TO","PORTAL_URL"] as const;
const original=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
const member={id:"10000000-0000-4000-8000-000000000001",full_name:"Fixture Attendee",email:"attendee@example.invalid"};
const rsvp:PortalRsvp={is_local:false,travel_plan:"Train from Toronto; staying with a friend",updated_at:"2026-10-23T12:00:00Z",cancelled_at:null,qr_token:"20000000-0000-4000-8000-000000000001"};
beforeEach(()=>{Object.assign(process.env,{APPLICATION_EMAIL_API_KEY:"fixture-key",APPLICATION_EMAIL_FROM:"applications@stupideas.com",APPLICATION_EMAIL_TO:"organizer@example.invalid",APPLICATION_EMAIL_REPLY_TO:"applications@stupideas.com",PORTAL_URL:"https://my.stupideas.com"});});
afterEach(()=>{globalThis.fetch=originalFetch;for(const key of keys){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}});

test("RSVP confirmation contains the saved answers, policy and an embedded PNG with the stored ticket",async()=>{
  const email=await createRsvpEmail(member,rsvp);
  assert.deepEqual(email.to,[member.email]);
  assert.ok(email.text.includes(rsvp.travel_plan!));
  assert.ok(email.text.includes(RSVP_ATTENDANCE_NOTE));
  for (const content of [email.text, email.html]) {
    assert.ok(!content.includes(rsvp.qr_token!));
    assert.ok(!content.includes("sih:ottawa-2026:"));
    assert.ok(!content.includes("Scanning reveals your RSVP"));
  }
  assert.ok(email.text.includes("09:30–20:00 EST"));
  assert.ok(email.text.includes("19:00 EST"));
  assert.ok(email.html.includes('src="cid:rsvp-qr"'));
  assert.equal(email.attachments?.[0].content_id,"rsvp-qr");
  const png=Buffer.from(email.attachments![0].content,"base64");
  assert.equal(png.subarray(1,4).toString(),"PNG");
  assert.equal(png.readUInt32BE(16),320);
  assert.equal(png.readUInt32BE(20),320);
  assert.equal("bcc" in email,false);
  assert.equal("cc" in email,false);
});
test("RSVP updates use the new saved answers and escape names and travel text",async()=>{
  const email=await createRsvpEmail({...member,full_name:'<img src=x onerror="alert(1)">'},{...rsvp,travel_plan:"<script>alert(1)</script>"});
  assert.ok(!email.html.includes("<script>alert"));
  assert.ok(!email.html.includes("<img src=x"));
  assert.ok(email.text.includes("<script>alert(1)</script>"));
  const local=await createRsvpEmail(member,{...rsvp,is_local:true,travel_plan:null});
  assert.ok(!local.text.includes("Travel + accommodation plan"));
});
test("cancellation confirms nonattendance and sends no usable QR attachment",async()=>{
  const email=await createRsvpEmail(member,{...rsvp,cancelled_at:"2026-10-24T12:00:00Z"});
  assert.ok(email.subject.includes("cancelled"));
  assert.ok(email.text.includes("no longer marked as attending"));
  assert.ok(!email.text.includes(rsvp.qr_token!));
  assert.equal(email.attachments,undefined);
});
test("delivery retries preserve the payload and key, target only the verified member, and report provider rejection",async()=>{
  const sent:{key:string|null;body:string}[]=[];
  globalThis.fetch=async(_input,init)=>{sent.push({key:new Headers(init?.headers).get("Idempotency-Key"),body:String(init?.body)});return Response.json(sent.length===1?{error:"retry"}:{id:"fixture-email"},{status:sent.length===1?503:200});};
  assert.equal(await sendRsvpEmail(member,rsvp),true);
  assert.equal(sent.length,2);
  assert.deepEqual(sent[0],sent[1]);
  const body=JSON.parse(sent[0].body);
  assert.deepEqual(body.to,[member.email]);
  assert.equal(body.bcc,undefined);
  globalThis.fetch=async()=>Response.json({error:"rejected"},{status:400});
  assert.equal(await sendRsvpEmail(member,rsvp),false);
  // Missing ticket/email delivery cannot alter the saved RSVP object.
  assert.equal(rsvp.cancelled_at,null);
  assert.equal(await sendRsvpEmail(member,{...rsvp,qr_token:undefined}),false);
});
