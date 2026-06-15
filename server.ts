import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy initialization of Gemini SDK
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured. Please add your Gemini key in the Settings > Secrets configuration.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing requests
  app.use(express.json());

  // API Endpoints FIRST
  app.post("/api/predict", async (req, res) => {
    try {
      const { 
        age, 
        gender, 
        hr, 
        spo2, 
        bpSys, 
        bpDia, 
        temp, 
        rr, 
        co2,
        datasetType,
        diagnosis,
        name
      } = req.body;

      // Construct medical intelligence prompt
      const prompt = `Perform a high-fidelity clinical risk assessment for the following hospital patient:
      Patient Name/ID: ${name || "Unknown"}
      Target Condition/Cohort Context: ${datasetType || "General ICU Monitor Baseline"}
      Age: ${age || "N/A"}
      Gender: ${gender || "N/A"}
      
      Vitals & Biomarkers:
      - Heart Rate (HR): ${hr || "N/A"} bpm
      - Blood Oxygen (SpO2): ${spo2 || "N/A"} %
      - Systolic BP (SBP): ${bpSys || "N/A"} mmHg
      - Diastolic BP (DBP): ${bpDia || "N/A"} mmHg
      - Body Temperature: ${temp || "N/A"} °C
      - Respiratory Rate (RR): ${rr || "N/A"} breaths/min
      - End-tidal CO2: ${co2 || "N/A"} mmHg
      - Current Admission Dx: ${diagnosis || "Under Observation"}

      Task: Run a multi-variable diagnostic simulation to assess risk progression. Return clinical classification metrics, severity indicators, explainable reasoning for weights, and responsive treatment recommendation guides. Let's do this sequentially and with strict clinical rigor.`;

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: `You are an expert full-stack clinical decision support expert system, similar to EPIC clinical models or early-warning TREWS tools. Analyze the patient parameters with absolute accuracy. Check thresholds (e.g. SBP < 90 is hypotensive, Temp > 38.3 is febrile, SpO2 < 92 is hypoxemic, HR > 100 is tachycardic, etc.). Ground your predictions in real ICU medicine guidelines (SIRS, qSOFA, NYHA, WHO ACOG). Return detailed JSON matching the exact schema definition. Determine riskScore as a number between 0 and 100 indicating likelihood of sepsis, cardiac arrest, or maternal preeclampsia depending on cohort context.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              riskScore: { type: Type.NUMBER, description: "Probability of clinical warning event from 0 to 100 percentage" },
              priority: { type: Type.STRING, description: "Category: Stable, Moderate, High Risk, or Critical" },
              diagnosis: { type: Type.STRING, description: "Refined clinical assessment or syndrome alert tag" },
              reasoning: { type: Type.STRING, description: "Clinical analysis grounding the risk score against vitals thresholds and guidelines" },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Actionable nurse guidelines: fluids, blood cultures, EKG, specialist consultation, or direct actions"
              },
              featureImportance: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    feature: { type: Type.STRING },
                    importance: { type: Type.NUMBER, description: "Normalized influence factor of this metric from -1.0 to 1.0 (positive increases risk, negative decreases)" }
                  },
                  required: ["feature", "importance"]
                },
                description: "Explanatory metrics weight overview"
              }
            },
            required: ["riskScore", "priority", "diagnosis", "reasoning", "recommendations", "featureImportance"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response content generated from Gemini API.");
      }

      // Safe JSON parse and forwarding to client
      const parsedData = JSON.parse(responseText.trim());
      res.json({ success: true, ...parsedData });

    } catch (err: any) {
      console.error("Clinical Prediction API Error:", err);
      res.status(500).json({ 
        success: false, 
        error: err.message || "An internal error occurred during clinical analysis." 
      });
    }
  });

  // Vite middleware in dev or serving static assets in prod
  if (process.env.NODE_ENV !== "production") {
    console.log("Vite dev server is integrated recursively.");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving compiled assets from production directory.");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Physiological telemetry server and integrated clinical models active on port ${PORT}`);
  });
}

startServer();
