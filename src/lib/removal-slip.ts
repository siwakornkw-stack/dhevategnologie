export type RemovedRow = { productName: string; unitPrice: number; qty: number };

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

// Build an 80/58mm thermal slip listing items removed from saved lines. Not a tax receipt.
export function buildRemovedHtml(rows: RemovedRow[], opts: { shopName: string; width: string; tabName: string; when: string }) {
  const body = rows
    .map((r) => `<tr><td>${escapeHtml(r.productName)}</td><td class="right">x${r.qty}</td><td class="right">${(r.unitPrice * r.qty).toFixed(2)}</td></tr>`)
    .join('');
  const total = rows.reduce((a, r) => a + r.unitPrice * r.qty, 0);
  return `<!doctype html><html><head><meta charset="utf-8"><title>รายการที่ลบ</title><style>
@page { size: ${opts.width} auto; margin: 0; }
body { margin: 0; }
.receipt { width: ${opts.width}; margin: 0 auto; padding: 8px; font-family: 'Tahoma', monospace; font-size: 11px; color: #000; }
.center { text-align: center; } .right { text-align: right; }
hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
table { width: 100%; border-collapse: collapse; } td { padding: 1px 0; }
</style></head><body><div class="receipt">
<div class="center" style="font-weight:bold;font-size:13px;">${escapeHtml(opts.shopName)}</div>
<div class="center" style="font-weight:bold;margin-top:4px;">*** รายการที่ลบ ***</div>
<hr/>
<div>${escapeHtml(opts.when)}</div>
<div>Tab: ${escapeHtml(opts.tabName)}</div>
<hr/>
<table><tbody>${body}</tbody></table>
<hr/>
<table><tbody><tr style="font-weight:bold;font-size:13px;"><td>รวมที่ลบ</td><td class="right">${total.toFixed(2)}</td></tr></tbody></table>
<hr/>
<div class="center" style="margin-top:6px;">บิลรายการที่ลบ (ไม่ใช่ใบเสร็จ)</div>
</div><script>window.onload=function(){window.print();}</script></body></html>`;
}

// Open a print window and write the slip. Returns false if blocked (popup blocker).
export function printRemovedSlip(rows: RemovedRow[], opts: { shopName: string; width: string; tabName: string; when: string }, win?: Window | null) {
  const w = win ?? window.open('', '_blank');
  if (!w) return false;
  w.document.write(buildRemovedHtml(rows, opts));
  w.document.close();
  return true;
}
