import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";
import { doctorsDbSchema } from "../_shared/schemas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const sendId = url.searchParams.get("send_id");

  if (!sendId) {
    return htmlResponse("<h2>Invalid link.</h2>", 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return htmlResponse("<h2>Server error.</h2>", 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: doctorsDbSchema() } });

  // Fetch the send record
  const { data: sendRecord, error: sendError } = await supabase
    .from("email_sequence_sends")
    .select("id, enrollment_id, step_id, doctor_id, clicked_at, status")
    .eq("id", sendId)
    .single();

  if (sendError || !sendRecord) {
    return htmlResponse("<h2>Link not found.</h2>", 404);
  }

  // Mark as clicked (idempotent — only update if not already clicked)
  if (!sendRecord.clicked_at) {
    await supabase
      .from("email_sequence_sends")
      .update({ clicked_at: new Date().toISOString(), status: "clicked" })
      .eq("id", sendId);
  }

  // Fetch the enrollment to know the current step
  const { data: enrollment, error: enrollError } = await supabase
    .from("doctor_sequence_enrollments")
    .select("id, doctor_id, current_step, status")
    .eq("id", sendRecord.enrollment_id)
    .single();

  if (enrollError || !enrollment || enrollment.status === "completed") {
    return redirectResponse();
  }

  // Find the step that was clicked to get its step_number
  const { data: clickedStep } = await supabase
    .from("email_sequence_steps")
    .select("step_number")
    .eq("id", sendRecord.step_id)
    .single();

  const clickedStepNumber = clickedStep?.step_number ?? enrollment.current_step;
  const nextStepNumber = clickedStepNumber + 1;

  // Check if next step exists
  const { data: nextStep } = await supabase
    .from("email_sequence_steps")
    .select("id")
    .eq("step_number", nextStepNumber)
    .single();

  if (!nextStep) {
    // This was the last step
    await supabase
      .from("doctor_sequence_enrollments")
      .update({ status: "completed" })
      .eq("id", enrollment.id);
    return redirectResponse();
  }

  // Send the next step by invoking send-sequence-step
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-sequence-step`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ doctorId: sendRecord.doctor_id, stepNumber: nextStepNumber }),
    });
  } catch {
    // Fire-and-forget — don't fail the response if the send fails
  }

  return redirectResponse();
});

function redirectResponse() {
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: "https://www.gutguard.ph",
    },
  });
}

function htmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}
