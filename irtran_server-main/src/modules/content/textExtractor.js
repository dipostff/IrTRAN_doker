//-----------Подключаемые модули-----------//
const fs = require('fs');
const path = require('path');
const WordExtractor = require('word-extractor');
let pdfParse;
//-----------Подключаемые модули-----------//

const wordExtractor = new WordExtractor();

/**
 * Ленивая загрузка pdf-parse, чтобы не падать, если модуль не установлен.
 */
function getPdfParse() {
  if (!pdfParse) {
    // eslint-disable-next-line global-require
    pdfParse = require('pdf-parse');
  }
  return pdfParse;
}

/**
 * Извлекает текст из файла справочника для последующего полнотекстового поиска.
 * Поддерживаются:
 *  - PDF (application/pdf)
 *  - Документы Word (.doc, .docx)
 */
async function extractTextFromFile(filePath, mimeType) {
  try {
    const ext = path.extname(filePath).toLowerCase();

    // PDF
    if (
      mimeType === 'application/pdf' ||
      ext === '.pdf'
    ) {
      const buffer = await fs.promises.readFile(filePath);
      const parse = getPdfParse();
      const data = await parse(buffer);
      return (data && data.text) || '';
    }

    // Word (.doc/.docx)
    if (
      mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === '.doc' ||
      ext === '.docx'
    ) {
      const doc = await wordExtractor.extract(filePath);
      return doc.getBody() || '';
    }

    // Для остальных типов содержимое не индексируем
    return '';
  } catch (error) {
    console.error('Error extracting text from file', filePath, error);
    return '';
  }
}

//-----------Экспортируемые модули-----------//
module.exports = {
  extractTextFromFile
};
//-----------Экспортируемые модули-----------//

