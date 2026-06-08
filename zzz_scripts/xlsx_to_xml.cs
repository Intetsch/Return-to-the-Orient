#:package ClosedXML@0.105.0

using ClosedXML.Excel;
using System.Xml;
using System.Xml.Linq;

string basePath = Directory.GetCurrentDirectory().Replace("\\gui", "");
string guiFolder = Path.Combine(basePath, "gui");
string excelPath = Path.Combine(basePath, "_Localizations.xlsx");

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

// Detect language columns (everything after column 4)
Dictionary<string, int> languageColumns = new();
int lastColumn = worksheet.LastColumnUsed().ColumnNumber();

for (int col = 5; col <= lastColumn; col++)
{
    string language = headerRow.Cell(col).GetString();
    if (!string.IsNullOrWhiteSpace(language))
        languageColumns[language] = col;
}

int lastRow = worksheet.LastRowUsed().RowNumber();

// Column layout:
// 1 = ModFolder
// 2 = GUID
// 3 = Template (unused here)
// 4 = AssetText (unused here)
var rows = Enumerable.Range(2, lastRow - 1)
    .Select(r => new
    {
        ModFolder = worksheet.Cell(r, 1).GetString(),
        Guid = worksheet.Cell(r, 2).GetString(),
        Row = r
    })
    .Where(x => !string.IsNullOrWhiteSpace(x.ModFolder))
    .Where(x => !string.IsNullOrWhiteSpace(x.Guid))
    .ToList();

//------------------------------------------------------------
// GROUP BY MOD FOLDER
//------------------------------------------------------------
var mods = rows.GroupBy(r => r.ModFolder);

foreach (var mod in mods)
{
    string modFolder = mod.Key;

    // ✅ Correct target folder
    string modGuiFolder = Path.Combine(modFolder, @"data\config\gui");

    Directory.CreateDirectory(modGuiFolder);

    foreach (var lang in languageColumns)
    {
        string language = lang.Key;
        int colIndex = lang.Value;

        XElement modOp = new(
            "ModOp",
            new XAttribute("Type", "add"),
            new XAttribute("Path", "/TextExport/Texts")
        );

        foreach (var row in mod)
        {
            string textRaw = worksheet.Cell(row.Row, colIndex).GetString();

            // Try get english column safely
            string englishText = "";
            if (languageColumns.TryGetValue("english", out int englishCol))
            {
                englishText = worksheet.Cell(row.Row, englishCol).GetString();
            }

            string finalText = null;

            if (!string.IsNullOrWhiteSpace(textRaw))
            {
                finalText = textRaw.Trim();
            }
            else if (!string.IsNullOrWhiteSpace(englishText))
            {
                finalText = "??" + englishText.Trim();
            }
            else
            {
                // 🚫 Skip completely if both are empty
                continue;
            }

            modOp.Add(
                new XElement("Text",
                    new XElement("GUID", row.Guid),
                    new XElement("Text", finalText)
                )
            );
        }

        XElement root = new("ModOps", modOp);

        string outputPath = Path.Combine(modGuiFolder, $"texts_{language}.xml");

        XmlWriterSettings settings = new()
        {
            OmitXmlDeclaration = true,
            Indent = true
        };

        using XmlWriter writer = XmlWriter.Create(outputPath, settings);
        root.Save(writer);

        Console.WriteLine($"Created: {outputPath}");
    }
}