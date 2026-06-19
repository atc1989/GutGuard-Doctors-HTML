import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ManageSequenceRequest = {
  action: "get-steps" | "upsert-step" | "delete-step" | "reorder-steps" | "get-progress";
  adminPassword: string;
  step?: { id?: string; stepNumber: number; subject: string; htmlBody: string };
  stepId?: string;
  stepIds?: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as ManageSequenceRequest;
    const { action, adminPassword } = body;

    if (!adminPassword) return jsonResponse({ error: "Missing adminPassword" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Missing Edge Function secrets" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate admin password
    const { error: authError } = await supabase.rpc("assert_wheel_admin", { p_admin_password: adminPassword });
    if (authError) return jsonResponse({ error: "Invalid admin password" }, 403);

    if (action === "get-steps") {
      const { data, error } = await supabase
        .from("email_sequence_steps")
        .select("*")
        .order("step_number", { ascending: true });
      if (error) throw error;
      return jsonResponse({ steps: data ?? [] });
    }

    if (action === "upsert-step") {
      const { step } = body;
      if (!step) return jsonResponse({ error: "Missing step" }, 400);

      if (step.id) {
        const { data, error } = await supabase
          .from("email_sequence_steps")
          .update({ step_number: step.stepNumber, subject: step.subject, html_body: step.htmlBody, updated_at: new Date().toISOString() })
          .eq("id", step.id)
          .select()
          .single();
        if (error) throw error;
        return jsonResponse({ step: data });
      } else {
        const { data, error } = await supabase
          .from("email_sequence_steps")
          .insert({ step_number: step.stepNumber, subject: step.subject, html_body: step.htmlBody })
          .select()
          .single();
        if (error) throw error;
        return jsonResponse({ step: data });
      }
    }

    if (action === "delete-step") {
      const { stepId } = body;
      if (!stepId) return jsonResponse({ error: "Missing stepId" }, 400);

      const { error } = await supabase.from("email_sequence_steps").delete().eq("id", stepId);
      if (error) throw error;

      // Renumber remaining steps
      const { data: remaining } = await supabase
        .from("email_sequence_steps")
        .select("id")
        .order("step_number", { ascending: true });

      if (remaining && remaining.length > 0) {
        for (let i = 0; i < remaining.length; i++) {
          await supabase
            .from("email_sequence_steps")
            .update({ step_number: i + 1 })
            .eq("id", remaining[i].id);
        }
      }

      return jsonResponse({ ok: true });
    }

    if (action === "reorder-steps") {
      const { stepIds } = body;
      if (!stepIds || stepIds.length === 0) return jsonResponse({ error: "Missing stepIds" }, 400);

      for (let i = 0; i < stepIds.length; i++) {
        await supabase
          .from("email_sequence_steps")
          .update({ step_number: i + 1 })
          .eq("id", stepIds[i]);
      }

      return jsonResponse({ ok: true });
    }

    if (action === "get-progress") {
      const { data, error } = await supabase
        .from("doctor_sequence_enrollments")
        .select(`
          id,
          doctor_id,
          current_step,
          enrolled_at,
          status,
          doctor_registrations (full_name, email),
          email_sequence_sends (sent_at, clicked_at, status, step_id)
        `)
        .order("enrolled_at", { ascending: false });

      if (error) throw error;

      const { data: totalStepsData } = await supabase
        .from("email_sequence_steps")
        .select("id", { count: "exact" });
      const totalSteps = totalStepsData?.length ?? 0;

      return jsonResponse({ progress: data ?? [], totalSteps });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
