/** 
 * DESVALLS CULTURA - GOOGLE SHEETS BACKEND CONNECTOR (MULTI-SHEET VERSION)
 * 
 * INSTRUCCIONS PELS ADMINISTRADORS (PAS A PAS):
 * 1. Obre el teu full de càlcul de Google (Google Sheets).
 * 2. Ves al menú superior: "Extensions" > "Apps Script".
 * 3. S'obrirà una nova pestanya amb un editor de codi. 
 * 4. Esborra tot el que hi hagi i enganxa EXACTAMENT tot aquest codi.
 * 5. Fes clic a la icona del disquet (Guardar) i posa-li de nom "Backend Pluja Art".
 * 6. Fes clic al botó blau: "Desplega" (Deploy) > "Nou Desplegament" (New deployment).
 * 7. Tria el tipus: "Aplicació Web" (Web App).
 * 8. Descripció: "Versió 2 - Pestanyes Separades".
 * 9. Executar com: "Tu" (Me).
 * 10. Qui té accés: "Qualsevol" (Anyone). IMPORTANT!
 * 11. Fes clic a "Desplega". Si et demana autorització, accepta tots els permisos.
 * 12. COPIA LA "URL de l'aplicació web" que et donarà (acaba en /exec).
 * 13. Enganxa aquesta URL a la línia 272 de l'arxiu HTML (participa-pluja-art.html).
 */

function doPost(e) {
  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var data = e.parameter;
    
    // TRIEM EL FULL SEGONS LA CATEGORIA (Si no n'hi ha, usem un genèric)
    var categoryName = data.Categoria || "Inscripcions2026";
    var sheet = doc.getSheetByName(categoryName);
    
    // Si el full no existeix, el creem automàticament
    if(!sheet) {
      sheet = doc.insertSheet(categoryName);
    }
    
    // Obtenim els encapçalaments actuals del full triat
    var headers = [];
    if (sheet.getLastRow() > 0) {
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    } else {
      headers = ["Data d'Alta"]; // Columna inicial per defecte
    }
    
    // Identifiquem totes les claus (camps) que ens arriben del formulari
    var keys = Object.keys(data);
    
    // Si ens arriben camps que no tenen columna, les afegim al moment
    var newHeadersFound = false;
    for (var i = 0; i < keys.length; i++) {
        if (headers.indexOf(keys[i]) === -1) {
            headers.push(keys[i]);
            newHeadersFound = true;
        }
    }
    
    // Si hem afegit columnes, actualitzem la fila 1 (els títols) amb estil
    if (newHeadersFound || sheet.getLastRow() === 0) {
       sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
       sheet.getRange(1, 1, 1, headers.length)
            .setFontWeight("bold")
            .setBackground("#12a298")
            .setFontColor("white")
            .setVerticalAlignment("middle")
            .setHorizontalAlignment("center");
       sheet.setFrozenRows(1); // Deixem la primera fila fixa
    }
    
    // Preparem la fila de dades respectant l'ordre de les columnes
    var rowData = new Array(headers.length).fill("");
    rowData[0] = new Date(); // Registre de temps
    
    for (var i = 1; i < headers.length; i++) {
        var headerName = headers[i];
        if (data[headerName] !== undefined) {
            rowData[i] = data[headerName];
        }
    }
    
    // Afegim la fila al full corresponent
    sheet.appendRow(rowData);
    
    // Resposta d'èxit per al navegador
    return ContentService
          .createTextOutput(JSON.stringify({"result":"success", "category": categoryName}))
          .setMimeType(ContentService.MimeType.JSON);
          
  } catch (error) {
    // Resposta d'error
    return ContentService
          .createTextOutput(JSON.stringify({"result":"error", "error": error.toString()}))
          .setMimeType(ContentService.MimeType.JSON);
  }
}
