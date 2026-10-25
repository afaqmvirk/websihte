create table public.participant_document_versions (
  version text primary key,
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  documents text not null check (jsonb_typeof(documents::jsonb)='object'),
  created_at timestamptz not null default now()
);
alter table public.participant_document_versions enable row level security;
revoke all on public.participant_document_versions from public, anon, authenticated;
grant select on public.participant_document_versions to service_role;

alter table public.member_rsvps
  add column is_adult boolean,
  add column consent_version text references public.participant_document_versions(version),
  add column signature_name text,
  add column code_accepted_at timestamptz,
  add column liability_accepted_at timestamptz,
  add column media_consent boolean not null default false,
  add column guardian_upload_id uuid,
  add column guardian_uploaded_at timestamptz,
  add column guardian_upload_status text check(guardian_upload_status in ('pending','approved','rejected')),
  add column guardian_filename text,
  add column guardian_review_note text,
  add column guardian_completed_at timestamptz,
  add column guardian_media_consent boolean not null default false;

create table public.member_consent_acceptances (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  version text not null references public.participant_document_versions(version),
  is_adult boolean not null,
  signature_name text not null,
  code_accepted_at timestamptz not null,
  liability_accepted_at timestamptz not null,
  media_consent boolean not null
);
create index member_consent_acceptances_application_idx on public.member_consent_acceptances(application_id);
alter table public.member_consent_acceptances enable row level security;
revoke all on public.member_consent_acceptances from public, anon, authenticated;
grant select, insert on public.member_consent_acceptances to service_role;


insert into public.participant_document_versions(version,digest,documents) values('ottawa-2026-2026-10-24','a5c6f834e29e051fb2183042e26f3b5860c570d4509a0894e2a1c8c68a092303',$document_snapshot${"version":"ottawa-2026-2026-10-24","organizer":"Stupid Ideas Hackathon Community","event":"Stupid Ideas Hackathon Ottawa on November 15, 2026 at Bayview Yards, 7 Bayview Station Rd, Ottawa, Ontario","documents":{"code-of-conduct":{"title":"Code of Conduct and Event Policy","introduction":"This policy applies to everyone taking part in Stupid Ideas Hackathon Ottawa on November 15, 2026 at Bayview Yards, 7 Bayview Station Rd, Ottawa, Ontario, including hackers, organizers, volunteers, mentors, judges, sponsors, and guests. The event is organized by Stupid Ideas Hackathon Community.","sections":[{"title":"Respect and inclusion","paragraphs":["Treat people with respect. Harassment, discrimination, bullying, intimidation, threats, unwanted sexual attention, unwanted physical contact, and abusive or degrading language or imagery are prohibited. Respect people's names, pronouns, boundaries, and requests to stop an interaction.","This applies in the venue, during event activities, in event chats and online spaces, and in communications connected to the event. A joke, project, presentation, or supposedly stupid idea is not an excuse to harm or target someone."]},{"title":"Safety and the venue","paragraphs":["Follow reasonable instructions from organizers, venue staff, and emergency personnel. Respect the venue, accessibility routes, equipment, and other people's property. Do not interfere with fire alarms, safety equipment, security systems, or building operations. Return borrowed items when requested.","Use electronics, batteries, tools, prototypes, and demonstrations safely. Ask an organizer before bringing or operating anything hazardous. Do not bring weapons, illegal substances, or anything that creates a safety risk. Do not attend while impaired in a way that puts you or others at risk.","Respect other people's privacy, confidential information, work, accounts, and devices. Do not record or photograph someone who asks you not to. Do not access systems or data without permission."]},{"title":"Participants under 18","paragraphs":["If you will be under 18 on November 15, 2026, your parent or legal guardian must complete the event's parent/guardian consent form before check-in. You and your guardian are responsible for arranging safe travel and pickup.","Abuse, exploitation, grooming, coercion, and inappropriate relationships involving a minor are prohibited. Never request, create, or exchange sexual or intimate images involving a minor. Adults should avoid unnecessary private meetings or communications with minors; use appropriate event channels or observable settings where reasonably possible.","Report safeguarding concerns to an organizer promptly. Everyone must follow reasonable safeguarding instructions."]},{"title":"Accessibility and support","paragraphs":["Contact applications@stupideas.com as early as reasonably possible to discuss accessibility needs, accommodations, dietary concerns, or support. You may also speak to an organizer at the event."]},{"title":"Reporting a concern","paragraphs":["Tell an organizer in person or email applications@stupideas.com. You can report something that happened to you or that you witnessed. In an emergency or immediate danger, contact emergency services at 911 and notify an organizer when safe to do so.","Organizers will handle reports with care and share information only as reasonably needed to respond, protect people, or meet legal obligations. Do not retaliate against someone for raising a concern in good faith."]},{"title":"Response and enforcement","paragraphs":["Organizers may ask someone to stop conduct, give a warning, restrict access, remove someone from an activity or the event, or disqualify a submission when reasonably necessary for safety or the integrity of the event. Serious matters may be referred to venue security, emergency services, law enforcement, or another appropriate authority where appropriate or legally required.","Participation means agreeing to follow this policy and reasonable event rules. Required consent forms do not excuse conduct that violates this policy."]}]},"liability-waiver":{"title":"Liability Release Waiver","introduction":"THIS DOCUMENT AFFECTS YOUR LEGAL RIGHTS. READ IT CAREFULLY. For adult participants, the release below includes claims for negligence, to the extent permitted by law. It does not release rights or liability that cannot lawfully be waived.","sections":[{"title":"1. Event and parties","paragraphs":["This waiver applies to my attendance and participation in Stupid Ideas Hackathon Ottawa on November 15, 2026 at Bayview Yards, 7 Bayview Station Rd, Ottawa, Ontario (the Event), organized by Stupid Ideas Hackathon Community (the Community). It covers official programming, building and demonstrations, workshops, meals, competitions, and ceremonies organized or authorized as part of this one-day event. Doors open at 9:30 AM EST and the event ends at 8 PM EST.","The Released Parties are the Community; the owners and operators of Bayview Yards acting in connection with the Event; and their organizers, volunteers, officers, employees, agents, mentors, judges, facilitators, and authorized sponsor representatives acting in an Event role. No other event organizer, university, or hackathon association is made a party by this waiver."]},{"title":"2. Assumption of risk","paragraphs":["I understand that participation involves risks that may result in injury, illness, disability, death, or loss or damage to property or data. These include use of premises, furniture, computers, electrical equipment, batteries, hardware, tools, prototypes, demonstrations and workshops; prolonged computer use, fatigue, stress and dehydration; foodborne illness, allergies and allergen cross-contact; the acts or omissions of other people; and emergencies or other known or unknown event risks.","I will consider my abilities, take reasonable precautions, follow safety instructions, and ask for help when needed. I understand that risks may arise from my conduct, other people's conduct, the premises or equipment, or the negligence of a Released Party. I voluntarily accept the risks associated with participation to the fullest extent permitted by law."]},{"title":"3. Adult release of claims","paragraphs":["IF I AM 18 OR OLDER: In consideration of being permitted to participate, I release the Released Parties from claims, demands, actions, damages, losses, expenses and liabilities arising from my attendance or participation, to the fullest extent permitted by law. This includes claims relating to injury, illness, disability or death; loss, theft or damage to property or data; the use or condition of premises or equipment; and negligence or breach of a duty of care by a Released Party, including duties under Ontario's Occupiers' Liability Act to the extent they can lawfully be released.","I understand that this may limit my right to sue even where a Released Party's negligence contributed to my injury or loss. This waiver does not release fraud, wilful misconduct, gross negligence, or any liability or right that applicable law does not allow to be released or waived."]},{"title":"4. Responsibilities and property","paragraphs":["I will follow the Code of Conduct and Event Policy and reasonable safety and emergency instructions. I am responsible for securing my belongings, devices and data and for making appropriate backups. I am responsible for property damage to the extent caused by my negligent, reckless or intentional conduct.","In my own capacity, I agree to indemnify the Released Parties against third-party claims and reasonable costs to the extent caused by my negligent, reckless or intentional conduct or material breach of safety rules. This does not apply to the extent a loss was caused by a Released Party's own negligence or other conduct for which that party is legally responsible."]},{"title":"5. Emergency assistance","paragraphs":["If event personnel reasonably believe I need help because of illness, injury or an emergency, I authorize them to summon or facilitate first aid, venue assistance, paramedics, 911 or other appropriate emergency assistance and disclose information reasonably necessary for that purpose. This does not authorize treatment or substitute consent beyond what applicable law permits. I remain responsible for personal expenses for which I am legally liable."]},{"title":"6. Participants under 18","paragraphs":["MINOR'S ACKNOWLEDGMENT: If I will be under 18 on November 15, 2026, I confirm that I have read this waiver or had it explained in a way I understand. I understand the described risks, want to participate voluntarily, and agree to follow the Code of Conduct, event policies, and safety instructions. My acknowledgment does not replace the required parent or legal guardian consent.","PARENT OR LEGAL GUARDIAN CONSENT: I confirm that I am at least 18 and am this participant's parent or legal guardian with authority to consent. I have read this waiver, understand the risks, and consent to the participant attending and participating in the Event. I will arrange appropriate travel and pickup and authorize the emergency assistance described above for the participant, within the limits of applicable law.","In my own capacity, I release the Released Parties from claims I may have arising from the participant's attendance, to the fullest extent permitted by law. To the extent permitted by law, I agree to the assumption-of-risk and release provisions on the participant's behalf. Nothing in this document releases or waives any right of a minor that a parent or guardian cannot lawfully release or waive."]},{"title":"7. Law, severability, and changes","paragraphs":["Ontario law and applicable Canadian law govern this waiver. Proceedings concerning it shall be brought in Ontario, subject to mandatory legal rules. If a provision is unenforceable, it will be limited or severed to the minimum extent necessary and the remaining provisions will continue to apply. A material amendment requires fresh affirmative acceptance of the amended version."]},{"title":"8. Acknowledgment and electronic signature","paragraphs":["I confirm that I have read and understand this waiver, including the assumption of risk and release of claims for negligence, and that I agree voluntarily. An adult signs in their own capacity. A minor provides the acknowledgment in section 6 and must also have a parent or legal guardian complete the separate parent form.","By affirmatively accepting the relevant checkboxes and typing my full legal name, I consent to using an electronic signature for this document. The signed version and acceptance time will be retained. I can request a copy or discuss an alternative signing arrangement by emailing applications@stupideas.com."]}]},"media-release":{"title":"Optional Media Release Authorization","introduction":"This authorization concerns photos, video, audio, name, likeness, and voice recorded in connection with Stupid Ideas Hackathon Ottawa on November 15, 2026 at Bayview Yards, 7 Bayview Station Rd, Ottawa, Ontario. It is optional. Declining does not affect eligibility or participation.","sections":[{"title":"Permission and purpose","paragraphs":["If I opt in, I grant Stupid Ideas Hackathon Community a non-exclusive, royalty-free, worldwide licence to use, reproduce, publish, display, distribute, crop, resize, caption, subtitle and reasonably edit this media to document and promote the event and the Community's hackathon activities, including websites, social media, event communications, news coverage, and historical or educational archives.","The Community may allow its photographers and other service providers to handle media as reasonably necessary for these purposes, and event sponsors to use authorized media to describe their involvement in this event. This does not authorize unrelated advertising or imply my personal endorsement of a sponsor, product, or service without separate express consent."]},{"title":"Limits and ownership","paragraphs":["Media must not materially distort my statements or depiction or falsely attribute statements to me. This permission does not transfer ownership of or give a licence to my projects, source code, inventions, submissions, résumé, or confidential information, except material incidentally visible or audible in authorized media.","I will not receive compensation for authorized uses. No media use is promised. To the extent permitted by law, I release claims arising solely from uses within this authorization; the release does not cover uses outside it, fraud, wilful misconduct, or liability that cannot lawfully be released."]},{"title":"Under-18 participants","paragraphs":["For a participant under 18 on the event date, media permission takes effect only when both the participant opts in and their parent or legal guardian separately authorizes it on the parent form. Declining media permission never prevents completion of the required participation forms."]},{"title":"Withdrawal and changes","paragraphs":["I may withdraw permission for future uses by emailing applications@stupideas.com. The Community will take reasonable steps to stop new uses under its control and notify sponsors to whom it supplied the media. Withdrawal does not undo lawful prior uses or require recalling distributed print, published, or archival material beyond reasonable control.","This permission remains in effect until withdrawn, subject to applicable law. A material expansion of its purposes or permitted recipients requires additional notice and fresh consent where required by law."]}]}},"parentDeclarations":["I am at least 18 and am the participant's parent or legal guardian with authority to give this consent. I have read the attached Code of Conduct and Event Policy and Liability Release Waiver, including the risks, negligence release, and limits on waiving a minor's rights. I consent to the participant attending and participating in this event and agree to the parent/guardian provisions in section 6 of the waiver in my own capacity and, only to the extent permitted by law, on the participant's behalf.","I will arrange appropriate travel and pickup, discuss the event rules and risks with the participant, and authorize the emergency assistance described in the waiver within the limits of applicable law. Nothing in this form waives a right of a minor that I cannot lawfully waive.","By signing below, I confirm that this information is accurate and I give this consent voluntarily. If I sign electronically, I intend my electronic signature to be my signature for this form. The signed form and its review record will be retained privately. Contact applications@stupideas.com for a copy or an alternative signing arrangement."],"parentFormDigest":"13f0abb7d14e4de442796427fff5740d1df9144a03d2bee605f4000b6aa08429"}$document_snapshot$);

create table public.member_guardian_uploads (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.member_rsvps(application_id) on delete cascade,
  version text not null references public.participant_document_versions(version),
  storage_path text not null unique,
  filename text not null check (char_length(filename) between 1 and 180),
  content_type text not null check (content_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes integer not null check (size_bytes between 1 and 4000000),
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  uploaded_at timestamptz not null default now(),
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_note text check (char_length(review_note)<=1000),
  media_consent boolean not null default false,
  check ((review_status='pending' and reviewed_at is null and reviewed_by is null)
    or (review_status<>'pending' and reviewed_at is not null and reviewed_by is not null))
);
create index member_guardian_uploads_application_idx on public.member_guardian_uploads(application_id,uploaded_at desc);
create index member_guardian_uploads_version_idx on public.member_guardian_uploads(version);
create index member_guardian_uploads_reviewer_idx on public.member_guardian_uploads(reviewed_by);
alter table public.member_guardian_uploads enable row level security;
revoke all on public.member_guardian_uploads from public,anon,authenticated;
grant select,insert,update on public.member_guardian_uploads to service_role;
alter table public.member_rsvps add constraint member_rsvps_guardian_upload_fkey foreign key(guardian_upload_id) references public.member_guardian_uploads(id);
create index member_rsvps_guardian_upload_idx on public.member_rsvps(guardian_upload_id);
create index member_rsvps_consent_version_idx on public.member_rsvps(consent_version);
create index member_consent_acceptances_version_idx on public.member_consent_acceptances(version);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('participant-consents','participant-consents',false,4000000,array['application/pdf','image/jpeg','image/png']);
-- No browser storage policies: uploads and reads go through the authenticated server.
comment on table public.member_guardian_uploads is 'Private signed parent forms. Each upload is retained separately; only a pending current upload can receive an organizer decision. No automatic check-in.';

create function public.record_guardian_upload(p_application_id uuid,p_email text,p_storage_path text,p_filename text,p_content_type text,p_size integer,p_digest text)
returns void language plpgsql security invoker set search_path='' as $$
declare saved public.member_rsvps%rowtype; upload_id uuid;
begin
  perform 1 from public.applications a where a.id=p_application_id and a.admission_status='accepted'
    and a.id=(select b.id from public.applications b where b.event_slug='ottawa-2026' and b.intake_status='complete'
      and lower(btrim(b.email))=lower(btrim(p_email)) order by b.created_at desc,b.id desc limit 1) for share;
  if not found then raise exception 'Accepted application required' using errcode='42501'; end if;
  select * into saved from public.member_rsvps r where r.application_id=p_application_id for update;
  if not found or saved.cancelled_at is not null or saved.is_adult is distinct from false
    or saved.consent_version is distinct from 'ottawa-2026-2026-10-24' or saved.code_accepted_at is null or saved.liability_accepted_at is null
    then raise exception 'guardian_upload_ineligible' using errcode='P0001'; end if;
  if p_storage_path !~ ('^' || p_application_id::text || '/[a-f0-9-]{36}\.(pdf|png|jpg)$')
    then raise exception 'guardian_upload_invalid' using errcode='22023'; end if;
  if (select count(*) from public.member_guardian_uploads g where g.application_id=p_application_id and g.uploaded_at>clock_timestamp()-interval '1 hour')>=10
    then raise exception 'guardian_upload_rate_limited' using errcode='P0001'; end if;
  insert into public.member_guardian_uploads(application_id,version,storage_path,filename,content_type,size_bytes,digest)
    values(p_application_id,saved.consent_version,p_storage_path,p_filename,p_content_type,p_size,p_digest) returning id into upload_id;
  update public.member_rsvps set guardian_upload_id=upload_id,guardian_uploaded_at=clock_timestamp(),guardian_upload_status='pending',
    guardian_filename=p_filename,guardian_completed_at=null,guardian_media_consent=false,guardian_review_note=null where application_id=p_application_id;
end;
$$;

create function public.organizer_review_guardian_upload(reviewer_user_id uuid,p_application_id uuid,p_upload_id uuid,p_approved boolean,p_note text,p_media_consent boolean,p_confirmed boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare saved public.member_rsvps%rowtype; reviewed public.member_guardian_uploads%rowtype; decision_time timestamptz:=clock_timestamp();
begin
  if not exists(select 1 from private.organizer_reviewers o where o.user_id=reviewer_user_id and o.enabled)
    then raise exception 'Organizer access required' using errcode='42501'; end if;
  if p_confirmed is distinct from true or p_approved is null or p_media_consent is null or p_note is null or char_length(p_note)>1000
    or (not p_approved and char_length(btrim(p_note))=0) then raise exception 'guardian_review_invalid' using errcode='22023'; end if;
  perform 1 from public.applications a where a.id=p_application_id and a.admission_status='accepted' and a.event_slug='ottawa-2026' and a.intake_status='complete'
    and a.id=(select b.id from public.applications b where b.event_slug='ottawa-2026' and b.intake_status='complete'
      and lower(btrim(b.email))=lower(btrim(a.email)) order by b.created_at desc,b.id desc limit 1) for share;
  if not found then raise exception 'guardian_review_ineligible' using errcode='P0001'; end if;
  select * into saved from public.member_rsvps r where r.application_id=p_application_id for update;
  if not found or saved.cancelled_at is not null or saved.is_adult is distinct from false or saved.guardian_upload_id is distinct from p_upload_id
    or saved.consent_version is distinct from 'ottawa-2026-2026-10-24' then raise exception 'guardian_review_stale' using errcode='P0001'; end if;
  select * into reviewed from public.member_guardian_uploads g where g.id=p_upload_id and g.application_id=p_application_id for update;
  if not found or reviewed.review_status<>'pending' or reviewed.version is distinct from saved.consent_version
    then raise exception 'guardian_review_stale' using errcode='P0001'; end if;
  update public.member_guardian_uploads set review_status=case when p_approved then 'approved' else 'rejected' end,
    reviewed_at=decision_time,reviewed_by=reviewer_user_id,review_note=nullif(btrim(p_note),''),media_consent=p_approved and p_media_consent where id=p_upload_id;
  update public.member_rsvps set guardian_upload_status=case when p_approved then 'approved' else 'rejected' end,
    guardian_completed_at=case when p_approved then decision_time else null end,guardian_media_consent=p_approved and p_media_consent,
    guardian_review_note=nullif(btrim(p_note),'') where application_id=p_application_id;
  insert into public.organizer_audit(action,actor_id,application_id) values(case when p_approved then 'guardian_form_approved' else 'guardian_form_rejected' end,reviewer_user_id,p_application_id);
end;
$$;

alter table public.organizer_audit drop constraint organizer_audit_action_check;
alter table public.organizer_audit add constraint organizer_audit_action_check check(action in (
  'signin_code_requested','signin_success','mfa_verified','queue_viewed','application_viewed','resume_viewed','review_saved','signed_out',
  'admission_accepted','admission_rejected','admission_email_sent','admission_email_failed','rsvp_checked_in','guardian_form_approved','guardian_form_rejected'));

create function public.member_rsvp_consent_ready(p_application_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce((select r.consent_version='ottawa-2026-2026-10-24'
    and r.code_accepted_at is not null and r.liability_accepted_at is not null
    and char_length(btrim(r.signature_name)) between 2 and 160
    and (r.is_adult=true or (r.is_adult=false and r.guardian_completed_at is not null and exists(
      select 1 from public.member_guardian_uploads g where g.id=r.guardian_upload_id and g.application_id=r.application_id
        and g.version=r.consent_version and g.review_status='approved')))
    from public.member_rsvps r where r.application_id=p_application_id),false);
$$;

create function public.record_member_consent(
  p_application_id uuid,p_email text,p_is_adult boolean,p_signature text,
  p_code_accepted boolean,p_waiver_accepted boolean,p_media_consent boolean
)
returns setof public.member_rsvps language plpgsql security invoker set search_path='' as $$
declare latest_id uuid; accepted_at timestamptz:=clock_timestamp(); saved public.member_rsvps%rowtype;
begin
  if p_is_adult is null or p_code_accepted is distinct from true or p_waiver_accepted is distinct from true
    or p_media_consent is null or p_signature is null or char_length(btrim(p_signature)) not between 2 and 160
    then raise exception 'member_consent_invalid' using errcode='22023'; end if;
  select a.id into latest_id from public.applications a where a.event_slug='ottawa-2026'
    and lower(btrim(a.email))=lower(btrim(p_email)) and a.intake_status='complete'
    order by a.created_at desc,a.id desc limit 1;
  perform 1 from public.applications a where a.id=p_application_id and a.id=latest_id
    and a.admission_status='accepted' for share;
  if not found then raise exception 'Accepted application required' using errcode='42501'; end if;
  select * into saved from public.member_rsvps r where r.application_id=p_application_id for update;
  if not found or saved.cancelled_at is not null then raise exception 'member_rsvp_inactive' using errcode='P0001'; end if;
  -- This endpoint intentionally permits required-form completion after the RSVP
  -- deadline. It cannot create/reactivate an RSVP or edit travel answers.
  update public.member_rsvps r set is_adult=p_is_adult,signature_name=btrim(p_signature),
    consent_version='ottawa-2026-2026-10-24',code_accepted_at=accepted_at,liability_accepted_at=accepted_at,
    media_consent=p_media_consent where r.application_id=p_application_id;
  -- A different named participant or age answer needs a fresh parent form. Prior
  -- uploads and decisions remain archived; no acceptance is invented.
  if saved.signature_name is distinct from btrim(p_signature) or saved.is_adult is distinct from p_is_adult
    or saved.consent_version is distinct from 'ottawa-2026-2026-10-24' then
    update public.member_rsvps set guardian_upload_id=null,guardian_uploaded_at=null,guardian_upload_status=null,
      guardian_filename=null,guardian_review_note=null,guardian_completed_at=null,guardian_media_consent=false where application_id=p_application_id;
  end if;
  insert into public.member_consent_acceptances(application_id,version,is_adult,signature_name,code_accepted_at,liability_accepted_at,media_consent)
    values(p_application_id,'ottawa-2026-2026-10-24',p_is_adult,btrim(p_signature),accepted_at,accepted_at,p_media_consent);
  return query select r.* from public.member_rsvps r where r.application_id=p_application_id;
end;
$$;

create function public.save_member_rsvp_with_consent(
  p_application_id uuid,p_email text,p_is_local boolean,p_travel_plan text,
  p_is_adult boolean,p_signature text,p_code_accepted boolean,p_waiver_accepted boolean,p_media_consent boolean
)
returns setof public.member_rsvps language plpgsql security invoker set search_path='' as $$
begin
  perform public.save_member_rsvp(p_application_id,p_email,p_is_local,p_travel_plan);
  return query select * from public.record_member_consent(p_application_id,p_email,p_is_adult,p_signature,p_code_accepted,p_waiver_accepted,p_media_consent);
end;
$$;


-- Record lookup is read-only; check-in always needs the existing explicit confirmation.
create or replace function public.organizer_lookup_rsvp(reviewer_user_id uuid,ticket_token uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare applicant public.applications%rowtype; rsvp public.member_rsvps%rowtype; ticket_status text;
begin
  if not exists(select 1 from private.organizer_reviewers o where o.user_id=reviewer_user_id and o.enabled)
    then raise exception 'Organizer access required' using errcode='42501'; end if;
  select * into rsvp from public.member_rsvps r where r.qr_token=ticket_token;
  if not found then raise exception 'check_in_invalid_ticket' using errcode='P0002'; end if;
  select * into applicant from public.applications a where a.id=rsvp.application_id;
  ticket_status:=case when applicant.admission_status<>'accepted' or applicant.intake_status<>'complete'
      or applicant.event_slug<>'ottawa-2026' or applicant.id is distinct from(select a.id from public.applications a
        where a.event_slug='ottawa-2026' and a.intake_status='complete' and lower(btrim(a.email))=lower(btrim(applicant.email))
        order by a.created_at desc,a.id desc limit 1) then 'not_eligible'
    when rsvp.cancelled_at is not null then 'cancelled'
    when rsvp.checked_in_at is not null then 'already_checked_in'
    when not public.member_rsvp_consent_ready(rsvp.application_id) then 'consent_required'
    else 'ready' end;
  return jsonb_build_object('status',ticket_status,'application_id',applicant.id,'full_name',applicant.full_name,
    'email',applicant.email,'affiliation',applicant.affiliation,'checked_in_at',rsvp.checked_in_at,
    'guardian_required',rsvp.is_adult=false,'guardian_completed',rsvp.guardian_completed_at is not null);
end;
$$;

create or replace function public.organizer_check_in_rsvp(reviewer_user_id uuid,ticket_token uuid,confirmed boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare target_id uuid; applicant public.applications%rowtype; rsvp public.member_rsvps%rowtype;
begin
  if not exists(select 1 from private.organizer_reviewers o where o.user_id=reviewer_user_id and o.enabled)
    then raise exception 'Organizer access required' using errcode='42501'; end if;
  if confirmed is distinct from true then raise exception 'check_in_confirmation_required' using errcode='22023'; end if;
  select r.application_id into target_id from public.member_rsvps r where r.qr_token=ticket_token;
  if target_id is null then raise exception 'check_in_invalid_ticket' using errcode='P0002'; end if;
  select * into applicant from public.applications a where a.id=target_id for update;
  if applicant.admission_status<>'accepted' or applicant.intake_status<>'complete' or applicant.event_slug<>'ottawa-2026'
    or applicant.id is distinct from(select a.id from public.applications a where a.event_slug='ottawa-2026' and a.intake_status='complete'
      and lower(btrim(a.email))=lower(btrim(applicant.email)) order by a.created_at desc,a.id desc limit 1)
    then raise exception 'check_in_not_eligible' using errcode='P0001'; end if;
  select * into rsvp from public.member_rsvps r where r.qr_token=ticket_token for update;
  if not found then raise exception 'check_in_invalid_ticket' using errcode='P0002'; end if;
  if rsvp.cancelled_at is not null then raise exception 'check_in_cancelled' using errcode='P0001'; end if;
  if rsvp.checked_in_at is not null then return public.organizer_lookup_rsvp(reviewer_user_id,ticket_token); end if;
  if not public.member_rsvp_consent_ready(target_id) then raise exception 'check_in_consent_required' using errcode='P0001'; end if;
  update public.member_rsvps r set checked_in_at=clock_timestamp(),checked_in_by=reviewer_user_id where r.application_id=target_id;
  insert into public.organizer_audit(action,actor_id,application_id) values('rsvp_checked_in',reviewer_user_id,target_id);
  return public.organizer_lookup_rsvp(reviewer_user_id,ticket_token)||'{"status":"checked_in"}'::jsonb;
end;
$$;


revoke all on function public.member_rsvp_consent_ready(uuid),public.record_member_consent(uuid,text,boolean,text,boolean,boolean,boolean),
public.save_member_rsvp_with_consent(uuid,text,boolean,text,boolean,text,boolean,boolean,boolean),
public.record_guardian_upload(uuid,text,text,text,text,integer,text),public.organizer_review_guardian_upload(uuid,uuid,uuid,boolean,text,boolean,boolean),
public.organizer_lookup_rsvp(uuid,uuid),public.organizer_check_in_rsvp(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.member_rsvp_consent_ready(uuid),public.record_member_consent(uuid,text,boolean,text,boolean,boolean,boolean),
public.save_member_rsvp_with_consent(uuid,text,boolean,text,boolean,text,boolean,boolean,boolean),
public.record_guardian_upload(uuid,text,text,text,text,integer,text),public.organizer_review_guardian_upload(uuid,uuid,uuid,boolean,text,boolean,boolean),
public.organizer_lookup_rsvp(uuid,uuid),public.organizer_check_in_rsvp(uuid,uuid,boolean) to service_role;
