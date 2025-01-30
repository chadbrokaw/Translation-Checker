import { useState } from "react";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";

interface CheckResultProps {
  label: string;
  passed: string[];
}

const CheckResult = ({ label, passed }: CheckResultProps) => {
  // eslint-disable-next-line
  const uniqueArray = [...new Set(passed)];
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-row gap-4">
        {uniqueArray.length === 0 ? (
          <CheckCircleIcon className="text-green-600 h-6" />
        ) : (
          <XCircleIcon className="text-red-600  h-6" />
        )}
        <span>{label}</span>
      </div>
      {uniqueArray.length > 0 && (
        <div className="flex flex-col">
          <h2>Failures</h2>
          <ul className="flex flex-col">
            {uniqueArray.map((item, index) => {
              return (
                <li className="text-sm list-disc list-inside" key={index}>
                  {item}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

const extractSegmentsFromXLF = (xlfContent: string) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xlfContent, "application/xml");

  if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
    throw new Error(
      xmlDoc.getElementsByTagName("parsererror").item(0)?.textContent ||
        "Parsing Error"
    );
    return [];
  }

  const units = Array.from(xmlDoc.getElementsByTagName("unit"));
  const segments: { id: string; source: string; target: string }[] = [];

  units.forEach((unit) => {
    const segment = unit.getElementsByTagName("segment")[0];
    const unitId = unit.getAttribute("id") || "";
    if (segment) {
      const sourceEl = segment.getElementsByTagName("source")[0];
      const targetEl = segment.getElementsByTagName("target")[0];
      if (sourceEl && targetEl) {
        const sourceText = sourceEl.textContent || "";
        const targetText = targetEl.textContent || "";
        segments.push({ id: unitId, source: sourceText, target: targetText });
      }
    }
  });

  return segments;
};

const App = () => {
  const [xlfContent, setXlfContent] = useState("");

  const [checks, setChecks] = useState<{
    encodingErrors: string[];
    variableMatch: string[];
    pluralMatch: string[];
    pluralBarCheck: string[];
    variableWithoutPercentFound: string[];
  }>({
    encodingErrors: [],
    variableMatch: [],
    pluralMatch: [],
    pluralBarCheck: [],
    variableWithoutPercentFound: [],
  });

  // Function to perform the checks
  const handleCheck = () => {
    let segments;
    try {
      segments = extractSegmentsFromXLF(xlfContent);
    } catch (e) {
      alert(e);
      return;
    }

    const variableMismatchFound: string[] = [];
    const variableWithoutPercentFound: string[] = [];

    const encodingErrorsFound = segments
      .filter(
        ({ source, target }) =>
          source.includes("nbsp;") ||
          target.includes("nbsp;") ||
          source.includes("&amp;") ||
          target.includes("&amp;")
      )
      .map(({ id }) => id);

    const varRegex = /%\{.*?\}/g;
    const varWithoutPercentRegex = /(?<!%)\{.*?\}/g;

    for (const { source, target, id } of segments) {
      const sourceVars = source.match(varRegex) || [];
      const targetVars = target.match(varRegex) || [];
      const sourceVarsWithoutPercent =
        source.match(varWithoutPercentRegex) || [];
      const targetVarsWithoutPercent =
        target.match(varWithoutPercentRegex) || [];

      if (sourceVars.length !== targetVars.length) {
        variableMismatchFound.push(id);
      }

      if (
        sourceVarsWithoutPercent.length > 0 ||
        targetVarsWithoutPercent.length > 0
      ) {
        variableWithoutPercentFound.push(id);
      }
    }

    const pluralMismatchFound: string[] = [];
    const pluralBarCheck: string[] = [];

    for (const { source, target, id } of segments) {
      const invalidSource = source.match(/(?<!\|)\|{1,3}(?!\|)/);
      const invalidTarget = target.match(/(?<!\|)\|{1,3}(?!\|)/);
      const tooManyBarsSource = source.match(/\|{5,}/);
      const tooManyBarsTarget = target.match(/\|{5,}/);

      if (
        invalidSource ||
        invalidTarget ||
        tooManyBarsSource ||
        tooManyBarsTarget
      ) {
        pluralBarCheck.push(id);
        continue;
      }

      const sourceParts = source
        .split("||||")
        .filter((item) => item.trim() !== "");
      const targetParts = target
        .split("||||")
        .filter((item) => item.trim() !== "");

      if (sourceParts.length !== targetParts.length) {
        pluralMismatchFound.push(id);
      }
    }

    setChecks({
      encodingErrors: encodingErrorsFound,
      variableMatch: variableMismatchFound,
      pluralMatch: pluralMismatchFound,
      variableWithoutPercentFound: variableWithoutPercentFound,
      pluralBarCheck: pluralBarCheck,
    });
  };

  return (
    <div className="min-h-screen w-full p-4 bg-stone-950 flex-col flex">
      <h1 className="text-2xl font-bold mb-4">XLF Checker</h1>
      <div className="flex gap-10 h-full w-full justify-center">
        {/* Left Panel: Text Input */}
        <div className="h-full w-1/2">
          <div className="h-6" />
          <h1 className="block mb-2 font-medium text-2xl">
            Paste XLF Content Below:
          </h1>
          <textarea
            className="w-full h-96 p-2 border rounded font-mono"
            value={xlfContent}
            onChange={(e) => setXlfContent(e.target.value)}
          />
          <button
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={handleCheck}
          >
            Run Checks
          </button>
        </div>

        {/* Right Panel: Results */}
        <div className="p-4 rounded border space-y-4 h-min w-120">
          <h2 className="text-xl font-semibold h-6">Checks</h2>
          {/* Distinct checks: each is either pass/fail */}
          <CheckResult
            label="No Encoding Errors (e.g. &amp;nbsp;)"
            passed={checks.encodingErrors}
          />
          <CheckResult
            label="Matching Variables Between Source and Target"
            passed={checks.variableMatch}
          />
          <CheckResult
            label="All variables have a % prefix"
            passed={checks.variableWithoutPercentFound}
          />
          <CheckResult
            label="Plural Forms Match (||||)"
            passed={checks.pluralMatch}
          />
          <CheckResult
            label="Malformed plural bars"
            passed={checks.pluralBarCheck}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
