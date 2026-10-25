#:package ClosedXML@0.105.0

using ClosedXML.Excel;
using System.Xml;
using System.Xml.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Net;

HttpClient http = new();
http.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0");
var translationCache = new Dictionary<(string, string), string>();

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
        Template = worksheet.Cell(r, 3).GetString(),
        Name = worksheet.Cell(r, 4).GetString(),
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
                finalText = textRaw;
            }
            else if (!string.IsNullOrWhiteSpace(englishText))
            {
                finalText = "??" + (await GetTranslatedText(englishText.Trim(), language));
            }
            else
            {
                // 🚫 Skip completely if both are empty
                continue;
            }

            modOp.Add(
                new XElement("Text",
                    new XElement("GUID", row.Guid.Trim()),
                    new XComment($" {row.Template} | {row.Name} | {englishText} "),
                    new XElement("Text", finalText.Trim())
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

async Task<string> GetTranslatedText(string text, string language)
{
    if (translationCache.TryGetValue((text, language), out var cachedTranslation))
    {
        Console.WriteLine($"Cached value found for {text} in {language}");
        return cachedTranslation;
    }

    var langMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
            // ["english"] = "en",
            ["german"] = "de",
            ["french"] = "fr",
            ["spanish"] = "es",
            ["italian"] = "it",
            ["polish"] = "pl",
            ["russian"] = "ru",
            ["portuguese"] = "pt",
            ["brazilian"] = "pt",
            ["japanese"] = "ja",
            ["korean"] = "ko",
            ["chinese"] = "zh-CN",
            ["taiwanese"] = "zh-TW"
    };

    if (!langMap.TryGetValue(language, out var target))
    {
        Console.WriteLine($"No language found for {language}");
        return $"?{text}";
    }

    try
    {
        string url =
            $"https://translate.googleapis.com/translate_a/single" +
            $"?client=gtx" +
            $"&sl=en" +
            $"&tl={target}" +
            $"&dt=t" +
            $"&q={WebUtility.UrlEncode(text)}";

        string json = await http.GetStringAsync(url);

        using JsonDocument doc = JsonDocument.Parse(json);

        // Response format:
        // [[[translated,original,null,null,...]],null,"en",...]

        var translation = doc.RootElement[0][0][0].GetString() ?? $"?{text}";
        
        Console.WriteLine($"Translated {text} to {language} / {target}: {translation} / {json}");

        translationCache.Add((text, language), translation);

        return translation;
    }
    catch (Exception e)
    {
        Console.WriteLine($"Failed translating {text} to {language} / {target}: {e.Message}");
        return $"?{text}";
    }
}