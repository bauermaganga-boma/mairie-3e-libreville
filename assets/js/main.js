/* Mairie du 3e arrondissement de Libreville — comportements du site public */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const IMG = n => `assets/img/${n}.jpg`;
const escH = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fdate = d => new Date(d).toLocaleDateString("fr-FR", {day:"numeric", month:"long", year:"numeric"});
const arrL = n => !+n ? "Mairie centrale" : n + (+n === 1 ? "er" : "e") + " arrondissement";
const arrS = n => n + (+n === 1 ? "er" : "e");
const arrN = () => (typeof ARR !== "undefined" && ARR && ARR.n) || 3;
const A3 = () => (typeof ARR !== "undefined" && ARR) || ARRONDISSEMENTS[0];
// Les mentions « [À CONFIRMER] » du dossier deviennent une pastille visible
const conf = s => escH(s).replace(/\s*[\[(]\s*(?:À|à) confirmer[^\])]*[\])]/gi, ' <span class="chip warn conf">à confirmer</span>');
const ss = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } };

function toast(msg, type = "") {
  let t = $(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.className = "toast " + type; t.textContent = msg;
  requestAnimationFrame(() => t.classList.add("on"));
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 3400);
}

/* ---------- Retour en arrière : chaque fenêtre, menu ou visionneuse ouverte crée une étape
   d'historique ; la touche « retour » du téléphone (ou le bouton « ← Retour ») la referme. ---------- */
const Back = {
  stack:[], skip:0,
  open(close) { if (this.stack.includes(close)) return; this.stack.push(close); history.pushState({lbvOverlay:this.stack.length}, ""); },
  close(close) { const i = this.stack.lastIndexOf(close); if (i < 0) return; this.stack.splice(i, 1); this.skip++; history.back(); },
};
addEventListener("popstate", () => {
  if (Back.skip) { Back.skip--; if (Back.stack.length) history.pushState({lbvOverlay:Back.stack.length}, ""); return; }
  const c = Back.stack.pop(); if (c) c(true);
});
// Bouton « retour » des pages : page précédente du site, sinon l'accueil
function goBack() { if (document.referrer && document.referrer.startsWith(location.origin) && history.length > 1) history.back(); else location.href = "index.html"; }

const BACK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
function hideModal(fromPop) {
  const m = $("#modal"); if (!m || !m.classList.contains("on")) return;
  if (fromPop && m.dataset.lock) { Back.open(hideModal); return; }   // paiement en cours : on ne ferme pas
  delete m.dataset.lock; m.classList.remove("on"); document.body.classList.remove("ov-open");
  if (!fromPop) Back.close(hideModal);
}
function modal(title, html) {
  let m = $("#modal");
  if (!m) {
    m = document.createElement("div"); m.id = "modal"; m.className = "modal";
    m.innerHTML = '<div class="box" role="dialog" aria-modal="true"><div class="mh"><button class="mback" aria-label="Retour">' + BACK_ICON + '<span>Retour</span></button><h3></h3><button class="x" aria-label="Fermer">×</button></div><div class="mb"></div></div>';
    document.body.appendChild(m);
    m.addEventListener("click", e => { if ((e.target === m || e.target.closest(".x") || e.target.closest(".mback")) && !m.dataset.lock) hideModal(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !m.dataset.lock) hideModal(); });
  }
  delete m.dataset.lock;
  $("h3", m).textContent = title; $(".mb", m).innerHTML = html;
  if (!m.classList.contains("on")) { m.classList.add("on"); document.body.classList.add("ov-open"); Back.open(hideModal); }
  $(".box", m).scrollTop = 0;
  return m;
}
const closeModal = () => hideModal();
window.pogCloseModal = closeModal;

/* ---------- Chargement de bibliothèques (à la demande) ---------- */
const _scripts = {};
function loadScript(src) {
  return _scripts[src] || (_scripts[src] = new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Chargement impossible, vérifiez votre connexion.")); document.head.appendChild(s); }));
}

/* ---------- Documents authentifiés : badge ---------- */
function acteBadge(a, big) {
  if (!a) return "";
  const ok = a.statut === "Authentifié", bad = a.statut === "Rejeté";
  return `<div class="auth-badge ${ok ? "ok" : bad ? "bad" : "wait"} ${big ? "big" : ""}"><span class="shield">${ok ? ICONS.shieldok : ICONS.shield}</span><span><b>${typeDocL(a.type)} n° ${escH(a.numAff || a.num)} — ${ok ? "Authentifié" : bad ? "Non conforme" : "À authentifier"}</b><small>${ok ? `Original vérifié${a.authDate ? " le " + fdate(a.authDate) : ""}${a.source === "registre" ? " (registre numérique de la commune)" : ""} : il ne vous sera plus demandé. Vos duplicatas, renouvellements et légalisations se font en ligne, vous passez seulement récupérer.` : bad ? "Le document présenté n'a pas été reconnu : rapprochez-vous du service de l'état civil." : "Première fois : présentez l'original UNE SEULE FOIS au guichet. Ensuite, ce numéro sera reconnu pour toutes vos démarches."}</small></span></div>`;
}

/* ---------- Pièces jointes : photos compressées, PDF limités ---------- */
const PJ_MAX = 3, PDF_MAX = 900 * 1024;
const fileToDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
async function compressImage(f) {
  const url = await fileToDataURL(f), img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const k = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", .72);
}
async function readFiles(input) {
  const files = [...(input && input.files || [])];
  if (files.length > PJ_MAX) throw new Error(`${PJ_MAX} fichiers maximum.`);
  const out = [];
  for (const f of files) {
    if (/^image\//.test(f.type)) out.push({nom:f.name.replace(/\.\w+$/, "") + ".jpg", type:"image/jpeg", data:await compressImage(f)});
    else if (f.type === "application/pdf") { if (f.size > PDF_MAX) throw new Error(`« ${f.name} » dépasse 900 Ko : envoyez une photo ou un PDF plus léger.`); out.push({nom:f.name, type:f.type, data:await fileToDataURL(f)}); }
    else throw new Error(`« ${f.name} » : seuls les photos et les PDF sont acceptés.`);
  }
  out.forEach(x => x.taille = Math.round(x.data.length * .75 / 1024));
  return out;
}
function bindFileList(input, box) {
  if (!input || !box) return;
  input.addEventListener("change", () => {
    const fs = [...input.files];
    if (fs.length > PJ_MAX) { toast(`${PJ_MAX} fichiers maximum.`, "err"); input.value = ""; }
    box.innerHTML = [...input.files].map(f => `<span class="pjchip">${ICONS.file}${escH(f.name)} <small>${Math.round(f.size / 1024)} Ko</small></span>`).join("");
  });
}
const pjLinks = list => (list || []).map(p => `<a class="pjchip" href="${p.data}" download="${escH(p.nom)}">${ICONS.file}${escH(p.nom)} <small>${p.taille || ""} Ko</small></a>`).join("");

/* ---------- Documents PDF (document délivré, reçu de paiement) ---------- */
const DOC_TITRES = {"vignette":"VIGNETTE DE TRANSPORT À QR CODE","naissance":"EXTRAIT D'ACTE DE NAISSANCE","decl-naissance":"ACTE DE NAISSANCE","deces":"COPIE D'ACTE DE DÉCÈS","copie-mariage":"COPIE D'ACTE DE MARIAGE","residence":"CERTIFICAT DE RÉSIDENCE","permis":"PERMIS DE CONSTRUIRE","domaine":"AUTORISATION D'OCCUPATION DU DOMAINE PUBLIC","place":"AUTORISATION D'EMPLACEMENT AU MARCHÉ"};
const verifCode = ref => { let h = 7; for (const c of ref) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(36).toUpperCase().padStart(7, "0").slice(-7); };
const pdfMoney = n => Math.round(n || 0).toLocaleString("fr-FR").replace(/ | /g, " ") + " FCFA";
async function newPdf() {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const doc = new window.jspdf.jsPDF({unit:"mm", format:"a4"});
  // En-tête aux couleurs de la ville
  doc.setFillColor(6, 54, 63); doc.rect(0, 0, 210, 34, "F");
  doc.setFillColor(10, 138, 85); doc.rect(0, 34, 70, 2, "F"); doc.setFillColor(242, 194, 48); doc.rect(70, 34, 70, 2, "F"); doc.setFillColor(20, 119, 181); doc.rect(140, 34, 70, 2, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("RÉPUBLIQUE GABONAISE", 105, 10, {align:"center"});
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text("Union – Travail – Justice", 105, 14.5, {align:"center"});
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("MAIRIE DE LIBREVILLE", 105, 24, {align:"center"});
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.text("Capitale de la République gabonaise · Province de l'Estuaire", 105, 29.5, {align:"center"});
  // Filigrane
  doc.setTextColor(232, 236, 242); doc.setFont("helvetica", "bold"); doc.setFontSize(54);
  doc.text("DÉMONSTRATION", 105, 175, {align:"center", angle:35});
  doc.setTextColor(15, 28, 51);
  return doc;
}
function pdfRows(doc, y, rows) {
  doc.setFontSize(10.5);
  rows.forEach(([k, v]) => {
    doc.setFont("helvetica", "normal"); doc.setTextColor(91, 107, 133); doc.text(k, 25, y);
    doc.setFont("helvetica", "bold"); doc.setTextColor(6, 54, 63); doc.text(doc.splitTextToSize(String(v), 105), 85, y);
    doc.setDrawColor(220, 226, 235); doc.line(25, y + 3, 185, y + 3); y += 10;
  });
  doc.setTextColor(15, 28, 51); return y;
}
function pdfFoot(doc, code) {
  doc.setDrawColor(6, 54, 63); doc.setLineWidth(.6); doc.circle(160, 245, 15); doc.setLineWidth(.2); doc.circle(160, 245, 12.5);
  doc.setFontSize(6.5); doc.setTextColor(6, 54, 63); doc.text("MAIRIE DE", 160, 243, {align:"center"}); doc.text("LIBREVILLE", 160, 247, {align:"center"});
  doc.setFontSize(9); doc.setTextColor(15, 28, 51); doc.text("L'officier d'état civil / Le maire", 160, 266, {align:"center"});
  doc.setFontSize(8); doc.setTextColor(91, 107, 133);
  doc.text(`Code de vérification : ${code}  ·  à contrôler sur le site de la mairie, rubrique « Suivre mon dossier »`, 105, 282, {align:"center"});
  doc.text("Document de démonstration généré en ligne — sans valeur légale.", 105, 287, {align:"center"});
}
async function downloadDocument(r) {
  if (r.document && r.document.type === "fichier" && r.document.data) {
    const a = document.createElement("a"); a.href = r.document.data; a.download = r.document.nom || (r.ref + ".pdf"); a.click(); return;
  }
  const doc = await newPdf(), titre = DOC_TITRES[r.typeId] || (r.type || "").toUpperCase(), ben = `${r.prenom} ${(r.nom || "").toUpperCase()}`;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(6, 54, 63); doc.text(titre, 105, 54, {align:"center"});
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(91, 107, 133); doc.text(`${arrL(r.arr)} · Dossier ${r.ref}`, 105, 61, {align:"center"});
  const intro = {
    residence:`Le maire de la commune de Libreville certifie que ${ben} réside sur le territoire de la commune, au quartier ${r.quartier || "—"} (${arrL(r.arr)}).`,
    permis:`Le maire de la commune de Libreville autorise ${ben} à réaliser les travaux décrits dans le dossier ${r.ref}, sous réserve du respect des règles d'urbanisme en vigueur.`,
    domaine:`Le maire de la commune de Libreville autorise ${ben} à occuper temporairement le domaine public au quartier ${r.quartier || "—"}, dans les conditions fixées par la mairie.`,
    vignette:`Le maire de la commune de Libreville atteste que le véhicule déclaré par ${ben} est titulaire d'une vignette de transport valable douze mois, vérifiable par QR code.`,
    place:`Le maire de la commune de Libreville attribue à ${ben} un emplacement dans un marché municipal, dans les conditions fixées par le règlement des marchés.`,
  }[r.typeId] || `Délivré à ${ben}, conformément aux mentions portées au registre d'état civil de la commune de Libreville.`;
  doc.setFontSize(11); doc.setTextColor(15, 28, 51); doc.text(doc.splitTextToSize(intro, 160), 25, 76);
  const docNo = "DOC-" + r.ref.replace(/^L3-/, "");
  pdfRows(doc, 100, [["N° du document", docNo], ...(r.acte ? [[typeDocL(r.acte.type) + " n°", (r.acte.numAff || r.acte.num) + (r.acte.statut === "Authentifié" ? "  (authentifié)" : "")]] : []), ["Bénéficiaire", ben], ["Quartier", r.quartier || "—"], ["Arrondissement", arrL(r.arr)], ["N° de dossier", r.ref], ["Demande déposée le", fdate(r.date)], ["Délivré le", fdate((r.document && r.document.date) || new Date())], ["Code de vérification", verifCode(r.ref)]]);
  doc.setFontSize(10); doc.text(`Fait à Libreville, le ${fdate((r.document && r.document.date) || new Date())}.`, 25, 206);
  pdfFoot(doc, verifCode(r.ref));
  doc.save(`${titre.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}-${r.ref}.pdf`);
}
async function downloadRecu(r) {
  const p = r.paiement || {}, doc = await newPdf();
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(6, 54, 63); doc.text("REÇU DE PAIEMENT", 105, 54, {align:"center"});
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(91, 107, 133); doc.text(`Quittance ${p.quittance || "—"}`, 105, 61, {align:"center"});
  const y = pdfRows(doc, 80, [["Démarche", r.type], ["N° de dossier", r.ref], ["Payé par", `${r.prenom} ${r.nom}`], ["Date du paiement", p.date ? new Date(p.date).toLocaleString("fr-FR") : "—"], ["Moyen de paiement", p.mode || "—"], ["Référence de transaction", p.transaction || "Guichet"], ["Arrondissement", arrL(r.arr)]]);
  doc.setFillColor(226, 245, 236); doc.roundedRect(25, y + 4, 160, 18, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(10, 138, 85); doc.text(`Montant réglé : ${pdfMoney(r.montant)}`, 105, y + 15.5, {align:"center"});
  pdfFoot(doc, verifCode(r.ref + (p.quittance || "")));
  doc.save(`recu-${p.quittance || r.ref}.pdf`);
}

/* ---------- Paiement en ligne (simulation de démonstration) ---------- */
function payFlow(r, tel) {
  return new Promise(resolve => {
    const m = modal("Paiement en ligne · " + fcfa(r.montant), `
      <p class="lead-p" style="margin-bottom:1rem">${escH(r.type)} — dossier <b>${r.ref}</b></p>
      <div class="paytabs">${PAIEMENT.modes.map((x, i) => `<button type="button" class="paytab ${i ? "" : "on"}" data-m="${x.id}" style="--c:${x.c}"><span class="plogo ${x.id}">${payLogo(x.id)}</span><span><b>${x.l}</b><small>${x.s}</small></span></button>`).join("")}</div>
      <div id="paybody"></div>
      <p class="demo-pay">${ICONS.lock} Mode démonstration : aucun débit réel. En production, le paiement passe par la plateforme sécurisée d'un prestataire agréé (Airtel Money, Moov Money, banque, ou la plateforme e-Tax de la commune) et la mairie ne voit jamais les données de carte.</p>`);
    const body = $("#paybody", m);
    const done = async mode => {
      body.innerHTML = `<div class="paywait"><span class="spin"></span><p>Validation du paiement…</p></div>`;
      try { const res = await Store.pay(r.ref, tel, mode); await new Promise(x => setTimeout(x, 900)); resolve(res); }
      catch (e) { body.innerHTML = `<p class="alert-box">${ICONS.alert}<span>${escH(e.message)}</span></p>`; delete m.dataset.lock; }
    };
    const show = id => {
      $$(".paytab", m).forEach(b => b.classList.toggle("on", b.dataset.m === id));
      if (id !== "carte") {
        const M = PAIEMENT.modes.find(x => x.id === id), isA = id === "airtel", re = isA ? /^0?7[4-7]/ : /^0?6[0-6]/;
        body.innerHTML = `<form class="form" id="pf"><div class="field"><label for="amn">Numéro ${M.l}</label><input id="amn" name="num" type="tel" required pattern="${isA ? "0?7[4-7]" : "0?6[0-6]"}[0-9\\s]{6,9}" placeholder="${isA ? "074 00 00 00" : "062 00 00 00"}" value="${escH(re.test(tel.replace(/\D/g, "")) ? tel : "")}"></div>
          <p style="font-size:.86rem;color:var(--muted)">Vous allez recevoir une demande de paiement sur votre téléphone. Validez-la avec votre code secret ${M.l} (ne le communiquez jamais à personne, pas même à la mairie).</p>
          <button class="btn btn-orange" style="justify-content:center">Payer ${fcfa(r.montant)}</button></form>`;
        $("#pf", m).onsubmit = e => {
          e.preventDefault(); m.dataset.lock = 1;
          body.innerHTML = `<div class="paywait"><span class="spin"></span><p><b>Demande envoyée au ${escH(e.target.num.value)}</b><br>Validez le paiement sur votre téléphone…</p><button type="button" class="btn btn-navy btn-sm" id="ok">J'ai validé sur mon téléphone</button></div>`;
          const t = setTimeout(() => done(M.l), 4500); $("#ok", m).onclick = () => { clearTimeout(t); done(M.l); };
        };
      } else {
        body.innerHTML = `<div class="cbmock"><div class="cbh">${ICONS.lock} Page de paiement sécurisée du prestataire <small>(simulation)</small></div>
          <div class="field"><label>Numéro de carte (carte de test)</label><input value="4242 4242 4242 4242" readonly></div>
          <div class="row"><div class="field"><label>Expiration</label><input value="12/29" readonly></div><div class="field"><label>Cryptogramme</label><input value="•••" readonly></div></div>
          <button class="btn btn-orange" id="cbpay" style="justify-content:center;width:100%">Payer ${fcfa(r.montant)}</button></div>`;
        $("#cbpay", m).onclick = () => { m.dataset.lock = 1; body.innerHTML = `<div class="paywait"><span class="spin"></span><p><b>Authentification 3-D Secure</b><br>Confirmation auprès de votre banque…</p></div>`; setTimeout(() => done("Carte bancaire"), 2200); };
      }
    };
    $$(".paytab", m).forEach(b => b.onclick = () => show(b.dataset.m));
    show("airtel");
  });
}
function paidModal(r) {
  modal("Paiement confirmé ✅", `<p class="lead-p">Merci ! Votre paiement de <b>${fcfa(r.montant)}</b> par <b>${escH(r.paiement.mode)}</b> est enregistré.</p>
    <div class="panel" style="margin:1.2rem 0;box-shadow:none;text-align:center"><small style="color:var(--muted)">Numéro de dossier</small><div class="refbig">${r.ref}</div><small style="color:var(--muted)">Quittance ${r.paiement.quittance}</small></div>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap"><button class="btn btn-orange" id="dlr">${ICONS.dl} Télécharger le reçu (PDF)</button><a class="btn btn-navy" href="demarches.html#suivi" id="gos">${ICONS.search} Suivre mon dossier</a></div>
    <p style="color:var(--muted);font-size:.88rem;margin-top:1rem">Dès que le service aura préparé votre document, vous pourrez le télécharger depuis « Suivre mon dossier ».</p>`);
  $("#dlr").onclick = () => downloadRecu(r).catch(e => toast(e.message, "err"));
  $("#gos").onclick = () => { closeModal(); if (location.pathname.endsWith("demarches.html")) setTimeout(() => window.__suivi && window.__suivi(r.ref), 50); };
}

function renderChrome() {
  const page = document.body.dataset.page;
  const links = [["mairie","La Mairie"],["arrondissement","Arrondissement"],["demarches","Démarches"],["payer","Payer & vérifier"],["projets","Projets"],["transparence","Transparence"],["actualites","Actualités"],["contact","Contact"]];
  const tel = (MAIRIE.tels || [])[0], C = MAIRIE.centrale || {};
  const h = $("#site-header");
  if (h) h.outerHTML = `
  <a class="skip" href="#main">Aller au contenu</a>
  <div class="progress"></div>
  <div class="topbar"><div class="wrap">
    <div class="tb-l"><span>${ICONS.pin}Mairie du 3e arrondissement · Libreville, Gabon</span>${tel ? `<a href="tel:+241${tel.replace(/\s/g,"").slice(1)}">${ICONS.phone}${tel}</a>` : ""}${MAIRIE.email ? `<a href="mailto:${MAIRIE.email}">${ICONS.mail}${MAIRIE.email}</a>` : ""}${MAIRIE.facebook ? `<a href="${MAIRIE.facebook}" target="_blank" rel="noopener">${ICONS.fb}Facebook de la mairie</a>` : ""}</div>
    <div class="tb-r"><a href="payer.html#verifier">${ICONS.qr}Vérifier une vignette</a><a href="demarches.html#suivi">${ICONS.search}Suivre mon dossier</a><a href="espace.html">${ICONS.lock}Espace agents</a></div>
  </div></div>
  <header class="header"><div class="wrap">
    ${page !== "index" ? `<button class="hback" type="button" onclick="goBack()" aria-label="Retour à la page précédente">${BACK_ICON}<span>Retour</span></button>` : ""}
    <a class="brand" href="index.html"><img src="assets/img/logo-3e.svg" alt="Emblème de la Mairie du 3e arrondissement"><span><b>Mairie du 3<sup>e</sup><br>arrondissement</b><small>Libreville · Gabon</small></span></a>
    <nav class="nav" id="nav" aria-label="Navigation principale"><div class="nav-top"><button type="button" class="nav-back">${BACK_ICON}<span>Retour</span></button><small>Menu</small></div><a href="index.html" class="${page === "index" ? "active" : ""} nav-home">Accueil</a>${links.map(([k,l]) => `<a href="${k}.html" class="${k===page?"active":""}"${k===page?' aria-current="page"':""}>${l}</a>`).join("")}<a class="nav-agent" href="espace.html">${ICONS.lock} Espace agents</a><a class="btn btn-orange" href="demarches.html#demande">Démarches en ligne</a></nav>
    <button class="burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
  </div></header>`;
  const main = document.querySelector("body > section, body > .hero"); if (main && !$("#main")) main.id = "main";

  const f = $("#site-footer");
  if (f) f.outerHTML = `
  <footer class="footer"><div class="wrap"><div class="grid">
    <div>
      <a class="logo-w" href="index.html"><img src="assets/img/logo-3e.svg" alt="Mairie du 3e arrondissement"><span>Mairie du 3<sup>e</sup><br>arrondissement</span></a>
      <p>La mairie d'arrondissement du 3e, au cœur de Libreville : Mont-Bouët, Petit-Paris, Akébé, Sorbonne et Nombakélé-Nord. Placée sous la coordination de la mairie centrale de Libreville${C.maire ? ", et animée au quotidien par son maire, Franck Ibouili" : ""}.</p>
      <div class="socials">
        ${MAIRIE.facebook ? `<a href="${MAIRIE.facebook}" target="_blank" rel="noopener" aria-label="Facebook de la mairie">${ICONS.fb}</a>` : ""}
        ${MAIRIE.whatsapp ? `<a href="https://wa.me/${MAIRIE.whatsapp}" target="_blank" rel="noopener" aria-label="WhatsApp">${ICONS.wa}</a>` : ""}
        <a href="contact.html" aria-label="Écrire à la mairie">${ICONS.mail}</a>
      </div>
    </div>
    <div><h4>Notre mairie</h4><ul>
      <li><a href="mairie.html">Le maire & ses adjoints</a></li><li><a href="arrondissement.html">Notre arrondissement & quartiers</a></li><li><a href="projets.html">Projets & chantiers</a></li><li><a href="transparence.html">Budget & transparence</a></li><li><a href="actualites.html">Actualités & avis</a></li>
    </ul></div>
    <div><h4>Services en ligne</h4><ul>
      <li><a href="demarches.html?c=etat-civil">État civil</a></li><li><a href="demarches.html?d=rdv#demande">Rendez-vous au guichet</a></li><li><a href="payer.html">Payer une taxe</a></li><li><a href="payer.html#verifier">Vérifier une vignette QR</a></li><li><a href="demarches.html?d=signalement#demande">Signaler un problème</a></li><li><a href="demarches.html#suivi">Suivre, payer, télécharger</a></li>
    </ul></div>
    <div><h4>Espace numérique</h4>
      <ul><li><a href="espace.html?role=cabinet">Cabinet du maire du 3e</a></li><li><a href="espace.html?role=services">Services municipaux</a></li><li><a href="espace.html?role=recettes">Recettes & e-Tax</a></li>${C.url ? `<li><a href="${C.url}" target="_blank" rel="noopener">Mairie centrale de Libreville ${ICONS.ext}</a></li>` : ""}</ul>
      <div class="staff-box"><b>Vous êtes agent municipal ?</b><p>Accédez au back-office pour traiter les demandes, encaisser et suivre vos indicateurs.</p><a class="btn btn-orange btn-sm" href="espace.html">${ICONS.lock} Accès agents</a></div>
    </div>
  </div>
  <div class="foot-bottom"><span>© ${new Date().getFullYear()} ${escH(MAIRIE.nom)}</span><span class="paylogos"><span class="plogo airtel">airtel money</span><span class="plogo moov">moov money</span><span class="plogo carte">VISA · MC</span> Paiement simulé (démonstration)</span></div>
  <p class="credits"><b>Site de démonstration</b> : les paiements, dossiers, vignettes et comptes affichés sont des données fictives. Photos de la ville : Wikimedia Commons (Shirmy25, Christian Vigna, Delrick Trevor, Tarik Esnow), licence <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr" target="_blank" rel="noopener">CC BY-SA 4.0</a> ; photos d'actualité : presse gabonaise citée. Les informations marquées « à confirmer » doivent être validées par la mairie.</p>
  <div class="foot-credit">Site de démonstration conçu par <b>Rouana</b> · ce site n'est pas le site officiel de la mairie</div>
  </div></footer>
  ${MAIRIE.whatsapp ? `<a class="wa" href="https://wa.me/${MAIRIE.whatsapp}?text=${encodeURIComponent("Bonjour, je souhaite un renseignement auprès de la Mairie du 3e arrondissement de Libreville.")}" target="_blank" rel="noopener" aria-label="Écrire sur WhatsApp">${ICONS.wa}</a>`
    : `<a class="wa fab-sig" href="demarches.html?d=signalement#demande" aria-label="Signaler un problème">${ICONS.alert}<span>Signaler</span></a>`}
  <button class="totop" aria-label="Haut de page">↑</button>
  <nav class="tabbar" aria-label="Accès rapides">
    <a href="index.html" class="${page === "index" ? "on" : ""}">${ICONS.home}<span>Accueil</span></a>
    <a href="demarches.html" class="${page === "demarches" ? "on" : ""}">${ICONS.file}<span>Démarches</span></a>
    <a href="payer.html" class="mid ${page === "payer" ? "on" : ""}"><span class="ib">${ICONS.qr}</span><span>Payer</span></a>
    <a href="arrondissement.html" class="${page === "arrondissement" ? "on" : ""}">${ICONS.map}<span>Quartiers</span></a>
    <a href="demarches.html#suivi">${ICONS.search}<span>Suivi</span></a>
  </nav>`;
  if (page !== "espace") document.body.classList.add("has-tabbar");
}

function initChrome() {
  const header = $(".header"), prog = $(".progress"), top = $(".totop");
  const onScroll = () => {
    const y = scrollY, H = document.documentElement.scrollHeight - innerHeight;
    header && header.classList.toggle("scrolled", y > 30);
    if (prog) prog.style.width = (H > 0 ? (y / H) * 100 : 0) + "%";
    top && top.classList.toggle("on", y > 600);
  };
  addEventListener("scroll", onScroll, {passive:true}); onScroll();
  top && top.addEventListener("click", () => scrollTo({top:0, behavior:"smooth"}));
  const b = $(".burger"), nav = $("#nav");
  if (!b || !nav) return;
  const closeNav = fromPop => {
    if (!nav.classList.contains("open")) return;
    nav.classList.remove("open"); b.classList.remove("on"); b.setAttribute("aria-expanded", false); document.body.classList.remove("nav-open");
    if (!fromPop) Back.close(closeNav);
  };
  const openNav = () => { nav.classList.add("open"); b.classList.add("on"); b.setAttribute("aria-expanded", true); document.body.classList.add("nav-open"); Back.open(closeNav); };
  b.addEventListener("click", () => nav.classList.contains("open") ? closeNav() : openNav());
  $(".nav-back", nav).addEventListener("click", () => closeNav());
  addEventListener("resize", () => { if (innerWidth > 1020) closeNav(); });
}

/* ---------- Animations ---------- */
function initReveal() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), {threshold:.12});
  $$(".rv:not(.in)").forEach(el => io.observe(el));
  const co = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting || e.target.dataset.done) return; co.unobserve(e.target); e.target.dataset.done = 1;
    const el = e.target, to = +el.dataset.count, dec = +(el.dataset.dec || 0), t0 = performance.now(), dur = 1600;
    const step = t => { const p = Math.min(1, (t - t0) / dur), v = to * (1 - Math.pow(1 - p, 3)); el.textContent = (dec ? v.toFixed(dec).replace(".", ",") : Math.round(v).toLocaleString("fr-FR")) + (el.dataset.suffix || ""); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), {threshold:.1});
  $$("[data-count]:not([data-done])").forEach(el => co.observe(el));
}

function initHero() {
  const figs = $$(".hero-slides figure"); if (!figs.length) return;
  const dots = $(".hero-dots"); let i = 0, h;
  dots.innerHTML = figs.map((_, k) => `<button aria-label="Diapositive ${k+1}" class="${k?"":"on"}"></button>`).join("");
  const go = k => { figs[i].classList.remove("on"); dots.children[i].classList.remove("on"); i = (k + figs.length) % figs.length; figs[i].classList.add("on"); dots.children[i].classList.add("on"); };
  const play = () => { clearInterval(h); h = setInterval(() => go(i + 1), 6500); };
  [...dots.children].forEach((d, k) => d.addEventListener("click", () => { go(k); play(); }));
  play();
}

/* ---------- Démarches ---------- */
function demCard(d) {
  const c = CAT_DEM[d.cat];
  return `<article class="fcard dcard rv" data-cat="${d.cat}" style="--c:${c.c}"><span class="tag" style="background:color-mix(in srgb,${c.c} 12%,#fff);color:${c.c}">${c.l}</span>
    <div class="ic">${ICONS[d.ic]}</div><h3>${d.t}</h3><p>${d.d}</p>
    <div class="dmeta"><span class="price ${d.prix ? "" : "free"}">${fcfa(d.prix)}</span>${d.doc ? `<span class="dl">${ICONS.dl} Téléchargeable</span>` : ""}</div>${d.acte ? `<p class="dauth">${ICONS.shieldok}<span>100 % en ligne si votre acte est authentifié</span></p>` : ""}
    <div class="dact"><button class="more" data-dem="${d.id}">Pièces à prévoir</button><a class="btn btn-orange btn-sm" href="demarches.html?d=${d.id}#demande">${d.signal ? "Signaler" : "Faire la demande"}</a></div></article>`;
}
function initDemarches() {
  const box = $("#dem-grid"); if (!box) return;
  const limit = +box.dataset.limit || 0, tabs = $("#dem-tabs");
  const render = cat => {
    let list = DEMARCHES.filter(d => cat === "tout" || d.cat === cat); if (limit) list = list.slice(0, limit);
    box.innerHTML = list.map(demCard).join("");
    requestAnimationFrame(() => $$(".rv", box).forEach((el, k) => setTimeout(() => el.classList.add("in"), k * 40)));
  };
  if (tabs) {
    const counts = {tout:DEMARCHES.length}; DEMARCHES.forEach(d => counts[d.cat] = (counts[d.cat] || 0) + 1);
    const opts = [["tout","Toutes"], ...Object.entries(CAT_DEM).map(([k, v]) => [k, v.l])];
    tabs.innerHTML = opts.map(([k, l]) => `<button class="tab" data-n="${k}">${l}<span class="n">${counts[k] || 0}</span></button>`).join("");
    const set = k => { $$(".tab", tabs).forEach(t => t.classList.toggle("on", t.dataset.n === k)); render(k); };
    tabs.addEventListener("click", e => { const t = e.target.closest(".tab"); if (t) set(t.dataset.n); });
    const st = new URLSearchParams(location.search).get("c"); set(CAT_DEM[st] ? st : "tout");
  } else render("tout");
  box.addEventListener("click", e => {
    const b = e.target.closest("[data-dem]"); if (!b) return;
    const d = DEMARCHES.find(x => x.id === b.dataset.dem);
    modal(d.t, `<p class="chip info" style="margin-bottom:1rem">${CAT_DEM[d.cat].l} · Service : ${d.service}</p><p class="lead-p">${d.d}</p>
      <div class="kv" style="margin-top:1rem"><div><small>Tarif</small><b>${fcfa(d.prix)}</b></div><div><small>Paiement</small><b>${d.prix ? "En ligne ou à la mairie" : "—"}</b></div><div><small>Document</small><b>${d.doc ? "Téléchargeable en PDF" : "Retrait au guichet"}</b></div></div>
      <h4 style="margin:1rem 0 .6rem;color:var(--navy)">À prévoir (vous pouvez les joindre en ligne)</h4><ul class="checks" style="margin:0 0 1rem">${d.pieces.map(p => `<li>${p}</li>`).join("")}</ul>
      <p style="color:var(--muted);font-size:.84rem">${PAIEMENT.note} Liste indicative : le service peut demander une pièce complémentaire.</p>
      <div style="display:flex;gap:.6rem;margin-top:1.4rem;flex-wrap:wrap"><a class="btn btn-orange" href="demarches.html?d=${d.id}#demande">${d.signal ? "Signaler maintenant" : "Faire la demande en ligne"}</a></div>`);
  });
}

function initDemandeForm() {
  const form = $("#demande-form"); if (!form) return;
  const sel = $("[name=type]", form), sig = $("#sig-fields", form), std = $("#std-fields", form), ts = $("[name=sigtype]", form), qList = $("#quartiers");
  sel.innerHTML = '<option value="">— Choisir une démarche —</option>' + Object.entries(CAT_DEM).map(([k, c]) => `<optgroup label="${c.l}">${DEMARCHES.filter(d => d.cat === k).map(d => `<option value="${d.id}">${d.t}${d.prix ? " — " + fcfa(d.prix) : ""}</option>`).join("")}</optgroup>`).join("");
  ts.innerHTML = TYPES_SIGNAL.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  qList.innerHTML = QUARTIERS_3E.map(q => `<option value="${q.nom}">`).join("");
  const arrSel = $("[name=arr]", form); arrSel.value = arrN();   // mono-arrondissement : toujours le 3e
  const rf = $("#rdv-fields", form);
  const drawSlots = async () => {
    if (!rf || rf.hidden) return;
    const jour = $("#rdvjour", form).value, a = arrSel.value || 1, box = $("#slots", form);
    let pris = []; try { pris = await Store.rdvPris(a, jour); } catch (e) {}
    const d = new Date(jour + "T12:00:00"), closed = d.getDay() === 0 || d.getDay() === 6;
    box.innerHTML = closed ? '<p class="imgnote">Les guichets sont fermés le week-end : choisissez un autre jour.</p>' : CRENEAUX.map(h => `<button type="button" data-h="${h}" ${pris.includes(h) ? "disabled title=\"Déjà réservé\"" : ""}>${h}</button>`).join("");
    $("[name=rdvheure]", form).value = "";
  };
  if (rf) {
    const j = $("#rdvjour", form), t0 = new Date(Date.now() + 864e5); while (t0.getDay() === 0 || t0.getDay() === 6) t0.setDate(t0.getDate() + 1);
    j.min = t0.toISOString().slice(0, 10); j.value = j.min; j.max = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    j.addEventListener("change", drawSlots); arrSel.addEventListener("change", drawSlots);
    $("#slots", form).addEventListener("click", e => { const b = e.target.closest("[data-h]"); if (!b) return; $$("#slots button", form).forEach(x => x.classList.toggle("on", x === b)); $("[name=rdvheure]", form).value = b.dataset.h; });
  }
  bindFileList($("#pj", form), $("#pj-list", form));
  const cur = () => DEMARCHES.find(x => x.id === sel.value);
  const af = $("#acte-fields", form), ta = $("#typeActe", form);
  if (ta) ta.innerHTML = TYPES_DOC.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  const verif = async () => {
    const d = cur(), res = $("#acte-res", form), num = $("#numActe", form).value, nom = $("#nomActe", form).value || $("#nom", form).value;
    if (!num.trim()) { res.innerHTML = ""; return null; }
    const type = d.acte === "tout" ? ta.value : d.acte;
    res.innerHTML = '<p class="empty" style="padding:.6rem">Vérification…</p>';
    let a = null; try { a = await Store.verifDoc(num, nom, type); } catch (e) {}
    res.innerHTML = a ? acteBadge({...a, num}) : acteBadge({numAff:num, type, statut:"En attente"}) + '<small class="imgnote">Numéro pas encore connu de la plateforme : il sera inscrit avec votre demande.</small>';
    return a;
  };
  if (af) { $("#verif", form).onclick = verif; $("#numActe", form).addEventListener("change", verif); }
  const sync = () => {
    const d = cur(), isSig = !!(d && d.signal);
    if (af) {
      af.hidden = !(d && d.acte); $("#numActe", form).required = !!(d && d.acte); $("#acte-res", form).innerHTML = "";
      if (d && d.acte) { $("#ta-field", form).hidden = d.acte !== "tout"; $("#acte-label", form).textContent = d.acte === "tout" ? "Numéro du document" : "Numéro de votre " + typeDocL(d.acte).toLowerCase(); }
    }
    sig.hidden = !isSig; std.hidden = isSig;
    if (rf) { rf.hidden = !(d && d.rdv); $("[name=rdvheure]", form).required = !!(d && d.rdv); drawSlots(); }
    $$("input,select,textarea", sig).forEach(i => i.required = isSig && i.dataset.req === "1");
    $("#dem-info").innerHTML = d ? `${d.lien ? `<p class="alert-box ok" style="margin-bottom:.8rem">${ICONS.qr}<span>Plus rapide : <a href="${d.lien}" style="text-decoration:underline;font-weight:700">payez directement votre vignette en ligne</a> et recevez-la immédiatement avec son QR code.</span></p>` : ""}<b>${d.t}</b> — ${d.d}<br><small>À prévoir : ${d.pieces.join(" · ")}</small><div class="dmeta" style="margin-top:.6rem"><span class="price ${d.prix ? "" : "free"}">${fcfa(d.prix)}</span>${d.doc ? `<span class="dl">${ICONS.dl} Document téléchargeable en PDF</span>` : ""}</div>` : "";
    $("#pj-label").textContent = isSig ? "Photos du problème (facultatif, 3 maximum)" : "Pièces justificatives (facultatif : photos ou PDF, 3 maximum)";
    const pay = $("#pay-step");
    if (!d) return;
    pay.innerHTML = d.prix ? `<p class="lead-p">Montant de la démarche : <b class="price">${fcfa(d.prix)}</b></p>
      <div class="paychoice">${PAIEMENT.modes.map((m, i) => `<label class="pc"><input type="radio" name="payer" value="${m.id}" ${i ? "" : "checked"}><span class="plogo ${m.id}">${payLogo(m.id)}</span><span><b>Payer maintenant · ${m.l}</b><small>${m.s} — votre document sera téléchargeable dès qu'il est prêt</small></span></label>`).join("")}
      <label class="pc"><input type="radio" name="payer" value="guichet"><span class="plogo guichet">${ICONS.building}</span><span><b>Payer à la mairie</b><small>${PAIEMENT.guichet}. Vous pourrez aussi payer en ligne plus tard depuis le suivi.</small></span></label></div>
      <p style="font-size:.8rem;color:var(--muted)">${PAIEMENT.note}</p>`
      : `<div class="alert-box ok">${ICONS.check}<span>Cette démarche est <b>gratuite</b> : aucun paiement n'est demandé.</span></div>`;
  };
  sel.addEventListener("change", sync);
  const pre = new URLSearchParams(location.search).get("d"); if (pre && DEMARCHES.some(d => d.id === pre)) sel.value = pre;
  sync();
  const steps = $$(".fstep", form), bars = $$(".steps span", form); let s = 0;
  const show = k => { s = k; steps.forEach((x, j) => x.classList.toggle("on", j === k)); bars.forEach((b, j) => b.classList.toggle("on", j <= k)); };
  const valid = () => { const bad = $$("[required]", steps[s]).find(i => !i.closest("[hidden]") && !i.checkValidity()); if (bad) { bad.reportValidity(); return false; } return true; };
  form.addEventListener("click", e => {
    if (e.target.closest("[data-next]") && valid()) show(s + 1);
    if (e.target.closest("[data-prev]")) show(s - 1);
  });
  form.addEventListener("submit", async e => {
    e.preventDefault(); if (!valid()) return;
    const f = Object.fromEntries(new FormData(form)), d = cur();
    const btn = $("button[type=submit]", form); btn.disabled = true; btn.textContent = "Envoi…";
    const reset = () => { btn.disabled = false; btn.textContent = "Valider ma demande"; };
    let ref, pj;
    try { pj = await readFiles($("#pj", form)); } catch (err) { reset(); return toast(err.message, "err"); }
    const online = d.prix && f.payer && f.payer !== "guichet";
    try {
      if (d.signal) {
        const t = TYPES_SIGNAL.find(x => x[0] === f.sigtype);
        ref = await Store.submitSignalement({type:f.sigtype, typeLabel:t[1], arr:+f.arr, quartier:f.quartier, lieu:f.lieu, description:f.description, prenom:f.prenom, nom:f.nom, tel:f.tel, priorite:"Normale", pj});
      } else {
        ref = await Store.submitDemande({...(d.rdv ? {rdv:{jour:f.rdvjour, heure:f.rdvheure}} : {}), ...(d.acte && f.numActe ? {numActe:f.numActe, nomActe:f.nomActe || f.nom, typeActe:d.acte === "tout" ? f.typeActe : d.acte} : {}), type:d.id, typeLabel:d.t, service:d.service, arr:+f.arr, prenom:f.prenom, nom:f.nom, tel:f.tel, email:f.email, quartier:f.quartier, details:f.details, montant:d.prix || 0, paiement:d.prix ? {choix:online ? "en ligne" : "guichet", statut:"À régler"} : {statut:"Gratuit"}, pj, document:null});
      }
    } catch (err) { reset(); return toast("Envoi impossible : " + err.message, "err"); }
    reset(); ss("lbv_suivi", JSON.stringify({ref, tel:f.tel}));
    const sent = d.acte && f.numActe ? await Store.suivi(ref, f.tel) : null;
    form.reset(); sel.value = ""; $("#pj-list").innerHTML = ""; sync(); show(0);
    if (online) {
      const r = await Store.suivi(ref, f.tel);
      const mode = PAIEMENT.modes.find(m => m.id === f.payer);
      setTimeout(() => $$(".paytab").find(b => b.dataset.m === mode.id)?.click(), 30);
      const paid = await payFlow(r, f.tel); paidModal(paid); return;
    }
    if (d.rdv) { const r = await Store.suivi(ref, f.tel); modal("Rendez-vous confirmé ✅", `<p class="lead-p">Merci <b>${escH(f.prenom)}</b> ! Votre créneau est réservé. Présentez ce ticket (ou son numéro) à l'accueil : vous serez reçu(e) sans faire la queue.</p>${rdvTicket(r)}<a class="btn btn-navy" href="demarches.html#suivi" id="gos">${ICONS.search} Retrouver mon rendez-vous</a>`); drawQRs(); $("#gos").onclick = () => { closeModal(); setTimeout(() => window.__suivi && window.__suivi(ref), 50); }; return; }
    modal(d.signal ? "Signalement transmis ✅" : "Demande enregistrée ✅", `<p class="lead-p">Merci <b>${escH(f.prenom)}</b> ! ${d.signal ? "Votre signalement a été transmis aux services techniques." : `Votre demande « <b>${d.t}</b> » a été transmise au service ${d.service} (${arrL(f.arr)}).`}${pj.length ? ` ${pj.length} pièce(s) jointe(s) reçue(s).` : ""}</p>
      <div class="panel" style="margin:1.2rem 0;box-shadow:none;text-align:center"><small style="color:var(--muted)">Votre numéro de dossier</small><div class="refbig">${ref}</div><small style="color:var(--muted)">Notez-le avec votre numéro de téléphone : ils vous permettent de suivre${d.prix ? ", payer" : ""} et télécharger.</small></div>
      ${sent && sent.acte ? acteBadge(sent.acte) : ""}
      ${d.prix ? `<p class="alert-box warn">${ICONS.wallet}<span>Montant à régler : <b>${fcfa(d.prix)}</b> — à la mairie, ou en ligne à tout moment depuis le suivi.</span></p>` : ""}
      <a class="btn btn-navy" href="demarches.html#suivi" id="gos">${ICONS.search} Suivre mon dossier</a>`);
    $("#gos").onclick = () => { closeModal(); setTimeout(() => window.__suivi && window.__suivi(ref), 50); };
  });
  show(0);
}

function initSuivi() {
  const form = $("#suivi-form"); if (!form) return;
  const out = $("#suivi-out");
  const render = r => {
    const done = /Remise|Résolu|Prête/.test(r.statut), bad = /Rejet|manquante/.test(r.statut);
    const dem = DEMARCHES.find(x => x.id === r.typeId) || {};
    const p = r.paiement || {}, paid = p.statut === "Payé" || p.statut === "Gratuit" || !r.montant;
    const ready = /Prête|Remise/.test(r.statut) && r.document;
    let payBox = "", docBox = "";
    if (r.montant && p.statut !== "Payé") payBox = `<div class="sbox warn"><div><b>${ICONS.wallet} Montant à régler : ${fcfa(r.montant)}</b><small>Payez en ligne maintenant ou au guichet de la mairie.</small></div><div class="mini-btns">${PAIEMENT.modes.map(m => `<button class="btn btn-orange btn-sm" data-pay="${m.id}">${m.l}</button>`).join("")}</div></div>`;
    else if (r.montant) payBox = `<div class="sbox ok"><div><b>${ICONS.check} Payé : ${fcfa(r.montant)}</b><small>${escH(p.mode || "")} · ${p.date ? fdate(p.date) : ""} · quittance ${escH(p.quittance || "")}</small></div><button class="btn btn-line btn-sm" id="dlrecu">${ICONS.dl} Reçu (PDF)</button></div>`;
    if (dem.doc || (r.document && r.document.type === "fichier")) {
      if (ready && paid) docBox = `<div class="sbox doc"><div><b>${ICONS.file} Votre document est prêt</b><small>${escH(DOC_TITRES[r.typeId] || r.type)} — délivré le ${fdate(r.document.date || r.date)}</small></div><button class="btn btn-orange btn-sm" id="dldoc">${ICONS.dl} Télécharger (PDF)</button></div>`;
      else if (ready) docBox = `<div class="sbox"><div><b>${ICONS.file} Votre document est prêt</b><small>Réglez ${fcfa(r.montant)} pour le télécharger, ou retirez-le au guichet.</small></div></div>`;
      else if (!/Rejet/.test(r.statut)) docBox = `<div class="sbox"><div><b>${ICONS.clock} Document en préparation</b><small>Il sera téléchargeable ici dès que le service l'aura validé.</small></div></div>`;
    } else if (/Prête/.test(r.statut)) docBox = `<div class="sbox"><div><b>${ICONS.building} À retirer au guichet</b><small>Présentez-vous avec votre pièce d'identité et votre numéro de dossier.</small></div></div>`;
    out.innerHTML = `<div class="suivi-card"><div class="sh"><div><small>Dossier ${r.ref} · ${arrL(r.arr)}</small><h3>${escH(r.type)}</h3><small>Déposé le ${fdate(r.date)} par ${escH(r.prenom)} ${escH(r.nom)}</small></div><span class="chip ${done ? "ok" : bad ? "warn" : "info"}">${r.statut}</span></div>
      ${r.rdv ? rdvTicket(r) : ""}${r.acte ? acteBadge(r.acte) : ""}${payBox}${docBox}
      <h4 style="color:var(--navy);margin:1.4rem 0 1rem">Historique</h4>
      <div class="timeline">${r.historique.slice().reverse().map(h => `<div class="tl"><b>${fdate(h.date)}</b><h4>${h.statut}</h4><p>${escH(h.note)}</p></div>`).join("")}</div></div>`;
    drawQRs(out);
    $$("[data-pay]", out).forEach(b => b.onclick = async () => { const tel = form.tel.value; setTimeout(() => $$(".paytab").find(x => x.dataset.m === b.dataset.pay)?.click(), 30); const res = await payFlow(r, tel); paidModal(res); render(res); });
    const dr = $("#dlrecu", out); if (dr) dr.onclick = () => downloadRecu(r).catch(e => toast(e.message, "err"));
    const dd = $("#dldoc", out); if (dd) dd.onclick = async () => { dd.disabled = true; try { await downloadDocument(r); toast("Document téléchargé.", "ok"); Store.markDownloaded(r.ref, form.tel.value); } catch (e) { toast(e.message, "err"); } dd.disabled = false; };
  };
  const run = async (ref, tel) => {
    out.innerHTML = `<p class="empty">Recherche…</p>`;
    let r = null; try { r = await Store.suivi(ref, tel); } catch (e) { out.innerHTML = `<p class="empty">Service momentanément indisponible.</p>`; return; }
    if (!r) { out.innerHTML = `<div class="empty">${ICONS.search}<p>Aucun dossier ne correspond à ce numéro et à ce téléphone.<br>Vérifiez la saisie (ex. L3-26-01234 ou SIG-26-0410).</p></div>`; return; }
    render(r);
  };
  form.addEventListener("submit", e => { e.preventDefault(); run(form.ref.value, form.tel.value); });
  let last = null; try { last = JSON.parse(ss("lbv_suivi") || "null"); } catch (e) {}
  window.__suivi = ref => { if (last || (last = JSON.parse(ss("lbv_suivi") || "null"))) { form.ref.value = last.ref; form.tel.value = last.tel; } $("#suivi").scrollIntoView({behavior:"smooth"}); run(form.ref.value, form.tel.value); };
  if (last) { form.ref.value = last.ref; form.tel.value = last.tel; if (location.hash === "#suivi") run(last.ref, last.tel); }
}

/* ---------- Le 3e arrondissement : faits du dossier de recherche (1er novembre 2026) ----------
   Les éléments non vérifiés portent la mention « à confirmer » ; aucune liste officielle de quartiers n'est publiée. */
const DOC3 = (() => {
  const S = {
    install:{src:"Gabon Infos Live", url:"https://gaboninfoslive.com/2025/11/25/mise-en-place-des-nouvelles-equipes-municipales-a-libreville/"},
    sale:{src:"Direct Infos Gabon", url:"https://directinfosgabon.com/lutte-contre-linsalubrite-mobilisation-citoyenne-a-petit-paris-et-mont-bouet/"},
    terrain:{src:"Infos Gabon", url:"https://fr.infosgabon.com/gabon-libreville-le-terrain-comme-priorite/"},
    sante:{src:"Gabon Media Time", url:"https://gabonmediatime.com/akebe-letat-concretise-le-rapprochement-des-soins-au-coeur-du-3%E1%B5%89-arrondissement/"},
    marches:{src:"Gabonreview", url:"https://www.gabonreview.com/libreville-double-offensive-municipale-sur-les-travaux-et-la-salubrite-des-marches/"},
    timbres:{src:"Gabonreview", url:"https://www.gabonreview.com/mairie-de-libreville-en-penurie-de-timbres-la-commune-passe-en-mode-derogatoire/"},
    hopitaux:{src:"Gabonreview", url:"https://www.gabonreview.com/libreville-les-futurs-hopitaux-du-pont-dakebe-et-de-la-peyrie-ouvriront-a-la-mi-aout-avec-60-lits-au-total/"},
    mb:{src:"Wikipédia (en)", url:"https://en.wikipedia.org/wiki/Mont-Bou%C3%ABt"},
    x:{src:"Ville de Libreville (X)", url:"https://x.com/MairieLbv/status/2080423317895332293"},
  };
  return {
    S,
    quartiers:[
      {id:"mont-bouet", nom:"Mont-Bouët", conf:true, c:"#d9480f", img:"mont-bouet", cr:"Gabonclic · lancement du paiement électronique à Mont-Bouët",
        alias:["mont bouet","mont-bouët","mont bouët","marche de mont bouet","grand marche"],
        pts:"300,120 440,115 470,230 340,300 250,200", lx:362, ly:196, pin:[355,232,"M"],
        d:"Le quartier du grand marché de Mont-Bouët, le plus grand marché du Gabon, ouvert au début des années 1970. Environ 4 000 commerçants y étaient recensés en 2008 ; le marché a connu plusieurs incendies (2009, 2012, 2013, 2014 et 2023) et fait l'objet d'opérations de dégagement des étals depuis 2024.",
        faits:["1er septembre 2026 : opération de nettoyage guidée par le maire du 3e, avec les commerçants et les riverains","19 octobre 2026 : visite du maire de Libreville et du maire du 3e ; prestataires de collecte rappelés à leurs engagements, emplacements de bennes recherchés"],
        src:[S.mb, S.sale, S.marches]},
      {id:"petit-paris", nom:"Petit-Paris", conf:true, c:"#0e7c86", img:"marche", cr:"Tarik Esnow · CC BY-SA 4.0 · ambiance de marché à Libreville (lieu exact à confirmer)",
        alias:["petit paris","petitparis","marche de petit paris"],
        pts:"60,70 230,40 300,120 250,200 80,190", lx:168, ly:122, pin:[150,152,"M"],
        d:"Quartier et marché au cœur des opérations de salubrité de 2026. L'opération du 1er septembre est présentée comme préalable à un réaménagement plus global de ces secteurs.",
        faits:["Ramassage des déchets sur les trottoirs, curage des caniveaux, sécurisation par les forces de l'ordre et sensibilisation à l'usage de sacs fermés","Matériel fourni par la mairie ; autorités, commerçants et riverains mobilisés"],
        src:[S.sale]},
      {id:"akebe", nom:"Akébé", sous:["Akébé Ville","Akébé Likouala"], conf:true, c:"#0a8a55", img:"bd-independance", cr:"Shirmy25 · CC BY-SA 4.0 · photo d'illustration de Libreville (pas du quartier)",
        alias:["akebe","akébé","akebe ville","akébé ville","akebe likouala","akébé likouala","likouala","pont d akebe","pont d'akébé"],
        pts:"440,115 570,120 560,330 430,370 340,300 470,230", lx:508, ly:228, pin:[505,268,"+"],
        d:"Présenté par la presse comme le « cœur du 3e arrondissement » (août 2026) : Akébé Ville et Akébé Likouala accueillent des équipements de santé et de commerce en projet ou en construction.",
        faits:["Centre de santé communautaire presque achevé en août 2026 (médecine générale, pédiatrie, gynécologie, ophtalmologie, laboratoire, imagerie) ; ouverture effective à confirmer","Futur marché d'Akébé Ville visité le 30 juillet 2026","Chef de quartier d'Akébé Likouala cité en août 2026 : Guillaume Ngoulou"],
        src:[S.sante, S.terrain]},
      {id:"sorbonne", nom:"Sorbonne", conf:false, c:"#5b3fb3", img:"libreville-nuit", cr:"Shirmy25 · CC BY-SA 4.0 · photo d'illustration de Libreville (pas du quartier)",
        alias:["sorbonne"],
        pts:"230,40 420,30 440,115 300,120", lx:340, ly:84,
        d:"Quartier rattaché au 3e arrondissement dans la liste électorale de 2018 publiée par L'Union. Aucune information locale n'est publiée à ce jour : la mairie la fournira.",
        faits:["Rattachement à valider avec la mairie"], src:[]},
      {id:"nombakele-nord", nom:"Nombakélé-Nord", conf:false, c:"#a8620a", img:"baie-des-rois", cr:"Shirmy25 · CC BY-SA 4.0 · photo d'illustration de Libreville (pas du quartier)",
        alias:["nombakele","nombakélé","nombakele nord","nombakélé nord","nombakele-nord"],
        pts:"80,190 250,200 340,300 430,370 300,410 110,380", lx:244, ly:312,
        d:"Nombakélé est associé au 3e arrondissement par Wikipédia, mais la liste électorale de 2018 le scinde : Nombakélé-Nord au 3e, Nombakélé-Sud au 4e. La limite exacte est à confirmer.",
        faits:["Limite entre Nombakélé-Nord et Nombakélé-Sud à valider avec la mairie"], src:[]},
    ],
    // Sites cités par la presse dont le rattachement n'est pas établi (utilisés par « Dans quel quartier j'habite ? »)
    sites:[
      {k:["peyrie","la peyrie","grand marche de la peyrie"], t:"Grand marché de la Peyrie", m:"Chantier visité le 19 octobre 2026 avec le maire du 3e ; rattachement au 3e à confirmer."},
      {k:["pk8","pk 8","canal pk8"], t:"Canal du PK8", m:"Site visité par le maire du 3e en juillet 2026 ; rattachement exact à confirmer."},
    ],
    equipements:[
      {t:"Marché de Mont-Bouët", q:"Mont-Bouët", ok:true, ic:"store", d:"Plus grand marché du Gabon, ouvert au début des années 1970 ; opérations de dégagement des étals depuis 2024.", s:S.mb},
      {t:"Futur marché d'Akébé Ville", q:"Akébé", ok:true, ic:"store", d:"Site visité le 30 juillet 2026 avec le maire de Libreville.", s:S.terrain},
      {t:"Centre de santé communautaire d'Akébé", q:"Akébé", ok:true, ic:"cross", d:"Construction presque achevée (août 2026) : médecine générale, pédiatrie, gynécologie, ophtalmologie, laboratoire, imagerie. Ouverture effective à confirmer.", s:S.sante},
      {t:"Centre médical du Pont d'Akébé (30 lits)", q:"Akébé", ok:false, ic:"cross", d:"Annoncé pour la mi-août 2026 (Akébé, Nkembo, Rio) ; ouverture à confirmer.", s:S.hopitaux},
      {t:"Grand marché de la Peyrie (en construction)", q:"à confirmer", ok:false, ic:"crane", d:"Chantier visité le 19 octobre 2026 ; rattachement au 3e à confirmer.", s:S.marches},
      {t:"Deux établissements scolaires", q:"noms à confirmer", ok:false, ic:"school", d:"Visités avec le maire de Libreville en juillet 2026 ; noms non précisés.", s:S.terrain},
      {t:"Canal du PK8", q:"à confirmer", ok:false, ic:"wave", d:"Site de curage visité en juillet 2026 ; rattachement exact à confirmer.", s:S.terrain},
    ],
    actions:[
      {date:"2026-10-19", t:"Visite des marchés de la Peyrie et de Mont-Bouët par le maire de Libreville et le maire du 3e : avancement du chantier de la Peyrie, insalubrité de Mont-Bouët, prestataires de collecte rappelés à leurs engagements.", ...S.marches},
      {date:"2026-10-01", t:"Pénurie de timbres municipaux : le maire de Libreville autorise les maires d'arrondissement à légaliser les actes d'état civil sans timbre jusqu'au retour des stocks.", ...S.timbres},
      {date:"2026-09-01", t:"Opération de salubrité à Petit-Paris et Mont-Bouët guidée par le maire du 3e, Franck Ibouili : déchets, caniveaux, sensibilisation.", ...S.sale},
      {date:"2026-08-07", t:"Centre de santé communautaire d'Akébé : l'État achève la construction, présentée comme une avancée de proximité pour le 3e.", ...S.sante},
      {date:"2026-07-30", t:"Visite d'Eugène Mba dans le 3e : rencontre avec le personnel de la mairie et les chefs de quartier, canal du PK8, deux écoles, futur marché d'Akébé Ville, centre de santé d'Akébé.", ...S.terrain},
      {date:"2026-07-31", mois:"Fin juillet 2026", t:"Tournée de terrain du maire et de son 1er adjoint, Alex Jordy Mangala Yentsa, dans plusieurs quartiers (détail du contenu à confirmer).", ...S.x},
      {date:"2025-11-19", t:"Installation officielle du maire du 3e, Franck Ibouili, et de ses deux adjoints par le maire de Libreville de l'époque.", ...S.install},
    ],
    services:[
      "État civil : actes de naissance, de mariage, de décès",
      "Légalisation de documents et certificats (résidence, vie…)",
      "Célébration des mariages",
      "Salubrité, urbanisme et domaine public (marchés, canaux)",
      "Relais avec les chefs de quartier",
    ],
  };
})();
const QUARTIERS_3E = DOC3.quartiers.flatMap(q => [q, ...(q.sous || []).map(n => ({nom:n}))]);
const slug3 = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* ---------- Page « Notre arrondissement » ---------- */
function initArr() {
  const a = A3();
  // Carte d'identité de la mairie
  const idb = $("#arr-id");
  if (idb) {
    const maire = a.maire || MAIRIE.maire || "Franck Ibouili", adj = a.adj || MAIRIE.adjoints || ["Alex Jordy Mangala Yentsa", "Boris Mba Ndong"];
    const ini = n => n.split(" ").filter(Boolean).map(x => x[0]).slice(0, 2).join("");
    const rows = [
      [ICONS.pin, "Adresse", (MAIRIE.adresse || "Avenue de Cointet, Libreville").replace(/\s*\(à confirmer\)/i, "") + (MAIRIE.adresseAConfirmer !== false ? " [À CONFIRMER]" : "")],
      [ICONS.phone, "Téléphone", (MAIRIE.tels || []).length ? MAIRIE.tels.join(" · ") : "Non publié [À CONFIRMER]"],
      [ICONS.mail, "E-mail", MAIRIE.email || "Non publié [À CONFIRMER]"],
      [ICONS.clock, "Horaires", MAIRIE.horaires || "Non publiés [À CONFIRMER]"],
    ];
    idb.innerHTML = `<div class="mcard rv"><span class="av lg">${ini(maire)}</span><div><small>Maire du 3e arrondissement</small><h3>${escH(maire)}</h3><p>Installé le 19 novembre 2025, après les élections du 9 novembre, par le conseil d'arrondissement.</p></div></div>
      <div class="adjs rv d1"><div class="p"><span class="av">${ini(adj[0])}</span><span><b>${escH(adj[0])}</b><small>1er adjoint au maire</small></span></div><div class="p"><span class="av">${ini(adj[1])}</span><span><b>${escH(adj[1])}</b><small>2e adjoint au maire</small></span></div></div>
      <div class="cinfo rv d2">${rows.map(([ic, b, s]) => `<div class="citem"><span class="ic">${ic}</span><span><b>${b}</b><span>${conf(s)}</span></span></div>`).join("")}</div>`;
  }
  // Équipements et sites
  const eq = $("#equip-grid");
  const fromData = (a.equipements || []).map(e => ({t:e.nom, d:e.detail, ok:!e.aConfirmer, s:{src:e.src, url:e.url}, q:/akébé|akebe/i.test(e.nom + e.detail) ? "Akébé" : /mont-bou/i.test(e.nom) ? "Mont-Bouët" : "à confirmer", ic:/santé|médical/i.test(e.nom) ? "cross" : /marché/i.test(e.nom) ? "store" : "pin"}));
  const seen = new Set(fromData.map(e => slug3(e.t).slice(0, 14)));
  const EQ = fromData.concat(DOC3.equipements.filter(e => !seen.has(slug3(e.t).slice(0, 14))));
  if (eq) eq.innerHTML = EQ.map((e, k) => `<article class="eqc rv d${k % 3}"><span class="i">${ICONS[e.ic] || ICONS.pin}</span><div><div class="eh"><h3>${e.t}</h3><span class="chip ${e.ok ? "ok" : "warn"}">${e.ok ? "Confirmé" : "À confirmer"}</span></div><small class="eq-q">${e.q}</small><p>${e.d}</p><a class="src" href="${e.s.url}" target="_blank" rel="noopener">Source : ${e.s.src} ${ICONS.ext}</a></div></article>`).join("");
  // Actions datées et sourcées
  const tl = $("#actions-tl");
  const ACT = (a.actions && a.actions.length ? a.actions : DOC3.actions).slice().sort((x, y) => y.date.localeCompare(x.date));
  if (tl) tl.innerHTML = ACT.map(x => `<div class="tl rv"><b>${x.mois || fdate(x.date)}</b><p style="color:var(--ink)">${x.t}</p><a class="src" href="${x.url}" target="_blank" rel="noopener">Source : ${x.src} ${ICONS.ext}</a></div>`).join("");
  const sv = $("#services-3e");
  if (sv) sv.innerHTML = DOC3.services.map(s => `<li>${s}</li>`).join("");

  // Quartiers : onglets + fiche
  const fx = $("#q-focus"); if (!fx) return;
  const tabs = $("#q-tabs");
  tabs.innerHTML = DOC3.quartiers.map(q => `<button class="tab" data-q="${q.id}" style="--ac:${q.c}">${q.nom}${q.conf ? "" : ' <i class="qc" title="à confirmer">?</i>'}</button>`).join("");
  const set = (id, scroll) => {
    const q = DOC3.quartiers.find(x => x.id === id) || DOC3.quartiers[0];
    $$(".tab", tabs).forEach(t => t.classList.toggle("on", t.dataset.q === q.id));
    $$(".lbvmap .zone").forEach(z => z.classList.toggle("on", z.dataset.q === q.id));
    const eqs = DOC3.equipements.filter(e => e.q.startsWith(q.nom.split("-")[0].split(" ")[0]));
    fx.innerHTML = `<div class="focus">
      <div class="fimg"><img src="${IMG(q.img)}" alt="Illustration : ${escH(q.nom)}" loading="lazy"><span class="badge"><b>${q.nom}</b> ${q.conf ? "quartier du 3e" : "à confirmer"}</span><small class="imgnote">${q.cr}</small></div>
      <div><span class="eyebrow">Quartier du 3e arrondissement ${q.conf ? "" : '<span class="chip warn conf">à confirmer</span>'}</span><h2>${q.nom}</h2><p class="lead-p">${q.d}</p>
        ${q.sous ? `<div class="qs" style="margin-top:.8rem">${q.sous.map(n => `<span>${n}</span>`).join("")}</div>` : ""}
        <h4>À retenir</h4><ul class="checks">${q.faits.map(f => `<li>${f}</li>`).join("")}</ul>
        ${eqs.length ? `<h4>Équipements et sites</h4><div class="qs">${eqs.map(e => `<span>${e.t}</span>`).join("")}</div>` : ""}
        ${q.src.length ? `<p class="srcs">Sources : ${q.src.map(s => `<a class="src" href="${s.url}" target="_blank" rel="noopener">${s.src} ${ICONS.ext}</a>`).join(" · ")}</p>` : ""}
        <div class="aa" style="margin-top:1.2rem"><a class="btn btn-orange" href="demarches.html?d=signalement#demande">${ICONS.alert} Signaler dans ce quartier</a><a class="btn btn-line" href="demarches.html?d=rdv#demande">${ICONS.ticket} Rendez-vous à la mairie</a></div>
      </div></div>`;
    if (scroll) $("#focus-sec").scrollIntoView({behavior:"smooth"});
  };
  tabs.addEventListener("click", e => { const t = e.target.closest(".tab"); if (t) { set(t.dataset.q); history.replaceState(null, "", "#q-" + t.dataset.q); } });
  window.__arrSet = (id, scroll) => { set(id, scroll); history.replaceState(null, "", "#q-" + id); };
  document.addEventListener("click", e => { const f = e.target.closest("[data-focus]"); if (f) { e.preventDefault(); window.__arrSet(f.dataset.focus, true); } });
  const h = (location.hash.match(/#q-([a-z-]+)/) || [])[1];
  set(h);
  if (h) setTimeout(() => $("#focus-sec").scrollIntoView(), 300);
}
/* Accueil : aperçu de l'arrondissement */
function initArrHome() {
  const g = $("#arr-home"); if (!g) return;
  g.innerHTML = DOC3.quartiers.map((q, k) => `<a class="qcard rv d${k % 3}" style="--ac:${q.c}" href="arrondissement.html#q-${q.id}"><span class="dot"></span><span><b>${q.nom}</b><small>${q.conf ? (q.sous ? q.sous.join(" · ") : q.id === "mont-bouet" ? "Plus grand marché du Gabon" : "Marché et salubrité") : "Rattachement à confirmer"}</small></span>${ICONS.arrow}</a>`).join("");
}

/* ---------- Vérifier un document authentifié ---------- */
function initAuthCheck() {
  const form = $("#auth-form"); if (!form) return;
  $("[name=type]", form).innerHTML = TYPES_DOC.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  form.addEventListener("submit", async e => {
    e.preventDefault(); const out = $("#auth-out");
    out.innerHTML = '<p class="empty">Vérification…</p>';
    let a = null; try { a = await Store.verifDoc(form.num.value, form.nom.value, form.type.value); } catch (err) {}
    out.innerHTML = a ? acteBadge(a, true) + `<p class="imgnote" style="margin-top:.6rem">Titulaire : <b>${escH(a.titulaire)}</b></p>`
      : `<div class="auth-badge wait big"><span class="shield">${ICONS.shield}</span><span><b>Numéro non encore authentifié</b><small>Faites votre prochaine démarche en ligne en indiquant ce numéro, puis présentez l'original une seule fois au guichet de votre mairie d'arrondissement.</small></span></div>`;
  });
}

/* ---------- Projets ---------- */
function projCard(p) {
  const cls = {"Réalisé":"ok","En service":"ok","En cours":"info","Lancé":"info","Engagé":"info","Programmé":"warn","À l'étude":"neu"}[p.st];
  const where = p.arr ? "Dans le 3e arrondissement" : "Programme de la commune";
  return `<article class="ncard pcard rv"><div class="ph"><img src="${IMG(p.img)}" alt="${escH(p.t)}" loading="lazy"><span class="cat">${THEMES[p.th]}</span></div>
    <div class="bd"><div style="display:flex;gap:.4rem;flex-wrap:wrap"><span class="chip ${cls}">${p.st}</span><span class="chip neu">${where}</span></div><h3>${p.t}</h3><p>${p.d}</p>${p.note ? `<small class="imgnote">${p.note}</small>` : ""}</div></article>`;
}
function initProjets() {
  const box = $("#proj-grid"); if (!box) return;
  const limit = +box.dataset.limit || 0, tabs = $("#proj-tabs"), atabs = $("#proj-arr");
  let th = "tout", ar = "all";
  const render = () => {
    let list = PROJETS.filter(p => (th === "tout" || p.th === th) && (ar === "all" || (ar === "3" ? !!p.arr : !p.arr)));
    if (limit) list = list.slice(0, limit);
    box.innerHTML = list.length ? list.map(projCard).join("") : `<p class="empty">Aucun projet pour ce filtre.</p>`;
    requestAnimationFrame(() => $$(".rv", box).forEach((el, k) => setTimeout(() => el.classList.add("in"), k * 50)));
  };
  if (tabs) {
    tabs.innerHTML = [["tout","Tous les thèmes"], ...Object.entries(THEMES)].map(([k, l]) => `<button class="tab ${k === "tout" ? "on" : ""}" data-n="${k}">${l}</button>`).join("");
    tabs.addEventListener("click", e => { const t = e.target.closest(".tab"); if (!t) return; th = t.dataset.n; $$(".tab", tabs).forEach(x => x.classList.toggle("on", x === t)); render(); });
  }
  if (atabs) {
    atabs.innerHTML = [["all", "Tous les projets"], ["3", "Dans le 3e arrondissement"], ["0", "Programmes de la commune"]].map(([k, l]) => `<button class="tab ${k === "all" ? "on" : ""}" data-a="${k}">${l}</button>`).join("");
    atabs.addEventListener("click", e => { const t = e.target.closest(".tab"); if (!t) return; ar = t.dataset.a; $$(".tab", atabs).forEach(x => x.classList.toggle("on", x === t)); render(); });
  }
  render();
}

/* ---------- Actualités, avis, galerie ---------- */
function newsCard(a, k) {
  return `<article class="ncard rv d${k%3}"><div class="ph"><img src="${IMG(a.img)}" alt="${escH(a.t)}" loading="lazy"><span class="cat">${a.cat}</span></div><div class="bd"><small class="ndate">${ICONS.cal}${a.mois || fdate(a.date)}</small><h3>${a.t}</h3><p>${a.d}</p><a class="src" href="${a.url}" target="_blank" rel="noopener">Source : ${a.src} ${ICONS.ext}</a></div></article>`;
}
function initNews() {
  const box = $("#news"); if (!box) return;
  const n = +box.dataset.limit || ACTUS.length;
  box.innerHTML = ACTUS.slice(0, n).map(newsCard).join("");
}
async function initAvis() {
  const box = $("#avis"); if (!box) return;
  try { await Store.initPublic(); } catch (e) {}
  const list = Store.publicationsPubliques().slice(0, +box.dataset.limit || 20);
  const cls = {"Communiqué":"info","Avis":"warn","Marché public":"ok","Recrutement":"ok","Actualité":"neu"};
  box.innerHTML = list.length ? list.map(p => `<article class="avis rv"><div class="ah"><span class="chip ${cls[p.type] || "neu"}">${p.type}</span><small>${fdate(p.date)} · ${arrL(+p.arr)}</small></div><h3>${escH(p.titre)}</h3><p>${escH(p.texte)}</p></article>`).join("")
    : `<p class="empty">Aucun avis publié pour le moment.</p>`;
  initReveal();
}
function initGallery() {
  const g = $("#gallery"); if (!g) return;
  const cats = {ville:"La ville", mairie:"La mairie", terrain:"Sur le terrain", evenements:"Événements"};
  g.innerHTML = GALERIE.map((p, k) => `<figure data-cat="${p.cat}" data-i="${k}"><img src="${IMG(p.img)}" alt="${p.t}" loading="lazy"><figcaption><small>${cats[p.cat]} · © ${p.cr}</small>${p.t}</figcaption></figure>`).join("");
  const f = $("#gallery-filters");
  if (f) {
    f.innerHTML = `<button class="tab on" data-c="all">Tout</button>` + Object.entries(cats).map(([k,v]) => `<button class="tab" data-c="${k}">${v}</button>`).join("");
    f.addEventListener("click", e => { const b = e.target.closest(".tab"); if (!b) return; $$(".tab", f).forEach(x => x.classList.toggle("on", x === b)); $$("figure", g).forEach(fig => fig.classList.toggle("hide", b.dataset.c !== "all" && fig.dataset.cat !== b.dataset.c)); });
  }
  const lb = document.createElement("div"); lb.className = "lightbox";
  lb.innerHTML = '<button class="lb-back" aria-label="Retour">' + BACK_ICON + '<span>Retour</span></button><button class="lb-x" aria-label="Fermer">×</button><button class="lb-p" aria-label="Précédente">‹</button><img alt=""><button class="lb-n" aria-label="Suivante">›</button><p></p>';
  document.body.appendChild(lb);
  let cur = 0;
  const vis = () => $$("figure:not(.hide)", g).map(x => +x.dataset.i);
  const hideLb = fromPop => { if (!lb.classList.contains("on")) return; lb.classList.remove("on"); document.body.classList.remove("ov-open"); if (!fromPop) Back.close(hideLb); };
  const show = i => { cur = i; $("img", lb).src = IMG(GALERIE[i].img); $("p", lb).textContent = GALERIE[i].t + " — © " + GALERIE[i].cr; if (!lb.classList.contains("on")) { lb.classList.add("on"); document.body.classList.add("ov-open"); Back.open(hideLb); } };
  const nav = d => { const v = vis(); show(v[(v.indexOf(cur) + d + v.length) % v.length]); };
  g.addEventListener("click", e => { const fig = e.target.closest("figure"); if (fig) show(+fig.dataset.i); });
  lb.addEventListener("click", e => { if (e.target.closest(".lb-x") || e.target.closest(".lb-back") || e.target === lb) hideLb(); if (e.target.matches(".lb-p")) nav(-1); if (e.target.matches(".lb-n")) nav(1); });
  document.addEventListener("keydown", e => { if (!lb.classList.contains("on")) return; if (e.key === "Escape") hideLb(); if (e.key === "ArrowLeft") nav(-1); if (e.key === "ArrowRight") nav(1); });
}

/* ---------- Espace numérique : accès rapides (accueil) ---------- */
function initAccess() {
  const showDemo = (window.ESM_CONFIG || {}).showDemo !== false;
  const link = e => `espace.html?role=${e.role}${showDemo ? "&demo=1" : ""}`;
  const q = $("#quick-access");
  if (q) q.innerHTML = `<span class="ql">${ICONS.lock} Espace numérique</span>` + ESPACES.map(e => `<a href="${link(e)}" class="qbtn">${ICONS[e.ic]}${e.t}</a>`).join("");
  const c = $("#access-cards");
  if (c) c.innerHTML = ESPACES.map((e, i) => `<article class="acard rv d${i}" style="--c:${e.c}">
      <div class="ah"><span class="aic">${ICONS[e.ic]}</span><span><h3>${e.t}</h3><small>${e.s}</small></span></div>
      <ul>${e.pts.map(p => `<li>${p}</li>`).join("")}</ul>
      ${showDemo ? `<div class="creds"><small>Compte de démonstration · ${e.demo.nom}</small><div><span>Identifiant <b>${e.demo.login}</b></span><span>Mot de passe <b>${e.demo.pwd}</b></span></div></div>` : ""}
      <a class="btn btn-sm acta" href="${link(e)}">${showDemo ? "Tester l'espace" : "Accéder à mon espace"} ${ICONS.arrow}</a>
    </article>`).join("");
}

/* ---------- Contact (avec pièces jointes) ---------- */
function initContact() {
  const form = $("#contact-form"); if (!form) return;
  bindFileList($("#cpj", form), $("#cpj-list", form));
  const dest = $("[name=arr]", form);
  if (dest) dest.innerHTML = `<option value="${arrN()}">Mairie du 3e arrondissement</option><option value="0">Mairie centrale de Libreville (hôtel de ville)</option>`;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("button[type=submit]", form); btn.disabled = true; btn.textContent = "Envoi…";
    try {
      const pj = await readFiles($("#cpj", form)), d = Object.fromEntries(new FormData(form)); delete d.pj; d.arr = +d.arr || 0; d.pj = pj;
      await Store.addContact(d); form.reset(); $("#cpj-list", form).innerHTML = "";
      toast(`Message envoyé${pj.length ? " avec " + pj.length + " pièce(s) jointe(s)" : ""} ! Il a été transmis à la mairie.`, "ok");
    } catch (err) { toast("Envoi impossible : " + err.message, "err"); }
    btn.disabled = false; btn.textContent = "Envoyer";
  });
  const ci = $("#contact-info");
  if (ci) {
    const items = [[ICONS.pin, "Adresse", conf((MAIRIE.adresse || "").replace(/\s*\(à confirmer\)/i, "") + (MAIRIE.adresseAConfirmer ? " [À CONFIRMER]" : ""))]];
    MAIRIE.tels.forEach(t => items.push([ICONS.phone, "Téléphone", `<a href="tel:+241${t.replace(/\s/g,"").slice(1)}">${t}</a>`]));
    if (MAIRIE.email) items.push([ICONS.mail, "E-mail", `<a href="mailto:${MAIRIE.email}">${MAIRIE.email}</a>`]);
    items.push([ICONS.clock, "Horaires et téléphone", conf(MAIRIE.horaires ||  "Non publiés pour l'instant : utilisez le formulaire ou la page Facebook de la mairie. [À CONFIRMER]")]);
    if (MAIRIE.facebook) items.push([ICONS.fb, "Facebook", `<a href="${MAIRIE.facebook}" target="_blank" rel="noopener">Mairie du 3ème Arrondissement de Libreville</a>`]);
    if (MAIRIE.x) items.push([ICONS.chat, "Ville de Libreville sur X", `<a href="${MAIRIE.x}" target="_blank" rel="noopener">@MairieLbv</a>`]);
    const C = MAIRIE.centrale; if (C && C.facebook) items.push([ICONS.building, "Mairie centrale de Libreville", `${escH(C.adresse || "Hôtel de ville")} · <a href="${C.facebook}" target="_blank" rel="noopener">Facebook</a>`]);
    items.push([ICONS.map, "Votre quartier", `<a href="arrondissement.html">Quartiers et équipements du 3e arrondissement</a>`]);
    items.push([ICONS.qr, "Payer une taxe, vérifier une vignette", `<a href="payer.html">e-Services de la commune</a>`]);
    items.push([ICONS.cal, "Rencontrer le maire", `<a href="demarches.html?d=audience#demande">Demander une audience en ligne</a>`]);
    items.push([ICONS.search, "Suivre, payer, télécharger", `<a href="demarches.html#suivi">Avec votre numéro de dossier</a>`]);
    ci.innerHTML = items.map(([ic, b, s]) => `<div class="citem"><span class="ic">${ic}</span><span><b>${b}</b><span>${s}</span></span></div>`).join("");
  }
}


/* =========================================================
   Libreville — fonctions ajoutées
   ========================================================= */
const QR_LIB = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
const JSQR_LIB = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
const siteBase = () => location.href.replace(/[#?].*$/, "").replace(/[^/]*$/, "");
const vigUrl = num => siteBase() + "payer.html?v=" + encodeURIComponent(num);
const fjour = d => new Date(d + (String(d).length === 10 ? "T12:00:00" : "")).toLocaleDateString("fr-FR", {weekday:"long", day:"numeric", month:"long", year:"numeric"});
async function qrMake(text) { await loadScript(QR_LIB); const q = window.qrcode(0, "M"); q.addData(text); q.make(); return q; }
// Remplit tous les éléments [data-qr] avec un QR code SVG
async function drawQRs(root = document) {
  const els = $$("[data-qr]", root).filter(e => !e.dataset.done); if (!els.length) return;
  try { for (const e of els) { const q = await qrMake(e.dataset.qr); e.innerHTML = q.createSvgTag({cellSize:4, margin:2, scalable:true}); e.dataset.done = 1; } } catch (err) {}
}
// QR code dessiné dans un PDF (jsPDF) case par case
async function pdfQR(doc, text, x, y, size) {
  const q = await qrMake(text), n = q.getModuleCount(), c = size / n;
  doc.setFillColor(255, 255, 255); doc.rect(x - 2, y - 2, size + 4, size + 4, "F"); doc.setFillColor(0, 0, 0);
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) doc.rect(x + k * c, y + r * c, c + .05, c + .05, "F");
}
function rdvTicket(r) {
  if (!r || !r.rdv) return "";
  return `<div class="ticket"><div><small>Rendez-vous · mairie du ${escH(arrL(r.arr))}</small><b>${fjour(r.rdv.jour)}<br>à ${escH(r.rdv.heure)}</b><small>Ticket n°</small><b style="font-size:1rem;color:#fff">${escH(r.ref)}</b><small>${escH(r.prenom || "")} ${escH(r.nom || "")} · présentez-vous 10 min avant</small></div><div class="qrbox" data-qr="RDV ${escH(r.ref)} ${escH(r.rdv.jour)} ${escH(r.rdv.heure)}"></div></div>`;
}

/* Information utile : pénurie de timbres municipaux (bandeau sur l'accueil et les démarches) */
function initInfo() {
  const el = $("#info-timbres"); if (!el || typeof INFO_TIMBRES === "undefined") return;
  el.innerHTML = `<div class="infobar rv"><span class="ic">${ICONS.stamp}</span><div><b>Information utile · ${fdate(INFO_TIMBRES.date)}</b><p>${INFO_TIMBRES.d}</p><a class="src" href="${INFO_TIMBRES.url}" target="_blank" rel="noopener">Source : ${INFO_TIMBRES.src} ${ICONS.ext}</a></div></div>`;
}
/* ---------- Accueil : « Que voulez-vous faire ? », programme 3A ---------- */
function initDo() {
  const g = $("#do-grid"); if (!g) return;
  const T = [
    ["baby","Acte de naissance","Copie ou extrait, téléchargeable","demarches.html?d=naissance#demande","#0a5260"],
    ["wallet","Payer une taxe","Marché, vignette, domaine public","payer.html","#d9480f"],
    ["qr","Vérifier une vignette","Scanner le QR d'un taxi","payer.html#verifier","#1d6fb8"],
    ["ticket","Rendez-vous","Réserver son créneau au guichet","demarches.html?d=rdv#demande","#5b3fb3"],
    ["alert","Signaler","Ordures, caniveau, éclairage…","demarches.html?d=signalement#demande","#c99400"],
    ["search","Suivre mon dossier","Avec votre numéro","demarches.html#suivi","#0a8a55"],
  ];
  g.innerHTML = T.map(([ic, t, s, h, c], k) => `<a class="do rv d${k % 3}" href="${h}" style="--c:${c}"><span class="i">${ICONS[ic]}</span><b>${t}</b><small>${s}</small></a>`).join("");
}
function init3A() {
  const b = $("#p3a"); if (!b) return;
  b.innerHTML = PROG3A.map((p, k) => `<article class="rv d${k}" style="--c:${p.c}"><span class="big">A</span><span class="i">${ICONS[p.ic]}</span><h3>Une ville <span>${p.k.toLowerCase()}</span></h3><p>${p.d}</p><div class="qs">${p.tags.map(t => `<span>${t}</span>`).join("")}</div></article>`).join("");
}
function initExec() {
  const ini = n => n.split(" ").filter(Boolean).map(x => x[0]).slice(0, 2).join("");
  const c = $("#exec-c"), ex = (MAIRIE.centrale || {}).executif;
  if (c && ex) c.innerHTML = ex.map((p, k) => `<div class="p ${k ? "" : "lead"} rv d${k % 3}">${k ? `<span class="av">${ini(p.nom)}</span>` : `<img class="av av-photo" src="assets/img/maire-3e.png" alt="" width="56" height="56">`}<span><b>${p.nom}</b><small>${p.r}</small>${p.d ? `<em>${p.d}</em>` : ""}</span></div>`).join("");
  const b = $("#exec"); if (!b) return;
  b.innerHTML = EXECUTIF.map((p, k) => `<div class="p ${k ? "" : "lead"} rv d${k % 3}"><span class="av">${ini(p.nom)}</span><span><b>${p.nom}</b><small>${p.r}</small>${p.d ? `<em>${p.d}</em>` : ""}</span></div>`).join("");
}

/* ---------- Schéma des quartiers du 3e + « Dans quel quartier j'habite ? » ---------- */
function mapSVG() {
  return `<svg class="lbvmap" viewBox="0 0 640 440" role="img" aria-label="Schéma des quartiers du 3e arrondissement : Mont-Bouët, Petit-Paris, Akébé, Sorbonne et Nombakélé-Nord">
    <defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="none"/><path d="M0 0v8" stroke="#fff" stroke-width="2" opacity=".28"/></pattern></defs>
    <rect x="6" y="6" width="628" height="428" rx="26" fill="#e3f5f6"/>
    <g transform="translate(20 4)">
    ${DOC3.quartiers.map(q => `<g class="zg" tabindex="0" role="button" aria-label="${q.nom}${q.conf ? "" : " (à confirmer)"}" data-q="${q.id}">
      <polygon class="zone ${q.conf ? "" : "dash"}" data-q="${q.id}" points="${q.pts}" fill="${q.c}" stroke-linejoin="round"><title>${q.nom}</title></polygon>
      ${q.conf ? "" : `<polygon points="${q.pts}" fill="url(#hatch)" pointer-events="none"/>`}
      <text class="lbl" x="${q.lx}" y="${q.ly}" text-anchor="middle">${q.nom.replace("Nombakélé-Nord", "Nombakélé N.")}</text>${q.conf ? "" : `<text class="sub" x="${q.lx}" y="${q.ly + 18}" text-anchor="middle">à confirmer</text>`}
      ${q.pin ? `<g class="pin" transform="translate(${q.pin[0]} ${q.pin[1]})"><circle r="13" fill="#fff"/><text y="5" text-anchor="middle" fill="${q.c}">${q.pin[2]}</text></g>` : ""}
    </g>`).join("")}
    </g>
  </svg>`;
}
function initMap() {
  const m = $("#lbvmap");
  if (m) {
    m.innerHTML = mapSVG();
    const go = z => { if (!z) return; const g = z.closest("[data-q]"); if (!g) return; if (window.__arrSet) window.__arrSet(g.dataset.q, true); else location.href = "arrondissement.html#q-" + g.dataset.q; };
    m.addEventListener("click", e => go(e.target));
    m.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(e.target); } });
  }
  $$(".finder").forEach(initFinder);
}
function initFinder(f) {
  const inp = $("input", f), res = $(".res", f); if (!inp) return;
  const base = f.dataset.target || "";   // sur l'accueil, les liens renvoient à la page de l'arrondissement
  const look = v => {
    const k = slug3(v); if (k.length < 2) return null;
    const hit = DOC3.quartiers.find(q => [q.nom, ...(q.sous || []), ...q.alias].some(n => { const s = slug3(n); return s.includes(k) || (k.length > 3 && k.includes(s)); }));
    if (hit) return {q:hit};
    const site = DOC3.sites.find(s => s.k.some(n => { const t = slug3(n); return t.includes(k) || (k.length > 2 && k.includes(t)); }));
    return site ? {site} : {none:true};
  };
  const find = v => {
    const r = look(v); if (!r) { res.innerHTML = ""; return; }
    if (r.q) { const q = r.q; res.innerHTML = `<div class="hit" style="--ac:${q.c}"><span class="n">${ICONS.pin}</span><span><b>${q.nom} : mairie du 3e arrondissement</b><small>${q.conf ? "Maire : " + escH(A3().maire) : "Rattachement indiqué par la liste électorale de 2018, à confirmer"}</small></span><a class="btn btn-sm btn-navy" href="${base}arrondissement.html#q-${q.id}" data-focus="${q.id}">Voir</a></div>`; }
    else if (r.site) res.innerHTML = `<div class="hit warnb"><span class="n">${ICONS.alert}</span><span><b>${r.site.t}</b><small>${r.site.m}</small></span></div>`;
    else res.innerHTML = `<p class="imgnote" style="margin-top:.6rem">Ce nom ne figure pas dans la liste actuelle des quartiers du 3e (liste à valider par la mairie). <a href="contact.html" style="text-decoration:underline">Demandez à la mairie</a> si vous avez un doute.</p>`;
  };
  inp.addEventListener("input", () => find(inp.value));
  $(".chips", f).innerHTML = ["Mont-Bouët", "Petit-Paris", "Akébé Likouala", "Sorbonne", "Nombakélé", "PK8"].map(q => `<button type="button">${q}</button>`).join("");
  $(".chips", f).addEventListener("click", e => { const b = e.target.closest("button"); if (b) { inp.value = b.textContent; find(b.textContent); } });
}

/* ---------- e-Services : payer une taxe, vérifier une vignette ---------- */
function vigCard(v) {
  if (!v) return `<div class="vcard" style="--vc:#7a8794"><div class="vh">${ICONS.alert}<span><b>Vignette introuvable</b><small>Aucune vignette ne correspond à ce numéro ou à cette immatriculation.</small></span></div><div class="vb"><p class="lead-p" style="font-size:.92rem">Le véhicule doit régulariser sa situation : la vignette s'achète en ligne en quelques minutes, ci-dessus.</p></div></div>`;
  const C = {Valide:["#0a8a55","shieldok","Vignette valide"], "Expirée":["#c0392b","alert","Vignette expirée"], Suspendue:["#d97706","alert","Vignette suspendue"]}[v.etat];
  return `<div class="vcard" style="--vc:${C[0]}"><div class="vh">${ICONS[C[1]]}<span><b>${C[2]}</b><small>${escH(v.num)} · ${escH(v.catL)}</small></span></div>
    <div class="vb"><div class="kv"><div><small>Immatriculation</small><b>${escH(v.plaque)}</b></div><div><small>Titulaire</small><b>${escH(v.titulaire)}</b></div><div><small>Valable du</small><b>${fdate(v.debut)}</b></div><div><small>Jusqu'au</small><b style="color:${C[0]}">${fdate(v.fin)}</b></div>${v.controle ? `<div><small>Dernier contrôle</small><b>${fdate(v.controle.date)} · ${escH(v.controle.lieu)}</b></div>` : ""}</div>
    <div class="qrbox" data-qr="${escH(vigUrl(v.num))}"></div></div></div>`;
}
async function downloadVignette(v, recu) {
  const doc = await newPdf();
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(6, 54, 63); doc.text("VIGNETTE DE TRANSPORT", 105, 52, {align:"center"});
  doc.setFillColor(13, 71, 161); doc.roundedRect(35, 60, 140, 70, 5, 5, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.text("COMMUNE DE LIBREVILLE · " + (v.catL || "").toUpperCase(), 45, 72);
  doc.setFillColor(255, 255, 255); doc.roundedRect(45, 78, 80, 24, 3, 3, "F");
  doc.setTextColor(230, 74, 25); doc.setFontSize(22); doc.text(v.num.replace(/^L3-\w+-/, "N° "), 85, 94, {align:"center"});
  doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.text(v.num + "  ·  " + v.plaque, 45, 112); doc.text("Valable jusqu'au " + fdate(v.fin), 45, 120);
  await pdfQR(doc, vigUrl(v.num), 135, 76, 34);
  pdfRows(doc, 146, [["N° de vignette", v.num], ["Catégorie", v.catL], ["Immatriculation", v.plaque], ["Titulaire", v.titulaire], ["Valable du", fdate(v.debut)], ["Jusqu'au", fdate(v.fin)], ...(recu ? [["Quittance", recu.quittance], ["Payé par", recu.mode]] : [])]);
  pdfFoot(doc, verifCode(v.num));
  doc.save(`vignette-${v.num}.pdf`);
}
async function downloadTaxeRecu(r) {
  const doc = await newPdf();
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(6, 54, 63); doc.text("REÇU DE PAIEMENT · e-TAX", 105, 54, {align:"center"});
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(91, 107, 133); doc.text(`Quittance ${r.quittance}`, 105, 61, {align:"center"});
  const y = pdfRows(doc, 80, [["Taxe", r.taxe], ["Référence", r.vignette ? r.vignette.num + " · " + r.vignette.plaque : r.ref], ["Payé par", r.nom], ["Date", new Date(r.date).toLocaleString("fr-FR")], ["Moyen de paiement", r.mode], ["Transaction", r.transaction], ["Nature de la recette", r.nature]]);
  doc.setFillColor(226, 245, 236); doc.roundedRect(25, y + 4, 160, 18, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(10, 138, 85); doc.text(`Montant réglé : ${pdfMoney(r.montant)}`, 105, y + 15.5, {align:"center"});
  await pdfQR(doc, "L3 QUITTANCE " + r.quittance + " " + r.montant, 25, y + 30, 28);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(91, 107, 133); doc.text("Ce QR code permet à un agent de vérifier le paiement : plus besoin d'intermédiaire ni d'espèces.", 58, y + 46);
  pdfFoot(doc, verifCode(r.quittance));
  doc.save(`recu-${r.quittance}.pdf`);
}
function initPayer() {
  const form = $("#tax-form"); if (!form) return;
  const grid = $("#taxgrid"), mp = $("#mpay");
  let cur = TAXES[0];
  grid.innerHTML = TAXES.map(t => `<button type="button" class="tax" data-t="${t.id}"><span class="i">${ICONS[t.ic]}</span><span><b>${t.t}</b><small>${t.s}</small><em>${fcfa(t.prix)}</em></span></button>`).join("");
  mp.innerHTML = PAIEMENT.modes.map((m, i) => `<label><input type="radio" name="mode" value="${m.l}" ${i ? "" : "checked"}><span class="plogo ${m.id}">${payLogo(m.id)}</span>${m.l}</label>`).join("");
  $("[name=arr]", form).value = arrN();
  const sync = () => {
    $$(".tax", grid).forEach(b => b.classList.toggle("on", b.dataset.t === cur.id));
    $("#tref-l", form).textContent = cur.ref; $("[name=ref]", form).placeholder = cur.ph;
    const q = $("#tqte", form), many = cur.id === "place-j" || cur.id === "place-m";
    q.hidden = !many; $("#tqte-l", form).textContent = cur.id === "place-j" ? "Nombre de jours" : "Nombre de mois";
    const n = many ? Math.max(1, +$("[name=qte]", form).value || 1) : 1;
    $("#ttot", form).innerHTML = `<b class="price">${fcfa(cur.prix * n)}</b> <small style="color:var(--muted)">${cur.t}${n > 1 ? " × " + n : ""}</small>`;
  };
  grid.addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; cur = TAXES.find(t => t.id === b.dataset.t); sync(); });
  $("[name=qte]", form).addEventListener("input", sync);
  const pre = new URLSearchParams(location.search).get("t"); if (pre && TAXES.some(t => t.id === pre)) cur = TAXES.find(t => t.id === pre);
  sync();
  form.addEventListener("submit", async e => {
    e.preventDefault(); if (!form.reportValidity()) return;
    const f = Object.fromEntries(new FormData(form)), many = cur.id === "place-j" || cur.id === "place-m";
    const data = {taxe:cur.id, ref:f.ref, nom:f.nom, tel:f.tel, arr:+f.arr || 0, mode:f.mode, qte:many ? +f.qte || 1 : 1};
    const total = cur.prix * data.qte, isCard = /Carte/.test(f.mode);
    const m = modal("Paiement · " + fcfa(total), `<div class="paywait"><span class="spin"></span><p>${isCard ? "<b>Authentification 3-D Secure</b><br>Confirmation auprès de votre banque…" : `<b>Demande envoyée au ${escH(f.tel)}</b><br>Validez le paiement ${escH(f.mode)} sur votre téléphone…`}</p></div><p class="demo-pay">${ICONS.lock} Mode démonstration : aucun débit réel. En production, ce paiement est raccordé à la plateforme e-Tax de la commune (etax-libreville.ga) et à MADIGIPAIE.</p>`);
    m.dataset.lock = 1;
    let r; try { await new Promise(x => setTimeout(x, 2200)); r = await Store.payTaxe(data); } catch (err) { delete m.dataset.lock; modal("Paiement impossible", `<p class="alert-box">${ICONS.alert}<span>${escH(err.message)}</span></p>`); return; }
    delete m.dataset.lock; form.reset(); sync();
    modal("Paiement confirmé ✅", `<p class="lead-p">Merci <b>${escH(r.nom)}</b> ! Votre paiement est enregistré dans les recettes de la commune : aucun intermédiaire, aucune espèce.</p>
      ${r.vignette ? `<h4 style="color:var(--navy);margin:1rem 0 .6rem">Votre vignette numérique</h4>${vigCard(r.vignette)}` : ""}
      <div class="recu" style="margin-top:1rem"><div class="top"><div><small style="color:var(--muted)">Quittance</small><div class="refbig" style="font-size:1.3rem">${r.quittance}</div><small style="color:var(--muted)">${escH(r.taxe)} · ${escH(r.mode)} · ${escH(r.transaction)}</small></div><span class="amt">${fcfa(r.montant)}</span></div></div>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1rem">${r.vignette ? `<button class="btn btn-orange" id="dlv">${ICONS.dl} Ma vignette (PDF)</button>` : ""}<button class="btn ${r.vignette ? "btn-line" : "btn-orange"}" id="dlq">${ICONS.dl} Reçu (PDF)</button></div>`);
    drawQRs($("#modal"));
    $("#dlq").onclick = () => downloadTaxeRecu(r).catch(x => toast(x.message, "err"));
    if (r.vignette) $("#dlv").onclick = () => downloadVignette(r.vignette, r).catch(x => toast(x.message, "err"));
  });

  // Vérifier une vignette
  const vf = $("#vig-form"), out = $("#vig-out");
  const verify = async q => {
    if (!q) return; vf.q.value = q; out.innerHTML = '<p class="empty">Vérification…</p>';
    let v = null; try { await Store.initPublic(); v = await Store.verifVignette(q); } catch (e) {}
    out.innerHTML = vigCard(v); drawQRs(out);
  };
  vf.addEventListener("submit", e => { e.preventDefault(); verify(vf.q.value); });
  // Exemples de démonstration
  Store.initPublic().catch(() => {}).then(() => {
    const db = Store.db().vignettes || [], exp = db.find(v => v.fin < new Date().toISOString().slice(0, 10));
    $("#vig-demo").innerHTML = `Démonstration : <button type="button" data-q="L3-TX-0001">L3-TX-0001</button> (valide) · <button type="button" data-q="GA 0001 LV">GA 0001 LV</button>${exp ? ` · <button type="button" data-q="${exp.num}">${exp.num}</button> (expirée)` : ""} · <button type="button" data-q="GA 9999 ZZ">GA 9999 ZZ</button> (inconnue)`;
  });
  $("#vig-demo").addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (b) verify(b.dataset.q); });
  // Scanner avec la caméra
  const sb = $("#scan-btn"), box = $("#scanbox"); let stream = null, raf = 0;
  const stop = () => { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; box.hidden = true; box.innerHTML = ""; };
  sb.addEventListener("click", async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return toast("Caméra indisponible sur cet appareil : saisissez le numéro.", "err");
    try { await loadScript(JSQR_LIB); stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}); }
    catch (e) { return toast("Accès à la caméra refusé : saisissez le numéro de la vignette.", "err"); }
    box.hidden = false; box.innerHTML = `<video playsinline muted></video><span class="frame"></span><button type="button" class="btn btn-sm btn-line stop">Arrêter</button>`;
    $(".stop", box).onclick = stop;
    const v = $("video", box), c = document.createElement("canvas"), cx = c.getContext("2d", {willReadFrequently:true});
    v.srcObject = stream; await v.play().catch(() => {});
    const tick = () => {
      if (!stream) return;
      if (v.readyState >= 2) {
        c.width = v.videoWidth; c.height = v.videoHeight; cx.drawImage(v, 0, 0);
        const code = window.jsQR(cx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
        if (code && code.data) { stop(); let q = code.data; try { q = new URL(q).searchParams.get("v") || q; } catch (e) {} if (navigator.vibrate) navigator.vibrate(80); verify(q); return; }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
  });
  const pv = new URLSearchParams(location.search).get("v");
  if (pv) { verify(pv); setTimeout(() => $("#verifier").scrollIntoView({behavior:"smooth"}), 300); }
}

/* ---------- Transparence ---------- */
function initTransparence() {
  const k = $("#tr-kpis"); if (!k) return;
  const md = n => (n / 1e9).toFixed(2).replace(".", ",") + " Md";
  const nb = BUDGET.nbArr || 6, part = BUDGET.dotation / BUDGET.total * 100;
  k.innerHTML = [["≈ 230 M", "FCFA de dotation 2026 pour le 3e arrondissement"], ["× 3,3", "dotation portée de 70 à environ 230 M FCFA"], [md(BUDGET.total), "FCFA : budget communal 2026, adopté le 30 avril"], ["≈ " + part.toFixed(2).replace(".", ",") + " %", "part de la dotation du 3e dans le budget communal (calcul)"]]
    .map(([b, s], i) => `<div class="tr-kpi rv d${i % 3}"><b>${i === 1 ? "<em>" + b + "</em>" : b}</b><span>${s}</span></div>`).join("");
  $("#tr-chrono").innerHTML = BUDGET.chrono.slice().sort((a, b) => b.date.localeCompare(a.date)).map(c => `<div class="tl"><b>${c.m || fdate(c.date)}</b><p style="color:var(--ink)">${c.t}</p></div>`).join("");
  const avant = BUDGET.dotationAvant, apres = BUDGET.dotation;
  $("#tr-dot").innerHTML = `<div class="r"><span><b style="text-align:left;display:block">Avant 2026</b><small style="color:var(--muted)">dotation précédente</small></span><div class="bb"><i style="width:${avant / apres * 100}%;background:rgba(0,0,0,.28)"></i></div><b>70 M</b></div>
    <div class="r"><span><b style="text-align:left;display:block">2026</b><small style="color:var(--muted)">3e arrondissement</small></span><div class="bb"><i style="width:100%;background:var(--blue)"></i></div><b>≈ 230 M</b></div>
    <p class="legend"><span><i style="background:rgba(0,0,0,.35)"></i>Dotation précédente : 70 M FCFA</span><span><i style="background:var(--blue)"></i>Dotation 2026 : environ 230 M FCFA</span></p>
    <p class="imgnote" style="margin-top:.8rem">La répartition de cette dotation entre les actions de la mairie n'est pas encore publiée : elle sera ajoutée dès sa communication par la mairie.</p>`;
  $("#tr-prio").innerHTML = (BUDGET.priorites3e || []).map(p => `<li>${p} <span class="chip info">3e</span></li>`).join("") + BUDGET.priorites.map(p => `<li>${p}</li>`).join("");
  const docs = [["Budget communal 2026 (Commune de Libreville)", "Adopté le 30 avril 2026"], ["Utilisation de la dotation 2026 du 3e arrondissement", "À publier par la mairie"], ["Délibérations du conseil d'arrondissement", "À publier"], ["Grille des tarifs municipaux (taxes, vignettes, actes)", "À publier par délibération"], ["Compte administratif 2025", "À publier"]];
  $("#tr-docs").innerHTML = docs.map(([t, s]) => `<div class="doc">${ICONS.file}<span><b>${t}</b><small>${s}</small></span><span class="chip neu">${/Adopté/.test(s) ? "Adopté" : "À publier"}</span></div>`).join("");
  const cv = $("#tr-chart"); if (!cv) return;
  const dot3 = BUDGET.dotation, autres = BUDGET.dotation * (nb - 1), masse = BUDGET.total * BUDGET.masse, reste = BUDGET.total - masse - dot3 - autres;
  loadScript("https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js").then(() => {
    const C = window.Chart; C.defaults.font.family = "Inter, system-ui, sans-serif"; C.defaults.color = "#5b6b85";
    new C(cv, {type:"doughnut", data:{labels:["Masse salariale (≈ 70 %)", "Dotation du 3e arrondissement", `Dotations des ${nb - 1} autres arrondissements`, "Investissements, services et autres dépenses"], datasets:[{data:[masse, dot3, autres, reste], backgroundColor:["#06363f", "#d9480f", "#f5b301", "#18a7b5"], borderColor:"#fff", borderWidth:3}]},
      options:{maintainAspectRatio:false, cutout:"58%", plugins:{legend:{position:"bottom", labels:{boxWidth:12}}, tooltip:{callbacks:{label:c => c.raw < 1e9 ? ` ${c.label} : ${Math.round(c.raw / 1e6)} M FCFA` : ` ${c.label} : ${md(c.raw)} FCFA (${Math.round(c.raw / BUDGET.total * 100)} %)`}}}}});
  }).catch(() => {});
}

/* ---------- Application installable (PWA) ---------- */
let _installEvt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); _installEvt = e; });
function initInstall() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
  $$("[data-install]").forEach(b => b.addEventListener("click", async () => {
    if (_installEvt) { _installEvt.prompt(); const r = await _installEvt.userChoice.catch(() => null); _installEvt = null; if (r && r.outcome === "accepted") toast("Application installée sur votre téléphone ✅", "ok"); return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    modal("Installer « Mairie du 3e arrondissement »", `<p class="lead-p">Gardez la mairie dans votre poche : l'icône s'ajoute à votre écran d'accueil, comme une application, sans passer par un magasin d'applications.</p>
      <div class="howto" style="margin-top:1rem">${(ios ? [["Touchez le bouton <strong>Partager</strong> de Safari (carré avec une flèche)."],["Choisissez <strong>Sur l'écran d'accueil</strong>."],["Touchez <strong>Ajouter</strong> : c'est prêt."]] : [["Ouvrez le menu du navigateur <strong>⋮</strong> (en haut à droite)."],["Choisissez <strong>Installer l'application</strong> ou <strong>Ajouter à l'écran d'accueil</strong>."],["Confirmez : l'icône de la mairie apparaît sur votre téléphone."]]).map(([t], i) => `<div><b class="n">${i + 1}</b><p>${t}</p></div>`).join("")}</div>`);
  }));
}

document.addEventListener("DOMContentLoaded", () => {
  renderChrome(); initChrome(); initHero(); initDemarches(); initDemandeForm(); initSuivi(); initAuthCheck(); initProjets(); initNews(); initGallery(); initArr(); initAccess(); initContact();
  initInfo(); initDo(); init3A(); initExec(); initArrHome(); initMap(); initPayer(); initTransparence(); initInstall();
  initReveal(); initAvis();
});
