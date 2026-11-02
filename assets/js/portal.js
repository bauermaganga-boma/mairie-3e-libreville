/* Mairie du 3e arrondissement de Libreville — Espace numérique des agents (back-office, un seul arrondissement) */
const P = (() => {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = n => Math.round(n || 0).toLocaleString("fr-FR").replace(/ | /g, " ") + " FCFA";
  const mshort = n => n >= 1e9 ? (n / 1e9).toFixed(2).replace(".", ",") + " Md" : n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " M" : Math.round(n).toLocaleString("fr-FR");
  const date = d => d ? new Date(d).toLocaleDateString("fr-FR", {day:"numeric", month:"short", year:"numeric"}) : "—";
  const dtime = d => new Date(d).toLocaleString("fr-FR", {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"});
  const ago = d => { const s = (Date.now() - new Date(d)) / 1000; if (s < 0) return "à venir"; if (s < 60) return "à l'instant"; if (s < 3600) return `il y a ${Math.floor(s/60)} min`; if (s < 86400) return `il y a ${Math.floor(s/3600)} h`; if (s < 30*86400) return `il y a ${Math.floor(s/86400)} j`; return date(d); };
  const days = d => (Date.now() - new Date(d)) / 864e5;
  const ini = u => (((u.prenom || "")[0] || "") + ((u.nom || "")[0] || "")).toUpperCase();
  const A3 = (typeof ARR !== "undefined" && ARR) || ARRONDISSEMENTS[0], N3 = A3.n || 3;
  const arrL = () => "3e arr.";
  const qKey = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  const qClean = q => String(q || "").replace(/ \(.*\)$/, "").trim();
  const QS = ["Mont-Bouët", "Petit-Paris", "Akébé", "Sorbonne", "Nombakélé-Nord"];  // Akébé Ville / Akébé Likouala sont regroupés sous « Akébé »
  const qOf = q => { const k = qKey(q); if (!k) return null; return QS.find(x => qKey(x) === k) || QS.find(x => k.includes(qKey(x)) || qKey(x).includes(k)) || null; };
  const byQ = list => { const m = Object.fromEntries(QS.map(q => [q, 0])); let o = 0; list.forEach(x => { const q = qOf(x.quartier); if (q) m[q]++; else o++; }); const r = QS.map(q => [q, m[q]]); if (o) r.push(["Autres quartiers", o]); return r; };
  const empty = (t, ic = "inbox") => `<div class="empty">${ICONS[ic]}<p>${t}</p></div>`;
  const opt = (list, cur) => list.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${String(v) === String(cur) ? "selected" : ""}>${esc(l)}</option>`; }).join("");
  const DOT_M = Math.round(DOTATION / 1e6) + " M";
  const SVC_LBL = {};
  const stChip = s => { const c = {"Valide":"ok","Expirée":"bad","Reçu":"ok","Attendu":"info","Absent":"neu","En service":"ok","Engagé":"info","Nouvelle":"bad","Nouveau":"bad","En traitement":"info","Pris en charge":"info","En intervention":"info","Pièce manquante":"warn","Prête":"ok","Remise":"neu","Résolu":"ok","Rejetée":"neu","En cours":"info","Programmé":"warn","Réalisé":"ok","À l'étude":"neu","Suspendu":"bad","Lancé":"info"}[s] || "neu"; return `<span class="chip ${c}">${esc(s)}</span>`; };
  async function act(fn, okMsg) { try { const r = await fn(); if (okMsg) toast(okMsg, "ok"); return r ?? true; } catch (e) { toast(e.message || "Une erreur est survenue.", "err"); return false; } }
  const kpis = list => `<div class="kpis">${list.map(([ic, cls, v, l, h]) => `<${h ? `a href="${h}"` : "div"} class="kpi${h ? " lnk" : ""}"><span class="ic ${cls}">${ICONS[ic]}</span><span><b>${v}</b><span>${l}</span></span></${h ? "a" : "div"}>`).join("")}</div>`;
  const tbl = (head, rows, emptyMsg = "Aucun élément", extra = "") => rows.length ? `<div class="tbl-wrap"><table class="tbl rc"><thead><tr>${head.map(h => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => { let i = 0; return r.replace(/<td(?=[ >])/g, () => { const l = head[i++]; return l ? `<td data-l="${esc(l)}"` : "<td"; }).replace('<tr class="clk"', '<tr class="clk" tabindex="0"'); }).join("")}</tbody></table></div>` : empty(emptyMsg) + extra;
  const dotCard = ch => {
    const eng = ch.reduce((s, c) => s + (+c.engage || 0), 0), pct = Math.min(100, Math.round(eng / DOTATION * 100));
    return `<div class="card dot"><h2>Dotation 2026 de la mairie <a class="btn btn-line btn-sm" href="#chantiers">Voir les chantiers</a></h2><div class="dot-top"><b>${mshort(eng)} FCFA</b><span>engagés sur ${DOT_M} FCFA</span><em>${pct} %</em></div><div class="prog dotbar" role="progressbar" aria-label="Dotation engagée" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div><small>Reste ${mshort(Math.max(0, DOTATION - eng))} FCFA disponibles · ${ch.filter(c => c.statut === "En cours").length} chantier(s) en cours · ${ch.filter(c => c.statut === "Réalisé").length} réalisé(s)</small></div>`;
  };
  /* Boîte de dialogue (confirmation / saisie) : remplace confirm() et prompt(), compatible touche « retour » du téléphone */
  function ask(msg, o = {}) {
    return new Promise(res => {
      const prev = document.activeElement, del = /^Supprimer/.test(msg), el = document.createElement("div");
      el.className = "dlg"; el.setAttribute("role", "alertdialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "dlg-t");
      el.innerHTML = `<form class="dlg-box"><h3 id="dlg-t">${esc(o.title || (o.input ? "Saisie" : del ? "Suppression" : "Confirmation"))}</h3><p>${esc(msg)}</p>${o.input ? `<label class="sr-only" for="dlg-i">${esc(msg)}</label><input id="dlg-i" type="${o.input}" value="${esc(o.value || "")}" minlength="${o.min || 0}" autocomplete="off" required>` : ""}<div class="dlg-act"><button type="button" class="btn btn-line" data-r="0">Annuler</button><button type="submit" class="btn ${del ? "btn-danger" : "btn-orange"}">${esc(o.ok || (del ? "Supprimer" : "Confirmer"))}</button></div></form>`;
      document.body.appendChild(el);
      let closed = false;
      const done = (v, fromPop) => { if (closed) return; closed = true; document.removeEventListener("keydown", key, true); el.remove(); if (!fromPop) Back.close(pop); try { prev && prev.focus && prev.focus(); } catch (e) {} res(v); };
      const pop = fromPop => done(false, fromPop);
      const key = e => { if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); done(false); } };
      document.addEventListener("keydown", key, true);
      Back.open(pop);
      el.addEventListener("click", e => { if (e.target === el || e.target.closest("[data-r='0']")) done(false); });
      el.querySelector("form").onsubmit = e => { e.preventDefault(); const i = el.querySelector("input"); if (i && i.value.length < (o.min || 0)) { i.reportValidity(); return; } done(i ? i.value : true); };
      setTimeout(() => (el.querySelector("input") || el.querySelector("[type=submit]")).focus(), 30);
    });
  }
  const hbars = (pairs, fmt = v => v) => { const max = Math.max(1, ...pairs.map(p => p[1])); return `<div class="hbars">${pairs.map(([l, v]) => `<div class="r"><span title="${esc(l)}">${esc(l)}</span><div class="prog"><i style="width:${v / max * 100}%"></i></div><b>${fmt(v)}</b></div>`).join("")}</div>`; };
  const vbars = (pairs, fmt) => { const max = Math.max(1, ...pairs.map(p => p[1])); return `<div class="bars flat">${pairs.map(([l, v]) => `<div class="b"><em>${fmt(v)}</em><i style="height:${Math.max(3, v / max * 100)}%"></i><small>${l}</small></div>`).join("")}</div>`; };
  function csv(name, head, rows) {
    const c = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const blob = new Blob(["﻿" + [head, ...rows].map(r => r.map(c).join(";")).join("\n")], {type:"text/csv;charset=utf-8"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name + ".csv"; a.click();
  }
  function printHTML(title, html) {
    const w = window.open("", "_blank"); if (!w) return toast("Autorisez les fenêtres pour imprimer.", "err");
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="assets/css/style.css"><style>body{background:#fff;padding:2rem}</style></head><body>${html}<script>setTimeout(()=>print(),400)<\/script></body></html>`);
    w.document.close();
  }
  /* Erreur de formulaire : message visible en haut du formulaire + champ mis en évidence + focus */
  function bad(fm, msg, name) {
    let b = fm.querySelector(".form-err"); if (!b) { b = document.createElement("div"); b.className = "form-err"; b.setAttribute("role", "alert"); fm.prepend(b); }
    b.textContent = msg; b.classList.add("on");
    const f = name && fm.elements[name]; if (f) { f.classList.add("bad"); f.focus(); f.addEventListener("input", () => { f.classList.remove("bad"); b.classList.remove("on"); }, {once:true}); }
    b.scrollIntoView({block:"nearest"}); return false;
  }
  const TEL_RE = /^\+?[0-9 .-]{8,18}$/;
  const filterBar = (fields, onChange, root) => root.querySelectorAll("[data-f]").forEach(i => i.addEventListener(i.tagName === "INPUT" ? "input" : "change", e => {
    const k = e.target.dataset.f, pos = e.target.selectionStart, txt = e.target.tagName === "INPUT";
    onChange(e); saveF();
    if (txt) { const n = document.querySelector('#views [data-f="' + k + '"]'); if (n && n !== e.target) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} } }
  }));
  /* Filtres mémorisés (par compte, dans ce navigateur) */
  const fKey = () => "l3e-bo-filtres-" + (me ? me.login : "");
  const saveF = () => { try { const o = {...F}; delete o.rdv; localStorage.setItem(fKey(), JSON.stringify(o)); } catch (e) {} };
  const loadF = () => { try { Object.assign(F, JSON.parse(localStorage.getItem(fKey()) || "{}")); } catch (e) {} };
  const resetBtn = k => '<p style="text-align:center"><button type="button" class="btn btn-line btn-sm" data-reset="' + k + '">Réinitialiser les filtres</button></p>';
  const today = () => new Date().toISOString().slice(0, 10);
  const isToday = d => new Date(d).toDateString() === new Date().toDateString();

  let me, NAV, VIEWS, cur, route;
  const charts = [];
  const F = {}; // filtres mémorisés par module

  async function boot() {
    const views = document.getElementById("views");
    views.innerHTML = `<div class="empty"><p>Chargement de votre espace…</p></div>`;
    let u = null;
    try { u = await Store.init(); } catch (e) { views.innerHTML = empty("Connexion à la base impossible. Vérifiez votre connexion internet puis rechargez la page."); return; }
    if (!u) { location.replace("espace.html"); return; }
    me = u; loadF();
    const n = document.querySelector(".notice");
    if (n) n.textContent = Store.LIVE ? "Connecté à la base de données de la mairie — les modifications sont partagées en temps réel avec tous les services." : "Mode démonstration : les données (personnes, montants, dossiers) sont fictives et enregistrées dans ce navigateur. En production, la même interface est branchée sur une base de données sécurisée partagée par tous les services.";
    start();
    Store.subscribe(col => { if (col === "demandes" || col === "signalements") toast("Nouvelle activité reçue du site public."); route(false); });
  }

  function shell() {
    const sb = document.getElementById("sb");
    sb.setAttribute("aria-label", "Navigation du back-office");
    const bn = document.createElement("nav"); bn.className = "bnav"; bn.id = "bnav"; bn.setAttribute("aria-label", "Accès rapide"); document.body.appendChild(bn);
    const PREF = ["demandes", "signalements", "recettes", "agents", "chantiers", "actes", "stocks", "publications"], SL = {tableau:"Accueil", demandes:"Demandes", signalements:"Signal.", recettes:"Recettes", agents:"Personnel", chantiers:"Chantiers", actes:"Registre", stocks:"Stocks", publications:"Site"};
    const drawBnav = () => {
      const pick = [NAV[0], ...PREF.map(id => NAV.find(n => n.id === id)).filter(Boolean)].filter((n, i, a) => n && a.indexOf(n) === i).slice(0, 4);
      bn.innerHTML = pick.map(n => { const b = n.badge ? n.badge() : 0; return `<a href="#${n.id}" class="${n.id === cur ? "on" : ""}" ${n.id === cur ? 'aria-current="page"' : ""}>${ICONS[n.ic]}<span>${SL[n.id] || n.l}</span>${b ? `<i class="pill" aria-label="${b} à traiter">${b}</i>` : ""}</a>`; }).join("") +
        `<button type="button" id="bnmenu" aria-label="Ouvrir le menu complet"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg><span>Menu</span></button>`;
      document.getElementById("bnmenu").onclick = e => { e.stopPropagation(); document.getElementById("sbt").click(); };
    };
    const draw = () => {
      let lastG = "";
      sb.innerHTML = `<button type="button" class="sb-back" id="sbback">${BACK_ICON}<span>Fermer le menu</span></button><div class="sb-brand"><img src="assets/img/logo-lbv.svg" alt=""><span><b>Mairie du 3e arrondissement</b><small>Libreville · ${esc(Store.ROLES[me.role].l)}</small></span></div>` +
        NAV.map(n => { const b = n.badge ? n.badge() : 0, g = n.g && n.g !== lastG ? (lastG = n.g, `<div class="sb-group">${n.g}</div>`) : ""; return g + `<a href="#${n.id}" data-v="${n.id}" class="${n.id === cur ? "on" : ""}" ${n.id === cur ? 'aria-current="page"' : ""}>${ICONS[n.ic]}${n.l}${b ? `<span class="pill" aria-label="${b} à traiter">${b}</span>` : ""}</a>`; }).join("") +
        `<div class="sb-foot"><a href="index.html">${ICONS.home}Retour au site</a><button class="lnk" id="logout">${ICONS.out}Déconnexion</button></div>`;
      document.getElementById("logout").onclick = async () => { await Store.logout(); location.href = "espace.html"; };
      document.getElementById("sbback").onclick = () => closeSb();
      const vb = document.getElementById("vback"); if (vb) vb.hidden = cur === NAV[0].id;
      drawBnav();
      const tot = NAV.reduce((a, n) => a + (n.badge ? n.badge() : 0), 0), cn = NAV.find(n => n.id === cur) || NAV[0];
      document.title = (tot ? "(" + tot + ") " : "") + cn.l + " – Mairie du 3e arrondissement";
    };
    P.redrawNav = draw;
    document.getElementById("who").innerHTML = `<span class="av">${ini(me)}</span><span><b>${esc(me.prenom + " " + me.nom)}</b><small>${esc(me.titre || Store.ROLES[me.role].l)}</small></span>`;
    const closeSb = fromPop => { if (!sb.classList.contains("open")) return; sb.classList.remove("open"); document.getElementById("sbt").setAttribute("aria-expanded", "false"); document.body.classList.remove("nav-open"); if (!fromPop) Back.close(closeSb); };
    document.getElementById("sbt").onclick = e => { e.stopPropagation(); if (sb.classList.contains("open")) return closeSb(); sb.classList.add("open"); document.getElementById("sbt").setAttribute("aria-expanded", "true"); document.body.classList.add("nav-open"); Back.open(closeSb); };
    document.querySelector(".app-main").addEventListener("click", () => closeSb());
    // « ← Retour » : écran précédent du back-office, sinon le tableau de bord
    const visited = [location.hash.slice(1) || NAV[0].id];
    const vb = document.getElementById("vback");
    if (vb) vb.onclick = () => { if (visited.length > 1) history.back(); else location.hash = NAV[0].id; };
    document.getElementById("views").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("tr.clk")) { e.preventDefault(); e.target.click(); } });
    const quit = document.getElementById("quit");
    if (quit) quit.onclick = async () => { quit.disabled = true; await Store.logout().catch(() => {}); location.href = "index.html"; };
    route = (top = true) => {
      if (document.querySelector("#modal.on")) return; // ne pas fermer une fiche ouverte
      const id = location.hash.slice(1);
      cur = NAV.some(n => n.id === id) ? id : NAV[0].id;
      const n = NAV.find(x => x.id === cur), y = scrollY;
      document.getElementById("vt").textContent = n.l; document.getElementById("vs").textContent = n.s || ""; document.title = n.l + " – Mairie du 3e arrondissement";
      while (charts.length) charts.pop().destroy();
      document.getElementById("views").innerHTML = `<div class="view on" id="v-${cur}"></div>`;
      VIEWS[cur](document.getElementById("v-" + cur));
      if (sb.classList.contains("open")) closeSb();
      draw(); scrollTo(0, top ? 0 : y);
      if (top) { const h = document.getElementById("vt"); h.tabIndex = -1; try { h.focus({preventScroll:true}); } catch (e) {} }
    };
    P.route = route;
    addEventListener("hashchange", () => { const h = location.hash.slice(1) || NAV[0].id; if (visited.length > 1 && visited[visited.length - 2] === h) visited.pop(); else if (visited[visited.length - 1] !== h) visited.push(h); route(); });
    route();
  }
  const closeModal = () => window.pogCloseModal();
  const refresh = () => { closeModal(); route(false); };

  /* =========================================================
     APPLICATION
     ========================================================= */
  function start() {
    const L = c => Store.list(c);
    const open = s => !/Remise|Rejetée|Résolu|Prête/.test(s);
    const thisMonth = d => { const a = new Date(d), b = new Date(); return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear(); };
    const lowStocks = () => L("stocks").filter(s => s.qte <= s.seuil);

    const ALL = [
      {g:"Pilotage", id:"tableau", l:"Tableau de bord", ic:"gauge", s:"Vue d'ensemble de la mairie du 3e en temps réel"},
      {g:"Pilotage", id:"indicateurs", l:"Indicateurs", ic:"chart", s:"Quartiers, services, délais et recettes de la mairie du 3e"},
      {g:"Pilotage", id:"agenda", l:"Agenda & audiences", ic:"cal", s:"Rendez-vous du maire, réunions, visites de terrain"},
      {g:"Services à la population", id:"demandes", l:"Demandes", ic:"inbox", s:"Démarches reçues en ligne et au guichet", badge:() => L("demandes").filter(d => d.statut === "Nouvelle").length},
      {g:"Services à la population", id:"rendezvous", l:"Rendez-vous guichet", ic:"ticket", s:"Créneaux réservés en ligne par les usagers, guichet par guichet", badge:() => L("demandes").filter(d => d.type === "rdv" && d.rdv && d.rdv.jour === new Date().toISOString().slice(0, 10) && d.statut === "Nouvelle").length},
      {g:"Services à la population", id:"authentifications", l:"Actes authentifiés", ic:"shieldok", s:"Original vérifié une seule fois : ensuite, toutes les démarches se font en ligne", badge:() => L("authentifications").filter(a => a.statut === "En attente").length},
      {g:"Services à la population", id:"actes", l:"Registre d'état civil", ic:"book", s:"Naissances, mariages et décès enregistrés numériquement"},
      {g:"Services à la population", id:"signalements", l:"Signalements", ic:"alert", s:"Problèmes signalés par les habitants du 3e", badge:() => L("signalements").filter(d => d.statut === "Nouveau").length},
      {g:"Services à la population", id:"vignettes", l:"Vignettes QR", ic:"qr", s:"Registre des vignettes de transport, renouvellements et contrôle sur le terrain", badge:() => Store.list("vignettes").filter(v => v.statut === "Active" && v.fin < new Date().toISOString().slice(0, 10)).length},
      {g:"Gestion municipale", id:"recettes", l:"Recettes", ic:"wallet", s:"Encaissements, quittances et suivi des recettes municipales"},
      {g:"Gestion municipale", id:"chantiers", l:"Chantiers", ic:"crane", s:"Suivi des projets, budgets et dotation 2026"},
      {g:"Gestion municipale", id:"stocks", l:"Stocks", ic:"box", s:"Fournitures sensibles avec alertes automatiques", badge:() => lowStocks().length},
      {g:"Gestion municipale", id:"agents", l:"Personnel", ic:"users", s:"Dossiers des agents de la mairie et pièces manquantes"},
      {g:"Communication", id:"publications", l:"Publications du site", ic:"mega", s:"Avis, communiqués, marchés publics et recrutements affichés sur le site"},
      {g:"Communication", id:"contacts", l:"Messages reçus", ic:"mail", s:"Messages et pièces jointes envoyés depuis le site", badge:() => Store.list("contacts").filter(c => !c.lu).length},
      {g:"Administration", id:"journal", l:"Journal d'activité", ic:"clock", s:"Traçabilité : qui a fait quoi, et quand"},
      {g:"Administration", id:"comptes", l:"Comptes agents", ic:"lock", s:"Créer et gérer les accès par service"},
      {g:"Administration", id:"compte", l:"Mon compte", ic:"edit", s:"Profil et mot de passe"},
    ];
    NAV = ALL.filter(n => n.id === "comptes" ? me.role === "sg" : Store.can(n.id));

    VIEWS = {
      /* ---------------- Tableau de bord ---------------- */
      tableau(el) {
        const dem = L("demandes"), sig = L("signalements"), rec = L("recettes"), ch = L("chantiers"), r = me.role, full = Store.ROLES[r].mods === "*";
        const late = dem.filter(d => open(d.statut) && days(d.date) > 7), hot = sig.filter(s => s.priorite === "Haute" && s.statut !== "Résolu");
        const chC = ch.filter(c => c.statut === "En cours"), td = today();
        const recM = rec.filter(x => days(x.date) <= 30).reduce((a, x) => a + x.montant, 0), recJ = rec.filter(x => isToday(x.date)).reduce((a, x) => a + x.montant, 0);
        const onl = (() => { const r30 = rec.filter(x => days(x.date) <= 30), t30 = r30.reduce((a, x) => a + x.montant, 0); return t30 ? Math.round(r30.filter(x => Store.ONLINE_RE.test(x.mode)).reduce((a, x) => a + x.montant, 0) / t30 * 100) + " %" : "—"; })();
        const nDem = dem.filter(d => d.statut === "Nouvelle" && d.type !== "rdv"), nSig = sig.filter(s => s.statut === "Nouveau");
        const rdvJ = dem.filter(d => d.type === "rdv" && d.rdv && d.rdv.jour === td).sort((a, b) => a.rdv.heure.localeCompare(b.rdv.heure));
        const vigExp = Store.can("vignettes") ? L("vignettes").filter(v => v.statut === "Active" && v.fin < td) : [];
        const ag = Store.can("agents") ? L("agents") : [], incAg = ag.filter(x => Object.values(x.pieces).some(v => !v));
        let k = [], lead = "";
        if (r === "etatcivil") { k = [["inbox","ic-o", dem.filter(d => isToday(d.date)).length, "demandes reçues aujourd'hui", "#demandes"],["clock","ic-b", nDem.length, "nouvelles demandes à traiter", "#demandes"],["ticket","ic-y", rdvJ.length, "rendez-vous au guichet aujourd'hui", "#rendezvous"],["shieldok","ic-g", L("authentifications").filter(a => a.statut === "En attente").length, "originaux à vérifier", "#authentifications"]]; lead = "Vos demandes du jour"; }
        else if (r === "technique") { k = [["alert","ic-o", nSig.length, "nouveaux signalements", "#signalements"],["alert","ic-o", hot.length, "prioritaires non résolus", "#signalements"],["crane","ic-b", sig.filter(s => /Pris en charge|En intervention/.test(s.statut)).length, "en cours de traitement", "#signalements"],["crane","ic-y", chC.length, "chantiers en cours", "#chantiers"]]; lead = "Vos signalements à traiter"; }
        else if (r === "finances") { k = [["wallet","ic-g", mshort(recJ), "FCFA encaissés aujourd'hui", "#recettes"],["chart","ic-b", mshort(recM), "FCFA sur 30 jours", "#recettes"],["phone","ic-o", onl, "payés en ligne (30 j)", "#indicateurs"],["qr","ic-y", vigExp.length, "vignettes expirées à renouveler", "#vignettes"]]; lead = "Vos encaissements du jour"; }
        else if (r === "rh") { k = [["users","ic-b", ag.length, "agents suivis", "#agents"],["check","ic-g", ag.length - incAg.length, "dossiers complets", "#agents"],["file","ic-o", incAg.length, "dossiers incomplets", "#agents"],["gauge","ic-y", ag.length ? Math.round((ag.length - incAg.length) / ag.length * 100) + " %" : "—", "taux de complétude", "#agents"]]; lead = "Vos dossiers du personnel"; }
        else { k = [["inbox","ic-b", dem.filter(d => open(d.statut)).length, "demandes en cours", "#demandes"],["alert","ic-o", sig.filter(s => s.statut !== "Résolu").length, "signalements ouverts", "#signalements"],["wallet","ic-g", mshort(recM), "FCFA encaissés sur 30 jours", "#recettes"],["crane","ic-y", chC.length, "chantiers en cours", "#chantiers"]]; lead = "Vue d'ensemble de la mairie"; }
        const alerts = [];
        if (Store.can("stocks")) lowStocks().forEach(s => alerts.push(["bad", `Stock bas : <b>${esc(s.article)}</b> — ${s.qte} ${esc(s.unite)}(s) restant(s), seuil ${s.seuil}.`, "#stocks"]));
        if (Store.can("demandes") && late.length) alerts.push(["warn", `<b>${late.length} demande(s)</b> en attente depuis plus de 7 jours.`, "#demandes"]);
        if (Store.can("signalements") && hot.length) alerts.push(["warn", `<b>${hot.length} signalement(s) prioritaire(s)</b> non résolu(s) (caniveaux, eau).`, "#signalements"]);
        if (vigExp.length) alerts.push(["warn", `<b>${vigExp.length} vignette(s)</b> expirée(s) à renouveler.`, "#vignettes"]);
        if (incAg.length) alerts.push(["warn", `<b>${incAg.length} dossier(s) du personnel</b> avec des pièces manquantes.`, "#agents"]);
        const off = new Date().getDate() <= 7 ? 1 : 0, months = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i - off); return d; });
        const recByM = months.map(m => [m.toLocaleDateString("fr-FR", {month:"short"}), rec.filter(x => { const d = new Date(x.date); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); }).reduce((a, x) => a + x.montant, 0)]);
        const journal = Store.list("journal").slice(0, 7);
        const hr = new Date().getHours(), hi = hr >= 18 || hr < 5 ? "Bonsoir" : "Bonjour";
        const covered = k.map(x => x[4]), todo = NAV.filter(n => n.badge && n.badge() > 0 && !covered.includes("#" + n.id));
        const qSrc = (Store.can("demandes") ? dem : []).concat(Store.can("signalements") ? sig : []).filter(x => days(x.date) <= 180);
        const qRows = byQ(qSrc);
        // Files de travail : les dossiers à traiter, avec l'action suivante en 1 clic
        const wl = (col, list, more) => list.length ? `<div class="wl">${list.map(d => `<div class="wl-row" data-open="${col}|${d.id}" tabindex="0" role="button"><span class="wl-main"><b>${d.ref}</b>${isToday(d.date) ? " <span class=\"chip info\">aujourd'hui</span>" : ""}${d.priorite === "Haute" ? " <span class=\"chip bad\">Haute</span>" : ""}<small>${esc(d.typeLabel)} · ${esc(d.prenom)} ${esc(d.nom)}${d.quartier ? " · " + esc(d.quartier) : ""} · ${ago(d.date)}</small></span>${nextBtn(col, d)}</div>`).join("")}</div>${more}` : empty("Rien à traiter : tout est à jour.", "check");
        const qDem = nDem.slice().sort((a, b) => a.date.localeCompare(b.date)), qSig = nSig.slice().sort((a, b) => (b.priorite === "Haute") - (a.priorite === "Haute") || a.date.localeCompare(b.date));
        const more = (n, h, l) => n > 6 ? `<p class="wl-more"><a href="${h}">Voir les ${n} ${l} →</a></p>` : "";
        const cardDem = Store.can("demandes") ? `<div class="card bo-queue"><h2><span>Demandes à traiter <small class="sub">${qDem.length} nouvelle(s) · ${qDem.filter(d => isToday(d.date)).length} reçue(s) aujourd'hui</small></span><a class="btn btn-line btn-sm" href="#demandes">Tout voir</a></h2>${wl("demandes", qDem.slice(0, 6), more(qDem.length, "#demandes", "demandes"))}</div>` : "";
        const cardSig = Store.can("signalements") ? `<div class="card bo-queue"><h2><span>Signalements à traiter <small class="sub">${qSig.length} nouveau(x) · ${hot.length} prioritaire(s)</small></span><a class="btn btn-line btn-sm" href="#signalements">Tout voir</a></h2>${wl("signalements", qSig.slice(0, 6), more(qSig.length, "#signalements", "signalements"))}</div>` : "";
        const cardRdv = Store.can("rendezvous") ? `<div class="card"><h2><span>Rendez-vous du jour <small class="sub">${rdvJ.length}</small></span><a class="btn btn-line btn-sm" href="#rendezvous">Planning</a></h2>${rdvJ.length ? `<div class="wl">${rdvJ.slice(0, 6).map(d => `<a class="wl-row" href="#rendezvous"><span class="wl-main"><b>${esc(d.rdv.heure)}</b> ${esc(d.prenom)} ${esc(d.nom)}<small>${esc(d.details || d.typeLabel)}</small></span>${stChip(d.statut === "Remise" ? "Reçu" : d.statut === "Rejetée" ? "Absent" : "Attendu")}</a>`).join("")}</div>` : empty("Aucun rendez-vous aujourd'hui", "ticket")}</div>` : "";
        const cardInc = Store.can("agents") ? `<div class="card bo-queue"><h2><span>Dossiers à compléter <small class="sub">${incAg.length}</small></span><a class="btn btn-line btn-sm" href="#agents">Personnel</a></h2>${incAg.length ? `<div class="wl">${incAg.slice(0, 6).map(a => `<a class="wl-row" href="#agents"><span class="wl-main"><b>${esc(a.nom)} ${esc(a.prenom)}</b><small>${esc(a.service)} · manque : ${esc(Object.entries(a.pieces).filter(([, v]) => !v).map(([x]) => x).join(", "))}</small></span><span class="chip warn">${Object.values(a.pieces).filter(v => !v).length}</span></a>`).join("")}</div>` : empty("Tous les dossiers sont complets.", "check")}</div>` : "";
        const cardEnc = Store.can("recettes") ? `<div class="card bo-queue"><h2><span>Derniers encaissements <small class="sub">${money(recJ)} aujourd'hui</small></span><a class="btn btn-line btn-sm" href="#recettes">Recettes</a></h2>${tbl(["Quittance","Nature","Montant"], rec.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(x => `<tr class="clk" data-open="recettes|${x.id}"><td><b>${x.quittance}</b><br><small style="color:var(--muted)">${ago(x.date)}</small></td><td>${esc(x.nature)}</td><td style="text-align:right;font-weight:700;white-space:nowrap">${money(x.montant)}</td></tr>`), "Aucun encaissement")}</div>` : "";
        const prio = r === "etatcivil" ? cardDem + cardRdv : r === "technique" ? cardSig : r === "finances" ? cardEnc : r === "rh" ? cardInc : cardDem + cardSig;
        const qlinks = {etatcivil:[["#demandes","Demandes"],["#rendezvous","Rendez-vous"],["#actes","Registre"]], technique:[["#signalements","Signalements"],["#chantiers","Chantiers"],["#stocks","Stocks"]], finances:[["#recettes","Encaisser"],["#vignettes","Contrôle vignettes"],["#indicateurs","Indicateurs"]], rh:[["#agents","Personnel"]]}[r] || [["#demandes","Demandes"],["#indicateurs","Indicateurs"],["#agenda","Agenda"]];
        el.innerHTML = `<section class="hello" aria-label="Bienvenue"><div><h2>${hi}, ${esc(me.prenom)}</h2><p>${new Date().toLocaleDateString("fr-FR", {weekday:"long", day:"numeric", month:"long", year:"numeric"})} · ${esc(lead)}${full && A3.maire ? " · Maire : " + esc(A3.maire) : ""}</p></div><div class="hello-act">${qlinks.filter(q => NAV.some(n => "#" + n.id === q[0])).map(q => `<a href="${q[0]}">${q[1]}</a>`).join("")}</div></section>` +
          (todo.length ? `<div class="todo-row" role="list" aria-label="À traiter">${todo.map(n => `<a class="todo" role="listitem" href="#${n.id}"><span class="ic">${ICONS[n.ic]}</span><b>${n.badge()}</b><span>${esc(n.l)}</span></a>`).join("")}</div>` : "") +
          kpis(k) +
          `<div class="bo-grid wide">${prio}</div>` +
          (alerts.length ? `<div class="card"><h2>Alertes <small class="sub">remontées automatiquement</small></h2>${alerts.map(([c, t, h]) => `<a class="alert-box ${c === "warn" ? "warn" : ""}" href="${h}">${ICONS.alert}<span>${t}</span></a>`).join("")}</div>` : `<div class="alert-box ok">${ICONS.check}<span>Aucune alerte : tout est sous contrôle.</span></div>`) +
          (Store.can("chantiers") ? dotCard(ch) : "") +
          `<div class="bo-grid">
            ${Store.can("recettes") ? `<div class="card"><h2>Recettes des 6 derniers mois</h2>${vbars(recByM, mshort)}</div>` : ""}
            ${qSrc.length ? `<div class="card"><h2>Demandes & signalements par quartier <small class="sub">6 mois</small></h2>${hbars(qRows)}</div>` : ""}
            ${full ? cardRdv : ""}
            ${Store.can("demandes") && full ? `<div class="card"><h2>Dernières demandes <a class="btn btn-line btn-sm" href="#demandes">Tout voir</a></h2>${tbl(["Dossier","Démarche","Statut"], dem.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(d => `<tr class="clk" data-open="demandes|${d.id}"><td><b>${d.ref}</b><br><small style="color:var(--muted)">${ago(d.date)}</small></td><td>${esc(d.typeLabel)}</td><td>${stChip(d.statut)}</td></tr>`), "Aucune demande pour le moment")}</div>` : ""}
            ${Store.can("signalements") && full ? `<div class="card"><h2>Signalements récents <a class="btn btn-line btn-sm" href="#signalements">Tout voir</a></h2>${tbl(["Réf.","Problème","Quartier","Statut"], sig.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(s => `<tr class="clk" data-open="signalements|${s.id}"><td><b>${s.ref}</b></td><td>${esc(s.typeLabel)}</td><td>${esc(s.quartier)}</td><td>${stChip(s.statut)}</td></tr>`), "Aucun signalement pour le moment")}</div>` : ""}
            ${Store.can("chantiers") ? `<div class="card"><h2>Avancement des chantiers <a class="btn btn-line btn-sm" href="#chantiers">Tout voir</a></h2>${ch.filter(c => c.statut !== "Réalisé").length ? hbars(ch.filter(c => c.statut !== "Réalisé").slice(0, 6).map(c => [c.titre, c.avancement]), v => v + " %") : empty("Aucun chantier en cours", "crane")}</div>` : ""}
            ${Store.can("agenda") ? `<div class="card"><h2>Prochains rendez-vous <a class="btn btn-line btn-sm" href="#agenda">Agenda</a></h2>${calList(L("agenda").filter(e => new Date(e.date) > Date.now() - 864e5).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4))}</div>` : ""}
            ${Store.can("journal") || full ? `<div class="card"><h2>Activité récente <a class="btn btn-line btn-sm" href="#journal">Journal</a></h2>${journal.length ? `<div class="hist">${journal.map(j => `<div><small>${ago(j.date)} · ${esc(j.user)}</small><b>${esc(j.action)}</b> — ${esc(j.detail)}</div>`).join("")}</div>` : empty("Aucune activité")}</div>` : ""}
          </div>`;
        el.addEventListener("click", e => {
          const q = e.target.closest("[data-q]"); if (q) { e.stopPropagation(); const [c, id, st] = q.dataset.q.split("|"); q.disabled = true; return quickStatus(c, id, st); }
          const o = e.target.closest("[data-open]"); if (o) { const [c, id] = o.dataset.open.split("|"); if (c === "recettes") quittance(Store.db().recettes.find(x => x.id === id)); else fiche(c, id); }
        });
        el.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-open]")) { e.preventDefault(); e.target.click(); } });
      },

      /* ---------------- Registre des documents authentifiés ---------------- */
      authentifications(el) {
        const f = F.au || (F.au = {statut:"", type:"", q:""});
        const all = L("authentifications");
        const draw = () => {
          const list = all.filter(a => (!f.statut || a.statut === f.statut) && (!f.type || a.type === f.type) && (!f.q || (a.numAff + " " + a.nom + " " + a.prenoms).toLowerCase().includes(f.q.toLowerCase())))
            .sort((a, b) => (a.statut === "En attente" ? 0 : 1) - (b.statut === "En attente" ? 0 : 1) || b.date.localeCompare(a.date));
          el.querySelector("#list").innerHTML = tbl(["Numéro","Type","Titulaire","Inscrit","Statut","Démarches"], list.slice(0, 250).map(a => `<tr class="clk" data-id="${a.id}"><td><b>${esc(a.numAff)}</b></td><td>${esc(typeDocL(a.type))}</td><td>${esc(a.prenoms)} ${esc(a.nom)}</td><td style="white-space:nowrap">${date(a.date)}<br><small style="color:var(--muted)">${a.source === "guichet" ? "au guichet" : "en ligne"}</small></td><td>${acteChip(a)}</td><td>${Store.db().demandes.filter(x => x.acte && x.acte.num === a.num).length}</td></tr>`), "Aucun document");
          el.querySelector("#cnt").textContent = list.length + " document(s)";
          el.querySelectorAll("#list [data-id]").forEach(tr => tr.onclick = () => authFiche(tr.dataset.id));
        };
        const n = st => all.filter(a => a.statut === st).length, dem = L("demandes").filter(d => d.acte), simp = dem.filter(d => d.acte.statut === "Authentifié").length;
        el.innerHTML = kpis([["shieldok","ic-g", n("Authentifié"), "documents authentifiés"],["clock","ic-o", n("En attente"), "originaux à vérifier au guichet"],["check","ic-b", dem.length ? Math.round(simp / dem.length * 100) + " %" : "—", "démarches sans original (100 % en ligne)"],["alert","ic-y", n("Rejeté"), "documents non conformes"]]) +
          `<div class="alert-box ok">${ICONS.shieldok}<span><b>Principe :</b> l'original d'un acte est vérifié <b>une seule fois</b>. Une fois authentifié, son numéro est reconnu sur toute la plateforme (badge 🛡) et l'original n'est plus demandé : renouvellements, duplicatas et légalisations se font en ligne, l'usager passe seulement récupérer.</span></div>
          <div class="card"><h2><span>Registre des documents <small id="cnt" style="color:var(--muted);font-weight:500;font-size:.8rem"></small></span><span class="mini-btns"><button class="btn btn-orange btn-sm" id="new">${ICONS.plus} Authentifier au guichet</button><button class="btn btn-line btn-sm" id="exp">${ICONS.dl} Export</button></span></h2>
          <div class="toolbar"><div class="field"><label>Rechercher</label><input data-f="q" placeholder="Numéro, nom, prénom" value="${esc(f.q)}"></div><div class="field"><label>Statut</label><select data-f="statut">${opt([["","Tous"],["En attente","À vérifier"],["Authentifié","Authentifiés"],["Rejeté","Non conformes"]], f.statut)}</select></div><div class="field"><label>Type</label><select data-f="type"><option value="">Tous</option>${opt(TYPES_DOC, f.type)}</select></div></div>
          <div id="list"></div></div>`;
        filterBar(null, e => { f[e.target.dataset.f] = e.target.value; draw(); }, el);
        el.querySelector("#exp").onclick = () => csv("documents-authentifies", ["Numéro","Type","Nom","Prénoms","Naissance","Statut","Authentifié le","Agent"], all.map(a => [a.numAff, typeDocL(a.type), a.nom, a.prenoms, a.naissance, a.statut, a.authDate ? date(a.authDate) : "", a.agent]));
        el.querySelector("#new").onclick = () => {
          modal("Authentifier un document au guichet", `<form class="form" id="naf"><p class="alert-box warn">${ICONS.alert}<span>L'usager présente l'<b>original</b>. Vérifiez-le, puis enregistrez son numéro : il sera reconnu pour toutes ses démarches futures.</span></p>
            <div class="row"><div class="field"><label>Type de document</label><select name="type">${opt(TYPES_DOC)}</select></div><div class="field"><label>Numéro du document</label><input name="numAff" required placeholder="Ex. 0312/2004"></div></div>
            <div class="row"><div class="field"><label>Nom</label><input name="nom" required></div><div class="field"><label>Prénom(s)</label><input name="prenoms" required></div></div>
            <div class="row"><div class="field"><label>Date de naissance</label><input name="naissance" type="date"></div><div class="field"><label>Lieu</label><input name="lieu" value="Libreville"></div></div>
            <div class="field"><label>Téléphone</label><input name="tel" type="tel" inputmode="tel" autocomplete="off"></div>
            <button class="btn btn-orange">${ICONS.shieldok} Original vérifié : enregistrer et authentifier</button></form>`);
          document.getElementById("naf").onsubmit = async e => {
            e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); d.arr = N3; d.num = normNum(d.numAff);
            if (d.tel && !TEL_RE.test(d.tel.trim())) return bad(e.target, "Numéro de téléphone invalide : saisissez au moins 8 chiffres.", "tel");
            if (d.naissance && d.naissance > today()) return bad(e.target, "La date de naissance ne peut pas être dans le futur.", "naissance");
            const ex = Store.db().authentifications.find(x => x.num === d.num && normNom(x.nom) === normNom(d.nom));
            if (ex) { if (ex.statut === "Authentifié") return toast("Ce document est déjà authentifié.", "err"); closeModal(); if (await authentifier(ex, true, "original présenté au guichet")) refresh(); return; }
            const now = new Date().toISOString();
            if (await act(() => Store.add("authentifications", {...d, statut:"Authentifié", source:"guichet", authDate:now, agent:me.prenom + " " + me.nom, historique:[{date:now, t:"Original présenté et vérifié au guichet par " + me.prenom + " " + me.nom + "."}]}), "Document authentifié : il ne sera plus demandé.")) { Store.log("Acte authentifié", typeDocL(d.type) + " n° " + d.numAff + " · " + d.nom); refresh(); }
          };
        };
        draw();
      },

      /* ---------------- Indicateurs de gestion de la mairie du 3e ---------------- */
      indicateurs(el) {
        const f = F.ind || (F.ind = {per:6});
        const off = new Date().getDate() <= 7 ? 1 : 0; // mois en cours trop récent : on s'arrête au dernier mois complet
        const months = [...Array(+f.per)].map((_, i) => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() - f.per + 1 + i - off); return d; });
        const from = months[0].getTime(), inPer = x => new Date(x.date).getTime() >= from;
        const sameM = (d, m) => { d = new Date(d); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); };
        const mLabel = m => m.toLocaleDateString("fr-FR", {month:"short"}) + (f.per > 6 ? " " + String(m.getFullYear()).slice(2) : "");
        const doneAt = d => { const h = (d.historique || []).find(x => /Prête|Remise|Rejetée|Résolu/.test(x.statut)); return h ? h.date : null; };
        const delay = list => { const v = list.map(d => { const t = doneAt(d); return t ? (new Date(t) - new Date(d.date)) / 864e5 : null; }).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
        const one = n => n == null ? "—" : n.toFixed(1).replace(".", ",");
        const allDem = L("demandes"), dem = allDem.filter(inPer), sig = L("signalements").filter(inPer), rec = L("recettes").filter(inPer), ch = L("chantiers");
        const tot = rec.reduce((s, r) => s + r.montant, 0), onl = rec.filter(r => Store.ONLINE_RE.test(r.mode)).reduce((s, r) => s + r.montant, 0);
        const S = {dem, sig, rec, ch, nDem:dem.length, traitees:dem.length ? dem.filter(d => doneAt(d)).length / dem.length * 100 : 0, delai:delay(dem), recettes:tot, online:tot ? onl / tot * 100 : 0,
          resolus:sig.length ? sig.filter(s => s.statut === "Résolu").length / sig.length * 100 : 0, avct:ch.length ? ch.reduce((s, c) => s + c.avancement, 0) / ch.length : 0, engage:ch.reduce((s, c) => s + (+c.engage || 0), 0)};
        // Par quartier
        const qRows = QS.concat(["Autres quartiers"]).map(q => {
          const m = x => (q === "Autres quartiers" ? !qOf(x.quartier) : qOf(x.quartier) === q), d = dem.filter(m), g = sig.filter(m);
          return {q, nDem:d.length, nSig:g.length, resolus:g.length ? g.filter(x => x.statut === "Résolu").length / g.length * 100 : null, delai:delay(d)};
        }).filter(r => r.nDem || r.nSig || r.q !== "Autres quartiers");
        // Par service
        const svcs = [...new Set(dem.map(d => d.service || "Non précisé"))].sort();
        const sRows = svcs.map(sv => { const d = dem.filter(x => (x.service || "Non précisé") === sv); return {sv, n:d.length, traitees:d.filter(x => doneAt(x)).length / d.length * 100, delai:delay(d)}; }).sort((a, b) => b.n - a.n);
        el.innerHTML = `<div class="card ind-bar"><div class="toolbar" style="margin:0">
            <div class="field"><label for="f-per">Période</label><select id="f-per" data-f="per">${opt([["3","3 derniers mois"],["6","6 derniers mois"],["12","12 derniers mois"]], f.per)}</select></div>
            <div class="field"><label for="f-sc">Périmètre</label><input id="f-sc" value="Mairie du 3e arrondissement" disabled></div>
            <div class="field" style="flex:0 0 auto"><label>&nbsp;</label><button class="btn btn-line btn-sm" id="pdfind" style="height:42px">${ICONS.print} Imprimer</button></div></div></div>` +
          kpis([["inbox","ic-b", S.nDem, "demandes reçues"],["clock","ic-y", one(S.delai) + " j", "délai moyen de traitement"],["check","ic-g", Math.round(S.traitees) + " %", "demandes traitées"],["wallet","ic-g", mshort(S.recettes), "FCFA encaissés"]]) +
          kpis([["phone","ic-o", Math.round(S.online) + " %", "des recettes payées en ligne"],["alert","ic-o", S.sig.length, "signalements reçus"],["wave","ic-b", Math.round(S.resolus) + " %", "signalements résolus"],["crane","ic-y", Math.round(S.avct) + " %", "avancement moyen des chantiers"]]) +
          `<div class="bo-grid">
            <div class="card"><h2>Demandes reçues et traitées par mois</h2><div class="chart"><canvas id="c1" role="img" aria-label="Courbe des demandes reçues et traitées par mois"></canvas></div></div>
            <div class="card"><h2>Recettes mensuelles</h2><div class="chart"><canvas id="c2" role="img" aria-label="Courbe des recettes mensuelles"></canvas></div></div>
            <div class="card"><h2>Demandes et signalements par quartier</h2><div class="chart"><canvas id="c9" role="img" aria-label="Demandes et signalements par quartier"></canvas></div></div>
            <div class="card"><h2>Demandes par service</h2><div class="chart"><canvas id="c10" role="img" aria-label="Demandes par service"></canvas></div></div>
            <div class="card"><h2>Demandes par statut</h2><div class="chart pie"><canvas id="c3" role="img" aria-label="Demandes par statut"></canvas></div></div>
            <div class="card"><h2>Recettes par moyen de paiement</h2><div class="chart pie"><canvas id="c4" role="img" aria-label="Recettes par moyen de paiement"></canvas></div></div>
            <div class="card"><h2>Recettes par nature</h2><div class="chart pie"><canvas id="c5" role="img" aria-label="Recettes par nature"></canvas></div></div>
            <div class="card"><h2>Signalements par type</h2><div class="chart pie"><canvas id="c6" role="img" aria-label="Signalements par type"></canvas></div></div>
            <div class="card"><h2>Délai moyen par démarche (jours)</h2><div class="chart"><canvas id="c7" role="img" aria-label="Délai moyen de traitement par démarche"></canvas></div></div>
            <div class="card"><h2>Dotation 2026 engagée</h2><div class="chart pie"><canvas id="c8" role="img" aria-label="Part de la dotation 2026 engagée"></canvas></div></div>
          </div>
          <div class="card"><h2>Situation par quartier <button class="btn btn-line btn-sm" id="expind">${ICONS.dl} Export</button></h2>${tbl(["Quartier","Demandes","Signalements","Signalements résolus","Délai moyen"], qRows.map(r => `<tr><td><b>${esc(r.q)}</b></td><td>${r.nDem}</td><td>${r.nSig}</td><td>${r.resolus == null ? "—" : Math.round(r.resolus) + " %"}</td><td>${r.delai == null ? "—" : one(r.delai) + " j"}</td></tr>`))}</div>
          <div class="card"><h2>Situation par service</h2>${tbl(["Service","Demandes","Traitées","Délai moyen"], sRows.map(r => `<tr><td><b>${esc(r.sv)}</b></td><td>${r.n}</td><td>${Math.round(r.traitees)} %</td><td>${r.delai == null ? "—" : one(r.delai) + " j"}</td></tr>`), "Aucune demande sur la période")}</div>`;
        filterBar(null, e => { f[e.target.dataset.f] = +e.target.value; route(false); }, el);
        el.querySelector("#pdfind").onclick = () => print();
        el.querySelector("#expind").onclick = () => csv("indicateurs-quartiers", ["Quartier","Demandes","Signalements","Signalements résolus %","Délai moyen (j)"], qRows.map(r => [r.q, r.nDem, r.nSig, r.resolus == null ? "" : Math.round(r.resolus), one(r.delai)]));
        // Graphiques
        loadScript("https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js").then(() => {
          if (!document.getElementById("c1")) return;
          const C = window.Chart, narrow = innerWidth < 640; C.defaults.font.family = "Inter, system-ui, sans-serif"; C.defaults.color = "#46566f"; C.defaults.plugins.legend.labels.boxWidth = 12;
          const PAL = ["#06363f","#d9480f","#f5b301","#0e7c86","#c0392b","#5b3fb3","#18a7b5","#0a8a55"];
          const mk = (id, cfg) => charts.push(new C(document.getElementById(id), {...cfg, options:{maintainAspectRatio:false, responsive:true, ...(cfg.options || {})}}));
          const pie = (id, labels, data, colors) => mk(id, {type:"doughnut", data:{labels, datasets:[{data, backgroundColor:colors || PAL, borderWidth:2, borderColor:"#fff"}]}, options:{cutout:"55%", plugins:{legend:{position:narrow ? "bottom" : "right"}, tooltip:{callbacks:{label:c => { const t = c.dataset.data.reduce((a, b) => a + b, 0); return ` ${c.label} : ${c.raw > 9999 ? mshort(c.raw) : c.raw} (${t ? Math.round(c.raw / t * 100) : 0} %)`; }}}}}});
          const line = (id, sets, money) => mk(id, {type:"line", data:{labels:months.map(mLabel), datasets:sets.map(s => ({tension:.35, fill:sets.length === 1, pointRadius:3, borderWidth:2.5, ...s, backgroundColor:sets.length === 1 ? s.borderColor + "22" : s.borderColor}))}, options:{interaction:{mode:"index", intersect:false}, plugins:{legend:{position:"bottom"}, tooltip:{callbacks:{label:c => ` ${c.dataset.label} : ${money ? mshort(c.raw) + " FCFA" : c.raw}`}}}, scales:{y:{beginAtZero:true, ticks:{callback:v => money ? mshort(v) : v}}, x:{grid:{display:false}}}}});
          const bar = (id, labels, data, colors, money, extra) => mk(id, {type:"bar", data:{labels, datasets:[{data, backgroundColor:colors, borderRadius:6}]}, options:{plugins:{legend:{display:false}, tooltip:{callbacks:{label:c => " " + (money ? mshort(c.raw) + " FCFA" : one(c.raw) + " jours")}}}, scales:{y:{beginAtZero:true, ticks:{callback:v => money ? mshort(v) : v}}, x:{grid:{display:false}}}, ...(extra || {})}});
          line("c1", [{label:"Reçues", data:months.map(m => dem.filter(d => sameM(d.date, m)).length), borderColor:"#1477b5"}, {label:"Traitées", data:months.map(m => allDem.filter(d => doneAt(d) && sameM(doneAt(d), m)).length), borderColor:"#0a8a55"}]);
          line("c2", [{label:"Recettes", data:months.map(m => rec.filter(r => sameM(r.date, m)).reduce((s, r) => s + r.montant, 0)), borderColor:"#0a8a55"}], true);
          mk("c9", {type:"bar", data:{labels:qRows.map(r => r.q), datasets:[{label:"Demandes", data:qRows.map(r => r.nDem), backgroundColor:"#1477b5", borderRadius:5}, {label:"Signalements", data:qRows.map(r => r.nSig), backgroundColor:"#d9480f", borderRadius:5}]}, options:{plugins:{legend:{position:"bottom"}}, scales:{y:{beginAtZero:true, ticks:{precision:0}}, x:{grid:{display:false}}}}});
          mk("c10", {type:"bar", data:{labels:sRows.map(r => r.sv), datasets:[{label:"Demandes", data:sRows.map(r => r.n), backgroundColor:"#0e7c86", borderRadius:5}]}, options:{indexAxis:"y", plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true, ticks:{precision:0}}, y:{grid:{display:false}}}}});
          const sts = Store.STATUTS.demandes; pie("c3", sts, sts.map(s => dem.filter(d => d.statut === s).length), ["#c0392b","#1477b5","#e67e22","#0a8a55","#06363f","#9aa5b8"]);
          pie("c4", Store.MODES, Store.MODES.map(mo => rec.filter(r => r.mode === mo).reduce((s, r) => s + r.montant, 0)), ["#06363f","#e40000","#0067b1","#1477b5","#9aa5b8"]);
          const nat = Store.NATURES.map(n => [n, rec.filter(r => r.nature === n).reduce((s, r) => s + r.montant, 0)]).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
          pie("c5", nat.map(x => x[0]), nat.map(x => x[1]));
          pie("c6", TYPES_SIGNAL.map(t => t[1]), TYPES_SIGNAL.map(t => sig.filter(s => s.type === t[0]).length), ["#5b6b85","#0e7c86","#f5b301","#e67e22","#18a7b5","#c0392b","#9aa5b8"]);
          const ty = DEMARCHES.filter(d => !d.signal).map(d => [d.t.replace(/ \(.*\)/, "").slice(0, 22), delay(dem.filter(x => x.type === d.id))]).filter(x => x[1] != null);
          bar("c7", ty.map(x => x[0]), ty.map(x => +x[1].toFixed(1)), "#1477b5");
          const e = Math.min(DOTATION, S.engage); pie("c8", ["Engagé","Disponible"], [e, DOTATION - e], ["#0a8a55","#dfe6ef"]);
        }).catch(e => toast(e.message, "err"));
      },

      /* ---------------- Demandes ---------------- */
      demandes(el) { dossiers(el, "demandes"); },
      signalements(el) { dossiers(el, "signalements"); },

      /* ---------------- Registre d'état civil ---------------- */
      actes(el) {
        const f = F.actes || (F.actes = {type:"", q:""});
        const TY = {naissance:"Naissance", mariage:"Mariage", deces:"Décès"};
        const draw = () => {
          const all = L("actes");
          const list = all.filter(a => (!f.type || a.type === f.type) && (!f.q || (a.num + " " + a.nom + " " + a.prenoms).toLowerCase().includes(f.q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date));
          el.querySelector("#list").innerHTML = tbl(["N° d'acte","Type","Nom & prénoms","Date de l'événement",""], list.slice(0, 200).map(a => `<tr class="clk" data-id="${a.id}"><td><b>${a.num}</b></td><td>${TY[a.type]}</td><td>${esc(a.nom)} ${esc(a.prenoms)}${a.conjoint ? ` <small style="color:var(--muted)">& ${esc(a.conjoint)}</small>` : ""}</td><td>${date(a.dateEvt)}</td><td><button class="btn btn-line btn-sm">${ICONS.print} Extrait</button></td></tr>`), "Aucun acte trouvé");
          el.querySelector("#cnt").textContent = list.length + " acte(s)";
        };
        const all = L("actes");
        el.innerHTML = kpis([["baby","ic-b", all.filter(a => a.type === "naissance").length, "naissances enregistrées"],["ring","ic-o", all.filter(a => a.type === "mariage").length, "mariages enregistrés"],["file","ic-y", all.filter(a => a.type === "deces").length, "décès enregistrés"],["search","ic-g", "1 s", "pour retrouver un acte"]]) +
          `<div class="card"><h2><span>Registre numérique <small id="cnt" style="color:var(--muted);font-weight:500;font-size:.8rem"></small></span><span class="mini-btns"><button class="btn btn-orange btn-sm" id="new">${ICONS.plus} Enregistrer un acte</button><button class="btn btn-line btn-sm" id="exp">${ICONS.dl} Export</button></span></h2>
          <div class="toolbar"><div class="field"><label>Rechercher</label><input data-f="q" placeholder="Nom, prénom ou n° d'acte" value="${esc(f.q)}"></div><div class="field"><label>Type</label><select data-f="type"><option value="">Tous</option>${opt(Object.entries(TY), f.type)}</select></div></div><div id="list"></div></div>`;
        filterBar(null, e => { f[e.target.dataset.f] = e.target.value; draw(); }, el);
        el.querySelector("#list").addEventListener("click", e => { const tr = e.target.closest("[data-id]"); if (tr) acteView(Store.db().actes.find(a => a.id === tr.dataset.id)); });
        el.querySelector("#exp").onclick = () => csv("registre-etat-civil", ["N°","Type","Nom","Prénoms","Date","Lieu"], L("actes").map(a => [a.num, TY[a.type], a.nom, a.prenoms, a.dateEvt, a.lieu]));
        el.querySelector("#new").onclick = () => {
          modal("Enregistrer un acte", `<form class="form" id="af">
            <div class="field"><label>Type d'acte</label><select name="type">${opt(Object.entries(TY))}</select></div>
            <div class="row"><div class="field"><label>Nom</label><input name="nom" required></div><div class="field"><label>Prénom(s)</label><input name="prenoms" required></div></div>
            <div class="row"><div class="field"><label>Date de l'événement</label><input name="dateEvt" type="date" required max="${today()}" value="${today()}"></div><div class="field"><label>Sexe</label><select name="sexe">${opt([["M","Masculin"],["F","Féminin"]])}</select></div></div>
            <div class="field"><label>Lieu</label><input name="lieu" value="Libreville"></div>
            <div class="row" data-for="naissance"><div class="field"><label>Père</label><input name="pere"></div><div class="field"><label>Mère</label><input name="mere"></div></div>
            <div class="field" data-for="mariage" hidden><label>Conjoint(e)</label><input name="conjoint"></div>
            <button class="btn btn-orange">${ICONS.save} Enregistrer au registre</button></form>`);
          const fm = document.getElementById("af"), sync = () => fm.querySelectorAll("[data-for]").forEach(x => x.hidden = x.dataset.for !== fm.type.value);
          fm.type.onchange = sync; sync();
          fm.onsubmit = async e => {
            e.preventDefault(); const d = Object.fromEntries(new FormData(fm)); d.arr = N3;
            if (d.dateEvt > today()) return bad(fm, "La date de l'événement ne peut pas être dans le futur.", "dateEvt");
            if (d.type === "mariage" && !(d.conjoint || "").trim()) return bad(fm, "Indiquez le nom du conjoint pour un acte de mariage.", "conjoint");
            const n = Math.max(Store.db().actes.length + 100, ...Store.db().actes.map(a => parseInt(String(a.num).split("-").pop(), 10) || 0)) + 1, num = {naissance:"N", mariage:"M", deces:"D"}[d.type] + "-" + new Date().getFullYear() + "-" + String(n).padStart(5, "0");
            const a = await act(() => Store.add("actes", {...d, num, officier:"Officier d'état civil — Mairie du 3e arrondissement"}), "Acte " + num + " enregistré.");
            if (a) { Store.log("Acte enregistré", num + " · " + d.nom + " " + d.prenoms); refresh(); acteView(a); }
          };
        };
        draw();
      },

      /* ---------------- Agenda ---------------- */
      agenda(el) {
        const ev = L("agenda").slice().sort((a, b) => a.date.localeCompare(b.date));
        const up = ev.filter(e => new Date(e.date) > Date.now() - 864e5), past = ev.filter(e => new Date(e.date) <= Date.now() - 864e5).reverse();
        const aud = L("demandes").filter(d => d.type === "audience" && /Nouvelle|En traitement/.test(d.statut));
        el.innerHTML = `<div class="cols"><div><div class="card"><h2>À venir <button class="btn btn-orange btn-sm" id="new">${ICONS.plus} Ajouter</button></h2>${calList(up, true)}</div>
          <div class="card"><h2>Passés</h2>${calList(past.slice(0, 6))}</div></div>
          <div class="card"><h2>Demandes d'audience à planifier</h2>${aud.length ? aud.map(d => `<div class="post"><div class="top"><h4>${esc(d.prenom)} ${esc(d.nom)}</h4>${stChip(d.statut)}</div><p>${esc(d.details || "Objet non précisé")}</p><small>${d.ref} · ${esc(d.quartier)} · ${ago(d.date)}</small><div style="margin-top:.5rem"><button class="btn btn-navy btn-sm" data-plan="${d.id}">${ICONS.cal} Planifier</button></div></div>`).join("") : empty("Aucune demande d'audience en attente", "cal")}</div></div>`;
        const form = (d) => {
          modal(d ? "Planifier l'audience" : "Nouveau rendez-vous", `<form class="form" id="ef">
            <div class="field"><label>Intitulé</label><input name="titre" required value="${d ? esc("Audience – " + d.prenom + " " + d.nom) : ""}"></div>
            <div class="row"><div class="field"><label>Date et heure</label><input name="date" type="datetime-local" required min="${new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16)}"></div><div class="field"><label>Type</label><select name="type">${opt(["Audience","Réunion","Terrain","Conseil","Cérémonie"], d ? "Audience" : "")}</select></div></div>
            <div class="field"><label>Lieu</label><input name="lieu" value="${d ? "Cabinet du maire" : ""}" placeholder="Ex. Mairie du 3e, Mont-Bouët…"></div>
            <button class="btn btn-orange">${ICONS.save} Enregistrer</button></form>`);
          const fm = document.getElementById("ef");
          fm.onsubmit = async e => {
            e.preventDefault(); const v = Object.fromEntries(new FormData(fm)); if (new Date(v.date) < new Date(Date.now() - 6e4)) return bad(fm, "Choisissez une date et une heure à venir.", "date"); v.date = new Date(v.date).toISOString(); v.arr = N3;
            if (!await act(() => Store.add("agenda", v), "Rendez-vous ajouté à l'agenda.")) return;
            if (d) { const h = d.historique.concat([{date:new Date().toISOString(), statut:"Prête", note:`Audience fixée le ${dtime(v.date)} (${v.lieu}). Merci de vous présenter 15 minutes avant.`, pub:true}]); await act(() => Store.update("demandes", d.id, {statut:"Prête", historique:h})); }
            Store.log("Agenda", v.titre + " · " + dtime(v.date)); refresh();
          };
        };
        el.querySelector("#new").onclick = () => form(null);
        el.querySelectorAll("[data-plan]").forEach(b => b.onclick = () => form(Store.db().demandes.find(d => d.id === b.dataset.plan)));
        el.querySelectorAll("[data-delev]").forEach(b => b.onclick = async () => { if (await ask("Supprimer ce rendez-vous ?") && await act(() => Store.remove("agenda", b.dataset.delev), "Rendez-vous supprimé.")) refresh(); });
      },

      /* ---------------- Rendez-vous au guichet ---------------- */
      rendezvous(el) {
        const f = F.rdv || (F.rdv = {jour:new Date().toISOString().slice(0, 10)});
        const all = L("demandes").filter(d => d.type === "rdv" && d.rdv);
        const day = all.filter(d => d.rdv.jour === f.jour).sort((a, b) => a.rdv.heure.localeCompare(b.rdv.heure));
        const up = all.filter(d => d.rdv.jour >= new Date().toISOString().slice(0, 10));
        const days7 = [...Array(7)].map((_, i) => { const x = new Date(Date.now() + i * 864e5); return x.toISOString().slice(0, 10); });
        el.innerHTML = kpis([["ticket","ic-b", up.length, "rendez-vous à venir"],["cal","ic-o", all.filter(d => d.rdv.jour === new Date().toISOString().slice(0, 10)).length, "aujourd'hui"],["check","ic-g", all.filter(d => d.statut === "Remise").length, "usagers reçus"],["clock","ic-y", "0 min", "d'attente pour un usager à l'heure"]]) +
          `<div class="card"><h2>Planning du guichet <span class="mini-btns">${days7.map(j => `<button class="btn btn-sm ${j === f.jour ? "btn-navy" : "btn-line"}" data-j="${j}">${new Date(j + "T12:00:00").toLocaleDateString("fr-FR", {weekday:"short", day:"numeric"})} <small>(${all.filter(d => d.rdv.jour === j).length})</small></button>`).join("")}</span></h2>
          
          ${tbl(["Heure","Usager","Objet","Ticket","Statut",""], day.map(d => `<tr><td><b style="font-size:1.05rem">${esc(d.rdv.heure)}</b></td><td>${esc(d.prenom)} ${esc(d.nom)}<br><small style="color:var(--muted)">${esc(d.tel)}</small></td><td>${esc(d.details || "—")}</td><td><b>${d.ref}</b></td><td>${stChip(d.statut === "Remise" ? "Reçu" : d.statut === "Rejetée" ? "Absent" : "Attendu")}</td><td><div class="mini-btns">${d.statut === "Nouvelle" ? `<button class="btn btn-orange btn-sm" data-ok="${d.id}">${ICONS.check} Reçu</button><button class="btn btn-line btn-sm" data-abs="${d.id}">Absent</button>` : ""}</div></td></tr>`), "Aucun rendez-vous ce jour-là")}</div>`;
        el.querySelectorAll("[data-j]").forEach(b => b.onclick = () => { f.jour = b.dataset.j; route(false); });
        filterBar(null, e => { f[e.target.dataset.f] = e.target.value; route(false); }, el);
        const mark = async (id, ok) => { const d = Store.db().demandes.find(x => x.id === id); const st = ok ? "Remise" : "Rejetée"; const h = d.historique.concat([{date:new Date().toISOString(), statut:st, note:ok ? "Usager reçu au guichet à l'heure du rendez-vous." : "Usager absent au rendez-vous : vous pouvez réserver un nouveau créneau en ligne.", pub:true}]); if (await act(() => Store.update("demandes", id, {statut:st, historique:h}), ok ? "Usager reçu." : "Absence enregistrée.")) { Store.log("Rendez-vous", d.ref + " · " + (ok ? "reçu" : "absent")); refresh(); } };
        el.querySelectorAll("[data-ok]").forEach(b => b.onclick = () => mark(b.dataset.ok, true));
        el.querySelectorAll("[data-abs]").forEach(b => b.onclick = () => mark(b.dataset.abs, false));
      },

      /* ---------------- Vignettes de transport à QR code ---------------- */
      vignettes(el) {
        const f = F.vig || (F.vig = {cat:"", etat:"", q:""});
        const td = new Date().toISOString().slice(0, 10), all = L("vignettes");
        const etat = v => v.statut === "Suspendue" ? "Suspendue" : v.fin < td ? "Expirée" : "Valide";
        const soon = v => etat(v) === "Valide" && (new Date(v.fin) - Date.now()) / 864e5 < 30;
        const draw = () => {
          const list = all.filter(v => (!f.cat || v.cat === f.cat) && (!f.etat || etat(v) === f.etat) && (!f.q || (v.num + " " + v.plaque + " " + v.proprio).toLowerCase().includes(f.q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date));
          el.querySelector("#list").innerHTML = tbl(["Vignette","Catégorie","Véhicule","Titulaire","Validité","État","Contrôles"], list.slice(0, 200).map(v => `<tr class="clk" data-id="${v.id}"><td><b>${v.num}</b></td><td>${CAT_VIG[v.cat]}</td><td>${esc(v.plaque)}</td><td>${esc(v.proprio)}<br><small style="color:var(--muted)">${esc(v.tel || "")}</small></td><td style="white-space:nowrap">${date(v.fin)}${soon(v) ? ` <span class="chip warn">&lt; 30 j</span>` : ""}</td><td>${stChip(etat(v) === "Valide" ? "Valide" : etat(v) === "Expirée" ? "Expirée" : "Suspendue")}</td><td>${(v.controles || []).length}</td></tr>`), "Aucune vignette");
          el.querySelector("#cnt").textContent = list.length + " vignette(s)";
          el.querySelectorAll("#list [data-id]").forEach(tr => tr.onclick = () => vigFiche(tr.dataset.id));
        };
        const n = e => all.filter(v => etat(v) === e).length;
        const recV = L("recettes").filter(r => r.nature === "Vignettes de transport"), recT = recV.reduce((a, r) => a + r.montant, 0);
        el.innerHTML = kpis([["qr","ic-g", n("Valide"), "vignettes valides"],["alert","ic-o", n("Expirée"), "expirées à renouveler"],["wallet","ic-b", mshort(recT), "FCFA encaissés (vignettes)"],["phone","ic-y", recT ? Math.round(recV.filter(r => Store.ONLINE_RE.test(r.mode)).reduce((a, r) => a + r.montant, 0) / recT * 100) + " %" : "—", "payées par mobile money ou carte"]]) +
          `<div class="cols"><div class="card"><h2><span>Registre des vignettes <small id="cnt" style="color:var(--muted);font-weight:500;font-size:.8rem"></small></span><span class="mini-btns"><button class="btn btn-orange btn-sm" id="scan">${ICONS.camera} Contrôle terrain</button><button class="btn btn-line btn-sm" id="exp">${ICONS.dl} Export</button></span></h2>
            <div class="toolbar"><div class="field"><label>Rechercher</label><input data-f="q" placeholder="N°, immatriculation, titulaire" value="${esc(f.q)}"></div><div class="field"><label>Catégorie</label><select data-f="cat"><option value="">Toutes</option>${opt(Object.entries(CAT_VIG), f.cat)}</select></div><div class="field"><label>État</label><select data-f="etat"><option value="">Tous</option>${opt(["Valide","Expirée","Suspendue"], f.etat)}</select></div></div>
            <div id="list"></div></div>
            <div><div class="card"><h2>Par catégorie</h2>${hbars(Object.entries(CAT_VIG).map(([k, l]) => [l, all.filter(v => v.cat === k && etat(v) === "Valide").length]))}</div>
            <div class="card"><h2>Derniers contrôles</h2>${(() => { const c = all.flatMap(v => (v.controles || []).map(x => ({...x, num:v.num}))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6); return c.length ? `<div class="hist">${c.map(x => `<div><small>${ago(x.date)} · ${esc(x.agent)}</small><b>${x.num}</b> — ${esc(x.lieu)} · ${esc(x.res)}</div>`).join("")}</div>` : empty("Aucun contrôle", "qr"); })()}</div></div></div>`;
        filterBar(null, e => { f[e.target.dataset.f] = e.target.value; draw(); }, el);
        el.querySelector("#exp").onclick = () => csv("vignettes", ["Numéro","Catégorie","Immatriculation","Titulaire","Téléphone","Début","Fin","État","Contrôles"], all.map(v => [v.num, CAT_VIG[v.cat], v.plaque, v.proprio, v.tel, v.debut, v.fin, etat(v), (v.controles || []).length]));
        el.querySelector("#scan").onclick = () => controleTerrain();
        draw();
      },

      /* ---------------- Recettes ---------------- */
      recettes(el) {
        const f = F.rec || (F.rec = {nature:"", per:"30", q:""});
        const all = L("recettes");
        const inPer = r => f.per === "tout" ? true : f.per === "mois" ? thisMonth(r.date) : days(r.date) <= ({"30":30, "90":90, "180":180}[f.per] || 9999);
        const list = all.filter(r => inPer(r) && (!f.nature || r.nature === f.nature) && (!f.q || (r.quittance + " " + r.payeur + " " + r.nature).toLowerCase().includes((f.q || "").toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date));
        const tot = list.reduce((a, r) => a + r.montant, 0), yr = all.filter(r => new Date(r.date).getFullYear() === new Date().getFullYear()).reduce((a, r) => a + r.montant, 0);
        const mm = list.filter(r => Store.ONLINE_RE.test(r.mode)).reduce((a, r) => a + r.montant, 0);
        const byNat = Store.NATURES.map(n => [n, list.filter(r => r.nature === n).reduce((a, r) => a + r.montant, 0)]).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
        const byQr = byQ(list.filter(r => r.quartier));
        el.innerHTML = kpis([["wallet","ic-g", mshort(tot), "FCFA sur la période"],["chart","ic-b", mshort(yr), "FCFA depuis janvier"],["file","ic-y", list.length, "quittances émises"],["phone","ic-o", tot ? Math.round(mm / tot * 100) + " %" : "—", "payé en ligne (Airtel, Moov, carte)"]]) +
          `<div class="cols"><div class="card"><h2>Encaissements <span class="mini-btns"><button class="btn btn-orange btn-sm" id="new">${ICONS.plus} Nouvel encaissement</button><button class="btn btn-line btn-sm" id="exp">${ICONS.dl} Export</button></span></h2>
            <div class="toolbar"><div class="field"><label>Rechercher</label><input data-f="q" type="search" placeholder="Quittance ou payeur" value="${esc(f.q || "")}"></div><div class="field"><label>Période</label><select data-f="per">${opt([["mois","Mois en cours"],["30","30 derniers jours"],["90","3 derniers mois"],["180","6 derniers mois"],["tout","Tout"]], f.per)}</select></div><div class="field"><label>Nature</label><select data-f="nature"><option value="">Toutes</option>${opt(Store.NATURES, f.nature)}</select></div></div>
            ${tbl(["Quittance","Date","Nature","Payeur","Mode","Montant"], list.slice(0, 150).map(r => `<tr class="clk" data-id="${r.id}"><td><b>${r.quittance}</b></td><td>${date(r.date)}</td><td>${esc(r.nature)}</td><td>${esc(r.payeur)}</td><td>${esc(r.mode)}</td><td style="text-align:right;font-weight:700;white-space:nowrap">${money(r.montant)}</td></tr>`), "Aucun encaissement sur la période", resetBtn("rec"))}${list.length ? `<div class="sumrow"><span>${list.length} quittance(s)</span><b>Total : ${money(tot)}</b></div>` : ""}</div>
            <div><div class="card"><h2>Par nature</h2>${byNat.length ? hbars(byNat, mshort) : empty("—")}</div></div></div>`;
        filterBar(null, e => { f[e.target.dataset.f] = e.target.value; route(false); }, el);
        el.querySelector("#exp").onclick = () => csv("recettes", ["Quittance","Date","Nature","Payeur","Mode","Montant"], list.map(r => [r.quittance, date(r.date), r.nature, r.payeur, r.mode, r.montant]));
        el.querySelectorAll("[data-id]").forEach(tr => tr.onclick = () => quittance(Store.db().recettes.find(r => r.id === tr.dataset.id)));
        el.querySelector("#new").onclick = () => {
          modal("Nouvel encaissement", `<form class="form" id="rf">
            <div class="field"><label>Nature de la recette</label><select name="nature">${opt(Store.NATURES)}</select></div>
            <div class="row"><div class="field"><label>Montant (FCFA)</label><input name="montant" type="number" inputmode="numeric" min="100" step="1" required placeholder="Ex. 5000"></div><div class="field"><label>Mode de paiement</label><select name="mode">${opt(Store.MODES.concat(["Chèque"]))}</select></div></div>
            <div class="field"><label>Payeur (nom ou commerce)</label><input name="payeur" required></div>
            <button class="btn btn-orange">${ICONS.save} Enregistrer et éditer la quittance</button></form>`);
          const fm = document.getElementById("rf");
          fm.onsubmit = async e => {
            e.preventDefault(); const d = Object.fromEntries(new FormData(fm)); d.arr = N3; d.montant = Math.round(+d.montant); d.payeur = d.payeur.trim();
            if (!(d.montant >= 100)) return bad(fm, "Le montant doit être d'au moins 100 FCFA.", "montant");
            if (!d.payeur) return bad(fm, "Indiquez le nom du payeur.", "payeur");
            d.quittance = "Q-" + String(new Date().getFullYear()).slice(2) + "-" + String(5200 + Store.db().recettes.length + 1).padStart(6, "0"); d.agent = me.prenom + " " + me.nom;
            const r = await act(() => Store.add("recettes", d), "Encaissement enregistré.");
            if (r) { Store.log("Encaissement", d.quittance + " · " + d.nature + " · " + money(d.montant)); refresh(); quittance(r); }
          };
        };
      },

      /* ---------------- Personnel ---------------- */
      agents(el) {
        const f = F.ag || (F.ag = {service:"", inc:"", q:""});
        const all = L("agents"), services = [...new Set(all.map(a => a.service))].sort();
        const missing = a => Object.entries(a.pieces).filter(([, v]) => !v).map(([k]) => k);
        const list = all.filter(a => (!f.service || a.service === f.service) && (!f.inc || missing(a).length) && (!f.q || (a.nom + " " + a.prenom + " " + a.matricule).toLowerCase().includes(f.q.toLowerCase()))).sort((a, b) => a.nom.localeCompare(b.nom));
        const inc = all.filter(a => missing(a).length).length;
        el.innerHTML = kpis([["users","ic-b", all.length, "agents (échantillon de démo)"],["check","ic-g", all.length - inc, "dossiers complets"],["file","ic-o", inc, "dossiers incomplets"],["gauge","ic-y", Math.round((all.length - inc) / Math.max(1, all.length) * 100) + " %", "taux de complétude"]]) +
          `<div class="card"><h2>Dossiers du personnel <span class="mini-btns"><button class="btn btn-orange btn-sm" id="new">${ICONS.plus} Ajouter un agent</button><button class="btn btn-line btn-sm" id="exp">${ICONS.dl} Export</button></span></h2>
          <div class="toolbar"><div class="field"><label>Rechercher</label><input data-f="q" placeholder="Nom ou matricule" value="${esc(f.q)}"></div><div class="field"><label>Service</label><select data-f="service"><option value="">Tous</option>${opt(services, f.service)}</select></div><div class="field"><label>Dossier</label><select data-f="inc">${opt([["","Tous"],["1","Incomplets uniquement"]], f.inc)}</select></div></div>
          ${tbl(["Matricule","Agent","Service / poste","Cat.","Pièces"], list.map(a => { const m = missing(a); return `<tr class="clk" data-id="${a.id}"><td><b>${a.matricule}</b></td><td>${esc(a.nom)} ${esc(a.prenom)}${a.statut !== "Actif" ? ` <span class="chip warn">${a.statut}</span>` : ""}</td><td>${esc(a.service)}<br><small style="color:var(--muted)">${esc(a.poste)}</small></td><td>${a.categorie}</td><td>${m.length ? `<span class="chip warn" title="${esc(m.join(", "))}">${m.length} manquante(s)</span>` : `<span class="chip ok">Complet</span>`}</td></tr>`; }), "Aucun agent")}</div>`;
        filterBar(null, e => { f[e.target.dataset.f] = e.target.value; route(false); }, el);
        const q = el.querySelector("[data-f=q]"); if (f.q) { q.focus(); q.setSelectionRange(f.q.length, f.q.length); }
        el.querySelector("#exp").onclick = () => csv("personnel", ["Matricule","Nom","Prénom","Service","Poste","Catégorie","Pièces manquantes"], all.map(a => [a.matricule, a.nom, a.prenom, a.service, a.poste, a.categorie, missing(a).join(", ")]));
        const edit = a => {
          const isNew = !a; a = a || {matricule:"L3-" + String(2600 + all.length).padStart(5, "0"), nom:"", prenom:"", service:services[0], poste:"", arr:N3, categorie:"C", entree:String(new Date().getFullYear()), statut:"Actif", pieces:{"Acte de naissance":false,"Pièce d'identité":false,"Diplôme":false,"Contrat / arrêté":false,"RIB":false,"Photo":false}};
          modal(isNew ? "Nouvel agent" : "Dossier de " + a.prenom + " " + a.nom, `<form class="form" id="gf">
            <div class="row"><div class="field"><label>Nom</label><input name="nom" required value="${esc(a.nom)}"></div><div class="field"><label>Prénom</label><input name="prenom" required value="${esc(a.prenom)}"></div></div>
            <div class="row"><div class="field"><label>Matricule</label><input name="matricule" required value="${esc(a.matricule)}"></div><div class="field"><label>Service</label><input name="service" list="svc" required value="${esc(a.service)}"><datalist id="svc">${services.map(s => `<option value="${esc(s)}">`).join("")}</datalist></div></div>
            <div class="row"><div class="field"><label>Poste</label><input name="poste" value="${esc(a.poste)}"></div><div class="field"><label>Catégorie</label><select name="categorie">${opt(["A","B","C"], a.categorie)}</select></div></div>
            <div class="row"><div class="field"><label>Situation</label><select name="statut">${opt(["Actif","En congé","Détaché","Retraité"], a.statut)}</select></div><div class="field"></div></div>
            <div class="field"><label>Pièces du dossier</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem">${Object.entries(a.pieces).map(([k, v]) => `<label style="display:flex;gap:.5rem;align-items:center;font-size:.88rem"><input type="checkbox" name="p:${esc(k)}" ${v ? "checked" : ""}> ${esc(k)}</label>`).join("")}</div></div>
            <div style="display:flex;gap:.6rem;flex-wrap:wrap"><button class="btn btn-orange">${ICONS.save} Enregistrer</button>${isNew ? "" : `<button type="button" class="btn btn-line" id="gdel">Supprimer</button>`}</div></form>`);
          const fm = document.getElementById("gf");
          fm.onsubmit = async e => {
            e.preventDefault(); const fd = new FormData(fm), d = {pieces:{}};
            for (const [k, v] of fd) if (!k.startsWith("p:")) d[k] = v;
            Object.keys(a.pieces).forEach(k => d.pieces[k] = fd.has("p:" + k)); d.arr = N3; d.matricule = d.matricule.trim();
            if (all.some(x => x.id !== a.id && x.matricule.toLowerCase() === d.matricule.toLowerCase())) return bad(fm, "Ce matricule existe déjà : choisissez-en un autre.", "matricule");
            if (await act(() => isNew ? Store.add("agents", {...d, entree:a.entree}) : Store.update("agents", a.id, d), "Dossier enregistré.")) { Store.log(isNew ? "Agent ajouté" : "Dossier agent mis à jour", d.matricule + " · " + d.nom + " " + d.prenom); refresh(); }
          };
          const del = document.getElementById("gdel"); if (del) del.onclick = async () => { if (await ask("Supprimer ce dossier ?") && await act(() => Store.remove("agents", a.id), "Dossier supprimé.")) refresh(); };
        };
        el.querySelector("#new").onclick = () => edit(null);
        el.querySelectorAll("[data-id]").forEach(tr => tr.onclick = () => edit(Store.db().agents.find(a => a.id === tr.dataset.id)));
      },

      /* ---------------- Stocks ---------------- */
      stocks(el) {
        const list = L("stocks").slice().sort((a, b) => (a.qte / a.seuil) - (b.qte / b.seuil));
        const low = list.filter(s => s.qte <= s.seuil);
        el.innerHTML = (low.length ? low.map(s => `<div class="alert-box">${ICONS.alert}<span><b>${esc(s.article)}</b> : ${s.qte} ${esc(s.unite)}(s) restant(s) pour un seuil de ${s.seuil}. Le cabinet du maire est alerté automatiquement.</span></div>`).join("") : `<div class="alert-box ok">${ICONS.check}<span>Tous les stocks sont au-dessus de leur seuil d'alerte.</span></div>`) +
          `<div class="card"><h2>Inventaire <button class="btn btn-orange btn-sm" id="new">${ICONS.plus} Nouvel article</button></h2>
          ${tbl(["Article","Service","Quantité","Seuil","Niveau",""], list.map(s => `<tr><td><b>${esc(s.article)}</b></td><td>${esc(s.service)}</td><td><b>${s.qte}</b> ${esc(s.unite)}(s)</td><td>${s.seuil}</td><td style="min-width:120px"><div class="prog ${s.qte <= s.seuil ? "low" : ""}"><i style="width:${Math.min(100, s.qte / (s.seuil * 3) * 100)}%"></i></div></td><td><div class="mini-btns"><button class="btn btn-line btn-sm" data-mv="in" data-id="${s.id}">+ Entrée</button><button class="btn btn-line btn-sm" data-mv="out" data-id="${s.id}">− Sortie</button><button class="btn btn-line btn-sm" data-h="${s.id}">Historique</button></div></td></tr>`), "Aucun article")}</div>`;
        el.querySelectorAll("[data-mv]").forEach(b => b.onclick = () => {
          const s = Store.db().stocks.find(x => x.id === b.dataset.id), inn = b.dataset.mv === "in";
          modal((inn ? "Entrée en stock — " : "Sortie de stock — ") + s.article, `<form class="form" id="mf"><div class="row"><div class="field"><label>Quantité (${esc(s.unite)}s)</label><input name="q" type="number" inputmode="numeric" min="1" ${inn ? "" : `max="${s.qte}"`} required></div><div class="field"><label>Motif</label><input name="motif" required value="${inn ? "Livraison fournisseur" : "Sortie pour le service"}"></div></div><button class="btn btn-orange">${ICONS.save} Valider</button></form>`);
          document.getElementById("mf").onsubmit = async e => {
            e.preventDefault(); const q = +e.target.q.value, delta = inn ? q : -q, nq = s.qte + delta;
            const hist = (s.hist || []).concat([{date:new Date().toISOString(), delta, motif:e.target.motif.value, by:me.prenom + " " + me.nom}]);
            if (!await act(() => Store.update("stocks", s.id, {qte:nq, hist}), "Stock mis à jour : " + nq + " " + s.unite + "(s).")) return;
            if (!inn && nq <= s.seuil) { await Store.log("Alerte stock", `${s.article} : ${nq} ${s.unite}(s) restant(s) (seuil ${s.seuil}). Le cabinet a été averti automatiquement.`); setTimeout(() => toast("⚠ Seuil d'alerte atteint : le cabinet du maire a été averti.", "err"), 600); }
            refresh();
          };
        });
        el.querySelectorAll("[data-h]").forEach(b => b.onclick = () => { const s = Store.db().stocks.find(x => x.id === b.dataset.h); modal("Mouvements — " + s.article, (s.hist || []).length ? `<div class="hist">${s.hist.slice().reverse().map(h => `<div><small>${dtime(h.date)} · ${esc(h.by)}</small><b style="color:${h.delta < 0 ? "var(--bad)" : "var(--ok)"}">${h.delta > 0 ? "+" : ""}${h.delta}</b> — ${esc(h.motif)}</div>`).join("")}</div>` : empty("Aucun mouvement")); });
        el.querySelector("#new").onclick = () => {
          modal("Nouvel article", `<form class="form" id="nf"><div class="field"><label>Article</label><input name="article" required></div><div class="row"><div class="field"><label>Unité</label><input name="unite" required value="unité"></div><div class="field"><label>Service</label><input name="service" required value="${esc(Store.ROLES[me.role].l)}"></div></div><div class="row"><div class="field"><label>Quantité initiale</label><input name="qte" type="number" inputmode="numeric" min="0" required></div><div class="field"><label>Seuil d'alerte</label><input name="seuil" type="number" inputmode="numeric" min="0" required></div></div><button class="btn btn-orange">${ICONS.save} Ajouter</button></form>`);
          document.getElementById("nf").onsubmit = async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); d.qte = +d.qte; d.seuil = +d.seuil; d.arr = N3; d.hist = [{date:new Date().toISOString(), delta:d.qte, motif:"Inventaire initial", by:me.prenom + " " + me.nom}]; if (await act(() => Store.add("stocks", d), "Article ajouté.")) refresh(); };
        };
      },

      /* ---------------- Chantiers ---------------- */
      chantiers(el) {
        const list = L("chantiers").slice().sort((a, b) => (a.statut === "Réalisé") - (b.statut === "Réalisé") || b.avancement - a.avancement);
        const bud = list.reduce((a, c) => a + c.budget, 0), eng = list.reduce((a, c) => a + c.engage, 0);
        const byTh = Object.entries(list.reduce((m, c) => (m[c.theme] = (m[c.theme] || 0) + (+c.engage || 0), m), {})).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
        el.innerHTML = kpis([["crane","ic-b", list.filter(c => c.statut === "En cours").length, "chantiers en cours"],["check","ic-g", list.filter(c => c.statut === "Réalisé").length, "chantiers réalisés"],["wallet","ic-y", mshort(bud), "FCFA programmés"],["chart","ic-o", bud ? Math.round(eng / bud * 100) + " %" : "—", "du budget engagé"]]) +
          `${dotCard(list)}
          ${byTh.length ? `<div class="card"><h2>Montants engagés par thème</h2>${hbars(byTh, mshort)}</div>` : ""}
          <div class="card"><h2>Projets & chantiers <button class="btn btn-orange btn-sm" id="new">${ICONS.plus} Nouveau chantier</button></h2>
          ${tbl(["Chantier","Statut","Avancement","Budget","Engagé"], list.map(c => `<tr class="clk" data-id="${c.id}"><td><b>${esc(c.titre)}</b><br><small style="color:var(--muted)">${esc(c.theme)} · ${esc(c.entreprise || "Prestataire à désigner")}</small></td><td>${stChip(c.statut)}</td><td style="min-width:130px"><div style="display:flex;gap:.5rem;align-items:center"><div class="prog" style="flex:1"><i style="width:${c.avancement}%"></i></div><b style="font-size:.8rem">${c.avancement} %</b></div></td><td style="white-space:nowrap">${mshort(c.budget)}</td><td style="white-space:nowrap">${mshort(c.engage)}</td></tr>`), "Aucun chantier")}</div>`;
        const edit = c => {
          const isNew = !c; c = c || {titre:"", arr:N3, theme:"Assainissement", budget:0, engage:0, avancement:0, statut:"Programmé", debut:"", fin:"", entreprise:"", notes:[]};
          modal(isNew ? "Nouveau chantier" : c.titre, `<form class="form" id="cf">
            <div class="field"><label>Intitulé</label><input name="titre" required value="${esc(c.titre)}"></div>
            <div class="field"><label>Thème</label><select name="theme">${opt(["Assainissement","Voirie","Éclairage","Cadre de vie","Logement","Équipement","Social"], c.theme)}</select></div>
            <div class="row"><div class="field"><label>Budget (FCFA)</label><input name="budget" type="number" inputmode="numeric" min="0" value="${c.budget}"></div><div class="field"><label>Montant engagé (FCFA)</label><input name="engage" type="number" inputmode="numeric" min="0" value="${c.engage}"></div></div>
            <div class="row"><div class="field"><label>Statut</label><select name="statut">${opt(Store.STATUTS.chantiers, c.statut)}</select></div><div class="field"><label>Avancement : <b id="avv">${c.avancement} %</b></label><input name="avancement" type="range" min="0" max="100" step="5" value="${c.avancement}" style="padding:0"></div></div>
            <div class="row"><div class="field"><label>Début</label><input name="debut" type="date" value="${esc(c.debut)}"></div><div class="field"><label>Fin prévue</label><input name="fin" type="date" value="${esc(c.fin)}"></div></div>
            <div class="field"><label>Entreprise / régie</label><input name="entreprise" value="${esc(c.entreprise)}"></div>
            <div class="field"><label>Ajouter une note de suivi</label><input name="note" placeholder="Ex. deuxième tronçon terminé"></div>
            ${c.notes && c.notes.length ? `<div class="hist">${c.notes.slice().reverse().map(n => `<div><small>${date(n.date)}</small>${esc(n.texte)}</div>`).join("")}</div>` : ""}
            <div style="display:flex;gap:.6rem;flex-wrap:wrap"><button class="btn btn-orange">${ICONS.save} Enregistrer</button>${isNew ? "" : `<button type="button" class="btn btn-line" id="cdel">Supprimer</button>`}</div></form>`);
          const fm = document.getElementById("cf");
          fm.avancement.oninput = () => document.getElementById("avv").textContent = fm.avancement.value + " %";
          fm.onsubmit = async e => {
            e.preventDefault(); const d = Object.fromEntries(new FormData(fm)); const note = d.note; delete d.note;
            if (d.debut && d.fin && d.fin < d.debut) return bad(fm, "La date de fin prévue est antérieure au début du chantier.", "fin");
            if (+d.engage > +d.budget) return bad(fm, "Le montant engagé dépasse le budget du chantier.", "engage");
            if (d.statut === "Réalisé" && +d.avancement < 100) d.avancement = 100;
            d.arr = N3; d.budget = +d.budget; d.engage = +d.engage; d.avancement = +d.avancement;
            d.notes = (c.notes || []).concat(note ? [{date:new Date().toISOString(), texte:note}] : []);
            if (await act(() => isNew ? Store.add("chantiers", d) : Store.update("chantiers", c.id, d), "Chantier enregistré.")) { Store.log(isNew ? "Chantier créé" : "Chantier mis à jour", d.titre + " : " + d.avancement + " %"); refresh(); }
          };
          const del = document.getElementById("cdel"); if (del) del.onclick = async () => { if (await ask("Supprimer ce chantier ?") && await act(() => Store.remove("chantiers", c.id), "Chantier supprimé.")) refresh(); };
        };
        el.querySelector("#new").onclick = () => edit(null);
        el.querySelectorAll("[data-id]").forEach(tr => tr.onclick = () => edit(Store.db().chantiers.find(c => c.id === tr.dataset.id)));
      },

      /* ---------------- Publications ---------------- */
      publications(el) {
        const f = F.pb || (F.pb = {s:""}), allP = L("publications").slice().sort((a, b) => b.date.localeCompare(a.date)), list = allP.filter(p => !f.s || (f.s === "on") === !!p.publie);
        el.innerHTML = `<div class="card"><h2>Publications <small class="sub">${allP.filter(p => p.publie).length} en ligne · ${allP.filter(p => !p.publie).length} brouillon(s)</small> <button class="btn btn-orange btn-sm" id="new">${ICONS.plus} Nouvelle publication</button></h2>
          <p style="color:var(--muted);font-size:.88rem;margin-bottom:1rem">Les publications marquées « En ligne » apparaissent immédiatement sur la page d'accueil et la page Actualités du site.</p>
          <div class="tools"><div class="seg" role="group" aria-label="Filtrer">${[["","Toutes"],["on","En ligne"],["off","Brouillons"]].map(([v, l]) => `<button type="button" data-s="${v}" class="${f.s === v ? "on" : ""}">${l}</button>`).join("")}</div></div>
          <div class="feed">${list.length ? list.map(p => `<div class="post ${p.publie ? "" : "devoir"}"><div class="top"><h4>${esc(p.titre)}</h4><span class="chip ${p.publie ? "ok" : "warn"}">${p.publie ? "En ligne" : "Brouillon"}</span></div><p>${esc(p.texte)}</p><small>${esc(p.type)} · ${date(p.date)}</small>
            <div class="mini-btns" style="margin-top:.5rem"><button class="btn btn-line btn-sm" data-tog="${p.id}">${p.publie ? "Retirer du site" : "Publier sur le site"}</button><button class="btn btn-line btn-sm" data-ed="${p.id}">Modifier</button><button class="btn btn-line btn-sm" data-del="${p.id}">Supprimer</button></div></div>`).join("") : empty(f.s ? "Aucune publication dans cette catégorie." : "Aucune publication : rédigez la première avec « Nouvelle publication ».", "mega")}</div></div>`;
        el.querySelectorAll(".seg [data-s]").forEach(b => b.onclick = () => { f.s = b.dataset.s; saveF(); route(false); });
        const edit = p => {
          const isNew = !p; p = p || {type:"Communiqué", titre:"", texte:"", arr:N3, publie:true};
          modal(isNew ? "Nouvelle publication" : "Modifier la publication", `<form class="form" id="pf"><div class="field"><label>Type</label><select name="type">${opt(["Communiqué","Avis","Marché public","Recrutement","Actualité"], p.type)}</select></div>
            <div class="field"><label>Titre</label><input name="titre" required maxlength="140" value="${esc(p.titre)}"></div><div class="field"><label>Texte</label><textarea name="texte" required>${esc(p.texte)}</textarea></div>
            <label style="display:flex;gap:.5rem;align-items:center"><input type="checkbox" name="publie" ${p.publie ? "checked" : ""}> Publier immédiatement sur le site</label><button class="btn btn-orange">${ICONS.save} Enregistrer</button></form>`);
          document.getElementById("pf").onsubmit = async e => {
            e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); d.publie = !!d.publie; d.arr = N3; d.titre = d.titre.trim(); d.texte = d.texte.trim();
            if (d.titre.length < 5) return bad(e.target, "Le titre est trop court (5 caractères minimum).", "titre");
            if (d.texte.length < 3) return bad(e.target, "Le texte est vide : rédigez votre message.", "texte");
            if (await act(() => isNew ? Store.add("publications", d) : Store.update("publications", p.id, d), d.publie ? "Publié sur le site." : "Brouillon enregistré.")) { Store.log("Publication", d.titre); refresh(); }
          };
        };
        el.querySelector("#new").onclick = () => edit(null);
        el.querySelectorAll("[data-ed]").forEach(b => b.onclick = () => edit(Store.db().publications.find(p => p.id === b.dataset.ed)));
        el.querySelectorAll("[data-tog]").forEach(b => b.onclick = async () => { const p = Store.db().publications.find(x => x.id === b.dataset.tog); if (await act(() => Store.update("publications", p.id, {publie:!p.publie}), p.publie ? "Publication retirée du site." : "Publié sur le site.")) refresh(); });
        el.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { if (await ask("Supprimer cette publication ?") && await act(() => Store.remove("publications", b.dataset.del), "Publication supprimée.")) refresh(); });
      },

      /* ---------------- Messages du site ---------------- */
      contacts(el) {
        const f = F.ct || (F.ct = {lu:""}), allC = Store.list("contacts").slice().sort((a, b) => b.date.localeCompare(a.date)), nonLus = allC.filter(c => !c.lu).length;
        const list = f.lu === "1" ? allC.filter(c => !c.lu) : allC;
        el.innerHTML = `<div class="card"><h2><span>Messages reçus via le site <small class="sub">${allC.length} message(s)</small></span><span class="mini-btns"><button class="btn btn-line btn-sm" id="allread" ${nonLus ? "" : "disabled"}>${ICONS.check} Tout marquer comme lu</button></span></h2>
          <div class="tools"><div class="seg" role="group" aria-label="Filtrer"><button type="button" data-lu="" class="${f.lu ? "" : "on"}">Tous</button><button type="button" data-lu="1" class="${f.lu ? "on" : ""}">Non lus (${nonLus})</button></div></div><div class="feed">${list.length ? list.map(c => `<div class="post ${c.lu ? "" : "urgent"}"><div class="top"><h4>${esc(c.sujet)} — ${esc(c.nom)}</h4>${c.lu ? `<span class="chip neu">Lu</span>` : `<span class="chip bad">Nouveau</span>`}</div><p>${esc(c.message)}</p>${(c.pj || []).length ? `<div class="pjlist" style="margin:.4rem 0">${c.pj.map(x => `<a class="pjchip" href="${x.data}" download="${esc(x.nom)}" target="_blank">${ICONS.file}${esc(x.nom)} <small>${x.taille || ""} Ko</small></a>`).join("")}</div>` : ""}<small>${esc(c.email)}${c.tel ? " · " + esc(c.tel) : ""} · ${ago(c.date)}</small>
          <div class="mini-btns" style="margin-top:.5rem">${c.email ? `<a class="btn btn-navy btn-sm" href="mailto:${esc(c.email)}?subject=${encodeURIComponent("Re : " + c.sujet)}">${ICONS.mail} Répondre</a>` : ""}${c.lu ? "" : `<button class="btn btn-line btn-sm" data-read="${c.id}">Marquer comme lu</button>`}<button class="btn btn-line btn-sm" data-del="${c.id}">Supprimer</button></div></div>`).join("") : empty(f.lu ? "Aucun message non lu : tout est à jour." : "Aucun message", "mail")}</div></div>`;
        el.querySelectorAll(".seg [data-lu]").forEach(b => b.onclick = () => { f.lu = b.dataset.lu; saveF(); route(false); });
        el.querySelector("#allread").onclick = async () => { for (const c of allC.filter(c => !c.lu)) await act(() => Store.update("contacts", c.id, {lu:true})); toast("Tous les messages sont marqués comme lus.", "ok"); route(false); };
        el.querySelectorAll("[data-read]").forEach(b => b.onclick = async () => { if (await act(() => Store.update("contacts", b.dataset.read, {lu:true}))) refresh(); });
        el.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { if (await ask("Supprimer ce message ?") && await act(() => Store.remove("contacts", b.dataset.del), "Message supprimé.")) refresh(); });
      },

      /* ---------------- Journal ---------------- */
      journal(el) {
        const f = F.jn || (F.jn = {q:"", user:""}), allJ = Store.list("journal").slice().sort((a, b) => b.date.localeCompare(a.date)), users = [...new Set(allJ.map(j => j.user))].sort();
        const list = allJ.filter(j => (!f.user || j.user === f.user) && (!f.q || (j.action + " " + j.detail).toLowerCase().includes((f.q || "").toLowerCase())));
        el.innerHTML = `<div class="card"><h2><span>Journal d'activité <small class="sub">${list.length} entrée(s)</small></span><button class="btn btn-line btn-sm" id="exp">${ICONS.dl} Export</button></h2><p style="color:var(--muted);font-size:.88rem;margin-bottom:1rem">Chaque action importante est horodatée et signée : une réponse directe au besoin de traçabilité soulevé par les audits des ressources humaines et des contrats.</p>
          <div class="toolbar"><div class="field"><label>Rechercher</label><input data-f="q" type="search" placeholder="Action ou détail" value="${esc(f.q || "")}"></div><div class="field"><label>Agent</label><select data-f="user"><option value="">Tous</option>${opt(users, f.user)}</select></div></div>
          ${tbl(["Date","Agent","Action","Détail"], list.slice(0, 300).map(j => `<tr><td style="white-space:nowrap">${dtime(j.date)}</td><td>${esc(j.user)}</td><td><b>${esc(j.action)}</b></td><td>${esc(j.detail)}</td></tr>`), "Aucune activité enregistrée", resetBtn("jn"))}</div>`;
        filterBar(null, e => { f[e.target.dataset.f] = e.target.value; route(false); }, el);
        el.querySelector("#exp").onclick = () => csv("journal-activite", ["Date","Agent","Action","Détail"], list.map(j => [dtime(j.date), j.user, j.action, j.detail]));
      },

      /* ---------------- Comptes ---------------- */
      comptes(el) {
        const users = Store.db().users.slice().sort((a, b) => a.role.localeCompare(b.role) || a.nom.localeCompare(b.nom));
        el.innerHTML = `<div class="cols"><div class="card"><h2>Comptes agents</h2>${tbl(["Identifiant","Nom","Profil",""], users.map(u => `<tr><td><b>${esc(u.login)}</b></td><td>${esc(u.prenom)} ${esc(u.nom)}<br><small style="color:var(--muted)">${esc(u.titre || "")}</small></td><td>${esc(Store.ROLES[u.role] ? Store.ROLES[u.role].l : u.role)}</td><td><div class="mini-btns"><button class="btn btn-line btn-sm" data-pw="${u.id}">Mot de passe</button>${u.id === me.id ? "" : `<button class="btn btn-line btn-sm" data-del="${u.id}">Supprimer</button>`}</div></td></tr>`))}</div>
          <div class="card"><h2>Créer un compte</h2><form class="form" id="uf">
            <div class="row"><div class="field"><label>Prénom</label><input name="prenom" required></div><div class="field"><label>Nom</label><input name="nom" required></div></div>
            <div class="field"><label>Profil</label><select name="role">${opt(Object.entries(Store.ROLES).map(([k, r]) => [k, r.l]), "etatcivil")}</select></div>
            <div class="field"><label>Fonction (affichée)</label><input name="titre" placeholder="Ex. Agent d'état civil"></div>
            <div class="row"><div class="field"><label>Identifiant</label><input name="login" required pattern="[A-Za-z0-9._\-]{3,40}" autocomplete="off" autocapitalize="none"></div><div class="field"><label>Mot de passe</label><input name="password" type="password" required minlength="6" autocomplete="new-password"></div></div>
            <div class="field"><label>Confirmer le mot de passe</label><input name="password2" type="password" required minlength="6" autocomplete="new-password"></div>
            <button class="btn btn-orange">${ICONS.plus} Créer le compte</button></form></div></div>`;
        el.querySelector("#uf").onsubmit = async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); d.arr = N3; d.login = d.login.trim();
          if (users.some(u => u.login.toLowerCase() === d.login.toLowerCase())) return bad(e.target, "Cet identifiant existe déjà : choisissez-en un autre.", "login");
          if (d.password !== d.password2) return bad(e.target, "Les deux mots de passe ne correspondent pas.", "password2");
          delete d.password2; if (await act(() => Store.createUser(d), "Compte créé : " + d.login)) { Store.log("Compte créé", d.login + " · " + Store.ROLES[d.role].l); route(false); } };
        el.querySelectorAll("[data-pw]").forEach(b => b.onclick = async () => { const p = await ask("Nouveau mot de passe (6 caractères minimum)", {input:"password", min:6, ok:"Enregistrer", title:"Changer le mot de passe"}); if (p && await act(() => Store.setPassword(b.dataset.pw, p), "Mot de passe modifié.")) route(false); });
        el.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { if (await ask("Supprimer ce compte ?") && await act(() => Store.deleteUser(b.dataset.del), "Compte supprimé.")) route(false); });
      },

      /* ---------------- Mon compte ---------------- */
      compte(el) {
        el.innerHTML = `<div class="cols"><div class="card"><h2>Mon profil</h2>
            <div class="stu" style="margin-bottom:1rem"><span class="av" style="width:56px;height:56px;font-size:1.1rem">${ini(me)}</span><span><b style="font-size:1.1rem">${esc(me.prenom + " " + me.nom)}</b><small>${esc(me.titre || "")}</small></span></div>
            <p style="color:var(--muted)">Identifiant : <b style="color:var(--navy)">${esc(me.login)}</b><br>Profil : <b style="color:var(--navy)">${esc(Store.ROLES[me.role].l)}</b><br>Mairie : <b style="color:var(--navy)">3e arrondissement de Libreville</b></p>
            ${Store.LIVE ? "" : `<button class="btn btn-line btn-sm" id="rst" style="margin-top:1rem">Réinitialiser les données de démonstration</button>`}</div>
          <div class="card"><h2>Changer mon mot de passe</h2><form class="form" id="pwf">
            <div class="field"><label for="np1">Nouveau mot de passe</label><input id="np1" name="np1" type="password" minlength="6" required autocomplete="new-password"></div>
            <div class="field"><label for="np2">Confirmer</label><input id="np2" name="np2" type="password" minlength="6" required autocomplete="new-password"></div>
            <button class="btn btn-orange">${ICONS.lock} Mettre à jour</button></form></div></div>`;
        el.querySelector("#pwf").onsubmit = async e => {
          e.preventDefault(); const a = el.querySelector("#np1").value, b = el.querySelector("#np2").value;
          if (a !== b) return bad(e.target, "Les deux mots de passe ne correspondent pas.", "np2");
          if (await act(() => Store.changePassword(a), "Mot de passe mis à jour.")) e.target.reset();
        };
        const r = el.querySelector("#rst"); if (r) r.onclick = async () => { if (await ask("Remettre toutes les données de démonstration à zéro ?")) { await Store.reset(); await Store.logout(); location.href = "espace.html"; } };
      },
    };
    shell();
  }

  /* ---------------- Fiches partagées ---------------- */
  function calList(list, del) {
    if (!list.length) return empty("Aucun rendez-vous", "cal");
    return `<div class="cal-list">${list.map(e => { const d = new Date(e.date); return `<div class="cal-item"><div class="d"><b>${d.getDate()}</b><small>${d.toLocaleDateString("fr-FR", {month:"short"})}</small></div><div><h4>${esc(e.titre)}</h4><p>${d.toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit"})} · ${esc(e.lieu || "")} · ${esc(e.type)}</p></div>${del ? `<button class="btn btn-line btn-sm" data-delev="${e.id}" aria-label="Supprimer">×</button>` : "<span></span>"}</div>`; }).join("")}</div>`;
  }

  function dossiers(el, col) {
    const isD = col === "demandes", STS = Store.STATUTS[col];
    const f = F[col] || (F[col] = {statut:"ouverts", quartier:"", q:"", type:""});
    const all = Store.list(col);
    const types = isD ? DEMARCHES.filter(d => !d.signal).map(d => [d.id, d.t]) : TYPES_SIGNAL.map(t => [t[0], t[1]]);
    let shown = [];
    const draw = () => {
      const list = shown = all.filter(d => (f.statut === "ouverts" ? !/Remise|Rejetée|Résolu/.test(d.statut) : !f.statut || d.statut === f.statut) && (!f.quartier || (f.quartier === "Autres quartiers" ? !qOf(d.quartier) : qOf(d.quartier) === f.quartier)) && (!f.type || d.type === f.type) && (!f.q || (d.ref + " " + d.nom + " " + d.prenom + " " + (d.quartier || "")).toLowerCase().includes(f.q.toLowerCase())))
        .sort((a, b) => b.date.localeCompare(a.date));
      el.querySelector("#list").innerHTML = tbl(isD ? ["Dossier","Demandeur","Démarche","Paiement","Statut",""] : ["Réf.","Problème","Lieu","Priorité","Statut",""],
        list.map(d => isD
          ? `<tr class="clk" data-id="${d.id}"><td><b>${d.ref}</b><br><small style="color:var(--muted)">${date(d.date)}${open(d.statut) && days(d.date) > 7 ? ` <span class="chip warn">+7 j</span>` : ""}</small></td><td style="white-space:nowrap">${esc(d.prenom)} ${esc(d.nom)}<br><small style="color:var(--muted)">${esc(d.tel)}</small></td><td>${esc(d.typeLabel)}</td><td>${payChip(d)} ${acteChip(d.acte)}${(d.pj || []).length ? ` <span class="chip neu" title="Pièces jointes">📎 ${d.pj.length}</span>` : ""}</td><td>${stChip(d.statut)}</td><td class="act">${nextBtn(col, d)}</td></tr>`
          : `<tr class="clk" data-id="${d.id}"><td><b>${d.ref}</b><br><small style="color:var(--muted)">${ago(d.date)}${(d.pj || []).length ? ` · 📷 ${d.pj.length}` : ""}</small></td><td>${esc(d.typeLabel)}</td><td>${esc(d.quartier)}<br><small style="color:var(--muted)">${esc(d.lieu || "")}</small></td><td>${d.priorite === "Haute" ? `<span class="chip bad">Haute</span>` : `<span class="chip neu">Normale</span>`}</td><td>${stChip(d.statut)}</td><td class="act">${nextBtn(col, d)}</td></tr>`), "Aucun dossier ne correspond aux filtres", resetBtn(col));
      el.querySelector("#cnt").textContent = list.length + " dossier(s)";
      el.querySelector("#list [data-reset]") && (el.querySelector("#list [data-reset]").onclick = () => { delete F[col]; saveF(); route(false); });
    };
    const open = s => !/Remise|Rejetée|Résolu|Prête/.test(s);
    const cnt = s => all.filter(d => d.statut === s).length;
    el.innerHTML = kpis(isD
      ? [["inbox","ic-o", cnt("Nouvelle"), "nouvelles demandes"],["clock","ic-b", cnt("En traitement") + cnt("Pièce manquante"), "en traitement"],["check","ic-g", cnt("Prête"), "prêtes à retirer"],["chart","ic-y", all.length, "demandes au total"]]
      : [["alert","ic-o", cnt("Nouveau"), "nouveaux signalements"],["crane","ic-b", cnt("Pris en charge") + cnt("En intervention"), "en cours de traitement"],["check","ic-g", cnt("Résolu"), "résolus"],["wave","ic-y", all.filter(s => s.type === "ordures" && s.statut !== "Résolu").length, "dépôts d'ordures à enlever"]]) +
      `<div class="card"><h2><span>${isD ? "Demandes" : "Signalements"} <small id="cnt" style="color:var(--muted);font-weight:500;font-size:.8rem"></small></span><span class="mini-btns">${isD ? `<button class="btn btn-orange btn-sm" id="new">${ICONS.plus} Demande au guichet</button>` : ""}<button class="btn btn-line btn-sm" id="exp">${ICONS.dl} Export</button></span></h2>
      <div class="toolbar"><div class="field"><label>Rechercher</label><input data-f="q" placeholder="N° de dossier, nom, quartier" value="${esc(f.q)}"></div><div class="field"><label>Statut</label><select data-f="statut">${opt([["ouverts","En cours (non clos)"],["","Tous"], ...STS], f.statut)}</select></div><div class="field"><label>Type</label><select data-f="type"><option value="">Tous</option>${opt(types, f.type)}</select></div><div class="field"><label>Quartier</label><select data-f="quartier"><option value="">Tous</option>${opt(QS.concat(["Autres quartiers"]), f.quartier)}</select></div></div>
      <div id="list"></div></div>`;
    filterBar(null, e => { f[e.target.dataset.f] = e.target.value; draw(); }, el);
    el.querySelector("#list").addEventListener("click", e => { const q = e.target.closest("[data-q]"); if (q) { q.disabled = true; const [c, id, st] = q.dataset.q.split("|"); return quickStatus(c, id, st); } const tr = e.target.closest("[data-id]"); if (tr) fiche(col, tr.dataset.id); });
    el.querySelector("#exp").onclick = () => csv(col + (shown.length === all.length ? "" : "-filtre"), ["Référence","Type","Nom","Prénom","Téléphone","Quartier","Date","Statut"], shown.map(d => [d.ref, d.typeLabel, d.nom, d.prenom, d.tel, d.quartier, date(d.date), d.statut]));
    const nb = el.querySelector("#new");
    if (nb) nb.onclick = () => {
      modal("Enregistrer une demande au guichet", `<form class="form" id="gf"><div class="field"><label>Démarche</label><select name="type">${opt(types)}</select></div>
        <div class="row"><div class="field"><label>Prénom</label><input name="prenom" required></div><div class="field"><label>Nom</label><input name="nom" required></div></div>
        <div class="row"><div class="field"><label>Téléphone</label><input name="tel" type="tel" inputmode="tel" required autocomplete="off" placeholder="Ex. 077 12 34 56"></div><div class="field"><label>Quartier</label><select name="quartier" required>${opt(QS.concat(["Autre quartier"]))}</select></div></div>
        <div class="field"><label>Précisions</label><textarea name="details" style="min-height:80px"></textarea></div><button class="btn btn-orange">${ICONS.save} Enregistrer et remettre le numéro</button></form>`);
      document.getElementById("gf").onsubmit = async e => {
        e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)), dm = DEMARCHES.find(x => x.id === d.type);
        d.prenom = d.prenom.trim(); d.nom = d.nom.trim(); if (!TEL_RE.test(d.tel.trim())) return bad(e.target, "Numéro de téléphone invalide : saisissez au moins 8 chiffres (ex. 077 12 34 56).", "tel");
        const ref = await act(() => Store.submitDemande({...d, arr:N3, typeLabel:dm.t, service:dm.service, email:"", montant:dm.prix || 0, paiement:dm.prix ? {choix:"guichet", statut:"À régler"} : {statut:"Gratuit"}, pj:[], document:null}));
        if (ref) { await Store.init(); Store.log("Demande au guichet", ref + " · " + dm.t); refresh(); modal("Demande enregistrée", `<p class="lead-p">Numéro à remettre à l'usager :</p><div class="refbig" style="text-align:center;margin:1rem 0">${ref}</div><p style="color:var(--muted)">L'usager peut suivre l'avancement sur le site, rubrique « Suivre mon dossier ».</p>`); }
      };
    };
    draw();
  }

  const acteChip = a => !a ? "" : a.statut === "Authentifié" ? `<span class="chip ok" title="${esc(typeDocL(a.type))} n° ${esc(a.numAff || a.num)} authentifié">🛡 Authentifié</span>` : a.statut === "Rejeté" ? `<span class="chip bad">Acte non conforme</span>` : `<span class="chip warn" title="Original à présenter au guichet">Original à vérifier</span>`;
  async function authentifier(au, ok, note) {
    const d = new Date().toISOString(), statut = ok ? "Authentifié" : "Rejeté";
    const h = (au.historique || []).concat([{date:d, t:(ok ? "Original vérifié et authentifié" : "Document non conforme") + " par " + me.prenom + " " + me.nom + (note ? " : " + note : ".")}]);
    if (!await act(() => Store.update("authentifications", au.id, {statut, authDate:ok ? d : null, agent:me.prenom + " " + me.nom, historique:h}), ok ? "Document authentifié : il ne sera plus demandé." : "Document marqué non conforme.")) return false;
    for (const dm of Store.db().demandes.filter(x => x.acte && x.acte.num === au.num)) {
      const hist = dm.historique.concat([{date:d, statut:dm.statut, note:ok ? `${typeDocL(au.type)} n° ${au.numAff} authentifié : l'original ne vous sera plus demandé pour vos prochaines démarches.` : `${typeDocL(au.type)} n° ${au.numAff} non reconnu : rapprochez-vous du service de l'état civil.`, pub:true}]);
      await Store.update("demandes", dm.id, {acte:{...dm.acte, statut, authDate:ok ? d : null}, historique:hist}).catch(() => {});
    }
    Store.log(ok ? "Acte authentifié" : "Acte rejeté", typeDocL(au.type) + " n° " + au.numAff + " · " + au.nom);
    return true;
  }
  function authFiche(id) {
    const au = Store.db().authentifications.find(x => x.id === id); if (!au) return;
    const linked = Store.db().demandes.filter(x => x.acte && x.acte.num === au.num);
    modal(typeDocL(au.type) + " n° " + au.numAff, `<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem">${acteChip(au)}<span class="chip neu">Inscrit ${au.source === "guichet" ? "au guichet" : "en ligne"}</span></div>
      <div class="kv"><div><small>Titulaire</small><b>${esc(au.prenoms)} ${esc(au.nom)}</b></div><div><small>Date de naissance</small><b>${au.naissance ? date(au.naissance) : "—"}</b></div><div><small>Lieu</small><b>${esc(au.lieu || "—")}</b></div><div><small>Téléphone</small><b>${esc(au.tel || "—")}</b></div><div><small>Authentifié le</small><b>${au.authDate ? date(au.authDate) : "—"}</b></div><div><small>Par</small><b>${esc(au.agent || "—")}</b></div></div>
      <h4 style="color:var(--navy)">Historique</h4><div class="hist">${(au.historique || []).slice().reverse().map(x => `<div><small>${dtime(x.date)}</small>${esc(x.t)}</div>`).join("") || "<div>—</div>"}</div>
      <h4 style="color:var(--navy)">Démarches utilisant ce numéro (${linked.length})</h4>${linked.length ? `<div class="hist">${linked.map(x => `<div><b>${x.ref}</b> — ${esc(x.typeLabel)} · ${stChip(x.statut)}</div>`).join("")}</div>` : "<p style='color:var(--muted)'>Aucune pour le moment.</p>"}
      ${au.statut !== "Authentifié" ? `<form class="form" id="authf" style="border-top:1px solid var(--line);padding-top:1rem"><p class="alert-box warn">${ICONS.alert}<span>Vérifiez l'<b>original</b> présenté par l'usager (cachet, signature, concordance avec le registre) avant de valider.</span></p>
        <div class="field"><label>Observation</label><input name="note" placeholder="Ex. vérifié dans le registre 1998, volume 2"></div>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap"><button class="btn btn-orange" name="ok" value="1">${ICONS.shieldok} Original vérifié : authentifier</button><button class="btn btn-line" name="ok" value="0">Non conforme</button></div></form>` : `<div class="auth-badge ok"><span class="shield">${ICONS.shieldok}</span><span><b>Authentifié</b><small>L'original n'est plus demandé : copies, duplicatas, renouvellements et légalisations se font en ligne, l'usager passe seulement récupérer.</small></span></div>`}`);
    const f = document.getElementById("authf");
    if (f) f.addEventListener("submit", async e => { e.preventDefault(); const ok = e.submitter && e.submitter.value === "1"; if (await authentifier(au, ok, f.note.value)) refresh(); });
  }

  const payChip = d => { const p = d.paiement || {}; return p.statut === "Payé" ? `<span class="chip ok" title="${esc(p.mode || "")}">Payé${p.mode ? " · " + (p.mode === "Airtel Money" ? "Airtel" : p.mode === "Carte bancaire" ? "Carte" : esc(p.mode)) : ""}</span>` : p.statut === "À régler" ? `<span class="chip warn">À régler${p.choix === "guichet" ? " (guichet)" : ""}</span>` : `<span class="chip neu">Gratuit</span>`; };
  const pubOf = d => ({ref:d.ref, typeId:d.type, type:d.typeLabel, prenom:d.prenom, nom:d.nom, quartier:d.quartier, arr:d.arr, date:d.date, montant:d.montant, paiement:d.paiement, document:d.document});

  const acteHTML = a => a.statut === "Authentifié"
    ? `<div class="auth-badge ok"><span class="shield">${ICONS.shieldok}</span><span><b>${esc(typeDocL(a.type))} n° ${esc(a.numAff || a.num)} — authentifié</b><small>Original déjà vérifié${a.authDate ? " le " + date(a.authDate) : ""} : ne pas le redemander. Traiter en ligne ; l'usager passe seulement récupérer.</small></span></div>`
    : `<div class="auth-badge ${a.statut === "Rejeté" ? "bad" : "wait"}"><span class="shield">${ICONS.shield}</span><span><b>${esc(typeDocL(a.type))} n° ${esc(a.numAff || a.num)} — ${a.statut === "Rejeté" ? "non conforme" : "à authentifier"}</b><small>Exiger l'original lors du passage au guichet, puis l'authentifier : il ne sera plus jamais demandé.</small></span><button type="button" class="btn btn-orange btn-sm" id="goauth">${ICONS.shieldok} Authentifier</button></div>`;

  /* Statut suivant en 1 clic (liste, tableau de bord) */
  const NEXT = {demandes:{"Nouvelle":["En traitement","Prendre en charge"],"En traitement":["Prête","Marquer prête"],"Pièce manquante":["En traitement","Reprendre"],"Prête":["Remise","Remis à l'usager"]}, signalements:{"Nouveau":["Pris en charge","Prendre en charge"],"Pris en charge":["En intervention","Équipe sur place"],"En intervention":["Résolu","Marquer résolu"]}};
  const nextBtn = (col, d) => { const n = d.type === "rdv" ? null : (NEXT[col] || {})[d.statut]; return n ? `<button type="button" class="btn btn-orange btn-sm" data-q="${col}|${d.id}|${esc(n[0])}">${n[1]}</button>` : ""; };
  const noteFor = (d, dem, st) => ({"En traitement":`Dossier pris en charge par le service ${d.service || "technique"}.`, "Pièce manquante":"Merci de fournir : ", "Prête":dem.doc ? "Votre document est prêt : téléchargez-le en ligne depuis « Suivre mon dossier » ou retirez-le au guichet." : "Votre dossier est prêt : présentez-vous au guichet avec votre pièce d'identité.", "Remise":"Document remis au demandeur.", "Rejetée":"", "Pris en charge":"Équipe des services techniques informée.", "En intervention":"Équipe sur place.", "Résolu":"Intervention terminée. Merci pour votre signalement."})[st];
  async function quickStatus(col, id, st) {
    const d = Store.db()[col].find(x => x.id === id); if (!d) return;
    const isD = col === "demandes", dem = isD ? DEMARCHES.find(x => x.id === d.type) || {} : {};
    const h = d.historique.concat([{date:new Date().toISOString(), statut:st, note:noteFor(d, dem, st) || "Statut mis à jour.", pub:true, by:me.prenom + " " + me.nom}]);
    const patch = {statut:st, historique:h}; if (isD && dem.doc && st === "Prête" && !d.document) patch.document = {type:"auto", date:new Date().toISOString()};
    if (await act(() => Store.update(col, id, patch), d.ref + " : " + st.toLowerCase() + ".")) { Store.log(isD ? "Demande traitée" : "Signalement traité", d.ref + " → " + st); refresh(); }
    else route(false);
  }

  function fiche(col, id) {
    const d = Store.db()[col].find(x => x.id === id); if (!d) return;
    const isD = col === "demandes", STS = Store.STATUTS[col], dem = isD ? DEMARCHES.find(x => x.id === d.type) || {} : {};
    const nextNote = new Proxy({}, {get:(_, st) => noteFor(d, dem, st)});
    const p = d.paiement || {};
    const payBox = !isD ? "" : !d.montant ? `<div class="sbox"><div><b>${ICONS.check} Démarche gratuite</b></div></div>`
      : p.statut === "Payé" ? `<div class="sbox ok"><div><b>${ICONS.check} Payé : ${money(d.montant)}</b><small>${esc(p.mode)} · ${dtime(p.date)} · quittance ${esc(p.quittance)}${p.transaction ? " · transaction " + esc(p.transaction) : ""}</small></div><button class="btn btn-line btn-sm" id="frecu">${ICONS.dl} Reçu</button></div>`
      : `<div class="sbox warn"><div><b>${ICONS.wallet} À régler : ${money(d.montant)}</b><small>${p.choix === "guichet" ? "L'usager a choisi de payer à la mairie." : "Paiement en ligne non finalisé."} Encaisser au guichet :</small></div><div class="mini-btns"><select id="encmode" class="btn btn-line btn-sm">${opt(Store.MODES)}</select><button class="btn btn-orange btn-sm" id="enc">${ICONS.wallet} Encaisser</button></div></div>`;
    const pjBox = (d.pj || []).length ? `<h4 style="margin-top:1rem;color:var(--navy)">Pièces jointes par l'usager</h4><div class="pjlist">${(d.pj || []).map(x => `<a class="pjchip" href="${x.data}" download="${esc(x.nom)}" target="_blank">${ICONS.file}${esc(x.nom)} <small>${x.taille || ""} Ko</small></a>`).join("")}</div>${d.pj.filter(x => /^image/.test(x.type)).map(x => `<img class="pjimg" src="${x.data}" alt="${esc(x.nom)}">`).join("")}` : "";
    const docBox = !isD || !dem.doc ? "" : `<h4 style="margin-top:1rem;color:var(--navy)">Document délivré à l'usager</h4>
      <div class="sbox doc"><div><b>${ICONS.file} ${d.document ? (d.document.type === "fichier" ? "Fichier joint : " + esc(d.document.nom) : "Document généré automatiquement (PDF)") : "Pas encore délivré"}</b><small>${d.document ? "Téléchargeable par l'usager une fois la démarche payée et le statut « Prête »." : "Il sera généré automatiquement au passage en « Prête », ou joignez le document scanné/signé."}</small></div>
      <div class="mini-btns"><button class="btn btn-line btn-sm" id="dprev">${ICONS.dl} Aperçu PDF</button><label class="btn btn-line btn-sm" for="dfile">${ICONS.plus} Joindre le document signé</label><input type="file" id="dfile" accept="application/pdf,image/*" class="sr-only"></div></div>`;
    modal(d.ref + " · " + d.typeLabel, `<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem">${stChip(d.statut)}${d.quartier ? `<span class="chip neu">${esc(d.quartier)}</span>` : ""}${isD ? payChip(d) : ""}${d.priorite ? `<span class="chip ${d.priorite === "Haute" ? "bad" : "neu"}">Priorité ${d.priorite.toLowerCase()}</span>` : ""}</div>
      <div class="kv"><div><small>${isD ? "Demandeur" : "Signalé par"}</small><b>${esc(d.prenom)} ${esc(d.nom)}</b></div><div><small>Téléphone</small><b>${esc(d.tel)}</b></div><div><small>Quartier</small><b>${esc(d.quartier)}</b></div><div><small>Déposé le</small><b>${date(d.date)}</b></div>${isD ? `<div><small>Service</small><b>${esc(d.service)}</b></div>` : `<div><small>Lieu</small><b>${esc(d.lieu || "—")}</b></div>`}</div>
      ${d.rdv ? `<div class="sbox doc"><div><b>${ICONS.ticket} Rendez-vous le ${date(d.rdv.jour)} à ${esc(d.rdv.heure)}</b><small>Réservé en ligne · mairie du 3e arrondissement</small></div></div>` : ""}
      ${d.details || d.description ? `<p style="background:var(--bg);padding:.8rem 1rem;border-radius:10px;font-size:.9rem">${esc(d.details || d.description)}</p>` : ""}
      ${d.acte ? `<h4 style="margin-top:1rem;color:var(--navy)">Document de référence</h4>${acteHTML(d.acte)}` : ""}${payBox}${pjBox}${docBox}
      <h4 style="margin-top:1.2rem;color:var(--navy)">Historique</h4>
      <div class="hist">${d.historique.slice().reverse().map(h => `<div class="${h.pub ? "" : "priv"}"><small>${dtime(h.date)} · ${h.pub ? "visible par l'usager" : "note interne"}</small><b>${esc(h.statut)}</b> — ${esc(h.note)}</div>`).join("")}</div>
      <form class="form" id="sf" style="border-top:1px solid var(--line);padding-top:1rem">
        <div class="row"><div class="field"><label>Nouveau statut</label><select name="statut">${opt(STS, d.statut)}</select></div>${isD ? "" : `<div class="field"><label>Priorité</label><select name="priorite">${opt(["Normale","Haute"], d.priorite)}</select></div>`}</div>
        <div class="field"><label>Message / note</label><textarea name="note" style="min-height:80px" required></textarea></div>
        <label style="display:flex;gap:.5rem;align-items:center;font-size:.88rem"><input type="checkbox" name="pub" checked> Visible par l'usager dans le suivi en ligne</label>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap"><button class="btn btn-orange">${ICONS.save} Mettre à jour le dossier</button>${d.tel ? `<a class="btn btn-line" href="tel:${esc(d.tel.replace(/\s/g, ""))}">${ICONS.phone} Appeler</a>` : ""}</div></form>`);
    const ab = document.getElementById("goauth"); if (ab) ab.onclick = () => { const au = Store.db().authentifications.find(x => x.num === d.acte.num); closeModal(); if (au) authFiche(au.id); else toast("Numéro introuvable dans le registre.", "err"); };
    const fm = document.getElementById("sf");
    const setNote = () => { fm.note.value = nextNote[fm.statut.value] ?? ""; };
    fm.statut.onchange = setNote; if (fm.statut.value === d.statut) fm.note.value = "";
    fm.onsubmit = async e => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(fm));
      if (!v.note.trim()) return bad(fm, "Écrivez un message ou une note pour expliquer ce changement.", "note");
      if (v.statut === "Pièce manquante" && v.note.trim().length < 22) return bad(fm, "Précisez la ou les pièces à fournir.", "note");
      const h = d.historique.concat([{date:new Date().toISOString(), statut:v.statut, note:v.note, pub:!!v.pub, by:me.prenom + " " + me.nom}]);
      const patch = {statut:v.statut, historique:h}; if (v.priorite) patch.priorite = v.priorite;
      if (isD && dem.doc && v.statut === "Prête" && !d.document) patch.document = {type:"auto", date:new Date().toISOString()};
      if (await act(() => Store.update(col, d.id, patch), "Dossier " + d.ref + " mis à jour.")) { Store.log(isD ? "Demande traitée" : "Signalement traité", d.ref + " → " + v.statut); refresh(); }
    };
    const enc = document.getElementById("enc");
    if (enc) enc.onclick = async () => { const mode = document.getElementById("encmode").value; enc.disabled = true; const r = await act(() => Store.encaisser(d.id, mode), "Paiement encaissé : " + money(d.montant)); if (r) { Store.log("Encaissement", d.ref + " · " + mode + " · " + money(d.montant)); refresh(); quittance(r); } else enc.disabled = false; };
    const fr = document.getElementById("frecu"); if (fr) fr.onclick = () => downloadRecu(pubOf(d)).catch(e => toast(e.message, "err"));
    const dp = document.getElementById("dprev"); if (dp) dp.onclick = () => downloadDocument({...pubOf(d), document:d.document || {type:"auto", date:new Date().toISOString()}}).catch(e => toast(e.message, "err"));
    const df = document.getElementById("dfile");
    if (df) df.onchange = async () => {
      let files; try { files = await readFiles(df); } catch (e) { return toast(e.message, "err"); }
      if (!files.length) return; const x = files[0];
      if (await act(() => Store.update("demandes", d.id, {document:{type:"fichier", nom:x.nom, data:x.data, date:new Date().toISOString()}}), "Document joint au dossier : l'usager pourra le télécharger.")) { Store.log("Document délivré", d.ref + " · " + x.nom); refresh(); fiche(col, id); }
    };
  }

  function vigFiche(id) {
    const v = Store.db().vignettes.find(x => x.id === id); if (!v) return;
    const p = Store.vigPub(v), url = siteBase() + "payer.html?v=" + encodeURIComponent(v.num);
    modal("Vignette " + v.num, `<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem">${stChip(p.etat)}<span class="chip neu">${esc(p.catL)}</span></div>
      <div class="vcard" style="--vc:${p.etat === "Valide" ? "#0a8a55" : p.etat === "Expirée" ? "#c0392b" : "#d97706"}"><div class="vb"><div class="kv"><div><small>Immatriculation</small><b>${esc(v.plaque)}</b></div><div><small>Titulaire</small><b>${esc(v.proprio)}</b></div><div><small>Téléphone</small><b>${esc(v.tel || "—")}</b></div><div><small>Valable du</small><b>${date(v.debut)}</b></div><div><small>Jusqu'au</small><b>${date(v.fin)}</b></div><div><small>Quittance</small><b>${esc(v.quittance || "—")}</b></div></div><div class="qrbox" data-qr="${esc(url)}"></div></div></div>
      <h4 style="color:var(--navy);margin-top:1rem">Contrôles (${(v.controles || []).length})</h4>${(v.controles || []).length ? `<div class="hist">${v.controles.slice().reverse().map(c => `<div><small>${dtime(c.date)} · ${esc(c.agent)}</small>${esc(c.lieu)} — <b>${esc(c.res)}</b></div>`).join("")}</div>` : "<p style='color:var(--muted)'>Aucun contrôle enregistré.</p>"}
      <div class="mini-btns" style="margin-top:1rem"><button class="btn btn-orange btn-sm" id="vpdf">${ICONS.dl} Vignette (PDF)</button><button class="btn btn-line btn-sm" id="vctl">${ICONS.check} Enregistrer un contrôle</button><button class="btn btn-line btn-sm" id="vsus">${v.statut === "Suspendue" ? "Réactiver" : "Suspendre"}</button></div>`);
    drawQRs(document.getElementById("modal"));
    document.getElementById("vpdf").onclick = () => downloadVignette(p).catch(e => toast(e.message, "err"));
    document.getElementById("vctl").onclick = () => addControle(v, p.etat);
    document.getElementById("vsus").onclick = async () => { const st = v.statut === "Suspendue" ? "Active" : "Suspendue"; if (await act(() => Store.update("vignettes", v.id, {statut:st}), st === "Active" ? "Vignette réactivée." : "Vignette suspendue.")) { Store.log("Vignette " + (st === "Active" ? "réactivée" : "suspendue"), v.num + " · " + v.plaque); refresh(); } };
  }
  async function addControle(v, res) {
    const lieu = await ask("Lieu du contrôle", {input:"text", value:"Marché de Mont-Bouët", ok:"Enregistrer", title:"Enregistrer un contrôle"}); if (!lieu) return;
    const c = (v.controles || []).concat([{date:new Date().toISOString(), agent:me.prenom + " " + me.nom, lieu, res}]);
    if (await act(() => Store.update("vignettes", v.id, {controles:c}), "Contrôle enregistré : " + res + ".")) { Store.log("Contrôle vignette", v.num + " · " + v.plaque + " · " + res + " (" + lieu + ")"); refresh(); }
  }
  function controleTerrain() {
    modal("Contrôle terrain", `<p class="lead-p">Scannez le QR code de la vignette ou saisissez la plaque : le résultat s'affiche instantanément et le contrôle est enregistré.</p>
      <form class="form" id="ctf" style="margin-top:1rem"><div class="row"><div class="field"><label>N° de vignette ou immatriculation</label><input name="q" required style="text-transform:uppercase" placeholder="L3-TX-0001"></div><div class="field"><label>&nbsp;</label><button class="btn btn-navy">Vérifier</button></div></div>
      <button type="button" class="btn btn-orange" id="ctscan">${ICONS.camera} Scanner avec la caméra</button></form><div class="scanbox" id="ctbox" hidden></div><div id="ctout" style="margin-top:1rem"></div>`);
    const out = document.getElementById("ctout"), fm = document.getElementById("ctf"), box = document.getElementById("ctbox");
    const check = q => { fm.q.value = q; const k = String(q).toUpperCase().replace(/[^A-Z0-9]/g, ""); const v = Store.db().vignettes.find(x => x.num.replace(/[^A-Z0-9]/g, "") === k || x.plaque.replace(/[^A-Z0-9]/g, "") === k);
      if (!v) { out.innerHTML = `<div class="alert-box">${ICONS.alert}<span><b>Aucune vignette</b> pour « ${esc(q)} » : véhicule en infraction.</span></div>`; return; }
      const p = Store.vigPub(v); out.innerHTML = vigCard(p) + `<button class="btn btn-orange" id="ctsave" style="margin-top:.8rem">${ICONS.save} Enregistrer ce contrôle</button>`; drawQRs(out);
      document.getElementById("ctsave").onclick = async () => { const c = (v.controles || []).concat([{date:new Date().toISOString(), agent:me.prenom + " " + me.nom, lieu:"Contrôle terrain", res:p.etat}]); if (await act(() => Store.update("vignettes", v.id, {controles:c}), "Contrôle enregistré.")) { Store.log("Contrôle vignette", v.num + " · " + p.etat); refresh(); } };
    };
    fm.onsubmit = e => { e.preventDefault(); check(fm.q.value); };
    let stream = null;
    document.getElementById("ctscan").onclick = async () => {
      try { await loadScript(JSQR_LIB); stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}); } catch (e) { return toast("Caméra indisponible : saisissez la plaque.", "err"); }
      box.hidden = false; box.innerHTML = '<video playsinline muted></video><span class="frame"></span>';
      const v = box.querySelector("video"), c = document.createElement("canvas"), cx = c.getContext("2d", {willReadFrequently:true}); v.srcObject = stream; await v.play().catch(() => {});
      const stop = () => { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; box.hidden = true; box.innerHTML = ""; };
      const tick = () => { if (!stream) return; if (!document.getElementById("ctbox")) return stop(); if (v.readyState >= 2) { c.width = v.videoWidth; c.height = v.videoHeight; cx.drawImage(v, 0, 0); const code = window.jsQR(cx.getImageData(0, 0, c.width, c.height).data, c.width, c.height); if (code && code.data) { stop(); let q = code.data; try { q = new URL(q).searchParams.get("v") || q; } catch (e) {} check(q); return; } } requestAnimationFrame(tick); };
      tick();
    };
  }

  function acteView(a) {
    const TY = {naissance:"ACTE DE NAISSANCE", mariage:"ACTE DE MARIAGE", deces:"ACTE DE DÉCÈS"};
    const rows = [["N° d'acte", a.num], ["Nom", a.nom], ["Prénom(s)", a.prenoms], ["Sexe", a.sexe === "F" ? "Féminin" : "Masculin"], [a.type === "deces" ? "Date du décès" : a.type === "mariage" ? "Date du mariage" : "Date de naissance", date(a.dateEvt)], ["Lieu", a.lieu]];
    if (a.pere) rows.push(["Père", a.pere]); if (a.mere) rows.push(["Mère", a.mere]); if (a.conjoint) rows.push(["Conjoint(e)", a.conjoint]); if (a.regime) rows.push(["Régime", a.regime]);
    const html = `<div class="acte"><p class="rep">République gabonaise · Union – Travail – Justice</p><p class="rep" style="margin-top:.3rem">Commune de Libreville · Mairie du 3e arrondissement</p><h2 style="margin-top:1.2rem">EXTRAIT D'${TY[a.type]}</h2>
      <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td><b>${esc(v)}</b></td></tr>`).join("")}</table>
      <div class="foot"><span>Délivré à Libreville, le ${date(new Date())}</span><span>L'officier d'état civil<br><br><br>Signature & cachet</span></div>
      <p style="text-align:center;font-size:.7rem;color:#999;margin-top:1.5rem">Document de démonstration — sans valeur légale</p></div>`;
    modal("Extrait " + a.num, html + `<div style="display:flex;gap:.6rem;margin-top:1rem;justify-content:center"><button class="btn btn-orange" id="pr">${ICONS.print} Imprimer l'extrait</button></div>`);
    document.getElementById("pr").onclick = () => printHTML("Extrait " + a.num, html);
  }

  function quittance(r) {
    const html = `<div class="acte"><p class="rep">Mairie du 3e arrondissement de Libreville · Recette municipale</p><h2 style="margin-top:1rem">QUITTANCE ${esc(r.quittance)}</h2>
      <table><tr><td>Date</td><td><b>${dtime(r.date)}</b></td></tr><tr><td>Nature</td><td><b>${esc(r.nature)}</b></td></tr><tr><td>Payeur</td><td><b>${esc(r.payeur)}</b></td></tr><tr><td>Mode de paiement</td><td><b>${esc(r.mode)}</b></td></tr><tr><td>Montant</td><td><b style="font-size:1.2rem">${money(r.montant)}</b></td></tr><tr><td>Encaissé par</td><td><b>${esc(r.agent || "")}</b></td></tr></table>
      <div class="foot"><span>Pour acquit</span><span>Le receveur municipal</span></div><p style="text-align:center;font-size:.7rem;color:#999;margin-top:1.5rem">Document de démonstration — sans valeur légale</p></div>`;
    modal("Quittance " + r.quittance, html + `<div style="display:flex;gap:.6rem;margin-top:1rem;justify-content:center"><button class="btn btn-orange" id="pr">${ICONS.print} Imprimer</button></div>`);
    document.getElementById("pr").onclick = () => printHTML("Quittance " + r.quittance, html);
  }

  return {boot};
})();
