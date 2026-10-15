import { getApplicationEmailConfig, isValidEmail, sendApplicationEmail } from "@/lib/application-email";
import { getApplicationStorageConfig, recordApplicationEmail, storeApplication } from "@/lib/application-storage";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { message: "We could not read this submission." },
      { status: 400 },
    );
  }

  if (formData.get("website")) {
    return Response.json({ message: "Application received." });
  }

  const emailValue = formData.get("email");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  if (!isValidEmail(email)) {
    return Response.json({ message: "Please enter a valid email address." }, { status: 400 });
  }
  formData.set("email", email);

  const textFields = [
    ["fullName", 200], ["affiliation", 500], ["linkedin", 2048],
    ["stupidestThing", 400], ["coolestBuild", 100],
  ] as const;
  for (const [name, maxLength] of textFields) {
    const value = formData.get(name);
    if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
      return Response.json({ message: "Please complete all required fields within their character limits." }, { status: 400 });
    }
    formData.set(name, value.trim());
  }

  const dietary = formData.get("dietaryRestrictions");
  const dietaryOther = formData.get("dietaryRestrictionsOther");
  const otherLink = formData.get("otherLink");
  if (formData.get("event") !== "ottawa-2026" || formData.get("attending") !== "on"
    || !["XS", "S", "M", "L", "XL", "2XL", "3XL"].includes(String(formData.get("tshirtSize")))
    || !["none", "halal", "vegan", "vegetarian", "other"].includes(String(dietary))
    || (dietary === "other" && (typeof dietaryOther !== "string" || !dietaryOther.trim() || dietaryOther.length > 500))
    || (otherLink !== null && (typeof otherLink !== "string" || otherLink.length > 2048))) {
    return Response.json({ message: "Please check your application details and confirm attendance and consent." }, { status: 400 });
  }

  for (const name of ["linkedin", "otherLink"]) {
    const value = formData.get(name);
    if (!value) continue;
    try {
      if (!["https:", "http:"].includes(new URL(String(value)).protocol)) throw new Error();
    } catch {
      return Response.json({ message: "Please enter a valid website URL for your profile links." }, { status: 400 });
    }
  }

  for (const value of formData.values()) {
    if (value instanceof File && value.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        { message: "Each uploaded file must be 4 MB or smaller." },
        { status: 413 },
      );
    }
  }

  const resume = formData.get("resume");
  if (resume instanceof File && resume.size > 0 && !/\.(pdf|doc|docx)$/i.test(resume.name)) {
    return Response.json({ message: "Please upload your résumé as a PDF, DOC, or DOCX file." }, { status: 400 });
  }

  const emailConfig = getApplicationEmailConfig();
  const storageConfig = getApplicationStorageConfig();
  if (!emailConfig || !storageConfig) {
    return Response.json(
      { message: "Applications are temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }

  const receiptFailureMessage = `Application received, but we couldn't email your copy. You don't need to apply again. Contact ${emailConfig.replyTo} if you need a copy.`;
  let applicationStored = false;
  try {
    const application = await storeApplication(formData, storageConfig);
    applicationStored = true;
    if (application.confirmation_email_status === "sent") {
      return Response.json({
        confirmationEmailSent: true,
        message: "We already received this application and sent your copy. Check your spam folder too.",
      });
    }

    const emailId = await sendApplicationEmail(formData, emailConfig);
    await recordApplicationEmail(storageConfig, application.id, emailId);
    if (!emailId) {
      return Response.json(
        {
          confirmationEmailSent: false,
          message: receiptFailureMessage,
        },
      );
    }

    return Response.json({
      confirmationEmailSent: true,
      message: "Application received. A copy is on its way to your email. Check your spam folder too.",
    });
  } catch {
    if (applicationStored) {
      return Response.json({ confirmationEmailSent: false, message: receiptFailureMessage });
    }
    return Response.json(
      {
        message:
          "We could not submit your application. Please try again in a moment.",
      },
      { status: 502 },
    );
  }
}
