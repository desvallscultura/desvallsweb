/**
 * GOOGLE APPS SCRIPT - GESTIÓ DE COMANDES DE SAMARRETES
 * DESVALLS CULTURA 2026
 * 
 * Instruccions:
 * 1. Obre el teu full de Google Sheets a Google Drive.
 * 2. Vés a Extensions > Apps Script.
 * 3. Enganxa aquest codi.
 * 4. Fes clic a "Implementa" (Deploy) > "Nova implementació" (New deployment).
 * 5. Tipus: "Aplicació web" (Web app).
 * 6. Executa com a: "Jo" (El teu compte).
 * 7. Qui té accés: "Tothom" (Anyone).
 * 8. Copia l'URL de l'aplicació web generada i actualitza-la al fitxer marxandatge.html si cal.
 */

const NOM_FULL = "Comandes Samarretes";
const EMAIL_ORGANITZACIO = "desvallscultura@gmail.com";
const PREU_UNITARI = 20;

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    missatge: "Servei de comandes de samarretes de Desvalls Cultura actiu"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter;
      if (typeof data.items === "string") {
        try {
          data.items = JSON.parse(data.items);
        } catch(err) {}
      }
    }
    
    // Honeypot anti-spam
    if (data.website_hp && data.website_hp.length > 0) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Bot detected" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var resultat = registrarComanda(data);
    return ContentService.createTextOutput(JSON.stringify(resultat))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function registrarComanda(dades) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName(NOM_FULL);
  
  if (!sheet) {
    sheet = doc.insertSheet(NOM_FULL);
  }
  
  var capcaleres = [
    "Data i Hora",
    "Núm. Comanda",
    "Nom i Cognoms",
    "Telèfon",
    "Email",
    "Detall Comanda",
    "Total Unitats",
    "Import (€)",
    "Observacions",
    "Estat"
  ];
  
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, capcaleres.length).setValues([capcaleres]);
    sheet.getRange(1, 1, 1, capcaleres.length)
      .setFontWeight("bold")
      .setBackground("#12a298")
      .setFontColor("white");
    sheet.setFrozenRows(1);
  }
  
  var nComanda = dades.num_comanda || dades.nComanda || generarNumeroComanda();
  var items = dades.items || [];
  
  var detallText = "";
  var totalUnitats = 0;
  
  if (Array.isArray(items)) {
    items.forEach(function(item) {
      var q = parseInt(item.unitats) || 0;
      if (q > 0) {
        totalUnitats += q;
        if (detallText !== "") detallText += ", ";
        detallText += q + "x " + item.talla + " (" + item.color + ")";
      }
    });
  }
  
  if (totalUnitats === 0 && dades.total_unitats) {
    totalUnitats = parseInt(dades.total_unitats) || 0;
  }
  
  var importTotal = dades.import_total ? parseFloat(dades.import_total) : (totalUnitats * PREU_UNITARI);
  
  var fila = [
    new Date(),
    nComanda,
    dades.nom || "",
    dades.telf || dades.telefon || "",
    dades.mail || dades.email || "",
    detallText,
    totalUnitats,
    importTotal,
    dades.observacions || dades.obs || "",
    "Pendent de recollida / pagament"
  ];
  
  sheet.appendRow(fila);
  
  // Format visual automàtic a la fila
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 8).setNumberFormat("#,##0.00 €");
  sheet.getRange(lastRow, 1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
  
  // Enviar correus de confirmació
  try {
    enviarConfirmacioClient(dades, nComanda, detallText, totalUnitats, importTotal);
    enviarNotificacioVenedor(dades, nComanda, detallText, totalUnitats, importTotal);
  } catch (eEmail) {
    Logger.log("Error enviant correu: " + eEmail.toString());
  }
  
  return {
    success: true,
    nComanda: nComanda,
    totalUnitats: totalUnitats,
    importTotal: importTotal,
    missatge: "Comanda registrada correctament!"
  };
}

function generarNumeroComanda() {
  var prefix = "SAM-2026-";
  var aleatori = Math.floor(1000 + Math.random() * 9000);
  return prefix + aleatori;
}

function enviarConfirmacioClient(dades, nComanda, detallText, totalUnitats, importTotal) {
  var email = dades.mail || dades.email;
  if (!email) return;
  
  var assumpte = "Sol·licitud de samarreta registrada (" + nComanda + ") - Desvalls Cultura";
  var htmlCos = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff;'>" +
    "<div style='text-align: center; margin-bottom: 25px;'>" +
      "<h2 style='color: #0f766e; margin: 0; font-size: 24px;'>Desvalls Cultura</h2>" +
      "<p style='color: #64748b; margin: 5px 0; font-size: 14px;'>Sant Jordi Desvalls · Batec cultural</p>" +
    "</div>" +
    
    "<div style='background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 5px solid #16a34a; padding: 16px; margin-bottom: 22px; border-radius: 6px;'>" +
      "<h3 style='margin: 0 0 6px; color: #15803d; font-size: 18px;'>✓ Sol·licitud registrada correctament!</h3>" +
      "<p style='margin: 0; color: #334155; font-size: 14px; line-height: 1.5;'>Hem registrat la teva comanda de samarretes. Com que el termini inicial ha finalitzat, la teva comanda es farà efectiva tan bon punt s'assoleixi el nombre mínim de peticions.</p>" +
    "</div>" +
    
    "<table style='width: 100%; border-collapse: collapse; margin-bottom: 22px; font-size: 14px;'>" +
      "<tr style='border-bottom: 1px solid #f1f5f9;'><td style='padding: 9px 0; color: #64748b;'><strong>Número de sol·licitud:</strong></td><td style='padding: 9px 0; color: #0f766e; font-size: 16px; font-weight: bold;'>" + nComanda + "</td></tr>" +
      "<tr style='border-bottom: 1px solid #f1f5f9;'><td style='padding: 9px 0; color: #64748b;'><strong>Comprador/a:</strong></td><td style='padding: 9px 0; color: #1e293b; font-weight: 600;'>" + (dades.nom || "") + "</td></tr>" +
      "<tr style='border-bottom: 1px solid #f1f5f9;'><td style='padding: 9px 0; color: #64748b;'><strong>Telèfon:</strong></td><td style='padding: 9px 0; color: #1e293b;'>" + (dades.telf || dades.telefon || "") + "</td></tr>" +
      "<tr style='border-bottom: 1px solid #f1f5f9;'><td style='padding: 9px 0; color: #64748b;'><strong>Articles demanats:</strong></td><td style='padding: 9px 0; color: #1e293b; font-weight: 600;'>" + detallText + "</td></tr>" +
      "<tr style='border-bottom: 1px solid #f1f5f9;'><td style='padding: 9px 0; color: #64748b;'><strong>Total unitats:</strong></td><td style='padding: 9px 0; color: #1e293b;'>" + totalUnitats + "</td></tr>" +
      "<tr><td style='padding: 9px 0; color: #64748b;'><strong>Import estimat a pagar:</strong></td><td style='padding: 9px 0; color: #0f766e; font-size: 17px; font-weight: bold;'>" + importTotal.toFixed(2).replace(".", ",") + " €</td></tr>" +
    "</table>" +
    
    (dades.observacions ? "<p style='color: #475569; font-size: 13.5px; background: #f8fafc; padding: 10px 12px; border-radius: 6px;'><strong>Observacions:</strong> " + dades.observacions + "</p>" : "") +
    
    "<div style='background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px; margin: 22px 0;'>" +
      "<p style='color: #1e3a8a; font-size: 14.5px; margin: 0 0 10px; font-weight: bold;'>ℹ️ Com funciona el procés?</p>" +
      "<ol style='color: #334155; font-size: 13.5px; margin: 0; padding-left: 20px; line-height: 1.6;'>" +
        "<li style='margin-bottom: 6px;'><strong>Sol·licitud recollida:</strong> La teva comanda queda registrada a la llista d'espera.</li>" +
        "<li style='margin-bottom: 6px;'><strong>Avís d'activació:</strong> T'avisarem per correu electrònic tan bon punt s'arribi al nombre suficient de peticions per tirar endavant la producció.</li>" +
        "<li><strong>Avís de recollida i pagament:</strong> Rebràs un correu d'avís quan les samarretes arribin per poder passar a <strong>pagar-les i recollir-les</strong> a Sant Jordi Desvalls.</li>" +
      "</ol>" +
    "</div>" +
    
    "<p style='color: #94a3b8; font-size: 12px; text-align: center; margin-top: 25px; border-top: 1px solid #f1f5f9; padding-top: 15px;'>" +
      "Associació Desvalls Cultura · Sant Jordi Desvalls (Gironès)<br>" +
      "<a href='mailto:desvallscultura@gmail.com' style='color: #0f766e; text-decoration: none;'>desvallscultura@gmail.com</a>" +
    "</p>" +
  "</div>";
  
  MailApp.sendEmail({
    to: email,
    subject: assumpte,
    htmlBody: htmlCos
  });
}

function enviarNotificacioVenedor(dades, nComanda, detallText, totalUnitats, importTotal) {
  if (!EMAIL_ORGANITZACIO) return;
  
  var assumpte = "Nova comanda de samarreta (" + nComanda + ") - " + (dades.nom || "Client");
  var cos = "S'ha registrat una nova comanda de samarretes:\n\n" +
    "Núm. Comanda: " + nComanda + "\n" +
    "Nom: " + (dades.nom || "") + "\n" +
    "Telèfon: " + (dades.telf || dades.telefon || "") + "\n" +
    "Email: " + (dades.mail || dades.email || "") + "\n" +
    "Articles: " + detallText + "\n" +
    "Total unitats: " + totalUnitats + "\n" +
    "Import: " + importTotal.toFixed(2) + " €\n" +
    "Observacions: " + (dades.observacions || dades.obs || "Cap") + "\n\n" +
    "Pots consultar el full de càlcul de Google Sheets per gestionar l'estat de la comanda.";
    
  MailApp.sendEmail(EMAIL_ORGANITZACIO, assumpte, cos);
}
