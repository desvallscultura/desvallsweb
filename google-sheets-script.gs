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
        if (keys[i] === "files" || keys[i] === "website_hp") continue;
        if (headers.indexOf(keys[i]) === -1) {
            headers.push(keys[i]);
            newHeadersFound = true;
        }
    }
    
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

// =========================================================================
// NOU: FUNCIÓ PER LLEGIR TOTES LES DADES DES DEL DASHBOARD WBADMIN
// =========================================================================
function doGet(e) {
  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    if (!doc) {
      return ContentService.createTextOutput(JSON.stringify({"error": "No active spreadsheet found. Script might be standalone."}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // DEBUG MODE: Return all sheet names and their row counts
    var sheets = doc.getSheets();
    var debugInfo = {
      spreadsheetName: doc.getName(),
      tabsFound: []
    };
    
    for (var i = 0; i < sheets.length; i++) {
        var s = sheets[i];
        debugInfo.tabsFound.push({
            name: s.getName(),
            numRows: s.getLastRow(),
            numCols: s.getLastColumn()
        });
    }

    var categories = ["Arts Generals", "Residència Artística", "Paradetes i Artesania"];
    var allData = [];
    
    for (var c = 0; c < categories.length; c++) {
      var catName = categories[c];
      var sheet = doc.getSheetByName(catName);
      
      if (sheet) {
        var data = sheet.getDataRange().getValues();
        if (data.length > 1) {
          var headers = data[0];
          
          for (var i = 1; i < data.length; i++) {
            var rowData = data[i];
            var obj = {};
            
            // Generem ID únic amagant el nom de la pestanya i numero de fila
            obj['id'] = catName.substring(0,4) + "_" + i; 
            obj['Categoria'] = catName; // Forcem la categoria
            
            for (var j = 0; j < headers.length; j++) {
              // Mapeig específic d'URLs per fer-ho fàcil de llegir al JS
              var headObj = headers[j];
              var valueObj = rowData[j];
              
              if (headObj === "Data d'Alta") headObj = "Timestamp";
              if (headObj === "URL_Dossier_File") headObj = "Dossier_File";
              if (headObj === "URL_Dossier") headObj = "Dossier";
              if (headObj === "URL_Portafoli") headObj = "Portafoli";
              if (headObj === "URL_Calendari") headObj = "Calendari";
              if (headObj === "URL_Pressupost") headObj = "Pressupost";
              if (headObj && headObj.startsWith("Nom_Represen")) headObj = "Nom_Representant"; // Arregla el nom curt
              
              obj[headObj] = valueObj;
            }
            allData.push(obj);
          }
        }
      }
    }
    
    // Si allData està buit, enviem el contingut de DEBUG per saber perquè
    if (allData.length === 0) {
        return ContentService.createTextOutput(JSON.stringify(debugInfo))
            .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Configurar per permetre CORS correctament
    var output = ContentService.createTextOutput(JSON.stringify(allData))
      .setMimeType(ContentService.MimeType.JSON);
    
    return output;
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"error": err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

