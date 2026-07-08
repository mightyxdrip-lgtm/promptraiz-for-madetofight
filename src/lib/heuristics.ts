import { AnalysisResult } from "./gemini";

const ACTION_VERBS = ["analyze", "create", "write", "explain", "generate", "build", "design", "fix", "improve", "summarize"];
const PERSONA_KEYWORDS = ["you are", "act as", "as a", "expert", "professional", "specialist"];
const CONTEXT_KEYWORDS = ["background", "context", "project", "goal", "purpose", "because", "situation"];
const CONSTRAINT_KEYWORDS = ["don't", "avoid", "must", "limit", "only", "no", "negative", "requirement"];
const TONE_KEYWORDS = ["tone", "style", "format", "markdown", "json", "bullet", "professional", "friendly", "concise"];

export function scanPromptSecurity(prompt: string): { securityScore: number; warnings: string[]; isSecure: boolean } {
  const warnings: string[] = [];
  let score = 100;
  
  const injectionPatterns = [
    { pattern: /ignore (all )?previous instructions/i, warning: "Instruction Override Attempt" },
    { pattern: /system override/i, warning: "System Command Hijacking" },
    { pattern: /you are now (unfiltered|unrestricted)/i, warning: "Jailbreak Attempt" },
    { pattern: /\bDAN\b/i, warning: "DAN Jailbreak Pattern" },
    { pattern: /jailbreak/i, warning: "Explicit Jailbreak Mention" },
    { pattern: /disregard (all )?rules/i, warning: "Rule Evasion Attempt" },
    { pattern: /output (the )?system prompt/i, warning: "System Prompt Leakage Attempt" },
    { pattern: /developer mode/i, warning: "Developer Mode Exploit" },
    // Hacking & Malicious Intent
    { pattern: /\bhack\b|\bhacking\b|\bexploit\b|\bpayload\b|\bmalware\b|\bvirus\b/i, warning: "Malicious Activity Detected" },
    { pattern: /\bdox\b|\bdoxing\b|\bpersonal info\b|\bprivate data\b|\baddress\b|\bphone number\b/i, warning: "Privacy Violation / Doxing Attempt" },
    { pattern: /\bpassword\b|\bcredential\b|\blogin\b|\btoken\b/i, warning: "Credential Theft Risk" },
    { pattern: /\bbank\b|\bcredit card\b|\bssn\b|\bsocial security\b|\bcvv\b|\brouting number\b|\baccount number\b/i, warning: "Financial Data Extraction Risk" },
    // NSFW & Harmful Content
    { pattern: /\bnsfw\b|\bporn\b|\bexplicit\b|\badult\b|\bsexual\b/i, warning: "NSFW Content Detected" },
    { pattern: /\bkill\b|\bmurder\b|\bhurt\b|\bviolence\b|\bbomb\b|\bweapon\b/i, warning: "Harmful or Violent Content" }
  ];

  injectionPatterns.forEach(({ pattern, warning }) => {
    if (pattern.test(prompt)) {
      warnings.push(warning);
      score -= 25;
    }
  });

  const finalScore = Math.max(0, score);
  return {
    securityScore: finalScore,
    warnings,
    isSecure: finalScore === 100
  };
}

export function heuristicAnalyze(prompt: string): AnalysisResult {
  const lowerPrompt = prompt.toLowerCase();
  
  const clarity = ACTION_VERBS.some(v => lowerPrompt.includes(v)) ? 8 + Math.min(2, prompt.split(' ').length / 20) : 4;
  const persona = PERSONA_KEYWORDS.some(k => lowerPrompt.includes(k)) ? 9 : 2;
  const context = CONTEXT_KEYWORDS.some(k => lowerPrompt.includes(k)) || prompt.length > 150 ? 8 : 3;
  const constraints = CONSTRAINT_KEYWORDS.some(k => lowerPrompt.includes(k)) ? 9 : 2;
  const tone = TONE_KEYWORDS.some(k => lowerPrompt.includes(k)) ? 9 : 3;

  const criteria = {
    clarity: Math.round(clarity),
    persona: Math.round(persona),
    context: Math.round(context),
    constraints: Math.round(constraints),
    tone: Math.round(tone)
  };

  const overallScore = Math.round((criteria.clarity + criteria.persona + criteria.context + criteria.constraints + criteria.tone) * 2);

  const feedback: string[] = [];
  const missingElements: string[] = [];

  if (criteria.persona < 5) {
    missingElements.push("Expert Persona definition");
    feedback.push("Assign a specific role to the AI to improve response quality.");
  }
  if (criteria.context < 5) {
    missingElements.push("Detailed background context");
    feedback.push("Provide more information about why you are asking this.");
  }
  if (criteria.constraints < 5) {
    missingElements.push("Explicit negative constraints");
    feedback.push("Tell the AI what NOT to do to avoid unwanted output.");
  }
  if (criteria.tone < 5) {
    missingElements.push("Specific output format or tone");
    feedback.push("Define how the response should look (e.g., Markdown, JSON).");
  }

  if (feedback.length === 0) {
    feedback.push("This prompt is exceptionally well-structured.");
  }

  return {
    overallScore,
    policyViolation: false,
    criteria,
    feedback,
    missingElements,
    security: scanPromptSecurity(prompt)
  };
}

export function heuristicOptimize(prompt: string, analysis: AnalysisResult): string {
  let optimized = "";
  
  // Persona
  if (analysis.criteria.persona < 7) {
    optimized += "Act as an elite expert and professional consultant in this field. ";
  }
  
  // Task
  optimized += `Your primary objective is to: ${prompt.trim()}\n\n`;
  
  // Context
  if (analysis.criteria.context < 7) {
    optimized += "### Context\nThis task is part of a high-stakes project requiring precision and professional-grade output. The goal is to achieve the most accurate and useful result possible.\n\n";
  }
  
  // Constraints
  optimized += "### Constraints\n- Provide a comprehensive and accurate response.\n- Avoid generic or filler content.\n- Ensure all technical details are verified.\n- Maintain a professional and authoritative tone throughout.\n\n";
  
  // Format
  optimized += "### Output Format\nPlease provide the response in a clear, structured Markdown format using appropriate headers and bullet points for readability.";

  return optimized;
}

export function heuristicImageToPrompt(base64: string, mimeType: string): Promise<{
  generatedPrompt: string;
  visualAnalysis: string[];
  style: string;
  lighting: string;
  colorPalette: string[];
  confidence: string;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const SIZE = 64;
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const { width: origW, height: origH } = img;

      // Orientation
      const ratio = origW / origH;
      const isPortrait = origH > origW;
      const orientation = isPortrait ? "portrait" : ratio > 1.7 ? "ultra-wide landscape" : ratio > 1.2 ? "landscape" : "square";

      // Grid sample 8x8
      const GRID = 8;
      const cellW = SIZE / GRID;
      const cellH = SIZE / GRID;
      const gridColors: string[][] = [];
      const regionColors: { top: string[]; middle: string[]; bottom: string[]; left: string[]; right: string[] } = { top: [], middle: [], bottom: [], left: [], right: [] };

      for (let gy = 0; gy < GRID; gy++) {
        gridColors[gy] = [];
        for (let gx = 0; gx < GRID; gx++) {
          const cx = Math.floor(gx * cellW + cellW / 2);
          const cy = Math.floor(gy * cellH + cellH / 2);
          const [r, g, b] = ctx.getImageData(cx, cy, 1, 1).data;
          const name = rgbToColorName(r, g, b);
          gridColors[gy][gx] = name;

          if (gy < 3) regionColors.top.push(name);
          else if (gy < 5) regionColors.middle.push(name);
          else regionColors.bottom.push(name);
          if (gx < 3) regionColors.left.push(name);
          else if (gx > 4) regionColors.right.push(name);
        }
      }

      // Brightness analysis
      const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
      let totalBrightness = 0;
      let darkPixels = 0;
      let brightPixels = 0;
      let totalSaturation = 0;
      const brightnessGrid: number[][] = [];

      for (let y = 0; y < SIZE; y++) {
        brightnessGrid[y] = [];
        for (let x = 0; x < SIZE; x++) {
          const i = (y * SIZE + x) * 4;
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
          totalBrightness += brightness;
          brightnessGrid[y][x] = brightness;
          if (brightness < 0.2) darkPixels++;
          if (brightness > 0.8) brightPixels++;
          const max = Math.max(r, g, b) / 255;
          const min = Math.min(r, g, b) / 255;
          totalSaturation += max === 0 ? 0 : (max - min) / max;
        }
      }

      const avgBrightness = totalBrightness / (SIZE * SIZE);
      const avgSaturation = totalSaturation / (SIZE * SIZE);
      const darknessRatio = darkPixels / (SIZE * SIZE);
      const brightnessRatio = brightPixels / (SIZE * SIZE);

      // Edge detection (Sobel-like)
      let edgeCount = 0;
      for (let y = 1; y < SIZE - 1; y++) {
        for (let x = 1; x < SIZE - 1; x++) {
          const gx = -brightnessGrid[y - 1][x - 1] + brightnessGrid[y - 1][x + 1]
                    - 2 * brightnessGrid[y][x - 1] + 2 * brightnessGrid[y][x + 1]
                    - brightnessGrid[y + 1][x - 1] + brightnessGrid[y + 1][x + 1];
          const gy = -brightnessGrid[y - 1][x - 1] - 2 * brightnessGrid[y - 1][x] - brightnessGrid[y - 1][x + 1]
                    + brightnessGrid[y + 1][x - 1] + 2 * brightnessGrid[y + 1][x] + brightnessGrid[y + 1][x + 1];
          if (Math.sqrt(gx * gx + gy * gy) > 0.3) edgeCount++;
        }
      }
      const edgeDensity = edgeCount / (SIZE * SIZE);
      const complexity = edgeDensity > 0.15 ? "highly detailed" : edgeDensity > 0.08 ? "moderately detailed" : "simple/clean";

      // Color temperature (warm vs cool)
      let warmScore = 0;
      let coolScore = 0;
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const i = (y * SIZE + x) * 4;
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          if (r > b + 30) warmScore++;
          if (b > r + 30) coolScore++;
        }
      }
      const temperature = warmScore > coolScore * 1.5 ? "warm tones" : coolScore > warmScore * 1.5 ? "cool tones" : "balanced temperature";

      // Unique dominant colors
      const colorCounts: Record<string, number> = {};
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          const c = gridColors[y][x];
          colorCounts[c] = (colorCounts[c] || 0) + 1;
        }
      }
      const dominantColors = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([c]) => c);

      // Region description
      const topColor = mostCommon(regionColors.top);
      const midColor = mostCommon(regionColors.middle);
      const botColor = mostCommon(regionColors.bottom);

      // Lighting estimation
      const topBright = avgBrightnessRegion(brightnessGrid, 0, 0, SIZE, SIZE / 3);
      const botBright = avgBrightnessRegion(brightnessGrid, 0, SIZE * 2 / 3, SIZE, SIZE);
      const lighting = topBright > botBright + 0.15 ? "top-lit / overhead lighting"
        : botBright > topBright + 0.15 ? "bottom-lit / underlit"
        : avgBrightness > 0.6 ? "bright/high-key lighting"
        : avgBrightness < 0.3 ? "dark/moody/low-key lighting"
        : "even/ambient lighting";

      // Saturation description
      const saturationDesc = avgSaturation > 0.5 ? "vibrant/saturated" : avgSaturation > 0.25 ? "moderate saturation" : "desaturated/muted";

      // Style detection
      const styleHints: string[] = [];
      if (edgeDensity > 0.18 && avgSaturation > 0.4) styleHints.push("digital illustration");
      if (edgeDensity < 0.06 && avgSaturation < 0.2) styleHints.push("minimalist/flat design");
      if (avgBrightness < 0.25 && darknessRatio > 0.6) styleHints.push("dark/dramatic");
      if (avgBrightness > 0.7 && brightnessRatio > 0.3) styleHints.push("bright/airy");
      if (avgSaturation > 0.6) styleHints.push("vivid/saturated colors");
      if (edgeDensity > 0.12) styleHints.push("detailed/complex");
      if (styleHints.length === 0) styleHints.push("photographic");

      // Build the visual fingerprint description
      const fingerprint = [
        `${orientation} image (${origW}x${origH})`,
        `Complexity: ${complexity} (edge density: ${(edgeDensity * 100).toFixed(1)}%)`,
        `Colors: ${dominantColors.join(", ")}`,
        `Top area: ${topColor || "mixed"}, Middle: ${midColor || "mixed"}, Bottom: ${botColor || "mixed"}`,
        `Brightness: ${(avgBrightness * 100).toFixed(0)}% avg (${darknessRatio > 0.4 ? "predominantly dark" : brightnessRatio > 0.4 ? "predominantly bright" : "mixed"})`,
        `Saturation: ${saturationDesc} (${(avgSaturation * 100).toFixed(0)}%)`,
        `Color temperature: ${temperature}`,
        `Lighting: ${lighting}`,
        `Style indicators: ${styleHints.join(", ")}`,
      ].join("\n");

      resolve({
        generatedPrompt: fingerprint,
        visualAnalysis: fingerprint.split("\n"),
        style: styleHints.join(", "),
        lighting,
        colorPalette: dominantColors,
        confidence: "High",
        _fingerprint: fingerprint,
      } as any);
    };
    img.onerror = () => {
      resolve({
        generatedPrompt: "A professional digital image.",
        visualAnalysis: ["Could not analyze image"],
        style: "Unknown",
        lighting: "Unknown",
        colorPalette: [],
        confidence: "Low",
      });
    };
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

function rgbToColorName(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 510;
  if (max - min < 20) {
    if (l < 0.15) return "black";
    if (l > 0.85) return "white";
    return "gray";
  }
  const s = l <= 0.5 ? (max - min) / (max + min) : (max - min) / (510 - max - min);
  let h = 0;
  if (max === r) h = ((g - b) / (max - min)) * 30;
  else if (max === g) h = 60 + ((b - r) / (max - min)) * 30;
  else h = 120 + ((r - g) / (max - min)) * 30;
  if (h < 0) h += 180;

  if (s < 0.15) return l < 0.5 ? "dark gray" : "light gray";
  if (h < 15 || h >= 165) return r > 180 ? "red" : "dark red";
  if (h < 45) return g > r ? "olive" : "orange";
  if (h < 75) return "yellow";
  if (h < 105) return "green";
  if (h < 135) return "cyan";
  if (h < 165) return "blue";
  return "magenta";
}

function mostCommon(arr: string[]): string {
  const counts: Record<string, number> = {};
  arr.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "mixed";
}

function avgBrightnessRegion(grid: number[][], x1: number, y1: number, x2: number, y2: number): number {
  let sum = 0, count = 0;
  for (let y = Math.floor(y1); y < Math.floor(y2) && y < grid.length; y++) {
    for (let x = Math.floor(x1); x < Math.floor(x2) && x < grid[0].length; x++) {
      sum += grid[y][x];
      count++;
    }
  }
  return count > 0 ? sum / count : 0.5;
}
