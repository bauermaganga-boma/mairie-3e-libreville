/* Test de bout en bout : node tests/e2e.js <url_base> [dossier_captures]  (puppeteer-core + Chrome ou Edge)
   Parcours : demande en ligne avec pièce jointe + paiement Airtel Money → agent état civil passe « Prête »
   → l'usager télécharge son PDF → paiement au guichet → contact avec PJ → indicateurs (graphiques)
   → tous les modules du cabinet → publication visible sur le site → mode mono-arrondissement (le 3e : plus de comptes arr1…arr6). */
const pp = require(process.env.PP || "puppeteer-core"), fs = require("fs"), path = require("path"), os = require("os");
const EDGE = process.env.BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const B = process.argv[2] || "http://127.0.0.1:8090/", OUT = process.argv[3] || "";
const W = ms => new Promise(r => setTimeout(r, ms)); let fails = 0;
const check = (l, ok, i = "") => { console.log((ok ? "OK  " : "ECHEC ") + l, i); if (!ok) fails++; };
(async () => {
  const DL = fs.mkdtempSync(path.join(os.tmpdir(), "l3e-dl-"));
  const img = path.join(DL, "piece-identite.png");
  fs.writeFileSync(img, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGNk+M/wn4GBgYGJAQoAAAD//wMAKQUDAZ0V6R0AAAAASUVORK5CYII=", "base64"));
  const b = await pp.launch({executablePath:EDGE, headless:"new"}), p = await b.newPage(), errs = [];
  const cdp = await b.target().createCDPSession(); await cdp.send("Browser.setDownloadBehavior", {behavior:"allow", downloadPath:DL});
  p.on("pageerror", e => errs.push(e.message + " @ " + (e.stack || "").split(String.fromCharCode(10)).slice(1, 3).join(" "))); p.on("dialog", d => d.accept());
  await p.setViewport({width:1366, height:900});
  const txt = s => p.$eval(s, e => e.innerText).catch(() => "");
  const shot = async n => { if (OUT) await p.screenshot({path:OUT + "/" + n + ".png", fullPage:true}); };
  const waitFile = async re => { for (let i = 0; i < 30; i++) { const f = fs.readdirSync(DL).find(x => re.test(x) && !x.endsWith(".crdownload")); if (f) return f; await W(300); } return null; };
  const selArr = async v => { if (await p.$("select#arr")) await p.select("#arr", v); };   // le choix d'arrondissement peut avoir disparu (mono-arrondissement)
  const login = async (l, pw) => { await p.goto(B + "espace.html", {waitUntil:"networkidle2"}); await p.evaluate(() => sessionStorage.clear()); await p.type("#login", l); await p.type("#pwd", pw); await p.click("#login-form button[type=submit]"); await p.waitForNavigation(); await W(800); };

  // 1. Demande en ligne + pièce jointe + paiement Airtel Money
  await p.goto(B + "demarches.html?d=naissance#demande", {waitUntil:"networkidle2"});
  await selArr("3"); await p.click("[data-next]");
  await p.type("#prenom", "Test"); await p.type("#nom", "Citoyen"); await p.type("#tel", "077112233"); await p.type("#quartier", "Akébé");
  await p.evaluate(() => document.querySelectorAll(".fstep")[1].querySelector("[data-next]").click());
  await p.type("#numActe", "4321/2001"); await p.click("#verif"); await W(500);
  check("numéro inconnu : à authentifier", (await txt("#acte-res")).includes("À authentifier"));
  const up = await p.$("#pj"); await up.uploadFile(img); await W(300);
  await p.evaluate(() => document.querySelectorAll(".fstep")[2].querySelector("[data-next]").click()); await W(200);
  check("étape paiement avec Airtel / Moov / carte / guichet", (await txt("#pay-step")).includes("Airtel Money") && (await txt("#pay-step")).includes("Moov Money") && (await txt("#pay-step")).includes("Payer à la mairie"));
  await shot("v2-paiement-etape");
  await p.evaluate(() => { document.querySelector(".fstep.on input[type=checkbox]").checked = true; }); await p.click("button[type=submit]"); await W(1200);
  await shot("v2-paiement-airtel");
  await p.$eval("#amn", e => e.value = ""); await p.type("#amn", "077112233"); await p.click("#pf button"); await W(500); await p.click("#ok"); await W(2000);
  check("paiement confirmé", (await txt("#modal")).includes("Paiement confirmé"));
  const ref = (await txt(".refbig")).trim(); check("numéro de dossier", /^L3-\d\d-\d{5}$/.test(ref), ref);
  await p.click("#dlr"); check("reçu PDF téléchargé", !!(await waitFile(/^recu-.*\.pdf$/)));
  // 2. Agent état civil : voit PJ + paiement, passe « Prête »
  await login("etat.civil", "agent2026");
  await p.goto(B + "agents.html#demandes"); await W(800);
  await p.type("[data-f=q]", ref); await W(300);
  check("liste : paiement Airtel visible", (await txt("#list")).includes("Payé · Airtel"));
  await p.click("#list [data-id]"); await W(400);
  check("fiche : pièce jointe visible", (await txt("#modal")).includes("piece-identite"));
  await p.select("#sf [name=statut]", "Prête"); await p.click("#sf button.btn-orange"); await W(800);
  // 2b. Authentification au guichet (original présenté une seule fois)
  await p.goto(B + "agents.html#authentifications"); await W(800);
  await p.type("[data-f=q]", "4321/2001"); await W(300); await p.click("#list [data-id]"); await W(400);
  await p.click("#authf button[value='1']"); await W(1200);
  check("acte authentifié au guichet", (await txt("#list")).includes("Authentifié"));
  await shot("v3-authentifications");
  // 2c. Deuxième démarche avec le même numéro : reconnu, original non requis
  await p.goto(B + "demarches.html?d=duplicata#demande", {waitUntil:"networkidle2"});
  await selArr("3"); await p.click("[data-next]");
  await p.type("#prenom", "Test"); await p.type("#nom", "Citoyen"); await p.type("#tel", "077112233"); await p.type("#quartier", "Akébé");
  await p.evaluate(() => document.querySelectorAll(".fstep")[1].querySelector("[data-next]").click());
  await p.type("#numActe", "N° 4321 / 2001"); await p.click("#verif"); await W(500);
  check("même numéro reconnu : badge Authentifié", (await txt("#acte-res")).includes("Authentifié"));
  await shot("v3-badge-demande");
  await p.evaluate(() => document.querySelectorAll(".fstep")[2].querySelector("[data-next]").click()); await W(200);
  await p.evaluate(() => { const g = [...document.querySelectorAll("[name=payer]")].find(x => x.value === "guichet"); g.checked = true; document.querySelector(".fstep.on input[type=checkbox]").checked = true; });
  await p.click("button[type=submit]"); await W(1200);
  check("confirmation : original non requis", (await txt("#modal")).includes("il ne vous sera plus demandé"));
  // vérification publique
  await p.goto(B + "demarches.html#authentification", {waitUntil:"networkidle2"});
  await p.type("#anum", "0312/2004"); await p.type("#anom", "Mengué"); await p.click("#auth-form button"); await W(600);
  check("vérification publique d'un numéro", (await txt("#auth-out")).includes("Authentifié"));
  await p.$eval("#anom", e => e.value = ""); await p.type("#anom", "Dupont"); await p.click("#auth-form button"); await W(600);
  check("mauvais nom : pas d'information divulguée", !(await txt("#auth-out")).includes("MENGUE"));
  await login("etat.civil", "agent2026");
  // 3. Usager : suivi + téléchargement du document
  await p.goto(B + "demarches.html#suivi", {waitUntil:"networkidle2"}); await W(800);
  await p.$eval("#ref", e => e.value = ""); await p.$eval("#stel", e => e.value = "");
  await p.type("#ref", ref); await p.type("#stel", "077 11 22 33"); await p.click("#suivi-form button"); await W(800);
  await shot("v2-suivi");
  check("suivi : document prêt", (await txt("#suivi-out")).includes("Votre document est prêt"));
  await p.click("#dldoc"); check("document PDF téléchargé", !!(await waitFile(/extrait.*\.pdf$/)));
  await p.$eval("#stel", e => e.value = "000000"); await p.click("#suivi-form button"); await W(600);
  check("suivi refusé avec mauvais téléphone", !(await txt("#suivi-out")).includes("Historique"));
  // 4. Dossier à payer au guichet → encaissement par l'agent
  await login("maire", "3e2026");
  await p.goto(B + "agents.html#demandes"); await W(800); await p.type("[data-f=q]", "L3-26-01235"); await W(300); await p.click("#list [data-id]"); await W(400);
  await p.click("#enc"); await W(1000);
  check("encaissement guichet + quittance", (await txt("#modal")).includes("QUITTANCE"));
  // 5. Contact avec pièce jointe
  await p.goto(B + "contact.html", {waitUntil:"networkidle2"});
  await p.type("#cnom", "Test Contact"); await p.type("#cmail", "t@exemple.ga"); if (await p.$("#cdest")) await p.$eval("#cdest", e => { e.selectedIndex = e.options.length - 1; }); await p.type("#cmsg", "Message avec PJ");
  const up2 = await p.$("#cpj"); await up2.uploadFile(img); await W(300); await p.click("#contact-form button[type=submit]"); await W(1200);
  check("contact envoyé avec PJ", (await txt(".toast")).includes("pièce"));
  await login("maire", "3e2026"); await p.goto(B + "agents.html#contacts"); await W(800);
  check("le cabinet du 3e reçoit le message et sa PJ", (await txt("#views")).includes("Message avec PJ") && (await txt("#views")).includes("piece-identite"));
  // 6. Tableau de bord et indicateurs du 3e arrondissement
  await p.goto(B + "agents.html#tableau"); await W(2500); await shot("v3-tableau-3e");
  check("tableau de bord du 3e", (await txt("#views")).length > 50);
  await p.goto(B + "agents.html#indicateurs"); await W(2500); await shot("v2-indicateurs-3e");
  check("indicateurs du 3e : graphiques", await p.$$eval("canvas", c => c.filter(x => x.width > 0).length) >= 4);
  // 7. Cabinet : indicateurs commune + comparatif + tous modules
  await p.goto(B + "espace.html?role=cabinet&demo=1", {waitUntil:"networkidle2"}); await p.waitForNavigation(); await W(900);
  await p.goto(B + "agents.html#indicateurs"); await W(2500); await shot("v2-indicateurs-maire");
  check("indicateurs du cabinet : graphiques", (await p.$$eval("canvas", c => c.length)) >= 4);
  for (const v of ["tableau","authentifications","demandes","rendezvous","signalements","actes","vignettes","agenda","recettes","agents","stocks","chantiers","publications","contacts","journal","compte"]) {
    await p.goto(B + "agents.html#" + v); await W(450); check("module " + v, (await txt("#views")).length > 50);
  }
  await p.goto(B + "agents.html#publications"); await W(500); await p.click("#new"); await W(300);
  await p.type("#pf [name=titre]", "Avis de test e2e"); await p.type("#pf [name=texte]", "Contenu"); await p.click("#pf button"); await W(800);
  await W(1500); await p.goto(B + "actualites.html", {waitUntil:"domcontentloaded"}); await W(1500);
  check("publication visible sur le site", (await txt("#avis")).includes("Avis de test e2e"));
  // 7b. e-Services : payer une vignette, la vérifier, la contrôler
  await p.goto(B + "payer.html", {waitUntil:"networkidle2"});
  await p.click("[data-t=vig-TB]"); await p.type("#tref", "GA 7777 EZ"); await p.type("#tnom", "Test Transporteur"); await p.type("#ttel", "062112233");
  await p.evaluate(() => [...document.querySelectorAll("#mpay input")].find(x => x.value === "Moov Money").checked = true);
  await p.click("#tax-form button[type=submit]"); await W(3200);
  check("vignette payée par Moov Money", (await txt("#modal")).includes("Paiement confirmé") && (await txt("#modal")).includes("Vignette valide"));
  check("QR code de la vignette affiché", !!(await p.$("#modal .qrbox svg")));
  const vnum = await p.$eval("#modal .vcard .vh small", e => e.textContent.split(" · ")[0]).catch(() => ""); check("numéro de vignette", /^L3-TB-\d{4}$/.test(vnum), vnum);
  await p.click("#dlv"); check("vignette PDF téléchargée", !!(await waitFile(/^vignette-.*\.pdf$/)));
  await p.click("#dlq"); check("reçu e-Tax PDF téléchargé", !!(await waitFile(/^recu-Q.*\.pdf$/)));
  await p.goto(B + "payer.html?v=" + vnum, {waitUntil:"networkidle2"}); await W(1200);
  check("scan du QR (lien) : vignette valide", (await txt("#vig-out")).includes("Vignette valide"));
  await p.$eval("#vq", e => e.value = ""); await p.type("#vq", "GA 9999 ZZ"); await p.click("#vig-form button"); await W(800);
  check("plaque inconnue : vignette introuvable", (await txt("#vig-out")).includes("introuvable"));
  // Rendez-vous au guichet
  await p.goto(B + "demarches.html?d=rdv#demande", {waitUntil:"networkidle2"});
  await selArr("3"); await W(500); await p.click("[data-next]");
  await p.type("#prenom", "Test"); await p.type("#nom", "Rdv"); await p.type("#tel", "074998877"); await p.type("#quartier", "Mont-Bouët");
  await p.evaluate(() => document.querySelectorAll(".fstep")[1].querySelector("[data-next]").click()); await W(600);
  check("créneaux proposés", (await p.$$eval("#slots button:not([disabled])", x => x.length)) > 3);
  await p.click("#slots button:not([disabled])"); await p.evaluate(() => document.querySelectorAll(".fstep")[2].querySelector("[data-next]").click()); await W(200);
  await p.evaluate(() => { document.querySelector(".fstep.on input[type=checkbox]").checked = true; }); await p.click("button[type=submit]"); await W(1500);
  check("rendez-vous confirmé avec ticket QR", (await txt("#modal")).includes("Rendez-vous confirmé") && !!(await p.$("#modal .ticket .qrbox svg")));
  await login("recettes", "agent2026"); await p.goto(B + "agents.html#vignettes"); await W(900);
  await p.type("[data-f=q]", vnum); await W(300);
  check("back-office : vignette payée en ligne au registre", (await txt("#list")).includes("GA 7777 EZ"));
  await p.click("#list [data-id]"); await W(600); await p.click("#vctl"); await W(1000);
  check("contrôle terrain enregistré", (await txt("#list")).includes(vnum));
  await p.goto(B + "agents.html#recettes"); await p.reload({waitUntil:"domcontentloaded"}); await W(1800);
  check("recette e-Tax au journal des recettes", (await txt("#views")).includes("Vignettes de transport"));
  // 8. Mode mono-arrondissement : le 3e arrondissement uniquement
  await p.goto(B + "demarches.html", {waitUntil:"networkidle2"}); await W(500);
  const mono = await p.evaluate(async () => ({
    n: ARR_N.length === 1 && ARR_N[0] === 3 && ARRONDISSEMENTS.length === 1, maire: ARR.maire, adj: ARR.adj.join("|"), roles: Object.keys(Store.ROLES).join(","),
    arr1: await Store.login("arr1", "arr2026"), quartier: QUARTIER_ARR["akébé"], tim: ((DEMARCHES.find(d => d.id === "legalisation") || {}).info || ""), pref: MAIRIE.prefixe,
    centrale: MAIRIE.centrale && MAIRIE.centrale.maire, ex: EXECUTIF.length, keys: Object.keys(localStorage).filter(k => /^(l3e|lbv)_/.test(k)).join(",") }));
  check("ARR_N = [3], une seule fiche", mono.n);
  check("maire Franck Ibouili, adjoints Mangala Yentsa et Mba Ndong", mono.maire === "Franck Ibouili" && mono.adj === "Alex Jordy Mangala Yentsa|Boris Mba Ndong", mono.adj);
  check("rôles sans « arrondissement »", mono.roles === "maire,sg,etatcivil,technique,finances,rh", mono.roles);
  check("comptes arr1…arr6 supprimés", mono.arr1 === null);
  check("Akébé → 3e arrondissement ; préfixe L3 ; mairie centrale à part ; exécutif de 3 personnes", mono.quartier === 3 && mono.pref === "L3" && mono.centrale === "Eugène Mba" && mono.ex === 3);
  check("timbres : légalisation sans timbre", /sans timbre/.test(mono.tim));
  check("clé localStorage l3e_ (pas lbv_)", /l3e_db_v1/.test(mono.keys) && !/lbv_/.test(mono.keys), mono.keys);
  for (const u of ["index.html", "mairie.html", "arrondissements.html", "actualites.html", "projets.html"]) {
    const rs = await p.goto(B + u, {waitUntil:"networkidle2"}); await W(500);
    if (!rs || !rs.ok()) { console.log("INFO page absente ou renommée : " + u); continue; }
    const t = await p.evaluate(() => document.body.innerText);
    check("aucune trace des autres arrondissements : " + u, !/Nzeng-Ayong|Plaine Niger|Haut-de-Gu[ée]-Gu[ée]|Sogatol|Obiang Ava|Sickout|Ozouaki|Nkoulou Abessolo|Sene Ingueza/.test(t));
  }
  await p.goto(B + "mairie.html", {waitUntil:"networkidle2"}); await W(500);
  check("mairie.html : Franck Ibouili et ses adjoints", /Franck Ibouili/.test(await txt("body")) && /Mangala Yentsa/.test(await txt("body")) && /Mba Ndong/.test(await txt("body")));
  check("aucune erreur JS", !errs.length, errs.join(" | "));
  await p.setViewport({width:390, height:844, isMobile:true});
  for (const u of ["agents.html#indicateurs", "demarches.html", "mairie.html", "payer.html", "transparence.html", "index.html"]) { await p.goto(B + u, {waitUntil:"networkidle2"}); await W(1200); const sw = await p.evaluate(() => document.documentElement.scrollWidth); check("mobile sans débordement : " + u, sw <= 390, sw); }
  await shot("v2-mobile-3e");
  await b.close(); fs.rmSync(DL, {recursive:true, force:true});
  console.log(fails ? fails + " échec(s)" : "Tous les tests sont passés"); process.exit(fails ? 1 : 0);
})();
