
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "cloudflare:workers";

export async function createSupabaseServerClient() {
  const url =
    env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Supabase server configuration is missing:", {
      hasSupabaseUrl: Boolean(url),
      hasPublishableKey: Boolean(key),
    });

    throw new Error("Missing Supabase server configuration.");
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Cookie writes may not be available in Server Components.
        }
      },
    },
  });
}

// Maintain compatibility with existing application imports.
export const createClient = createSupabaseServerClient;
