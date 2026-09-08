
(function renderImportAudit(){
  const el=document.getElementById("importAuditContent"), a=window.IMPORT_AUDIT, m=window.ORG_REVENUE_METRICS;
  if(!el||!a)return;
  const escAudit=v=>String(v==null?"—":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const money=v=>v==null?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);
  const rows=(items,fn)=>items.length?items.map(fn).join(""):"<li>None</li>";
  el.innerHTML=`<p><strong>${a.summary.sponsorsWithImportedEvidence}</strong> sponsor records matched source evidence; <strong>${a.summary.placementsImported}</strong> placements imported.</p>
  <p><strong>Organization revenue only:</strong> signed ${money(m.signed)} of ${money(m.budget)} budget; total pipeline ${money(m.totalPipeline)}. No totals were assigned to individual sponsors.</p>
  <h4 style="margin:var(--space-12) 0 var(--space-4);">Conflicts &amp; limitations (${a.conflicts.length})</h4><ul>${rows(a.conflicts,x=>`<li><strong>${escAudit(x.sponsor||x.type)}</strong> &mdash; ${escAudit(x.field||x.detail)}${x.imported!=null?`: imported ${escAudit(x.imported)}`:""}${x.existing!=null?`; existing ${escAudit(x.existing)}`:""}</li>`)}</ul>`;
})();




