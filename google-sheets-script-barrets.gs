/**
 * GOOGLE APPS SCRIPT DEDICAT 100% AL CONCURS DE DECORACIÓ DE BARRETS
 * Fira Pluja d'Art 2026 - Sant Jordi Desvalls
 */

function doGet(e) {
  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getActiveSheet();
    var data = sheet.getDataRange().getValues();
    var result = [];
    
    if (data.length > 1) {
      var headers = data[0];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var obj = {};
        for (var j = 0; j < headers.length; j++) {
          obj[headers[j]] = row[j];
        }
        result.push(obj);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"error": err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getActiveSheet();
    
    // Assegurar nom de la fulla
    if (sheet.getName() !== "Inscripcions Barrets") {
      try { sheet.setName("Inscripcions Barrets"); } catch(err) {}
    }
    
    var data = {};
    if (e && e.parameter && Object.keys(e.parameter).length > 0) {
      data = e.parameter;
    } else if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch(jsonErr) {
        data = e.parameter || {};
      }
    }
    
    // Crear encapçalaments si la fulla està buida
    if (sheet.getLastRow() === 0) {
      var headers = ["Data d'Alta", "Nº Inscripció", "Nom i Cognoms", "Telèfon", "Correu electrònic", "Edat"];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#6b21a8").setFontColor("white");
      sheet.setFrozenRows(1);
    }
    
    var dataAlta = new Date();
    var numInscripcio = data.Codi_Registre || data.codi_registre || data.numInscripcio || "";
    var nom = data.Nom || data.nom || "";
    var telefon = data.Telefon || data.telefon || "";
    var email = data.Email || data.email || "";
    var edat = data.Edat || data.edat || "";
    
    sheet.appendRow([dataAlta, numInscripcio, nom, telefon, email, edat]);
    
    return ContentService.createTextOutput(JSON.stringify({"result": "success", "codi": numInscripcio}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"result": "error", "message": err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
