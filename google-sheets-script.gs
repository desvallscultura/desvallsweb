/** 
 * DESVALLS CULTURA - GOOGLE SHEETS & DRIVE BACKEND (FILE UPLOAD VERSION)
 * 
 * INSTRUCCIONS PELS ADMINISTRADORS:
 * 1. Obre el teu Google Sheet.
 * 2. Ves a Extensions > Apps Script.
 * 3. Esborra tot el contingut i enganxa ESTE CODI.
 * 4. Fes clic a la icona del disquet per Guardar.
 * 5. Fes clic a "Desplega" > "Nou Desplegament".
 * 6. Tria "Aplicació Web", Executar com "Tu", Qui té accés "Qualsevol".
 * 7. IMPORTANT: Si et demana autorització per "Google Drive", accepta-la.
 * 8. Copia la URL que et doni i actualitza-la al web si ha canviat.
 */

function doPost(e) {
  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var data;
    
    // Suport per a enviament JSON (més robust per a fitxers grans) o paràmetres estàndard
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter;
    }
    
    // 1. SEGURETAT: PROTECCIÓ HONEPOT
    if (data.website_hp && data.website_hp.length > 0) {
      return ContentService.createTextOutput("Bot detected").setMimeType(ContentService.MimeType.TEXT);
    }

    // 2. SEGURETAT: LLISTA BLANCA DE CATEGORIES
    var ALLOWED_CATEGORIES = ["Arts Generals", "Residència Bòlit", "Paradetes i Artesania", "Associat"];
    var categoryName = data.Categoria || "Inscripcions2026";
    
    if (ALLOWED_CATEGORIES.indexOf(categoryName) === -1 && categoryName !== "Inscripcions2026") {
       return ContentService.createTextOutput(JSON.stringify({"result":"error", "error": "Invalid category"}))
             .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = doc.getSheetByName(categoryName);
    if(!sheet) sheet = doc.insertSheet(categoryName);
    
    // 3. GESTIÓ DE FITXERS (DRIVE)
    // Si ens arriba un fitxer en base64, el guardem al Drive
    var fileUrl = "";
    if (data.fileData && data.fileName) {
      var folder = getOrCreateFolder("Dossiers Pluja Art 2026");
      var contentType = data.fileType || "application/octet-stream";
      var decodedData = Utilities.base64Decode(data.fileData);
      var blob = Utilities.newBlob(decodedData, contentType, data.fileName);
      var file = folder.createFile(blob);
      fileUrl = file.getUrl();
    }

    // Obtenim encapçalaments
    var headers = [];
    if (sheet.getLastRow() > 0) {
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    } else {
      headers = ["Data d'Alta"];
    }
    
    var keys = Object.keys(data);
    var newHeadersFound = false;
    for (var i = 0; i < keys.length; i++) {
        // No afegim el camp de dades del fitxer com a columna, només la URL
        if (keys[i] === "fileData" || keys[i] === "website_hp") continue;
        if (headers.indexOf(keys[i]) === -1) {
            headers.push(keys[i]);
            newHeadersFound = true;
        }
    }
    
    // Afegim columna per la URL del fitxer si s'ha pujat
    if (fileUrl && headers.indexOf("URL_Dossier_Drive") === -1) {
      headers.push("URL_Dossier_Drive");
      newHeadersFound = true;
    }

    if (newHeadersFound || sheet.getLastRow() === 0) {
       sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
       sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#12a298").setFontColor("white");
       sheet.setFrozenRows(1);
    }
    
    var rowData = new Array(headers.length).fill("");
    rowData[0] = new Date();
    
    for (var i = 1; i < headers.length; i++) {
        var headerName = headers[i];
        if (headerName === "URL_Dossier_Drive") {
          rowData[i] = fileUrl;
        } else if (data[headerName] !== undefined) {
            rowData[i] = data[headerName].toString().replace(/<[^>]*>?/gm, '').trim();
        }
    }
    
    sheet.appendRow(rowData);
    
    return ContentService.createTextOutput(JSON.stringify({"result":"success", "fileUrl": fileUrl}))
          .setMimeType(ContentService.MimeType.JSON);
          
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"result":"error", "error": error.toString()}))
          .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}

