function logError(msg) {
  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName("DEBUG_LOGS");
    if(!sheet) sheet = doc.insertSheet("DEBUG_LOGS");
    sheet.appendRow([new Date(), msg]);
  } catch(e) {}
}

function doPost(e) {
  logError("Inici doPost. postData: " + (e.postData ? "SI" : "NO"));
  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var data;
    
    if (e.postData && e.postData.contents) {
      logError("Rebent JSON: " + e.postData.contents.substring(0, 100) + "...");
      data = JSON.parse(e.postData.contents);
    } else {
      logError("Rebent parameters estàndard: " + JSON.stringify(e.parameter).substring(0,100));
      data = e.parameter;
    }
    
    // 1. SEGURETAT: PROTECCIÓ HONEPOT
    if (data.website_hp && data.website_hp.length > 0) {
      return ContentService.createTextOutput("Bot detected").setMimeType(ContentService.MimeType.TEXT);
    }

    // 2. SEGURETAT: LLISTA BLANCA DE CATEGORIES
    var ALLOWED_CATEGORIES = ["Arts Generals", "Residència Artística", "Paradetes i Artesania", "Associat"];
    var categoryName = data.Categoria || "Inscripcions2026";
    
    if (ALLOWED_CATEGORIES.indexOf(categoryName) === -1 && categoryName !== "Inscripcions2026") {
       return ContentService.createTextOutput(JSON.stringify({"result":"error", "error": "Invalid category"}))
             .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = doc.getSheetByName(categoryName);
    if(!sheet) sheet = doc.insertSheet(categoryName);
    
    // 3. GESTIÓ DE FITXERS (DRIVE) - Suport per a múltiples fitxers i noms únics
    var fileLinks = {};
    if (data.files && typeof data.files === 'object') {
      var folder = getOrCreateFolder("Dossiers Pluja Art 2026");
      var userIdentifier = (data.DNI_URL || data.Email || "ANON").toString().replace(/[^a-z0-9]/gi, '_');

      for (var fieldName in data.files) {
        var fileInfo = data.files[fieldName];
        if (fileInfo.data && fileInfo.name) {
          // Generem nom únic: Camp_DNI_NomOriginal.pdf (i gestionem duplicats)
          var baseName = fieldName + "_" + userIdentifier + "_" + fileInfo.name;
          var uniqueName = getUniqueFileName(folder, baseName);
          
          logError("Creant fitxer únic: " + uniqueName);
          var decodedData = Utilities.base64Decode(fileInfo.data);
          var blob = Utilities.newBlob(decodedData, fileInfo.type || "application/octet-stream", uniqueName);
          var file = folder.createFile(blob);
          fileLinks[fieldName] = file.getUrl();
        }
      }
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
        // Ignorem el camp d'arxius binaris i el trampa
        if (keys[i] === "files" || keys[i] === "website_hp") continue;
        if (headers.indexOf(keys[i]) === -1) {
            headers.push(keys[i]);
            newHeadersFound = true;
        }
    }
    
    // Afegim columnes pels enllaços dels fitxers
    for (var fieldName in fileLinks) {
      var linkHeader = "URL_" + fieldName;
      if (headers.indexOf(linkHeader) === -1) {
        headers.push(linkHeader);
        newHeadersFound = true;
      }
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
        if (headerName.indexOf("URL_") === 0) {
          var fieldKey = headerName.substring(4);
          rowData[i] = fileLinks[fieldKey] || "";
        } else if (data[headerName] !== undefined) {
            rowData[i] = data[headerName].toString().replace(/<[^>]*>?/gm, '').trim();
        }
    }
    
    sheet.appendRow(rowData);
    
    return ContentService.createTextOutput(JSON.stringify({"result":"success", "links": fileLinks}))
          .setMimeType(ContentService.MimeType.JSON);
          
  } catch (error) {
    logError("ERROR CRÍTIC: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({"result":"error", "error": error.toString()}))
          .setMimeType(ContentService.MimeType.JSON);
  }
}

function getUniqueFileName(folder, fileName) {
  var name = fileName;
  var extension = "";
  if (fileName.indexOf(".") !== -1) {
    extension = fileName.substring(fileName.lastIndexOf("."));
    name = fileName.substring(0, fileName.lastIndexOf("."));
  }
  
  var finalName = fileName;
  var counter = 1;
  while (folder.getFilesByName(finalName).hasNext()) {
    finalName = name + "_v" + counter + extension;
    counter++;
  }
  return finalName;
}

function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}

