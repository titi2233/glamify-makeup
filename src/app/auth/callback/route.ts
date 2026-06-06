import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mergeCartForCurrentCustomer } from "@/app/(storefront)/ingresar/actions";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  if (error) return NextResponse.redirect(`${origin}/ingresar?error=oauth`);
  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) return NextResponse.redirect(`${origin}/ingresar?error=oauth`);
    await mergeCartForCurrentCustomer();
  }
  return NextResponse.redirect(`${origin}/cuenta`);
}
