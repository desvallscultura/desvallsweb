// ==========================================
// GOOGLE APPS SCRIPT - BACKEND DESVALLS CULTURA
// ==========================================
// Com instal·lar:
// 1. Crea un nou full de càlcul a Google Drive.
// 2. A la barra superior, ves a "Extensions > Apps Script".
// 3. Esborra el codi existent i enganxa tot aquest fitxer.
// 4. Desa el projecte.
// 5. Prem el botó "Implementa" (Deploy) > "Nova implementació" (New deployment).
// 6. Tria el tipus "Aplicació web" (Web app).
// 7. Configura així: 
//      - Executar com: Tu (el teu correu)
//      - Qui hi té accés: Qualsevol (Anyone)
// 8. Fes clic a "Implementa" (Autoritza els permisos si t'ho demana).
// 9. Copia l'URL que et donaran i enganxa'l al fitxer de la web (js/main.js -> SCRIPT_URL).

function doPost(e) {
  try {
    // Escull el full actiu
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Si el full està vuit, creem la capçalera
    if(sheet.getLastRow() === 0){
        sheet.appendRow(["Data", "Nom i Cognoms", "Correu", "Telèfon", "Tipus"]);
        // Format capçalera
        sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#f3f4f6");
    }

    // Agafa els paràmetres enviats pel formulari HTML (js/main.js)
    var dateTime = new Date();
    var nom = e.parameter.nom || "No especificat";
    var email = e.parameter.email || "No especificat";
    var telefon = e.parameter.telefon || "No especificat";
    var tipus = e.parameter.tipus || "No especificat";

    // Afegeix una nova línia al full
    sheet.appendRow([dateTime, nom, email, telefon, tipus]);

    // Respon un text d'èxit (CORS friendly si JS no rep JSON)
    return ContentService.createTextOutput("Success")
      .setMimeType(ContentService.MimeType.TEXT);
      
  } catch (error) {
    // En cas d'error
    return ContentService.createTextOutput("Error: " + error.toString())
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

// Afegeix doGet per si algú entra per error a l'URL de l'App Script directament
function doGet(e) {
  return ContentService.createTextOutput("Aquest és l'endpoint POST de l'API de Desvalls Cultura. Fes servir una petició POST.");
}
