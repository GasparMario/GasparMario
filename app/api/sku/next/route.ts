import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { extractNextSkuRpcValue, normalizeNumericSku } from "@/lib/sku";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.rpc("next_sku");

    if (error) {
      return NextResponse.json(
        {
          error: "Falha ao gerar SKU via Supabase RPC `next_sku`.",
          details: error.message
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
          }
        }
      );
    }

    const rawValue = extractNextSkuRpcValue(data);

    if (rawValue == null) {
      return NextResponse.json(
        { error: "RPC `next_sku` retornou vazio." },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
          }
        }
      );
    }

    const sku = normalizeNumericSku(rawValue);

    if (!sku) {
      return NextResponse.json(
        { error: "RPC `next_sku` retornou um valor não numérico." },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
          }
        }
      );
    }

    return NextResponse.json(
      { sku },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
        }
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "Erro interno ao gerar SKU.",
        details: err instanceof Error ? err.message : "Erro desconhecido"
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
        }
      }
    );
  }

