import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = request.headers.get("Authorization") ?? "";

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return response({ error: "يجب تسجيل الدخول." }, 401);

    const { data: caller } = await adminClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (!caller?.is_active || caller.role !== "admin") {
      return response({ error: "هذه العملية متاحة للمدير فقط." }, 403);
    }

    const body = await request.json();
    const action = body.action as "create" | "update" | "toggle";

    if (action === "toggle") {
      if (!body.userId || body.userId === user.id) {
        return response({ error: "لا يمكن تعطيل حساب المدير الحالي." }, 400);
      }
      const { error } = await adminClient
        .from("profiles")
        .update({ is_active: Boolean(body.isActive) })
        .eq("id", body.userId);
      if (error) throw error;
      return response({ success: true });
    }

    const loginId = String(body.loginId ?? "").trim().toLowerCase();
    const fullName = String(body.fullName ?? "").trim();
    const pin = String(body.pin ?? "").trim();
    const role = String(body.role ?? "guardian");
    const relationship = String(body.relationship ?? "");

    if (!/^[a-z0-9_]{3,30}$/.test(loginId)) return response({ error: "المعرّف غير صالح." }, 400);
    if (!fullName) return response({ error: "اكتب الاسم الكامل." }, 400);
    if (!['student', 'guardian', 'admin'].includes(role)) return response({ error: "نوع الحساب غير صالح." }, 400);
    if (!['self', 'brother', 'father', 'mother', 'sister'].includes(relationship)) return response({ error: "صفة الحساب غير صالحة." }, 400);

    const email = `${loginId}@jaafar-learning.local`;

    if (action === "create") {
      if (!/^\d{6}$/.test(pin)) return response({ error: "PIN يجب أن يتكون من 6 أرقام." }, 400);
      const { data, error } = await adminClient.auth.admin.createUser({ email, password: pin, email_confirm: true });
      if (error) throw error;
      const { error: profileError } = await adminClient.from("profiles").upsert({
        id: data.user.id,
        login_id: loginId,
        full_name: fullName,
        role,
        relationship,
        is_active: true,
      });
      if (profileError) throw profileError;
      return response({ success: true });
    }

    if (action === "update") {
      if (!body.userId) return response({ error: "الحساب غير موجود." }, 400);
      const authChanges: Record<string, string> = { email };
      if (pin) {
        if (!/^\d{6}$/.test(pin)) return response({ error: "PIN يجب أن يتكون من 6 أرقام." }, 400);
        authChanges.password = pin;
      }
      const { error: authError } = await adminClient.auth.admin.updateUserById(body.userId, authChanges);
      if (authError) throw authError;
      const { error: profileError } = await adminClient.from("profiles").update({
        login_id: loginId,
        full_name: fullName,
        role,
        relationship,
      }).eq("id", body.userId);
      if (profileError) throw profileError;
      return response({ success: true });
    }

    return response({ error: "العملية غير معروفة." }, 400);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "حدث خطأ غير متوقع." }, 400);
  }
});
