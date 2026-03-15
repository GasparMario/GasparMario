import { createClient } from "@supabase/supabase-js";

function getPublicEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

export function getSupabaseBrowserClient() {
  return createClient(
    getPublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

export function getPublicDtfBucketName() {
  return process.env.NEXT_PUBLIC_SUPABASE_DTF_BUCKET || process.env.SUPABASE_DTF_BUCKET || "dtf-pdfs";
}
