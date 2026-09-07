// =========================================================================
// COPIA I ENGANXA AIXÒ AL FINAL DEL TEU GOOGLE APPS SCRIPT ACTUAL
// =========================================================================

// Aquesta funció permetrà a la nova web d'Administració llegir (GET) les dades
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var headers = data[0];
  var result = [];
  
  for(var i = 1; i < data.length; i++){
    var rowData = data[i];
    var obj = {};
    obj['id'] = (i).toString(); // Generem un ID simple basat en la fila
    
    for(var j = 0; j < headers.length; j++){
      obj[headers[j]] = rowData[j];
    }
    result.push(obj);
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
