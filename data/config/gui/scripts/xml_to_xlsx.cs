#:package ClosedXML@0.105.0

using ClosedXML.Excel;
using System.Xml;
using System.Xml.Linq;

string basePath = Directory.GetCurrentDirectory().Replace("\\gui", "");
string rootFolder = Path.Combine(basePath, @"export\main\asset\assets_includes");
string guiFolder = Path.Combine(basePath, "gui");

//------------------------------------------------------------
// 1️⃣ Load Asset XMLs (your original code slightly cleaned)
//------------------------------------------------------------

List<(string guid, string text, string template)> assetTexts =
    Directory.EnumerateFiles(rootFolder, "*.xml", SearchOption.AllDirectories)
    .SelectMany(file =>
    {
        XDocument doc = XDocument.Load(file);

        return doc.Descendants("Asset")
            .Select(a => (
                guid: a.Element("Values")?.Element("Standard")?.Element("GUID")?.Value ?? "",
                text:
                    a.Element("Values")?.Element("Text")?.Element("LocaText")?
                        .Element("English")?.Element("Text")?.Value
                    ?? a.Element("Values")?.Element("Standard")?.Element("Name")?.Value
                    ?? "",
                template: a.Element("Template")?.Value ?? ""
            ));
    })
    .Where(x => !string.IsNullOrWhiteSpace(x.guid))
    .Where(x => x.guid.StartsWith("1404"))
    .ToList();

//------------------------------------------------------------
// 2️⃣ Load ALL languages from gui folder
//------------------------------------------------------------

List<string> languageFiles = Directory
    .EnumerateFiles(guiFolder, "texts_*.xml", SearchOption.TopDirectoryOnly)
    .ToList();

// Dictionary<Guid, Dictionary<Language, Text>>
Dictionary<string, Dictionary<string, string>> localizedTexts = new();

foreach (string file in languageFiles)
{
    string language = Path.GetFileNameWithoutExtension(file)
        .Replace("texts_", "");

    XDocument doc = XDocument.Load(file);

    var entries = doc
        .Descendants("ModOp")
        .SelectMany(x => x.Descendants("Text"))
        .Select(a => new
        {
            Guid = a.Element("GUID")?.Value ?? "",
            Text = a.Element("Text")?.Value ?? ""
        })
        .Where(x => !string.IsNullOrWhiteSpace(x.Guid))
        .Where(x => x.Guid.StartsWith("1404"));

    foreach (var entry in entries)
    {
        if (!localizedTexts.ContainsKey(entry.Guid))
        {
            localizedTexts[entry.Guid] = new Dictionary<string, string>();
        }

        localizedTexts[entry.Guid][language] = entry.Text;
    }
}

//------------------------------------------------------------
// 3️⃣ Merge everything into a unified structure
//------------------------------------------------------------

List<string> allGuids = assetTexts
    .Select(a => a.guid)
    .Union(localizedTexts.Keys)
    .Distinct()
    .OrderBy(x => x)
    .ToList();

//------------------------------------------------------------
// 4️⃣ Write Excel
//------------------------------------------------------------

string outputPath = Path.Combine(guiFolder, "_Localizations.xlsx");

using (XLWorkbook workbook = new())
{
    IXLWorksheet worksheet = workbook.Worksheets.Add("Localization");

    // Header
    worksheet.Cell(1, 1).Value = "GUID";
    worksheet.Cell(1, 2).Value = "Template";
    worksheet.Cell(1, 3).Value = "AssetText";

    for (int i = 0; i < languageFiles.Count; i++)
    {
        string language = Path.GetFileNameWithoutExtension(languageFiles[i])
            .Replace("texts_", "");

        worksheet.Cell(1, i + 4).Value = language;
    }

    int row = 2;

    foreach (string guid in allGuids)
    {
        worksheet.Cell(row, 1).Value = guid;

        // Asset info
        (string guid, string text, string template) asset = assetTexts.FirstOrDefault(a => a.guid == guid);

        worksheet.Cell(row, 2).Value = asset.template;
        worksheet.Cell(row, 3).Value = asset.text;

        // Localized texts
        for (int col = 0; col < languageFiles.Count; col++)
        {
            string language = Path.GetFileNameWithoutExtension(languageFiles[col])
                .Replace("texts_", "");

            if (localizedTexts.TryGetValue(guid, out Dictionary<string, string>? langDict) &&
                langDict.TryGetValue(language, out string? text))
            {
                worksheet.Cell(row, col + 4).Value = text;
            }
        }

        row++;
    }

    workbook.SaveAs(outputPath);
}

Console.WriteLine("Excel file created:");
Console.WriteLine(outputPath);
