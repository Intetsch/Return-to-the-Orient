#:package ClosedXML@0.105.0

using ClosedXML.Excel;
using System.Xml.Linq;
using System.Text.Json;


HashSet<long> BlacklistedGuids = new()
{
    500475
};

//------------------------------------------------------------
// 1️⃣ Find all modinfo.json files
//------------------------------------------------------------

string basePath = Directory.GetCurrentDirectory();

var modFolders = Directory
    .EnumerateFiles(basePath, "modinfo.json", SearchOption.AllDirectories)
    .Select(path => Path.GetDirectoryName(path)!)
    .ToList();

//------------------------------------------------------------
// 2️⃣ Structures
//------------------------------------------------------------

// (ModFolder, Guid, Text, Template)
List<(string mod, string guid, string text, string template)> assetTexts = new();

// Guid -> (Language -> Text)
Dictionary<string, Dictionary<string, string>> localizedTexts = new();

// Keep track of all languages
HashSet<string> allLanguages = new();

//------------------------------------------------------------
// 3️⃣ Process each mod
//------------------------------------------------------------

foreach (string modFolder in modFolders)
{
    string assetFolder = Path.Combine(modFolder, @"data\config\export\main\asset");
    string guiFolder = Path.Combine(modFolder, @"data\config\gui");

    //--------------------------------------------------------
    // Assets
    //--------------------------------------------------------
    if (Directory.Exists(assetFolder))
    {
        var assets = Directory.EnumerateFiles(assetFolder, "*.xml", SearchOption.AllDirectories)
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
            .Select(x =>
            {
                bool parsed = long.TryParse(x.guid, out long guidNum);
                return (parsed, guidNum, x);
            })
            .Where(x => x.parsed && !BlacklistedGuids.Contains(x.guidNum))
            .Select(x => x.x);

        foreach (var a in assets)
        {
            assetTexts.Add((modFolder, a.guid, a.text, a.template));
        }
    }

    //--------------------------------------------------------
    // GUI Translations
    //--------------------------------------------------------
    if (Directory.Exists(guiFolder))
    {
        var languageFiles = Directory
            .EnumerateFiles(guiFolder, "texts_*.xml", SearchOption.TopDirectoryOnly);

        foreach (string file in languageFiles)
        {
            string language = Path.GetFileNameWithoutExtension(file)
                .Replace("texts_", "");

            allLanguages.Add(language);

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
                .Where(x =>
                {
                    if (!long.TryParse(x.Guid, out long guidNum))
                        return false;

                    return !BlacklistedGuids.Contains(guidNum);
                });

            foreach (var entry in entries)
            {
                if (!localizedTexts.ContainsKey(entry.Guid))
                {
                    localizedTexts[entry.Guid] = new Dictionary<string, string>();
                }

                localizedTexts[entry.Guid][language] = entry.Text;
            }
        }
    }
}

//------------------------------------------------------------
// 4️⃣ Merge GUIDs
//------------------------------------------------------------

var allGuids = assetTexts
    .Select(a => a.guid)
    .Union(localizedTexts.Keys)
    .Distinct()
    .OrderBy(x => x)
    .ToList();

var languagesList = allLanguages.OrderBy(x => x).ToList();

//------------------------------------------------------------
// 5️⃣ Write Excel
//------------------------------------------------------------

string outputPath = Path.Combine(basePath, "_Localizations.xlsx");

using (XLWorkbook workbook = new())
{
    var ws = workbook.Worksheets.Add("Localization");

    // Header
    ws.Cell(1, 1).Value = "ModFolder";
    ws.Cell(1, 2).Value = "GUID";
    ws.Cell(1, 3).Value = "Template";
    ws.Cell(1, 4).Value = "AssetText";

    for (int i = 0; i < languagesList.Count; i++)
    {
        ws.Cell(1, i + 5).Value = languagesList[i];
    }

    // Column widths
    ws.Column(1).Width = 40; // ModFolder
    ws.Column(2).Width = 20; // GUID
    ws.Column(3).Width = 38; // Template
    ws.Column(4).Width = 60; // AssetText

    for (int i = 0; i < languagesList.Count; i++)
    {
        ws.Column(i + 5).Width = 20; // Languages
    }

    // ✅ Header styling
    var headerRange = ws.Range(1, 1, 1, 4 + languagesList.Count);
    headerRange.Style.Font.Bold = true;
    headerRange.Style.Border.BottomBorder = XLBorderStyleValues.Medium;

    // ✅ Freeze
    ws.SheetView.FreezeRows(1);
    ws.SheetView.FreezeColumns(4);

    ws.Range(1, 1, 1, 4 + languagesList.Count).SetAutoFilter();

    int row = 2;

    foreach (var guid in allGuids)
    {
        var matchingAssets = assetTexts.Where(a => a.guid == guid);

        foreach (var asset in matchingAssets)
        {
            if (!string.IsNullOrEmpty(asset.text) &&
                asset.text.Contains("fake", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if(!asset.mod.EndsWith("[Addon] Return to the Orient") && !asset.mod.Contains("[Addon] Return to the Orient\\Natoncy")){
                continue;
            }
            
            // ws.Cell(row, 1).Value = Path.GetFileName(asset.mod);
            ws.Cell(row, 1).Value = $"{asset.mod}";
            if (long.TryParse(guid, out long guidNum))
            {
                ws.Cell(row, 2).Value = guidNum;
            }
            ws.Cell(row, 3).Value = asset.template;
            ws.Cell(row, 4).Value = asset.text;

            // Languages
            for (int col = 0; col < languagesList.Count; col++)
            {
                string lang = languagesList[col];

                if (localizedTexts.TryGetValue(guid, out var langDict) &&
                    langDict.TryGetValue(lang, out var text))
                {
                    ws.Cell(row, col + 5).Value = text;
                }
            }

            row++;
        }
    }

    workbook.SaveAs(outputPath);
}

Console.WriteLine("Excel file created:");
Console.WriteLine(outputPath);