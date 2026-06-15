import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Safe resolution for both ESM (tsx dev) and CJS (esbuild prod bundle)
const _filename = typeof import.meta !== "undefined" && import.meta.url
  ? fileURLToPath(import.meta.url)
  : (typeof __filename !== "undefined" ? __filename : "");

const _dirname = typeof import.meta !== "undefined" && import.meta.url
  ? path.dirname(fileURLToPath(import.meta.url))
  : (typeof __dirname !== "undefined" ? __dirname : "");

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

  // POST endpoint to generate comforting drug explanations in selected language
  app.post("/api/explain-med", async (req, res) => {
    try {
      const { medicine, language, age } = req.body;
      const patientAge = age || 68;
      const targetLang = language || "English";
      
      const prompt = `A geriatric patient named Susan White, aged ${patientAge}, is receiving a medicine reminder.
      Explain the purpose and guidelines for taking the medicine "${medicine}" in "${targetLang}" language.
      Strict limits:
      - Keep the tone exceptionally comforting, clear, and reassuring, as if spoken by a daughter or head nurse.
      - Write exactly 2 blocks/sentences.
      - Dedicate sentence 1 to what the medicine does (its purpose, e.g. control blood sugar).
      - Dedicate sentence 2 to exactly how and when to take it relative to breakfast/food.
      - Return the text in the requested script/alphabet style (e.g. Tamil characters for Tamil, Hindi script for Hindi, etc.).`;

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are the CareSync AI Multilingual Companion. You translate complex medical drug prescriptions into extremely warm, easy-to-understand, supportive vocal blocks in non-English native languages (Tamil, Hindi, Telugu, Malayalam) or English.",
        }
      });

      res.json({ success: true, text: response.text || "" });
    } catch (err: any) {
      console.error("Explain Med API Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST endpoint to handle pill identification with Gemini Vision or descriptive text
  app.post("/api/identify-pill", async (req, res) => {
    try {
      const { image, textQuery } = req.body;
      const ai = getAIClient();
      const contents: any[] = [];

      if (image) {
        // Strip data:image/... base64 prefix if present
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        contents.push({
          inlineData: {
            mimeType: "image/png",
            data: base64Data
          }
        });
      }

      contents.push({
        text: textQuery || "A patient shows this medicine pill. Identify this tablet. Return standard Name & strength, Color, Shape, dosage, and food safety guideline in structural JSON."
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: "You are the CareSync Pill Recognition Engine. Inspect the provided image or physical description. Perform a high-fidelity image match, then output JSON fitting the requested schema perfectly.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              medicine: { type: Type.STRING, description: "Official pharmaceutical name and standard milligram dose, e.g. Metformin 500mg, Aspirin 75mg, or Atorvastatin 20mg" },
              color: { type: Type.STRING, description: "The color of the tablet, e.g., White, Red, Blue, Yellow" },
              shape: { type: Type.STRING, description: "The physical shape, e.g., round, oval, capsule, hexagonal" },
              dosage: { type: Type.STRING, description: "Prescription dosage, e.g., Take 1 tablet" },
              purpose: { type: Type.STRING, description: "Primary medical use in simple patient terms, e.g. controls blood sugar levels, prevents blood clots, or lowers cholesterol" },
              food: { type: Type.STRING, description: "Timing guideline, e.g., Take after breakfast, Take with water before lunch, or Take before bed" }
            },
            required: ["medicine", "color", "shape", "dosage", "purpose", "food"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response text returned from the model.");
      }

      res.json({ success: true, data: JSON.parse(text.trim()) });
    } catch (err: any) {
      console.error("Identify Pill API Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST endpoint to handle patient Q&A dialog
  app.post("/api/patient-chat", async (req, res) => {
    try {
      const { message, language, age, selectedMed } = req.body;
      const targetLang = language || "English";
      const currentMed = selectedMed || "Metformin";

      const prompt = `A senior patient aged ${age || 68} asks the CareSync Health Companion: "${message}" regarding their medication "${currentMed}".
      Formulate a loving, clear response in "${targetLang}" language script.
      Safety Rules:
      - Reply under 3 simple sentences.
      - Always prioritize clinical safety (e.g. advise taking medicines with room-temperature water rather than coffee, tea, soft drinks, or juices, and remind them to query their doctor for complex changes).
      - Be exceptionally encouraging and respectful.`;

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are the CareSync Home Companion chatbot, answering questions for elderly patients with supreme medical safety, professional warmth, and clarity."
        }
      });

      res.json({ success: true, text: response.text || "" });
    } catch (err: any) {
      console.error("Patient Chat API Error:", err);
      res.status(500).json({ success: false, error: err.message });
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
