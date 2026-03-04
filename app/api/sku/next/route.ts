import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type NextSkuRpcResponse = number | string | { next_sku?: number | string } | null;

function formatSku(raw: number | string, prefix: string) {
  const value = String(raw).trim();
  if (!value) return null;
  if (value.startsWith(prefix)) return value;
  return `${prefix}${value}`;
}

export async function GET(req: NextRequest) {
  try {
    const prefix = req.nextUrl.searchParams.get("prefix") ?? "SKU-";

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

    const rpcData = data as NextSkuRpcResponse;
    const rawValue =
      rpcData == null
        ? null
        : typeof rpcData === "object"
          ? (rpcData.next_sku ?? null)
          : rpcData;

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

    const sku = formatSku(rawValue, prefix);

    if (!sku) {
      return NextResponse.json(
        { error: "Não foi possível formatar o SKU retornado pela RPC." },
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
}
