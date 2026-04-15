#:package ClosedXML@0.105.0

using ClosedXML.Excel;
using System.Xml;
using System.Xml.Linq;

string basePath = Directory.GetCurrentDirectory().Replace("\\gui", "");
string guiFolder = Path.Combine(basePath, "gui");
string excelPath = Path.Combine(guiFolder, "_Localizations.xlsx");

if (!File.Exists(excelPath))
{
    Console.WriteLine($"Excel file not found in {excelPath}.");
    return;
}

using FileStream stream = new(
    excelPath,
    FileMode.Open,
    FileAccess.Read,
    FileShare.ReadWrite);

using XLWorkbook workbook = new(stream);
IXLWorksheet worksheet = workbook.Worksheet("Localization");

IXLRow headerRow = worksheet.Row(1);

// Detect language columns (everything after column 3)
Dictionary<string, int> languageColumns = new();
int lastColumn = worksheet.LastColumnUsed().ColumnNumber();

for (int col = 4; col <= lastColumn; col++)
{
    string language = headerRow.Cell(col).GetString();
    if (!string.IsNullOrWhiteSpace(language))
    {
        languageColumns[language] = col;
    }
}

int lastRow = worksheet.LastRowUsed().RowNumber();

var rows = Enumerable.Range(2, lastRow - 1)
    .Select(r => new
    {
        Guid = worksheet.Cell(r, 1).GetString(),
        Row = r
    })
    .Where(x => !string.IsNullOrWhiteSpace(x.Guid))
    .ToList();

//------------------------------------------------------------
// Create one XML file per language
//------------------------------------------------------------
foreach (KeyValuePair<string, int> lang in languageColumns)
{
    string language = lang.Key;
    int colIndex = lang.Value;

    XElement modOp = new("ModOp",
        new XAttribute("Type", "add"),
        new XAttribute("Path", "TextExport/Texts")
    );

    foreach (var row in rows)
    {
        string textRaw = worksheet.Cell(row.Row, colIndex).GetString();

        modOp.Add(
            new XElement("Text",
                new XElement("GUID", row.Guid),
                new XElement("Text", textRaw?.Trim())
            )
        );
    }

    XElement root = new("ModOps", modOp);

    string outputPath = Path.Combine(guiFolder, $"texts_{language}.xml");

    // Save WITHOUT XML declaration
    XmlWriterSettings settings = new()
    {
        OmitXmlDeclaration = true,
        Indent = true
    };

    using XmlWriter writer = System.Xml.XmlWriter.Create(outputPath, settings);
    root.Save(writer);

    Console.WriteLine($"Created: {outputPath}");
}
