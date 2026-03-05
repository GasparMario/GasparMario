import assert from "node:assert/strict";
import { buildOrderedVariations, extractNextSkuRpcValue, normalizeNumericSku } from "../lib/sku";

function run() {
  assert.equal(normalizeNumericSku("100001"), "100001");
  assert.equal(normalizeNumericSku(" 100001 "), "100001");
  assert.equal(normalizeNumericSku(12345), "12345");
  assert.equal(normalizeNumericSku("10A"), null);
  assert.equal(normalizeNumericSku(""), null);

  assert.equal(extractNextSkuRpcValue(100), 100);
  assert.equal(extractNextSkuRpcValue("101"), "101");
  assert.equal(extractNextSkuRpcValue({ next_sku: 102 }), 102);
  assert.equal(extractNextSkuRpcValue({}), null);
  assert.equal(extractNextSkuRpcValue(null), null);

  const colors = [
    { slug: "preto", name: "Preto" },
    { slug: "off-white", name: "Off White" }
  ];
  const sizes = ["G", "P"];

  const ordered = buildOrderedVariations(colors, sizes);
  const keys = ordered.map(({ color, size }) => `${color.slug}::${size}`);

  assert.deepEqual(keys, ["off-white::G", "off-white::P", "preto::G", "preto::P"]);

  const suffixes = ordered.map((_, idx) => String(idx + 1).padStart(2, "0"));
  assert.deepEqual(suffixes, ["01", "02", "03", "04"]);

  console.log("sku.test.ts: all assertions passed");
}

run();
