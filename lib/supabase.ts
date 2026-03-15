import { createClient } from "@supabase/supabase-js";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

export function getSupabaseClient() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export function getDtfBucketName() {
  return process.env.SUPABASE_DTF_BUCKET || process.env.NEXT_PUBLIC_SUPABASE_DTF_BUCKET || "dtf-pdfs";
}