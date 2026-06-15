import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { 
  Clock, 
  RefreshCw, 
  Heart, 
  AlertTriangle, 
  X, 
  ShieldAlert, 
  Search, 
  ChevronRight, 
  Sparkles, 
  TrendingDown, 
  Activity, 
  Stethoscope, 
  Layers,
  Database,
  UploadCloud,
  FileText,
  CheckCircle,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { Patient, getPatientMetrics, getExplainableAIReason } from "./types";
import { initialPatients } from "./data";

// --- CLIENT-SIDE CSV PARSING & DATASET SCHEMA CLARIFIER ENGINE ---
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseSepsisCSV(text: string): Patient[] {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  
  const hrIdx = headers.findIndex(h => h.includes("hr") || h.includes("heart") || h.includes("pulse"));
  const o2Idx = headers.findIndex(h => h.includes("o2") || h.includes("spo2") || h.includes("sat"));
  const tempIdx = headers.findIndex(h => h.includes("temp"));
  const sbpIdx = headers.findIndex(h => h.includes("sbp") || h.includes("sys") || h.includes("systolic"));
  const dbpIdx = headers.findIndex(h => h.includes("dbp") || h.includes("dia") || h.includes("diastolic"));
  const respIdx = headers.findIndex(h => h.includes("resp") || h.includes("rr") || h.includes("breath"));
  const labelIdx = headers.findIndex(h => h.includes("sepsis") || h.includes("label"));
  const idIdx = headers.findIndex(h => h.includes("id") || h.includes("patient"));
  const nameIdx = headers.findIndex(h => h.includes("name"));
  const ageIdx = headers.findIndex(h => h.includes("age"));
  const genderIdx = headers.findIndex(h => h.includes("gender") || h.includes("sex"));
  const dxIdx = headers.findIndex(h => h.includes("dx") || h.includes("diag") || h.includes("outcome"));

  return lines.slice(1).map((line, curIdx) => {
    const values = parseCSVLine(line);
    const idVal = idIdx !== -1 && values[idIdx] ? values[idIdx] : `S-${101 + curIdx}`;
    const nameVal = nameIdx !== -1 && values[nameIdx] ? values[nameIdx] : `Sepsis Unit Candidate #${curIdx + 1}`;
    const ageVal = ageIdx !== -1 ? parseInt(values[ageIdx]) || 58 : 58;
    const genderVal = genderIdx !== -1 ? (values[genderIdx].toUpperCase().startsWith("1") || values[genderIdx].toLowerCase().startsWith("m") ? "M" : "F") : (curIdx % 2 === 0 ? "F" : "M");
    const hrVal = hrIdx !== -1 ? parseFloat(values[hrIdx]) || 115 : 115;
    const o2Val = o2Idx !== -1 ? parseFloat(values[o2Idx]) || 91 : 91;
    let tempVal = tempIdx !== -1 ? parseFloat(values[tempIdx]) || 38.9 : 38.9;
    if (tempVal > 45) tempVal = (tempVal - 32) * 5 / 9; // F to C conversion
    const sbpVal = sbpIdx !== -1 ? parseFloat(values[sbpIdx]) || 88 : 88;
    const dbpVal = dbpIdx !== -1 ? parseFloat(values[dbpIdx]) || 58 : 58;
    const rrVal = respIdx !== -1 ? parseFloat(values[respIdx]) || 26 : 26;
    const isSeptic = labelIdx !== -1 ? parseInt(values[labelIdx]) === 1 : (hrVal > 110 && o2Val < 92);
    const dxVal = dxIdx !== -1 && values[dxIdx] ? values[dxIdx] : (isSeptic ? "Severe Sepsis Progression" : "Vitals Observation / Sepsis Surveillance");

    const priority: "Critical" | "High Risk" | "Moderate" | "Stable" = isSeptic ? "Critical" : (o2Val < 93 ? "High Risk" : "Stable");

    return {
      id: idVal,
      bedId: `Bed ${String(curIdx + 1).padStart(2, "0")}`,
      name: nameVal,
      age: ageVal,
      gender: genderVal,
      dx: dxVal,
      hr: Math.round(hrVal),
      spo2: Math.round(o2Val),
      bpSys: Math.round(sbpVal),
      bpDia: Math.round(dbpVal),
      temp: parseFloat(tempVal.toFixed(1)),
      rr: Math.round(rrVal),
      co2: isSeptic ? 30 : 38,
      riskScore: isSeptic ? 85 + (curIdx % 12) : 10 + (curIdx % 15),
      priority,
      spo2History: [Math.min(100, o2Val + 4), Math.min(100, o2Val + 2), Math.min(100, o2Val + 1), o2Val, o2Val],
      hrHistory: [hrVal - 10, hrVal - 5, hrVal, hrVal, hrVal],
      tempHistory: [tempVal - 0.4, tempVal - 0.2, tempVal, tempVal, tempVal],
      bpSysHistory: [sbpVal + 15, sbpVal + 10, sbpVal, sbpVal, sbpVal],
      alertStatus: isSeptic ? "TREWS SEPSIS DETECTED" : "NORMAL"
    };
  });
}

function parseHeartFailureCSV(text: string): Patient[] {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

  const idIdx = headers.findIndex(h => h.includes("id") || h.includes("patient"));
  const nameIdx = headers.findIndex(h => h.includes("name"));
  const ageIdx = headers.findIndex(h => h.includes("age"));
  const sexIdx = headers.findIndex(h => h.includes("sex") || h.includes("gender"));
  const hrIdx = headers.findIndex(h => h.includes("hr") || h.includes("heart") || h.includes("pulse"));
  const o2Idx = headers.findIndex(h => h.includes("spo2") || h.includes("o2"));
  const sbpIdx = headers.findIndex(h => h.includes("sbp") || h.includes("bp") || h.includes("systolic") || h.includes("pressure"));
  const hbpIdx = headers.findIndex(h => h.includes("high_blood") || h.includes("hbp"));
  const efIdx = headers.findIndex(h => h.includes("fraction") || h.includes("ef"));
  const deIdx = headers.findIndex(h => h.includes("death") || h.includes("event") || h.includes("de"));
  const dxIdx = headers.findIndex(h => h.includes("diag") || h.includes("dx"));

  return lines.slice(1).map((line, curIdx) => {
    const values = parseCSVLine(line);
    const idVal = idIdx !== -1 && values[idIdx] ? values[idIdx] : `H-${201 + curIdx}`;
    const nameVal = nameIdx !== -1 && values[nameIdx] ? values[nameIdx] : `Cardiovascular Failure Candidate #${curIdx + 1}`;
    const ageVal = ageIdx !== -1 ? parseInt(values[ageIdx]) || 68 : 68;
    
    let isMale = true;
    if (sexIdx !== -1 && values[sexIdx]) {
      const s = values[sexIdx].toLowerCase();
      if (s === "0" || s.startsWith("f")) isMale = false;
    } else {
      isMale = curIdx % 2 === 0;
    }
    const genderVal = isMale ? "M" : "F";

    const efVal = efIdx !== -1 ? parseFloat(values[efIdx]) || 25 : 25;
    const isDeathEvent = deIdx !== -1 ? parseInt(values[deIdx]) === 1 : efVal < 30;
    
    const hrVal = hrIdx !== -1 ? parseFloat(values[hrIdx]) || (isDeathEvent ? 108 : 78) : (isDeathEvent ? 102 + (curIdx % 10) : 74 + (curIdx % 8));
    const o2Val = o2Idx !== -1 ? parseFloat(values[o2Idx]) || (isDeathEvent ? 91 : 97) : (isDeathEvent ? 90 + (curIdx % 4) : 96 + (curIdx % 4));
    
    let sbpVal = 120;
    let dbpVal = 80;
    if (sbpIdx !== -1 && values[sbpIdx]) {
      sbpVal = parseFloat(values[sbpIdx]) || 120;
      dbpVal = Math.round(sbpVal * 0.65);
    } else if (hbpIdx !== -1 && parseInt(values[hbpIdx]) === 1) {
      sbpVal = 158;
      dbpVal = 92;
    } else if (isDeathEvent) {
      sbpVal = 90; // cardiogenic shock
      dbpVal = 55;
    }

    const priority: "Critical" | "High Risk" | "Moderate" | "Stable" = isDeathEvent ? "Critical" : (efVal < 35 ? "High Risk" : "Stable");
    const dxVal = dxIdx !== -1 && values[dxIdx] ? values[dxIdx] : `Decompensated CHF (EF: ${efVal}%)`;

    return {
      id: idVal,
      bedId: `Bed ${String(curIdx + 1).padStart(2, "0")}`,
      name: nameVal,
      age: ageVal,
      gender: genderVal,
      dx: dxVal,
      hr: Math.round(hrVal),
      spo2: Math.round(o2Val),
      bpSys: Math.round(sbpVal),
      bpDia: Math.round(dbpVal),
      temp: 36.5 + (curIdx % 5) * 0.1,
      rr: isDeathEvent ? 24 : 16,
      co2: isDeathEvent ? 32 : 38,
      riskScore: isDeathEvent ? 82 + (curIdx % 10) : (efVal < 35 ? 65 + (curIdx % 10) : 12),
      priority,
      spo2History: [Math.min(100, o2Val + 3), Math.min(100, o2Val + 2), Math.min(100, o2Val + 1), o2Val, o2Val],
      hrHistory: [hrVal - 6, hrVal - 3, hrVal, hrVal, hrVal],
      tempHistory: [36.5, 36.6, 36.7, 36.7, 36.7],
      bpSysHistory: [sbpVal + 10, sbpVal + 5, sbpVal, sbpVal, sbpVal],
      alertStatus: isDeathEvent ? "HEART FAILURE EXACERBATION" : "STABLE VIEW"
    };
  });
}

function parseMaternalHealthCSV(text: string): Patient[] {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

  const idIdx = headers.findIndex(h => h.includes("id") || h.includes("patient"));
  const nameIdx = headers.findIndex(h => h.includes("name"));
  const ageIdx = headers.findIndex(h => h.includes("age"));
  const sbpIdx = headers.findIndex(h => h.includes("systolic") || h.includes("sbp"));
  const dbpIdx = headers.findIndex(h => h.includes("diastolic") || h.includes("dbp"));
  const bsIdx = headers.findIndex(h => h.includes("blood") || h.includes("bs") || h.includes("sugar") || h.includes("glucose"));
  const tempIdx = headers.findIndex(h => h.includes("temp") || h.includes("body") || h.includes("fever"));
  const hrIdx = headers.findIndex(h => h.includes("heart") || h.includes("hr") || h.includes("pulse"));
  const riskIdx = headers.findIndex(h => h.includes("risk"));
  const dxIdx = headers.findIndex(h => h.includes("diag") || h.includes("dx"));

  return lines.slice(1).map((line, curIdx) => {
    const values = parseCSVLine(line);
    const idVal = idIdx !== -1 && values[idIdx] ? values[idIdx] : `M-${301 + curIdx}`;
    const nameVal = nameIdx !== -1 && values[nameIdx] ? values[nameIdx] : `High-Risk Maternal Patient #${curIdx + 1}`;
    const ageVal = ageIdx !== -1 ? parseInt(values[ageIdx]) || 28 : 28;
    
    const sbpVal = sbpIdx !== -1 ? parseFloat(values[sbpIdx]) || 140 : 140;
    const dbpVal = dbpIdx !== -1 ? parseFloat(values[dbpIdx]) || 95 : 95;
    
    const tempF = tempIdx !== -1 ? parseFloat(values[tempIdx]) || 98.6 : 98.6;
    let tempC = tempF;
    if (tempF > 45) {
      tempC = (tempF - 32) * 5 / 9;
    }
    
    const hrVal = hrIdx !== -1 ? parseFloat(values[hrIdx]) || 98 : 98;
    const bsVal = bsIdx !== -1 ? parseFloat(values[bsIdx]) || 7.8 : 7.8;
    
    let riskStr = "low risk";
    if (riskIdx !== -1 && values[riskIdx]) {
      riskStr = values[riskIdx].toLowerCase();
    } else {
      if (sbpVal > 135 || tempC > 38.0 || bsVal > 8.0) riskStr = "high risk";
      else if (sbpVal > 125 || bsVal > 6.5) riskStr = "mid risk";
    }

    let priority: "Critical" | "High Risk" | "Moderate" | "Stable" = "Stable";
    let riskScore = 15;
    if (riskStr.includes("high")) {
      priority = "Critical";
      riskScore = 88;
    } else if (riskStr.includes("mid")) {
      priority = "High Risk";
      riskScore = 65;
    } else if (sbpVal > 130) {
      priority = "Moderate";
      riskScore = 40;
    }

    const isHighSugar = bsVal > 7.5;
    const dxVal = dxIdx !== -1 && values[dxIdx] ? values[dxIdx] : 
                  (sbpVal > 138 ? "Pre-eclampsia Risk Monitor" : (isHighSugar ? "Gestational Diabetes Triage" : "Obstetric Monitor"));

    return {
      id: idVal,
      bedId: `Bed ${String(curIdx + 1).padStart(2, "0")}`,
      name: nameVal,
      age: ageVal,
      gender: "F",
      dx: dxVal,
      hr: Math.round(hrVal),
      spo2: 98 - (curIdx % 3),
      bpSys: Math.round(sbpVal),
      bpDia: Math.round(dbpVal),
      temp: parseFloat(tempC.toFixed(1)),
      rr: sbpVal > 135 ? 20 : 16,
      co2: 38,
      riskScore,
      priority,
      spo2History: [98, 98, 98, 98, 98 - (curIdx % 3)],
      hrHistory: [hrVal - 4, hrVal - 2, hrVal, hrVal, hrVal],
      tempHistory: [tempC - 0.2, tempC - 0.1, tempC, tempC, tempC],
      bpSysHistory: [sbpVal + 5, sbpVal + 2, sbpVal, sbpVal, sbpVal],
      alertStatus: priority === "Critical" ? "OBSTETRIC EMERGENCY PRE-ECLAMPSIA" : "NORMAL PREGNANCY"
    };
  });
}

export default function App() {
  // --- Master Patient State ---
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [isDriftPaused, setIsDriftPaused] = useState<boolean>(false);

  // --- Monitored Bed Selection ---
  const [activePatientId, setActivePatientId] = useState<string>("P108"); // starts with Jenkins, Sarah (ICU-08)

  // --- Navigation Tabs ---
  const [activeTab, setActiveTab] = useState<"live" | "table" | "command" | "kaggle" | "presentation">("live");

  // --- Clicked Patient Detail Modal ---
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // --- Filter states ---
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("All");

  // --- Live Clock State ---
  const [timeStr, setTimeStr] = useState("21:42:30");
  const [lookDeepTime, setLookDeepTime] = useState("Restless — 21:40");

  // --- NIBP Timer States & Drift logic ---
  const [nibpSeconds, setNibpSeconds] = useState(300);
  const [nibpMeasuring, setNibpMeasuring] = useState(false);

  // --- Kaggle Lab Live States ---
  const [loadedDatasetName, setLoadedDatasetName] = useState<string>("System Default Simulator Patients");
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [datasetSuccess, setDatasetSuccess] = useState<string | null>(null);
  const [isLabbing, setIsLabbing] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const loadAndInjectDataset = async (datasetKey: "sepsis" | "heart" | "maternal", filename: string) => {
    setIsLabbing(true);
    setDatasetError(null);
    setDatasetSuccess(null);
    try {
      const response = await fetch(`/datasets/${filename}`);
      if (!response.ok) {
        throw new Error(`File /datasets/${filename} not found in public directory. Ensure you place your downloaded *.csv file directly in that path, or use the drag & drop area below to test your file immediately.`);
      }
      const text = await response.text();
      let parsed: Patient[] = [];
      if (datasetKey === "sepsis") {
        parsed = parseSepsisCSV(text);
      } else if (datasetKey === "heart") {
        parsed = parseHeartFailureCSV(text);
      } else if (datasetKey === "maternal") {
        parsed = parseMaternalHealthCSV(text);
      }

      if (parsed.length === 0) {
        throw new Error("Zero clinical rows parsed. Check file structure.");
      }

      const sliced = parsed.slice(0, 20);
      const formatted = sliced.map((p, idx) => ({
        ...p,
        bedId: `Bed ${String(idx + 1).padStart(2, "0")}`
      }));

      setPatients(formatted);
      setActivePatientId(formatted[0].id);
      
      const titleName = datasetKey === "sepsis" ? "PhysioNet Early Sepsis Warning Dataset" :
                       datasetKey === "heart" ? "UCSD Heart Failure Prediction Dataset" :
                       "WHO Maternal Health Risk Dataset";
      setLoadedDatasetName(titleName);
      setDatasetSuccess(`Successfully loaded ${formatted.length} patients from /datasets/${filename}! Primary bed set as LIVE Monitor focus.`);
    } catch (err: any) {
      setDatasetError(err.message || "Failed to load static file. Please place your file or proceed with manual drag-and-drop.");
    } finally {
      setIsLabbing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadedFile(file);
  };

  const processUploadedFile = (file: File) => {
    setIsLabbing(true);
    setDatasetError(null);
    setDatasetSuccess(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setDatasetError("File content is empty.");
        setIsLabbing(false);
        return;
      }
      try {
        const firstLine = text.split("\n")[0].toLowerCase();
        let parsed: Patient[] = [];
        let detected = "Custom Database";

        if (firstLine.includes("sepsis") || firstLine.includes("o2sat") || firstLine.includes("sepsislabel") || firstLine.includes("sbp")) {
          // If Sepsis label is here
          if (firstLine.includes("sepsislabel") || firstLine.includes("hr")) {
            parsed = parseSepsisCSV(text);
            detected = "Uploaded PhysioNet Sepsis Dataset";
          }
        }
        
        if (parsed.length === 0 && (firstLine.includes("ejection") || firstLine.includes("fraction") || firstLine.includes("death_event"))) {
          parsed = parseHeartFailureCSV(text);
          detected = "Uploaded UCSD Heart Failure Record";
        }
        
        if (parsed.length === 0 && (firstLine.includes("systolicbp") || firstLine.includes("bodytemp") || firstLine.includes("risklevel"))) {
          parsed = parseMaternalHealthCSV(text);
          detected = "Uploaded Maternal Health Risk Sheet";
        }

        // Catch-all mapping check
        if (parsed.length === 0) {
          if (firstLine.includes("systolic") || firstLine.includes("diastolic") || firstLine.includes("sugar")) {
            parsed = parseMaternalHealthCSV(text);
            detected = "Custom Maternal Health Sheet (Auto)";
          } else if (firstLine.includes("fraction") || firstLine.includes("heartrate") || firstLine.includes("death")) {
            parsed = parseHeartFailureCSV(text);
            detected = "Custom Cardio Failure Profile (Auto)";
          } else {
            parsed = parseSepsisCSV(text);
            detected = "Annotated Clinical CSV (Auto-mapped)";
          }
        }

        if (parsed.length === 0) {
          throw new Error("Unable to identify table structures. Verify CSV contains valid patient log entries.");
        }

        const sliced = parsed.slice(0, 20);
        const formatted = sliced.map((p, idx) => ({
          ...p,
          bedId: `Bed ${String(idx + 1).padStart(2, "0")}`
        }));

        setPatients(formatted);
        setActivePatientId(formatted[0].id);
        setLoadedDatasetName(detected);
        setDatasetSuccess(`Successfully loaded ${formatted.length} beds from local upload: "${file.name}"!`);
      } catch (err: any) {
        setDatasetError(err.message || "Parsing error. Ensure valid clinical data formats.");
      } finally {
        setIsLabbing(false);
      }
    };
    reader.readAsText(file);
  };

  // --- FRONTEND ML TRAINER LIVE STATES ---
  const [lrSelectedFeatures, setLrSelectedFeatures] = useState<string[]>(["hr", "spo2", "temp", "bpSys", "rr", "age"]);
  const [lrLearningRate, setLrLearningRate] = useState<number>(0.08);
  const [lrEpochs, setLrEpochs] = useState<number>(100);
  const [lrIsTraining, setLrIsTraining] = useState<boolean>(false);
  const [lrCurrentEpoch, setLrCurrentEpoch] = useState<number>(0);
  const [lrLossHistory, setLrLossHistory] = useState<{ epoch: number; loss: number; accuracy: number }[]>([]);
  const [lrWeights, setLrWeights] = useState<Record<string, number>>({});
  const [lrBias, setLrBias] = useState<number>(0);
  const [lrConfusionMatrix, setLrConfusionMatrix] = useState<{ tp: number; fp: number; tn: number; fn: number } | null>(null);
  const [lrAccuracy, setLrAccuracy] = useState<number | null>(null);
  const [lrPredictionScore, setLrPredictionScore] = useState<number | null>(null);

  // --- BACKEND AI PROGNOSIS STATES ---
  const [backendPrognosis, setBackendPrognosis] = useState<any>(null);
  const [isPrognosing, setIsPrognosing] = useState<boolean>(false);
  const [prognosisError, setPrognosisError] = useState<string | null>(null);

  // Get active patient object
  const activePatient = patients.find(p => p.id === activePatientId) || patients[0];
  const { hr, spo2, bpSys: nibpSys, bpDia: nibpDia, temp, rr, co2, riskScore: ediScore } = activePatient;

  const predictActivePatient = (w: Record<string, number>, b: number) => {
    if (!activePatient) return;
    const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
    let z = b;
    
    // Normalize helpers matching normalizer steps
    const hrVal = Math.max(0, Math.min(1, (activePatient.hr - 50) / 100));
    const spo2Val = Math.max(0, Math.min(1, (100 - activePatient.spo2) / 20));
    const tempVal = Math.max(0, Math.min(1, (activePatient.temp - 36.0) / 4.0));
    const bpSysVal = Math.max(0, Math.min(1, (activePatient.bpSys - 80) / 100));
    const rrVal = Math.max(0, Math.min(1, (activePatient.rr - 10) / 25));
    const ageVal = Math.max(0, Math.min(1, activePatient.age / 100));

    if (w.hasOwnProperty("hr")) z += w["hr"] * hrVal;
    if (w.hasOwnProperty("spo2")) z += w["spo2"] * spo2Val;
    if (w.hasOwnProperty("temp")) z += w["temp"] * tempVal;
    if (w.hasOwnProperty("bpSys")) z += w["bpSys"] * bpSysVal;
    if (w.hasOwnProperty("rr")) z += w["rr"] * rrVal;
    if (w.hasOwnProperty("age")) z += w["age"] * ageVal;

    const prob = sigmoid(z);
    setLrPredictionScore(Math.round(prob * 100));
  };

  const trainFrontendModel = () => {
    if (patients.length === 0) {
      setDatasetError("No patient dataset loaded to train on.");
      return;
    }

    setLrIsTraining(true);
    setLrCurrentEpoch(0);
    setLrLossHistory([]);
    setLrWeights({});
    setLrBias(0);
    setLrConfusionMatrix(null);
    setLrAccuracy(null);

    const features = [...lrSelectedFeatures];
    const weights: Record<string, number> = {};
    features.forEach(f => {
      weights[f] = (Math.random() - 0.5) * 0.1;
    });
    let bias = (Math.random() - 0.5) * 0.1;

    const getNormalizedVal = (p: Patient, feature: string): number => {
      if (feature === "hr") return Math.max(0, Math.min(1, (p.hr - 50) / 100));
      if (feature === "spo2") return Math.max(0, Math.min(1, (100 - p.spo2) / 20));
      if (feature === "temp") return Math.max(0, Math.min(1, (p.temp - 36.0) / 4.0));
      if (feature === "bpSys") return Math.max(0, Math.min(1, (p.bpSys - 80) / 100));
      if (feature === "rr") return Math.max(0, Math.min(1, (p.rr - 10) / 25));
      if (feature === "age") return Math.max(0, Math.min(1, p.age / 100));
      return 0;
    };

    const dataset = patients.map(p => {
      const inputs: Record<string, number> = {};
      features.forEach(f => {
        inputs[f] = getNormalizedVal(p, f);
      });
      const target = (p.priority === "Critical" || p.priority === "High Risk" || p.riskScore > 50) ? 1 : 0;
      return { inputs, target };
    });

    const totalEpochs = lrEpochs;
    const alpha = lrLearningRate;
    const history: { epoch: number; loss: number; accuracy: number }[] = [];
    let currentEpochNum = 0;
    const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

    const runEpochStep = () => {
      if (currentEpochNum >= totalEpochs) {
        let tp = 0, fp = 0, tn = 0, fn = 0;
        let correctCount = 0;

        dataset.forEach(d => {
          let z = bias;
          features.forEach(f => {
            z += (weights[f] || 0) * d.inputs[f];
          });
          const predProb = sigmoid(z);
          const predLabel = predProb >= 0.5 ? 1 : 0;

          if (d.target === 1) {
            if (predLabel === 1) tp++;
            else fn++;
          } else {
            if (predLabel === 0) tn++;
            else fp++;
          }

          if (predLabel === d.target) {
            correctCount++;
          }
        });

        const finalAccuracy = (correctCount / dataset.length) * 100;
        setLrAccuracy(parseFloat(finalAccuracy.toFixed(1)));
        setLrConfusionMatrix({ tp, fp, tn, fn });
        setLrWeights({ ...weights });
        setLrBias(bias);
        setLrIsTraining(false);
        setLrPredictionScore(null);
        
        setTimeout(() => {
          let focalZ = bias;
          const hVal = Math.max(0, Math.min(1, (activePatient.hr - 50) / 100));
          const oVal = Math.max(0, Math.min(1, (100 - activePatient.spo2) / 20));
          const tVal = Math.max(0, Math.min(1, (activePatient.temp - 36.0) / 4.0));
          const bVal = Math.max(0, Math.min(1, (activePatient.bpSys - 80) / 100));
          const rVal = Math.max(0, Math.min(1, (activePatient.rr - 10) / 25));
          const aVal = Math.max(0, Math.min(1, activePatient.age / 100));

          if (weights.hasOwnProperty("hr")) focalZ += weights["hr"] * hVal;
          if (weights.hasOwnProperty("spo2")) focalZ += weights["spo2"] * oVal;
          if (weights.hasOwnProperty("temp")) focalZ += weights["temp"] * tVal;
          if (weights.hasOwnProperty("bpSys")) focalZ += weights["bpSys"] * bVal;
          if (weights.hasOwnProperty("rr")) focalZ += weights["rr"] * rVal;
          if (weights.hasOwnProperty("age")) focalZ += weights["age"] * aVal;

          const prob = sigmoid(focalZ);
          setLrPredictionScore(Math.round(prob * 100));
        }, 50);

        return;
      }

      let totalLoss = 0;
      let correctTrain = 0;
      const dWeights: Record<string, number> = {};
      features.forEach(f => dWeights[f] = 0);
      let dBias = 0;

      dataset.forEach(d => {
        let z = bias;
        features.forEach(f => {
          z += weights[f] * d.inputs[f];
        });
        const pred = sigmoid(z);
        const lossVal = -d.target * Math.log(pred + 1e-15) - (1 - d.target) * Math.log(1 - pred + 1e-15);
        totalLoss += lossVal;

        if ((pred >= 0.5 ? 1 : 0) === d.target) {
          correctTrain++;
        }

        const error = pred - d.target;
        features.forEach(f => {
          dWeights[f] += error * d.inputs[f];
        });
        dBias += error;
      });

      const N = dataset.length;
      totalLoss = totalLoss / N;
      const stepAccuracy = (correctTrain / N) * 100;

      features.forEach(f => {
        weights[f] = weights[f] - alpha * (dWeights[f] / N);
      });
      bias = bias - alpha * (dBias / N);

      currentEpochNum++;
      setLrCurrentEpoch(currentEpochNum);
      
      const stepHistoryObj = { epoch: currentEpochNum, loss: parseFloat(totalLoss.toFixed(4)), accuracy: parseFloat(stepAccuracy.toFixed(1)) };
      history.push(stepHistoryObj);
      setLrLossHistory([...history]);

      if (currentEpochNum % 3 === 0 || currentEpochNum === totalEpochs) {
        setTimeout(runEpochStep, 15);
      } else {
        runEpochStep();
      }
    };

    runEpochStep();
  };

  const runBackendAIPrognosis = async () => {
    setIsPrognosing(true);
    setPrognosisError(null);
    setBackendPrognosis(null);
    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: activePatient.age,
          gender: activePatient.gender,
          hr: activePatient.hr,
          spo2: activePatient.spo2,
          bpSys: activePatient.bpSys,
          bpDia: activePatient.bpDia,
          temp: activePatient.temp,
          rr: activePatient.rr,
          co2: activePatient.co2,
          diagnosis: activePatient.dx,
          name: activePatient.name,
          datasetType: loadedDatasetName
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to retrieve analysis from server clinical endpoint.");
      }

      setBackendPrognosis(data);
    } catch (err: any) {
      setPrognosisError(err.message || "Network failed reading backend prediction. Ensure GEMINI_API_KEY is configured in Secrets.");
    } finally {
      setIsPrognosing(false);
    }
  };

  useEffect(() => {
    if (Object.keys(lrWeights).length > 0) {
      predictActivePatient(lrWeights, lrBias);
    }
  }, [activePatientId]);

  // Refs for drawing loop sync
  const hrRef = useRef(134);
  const spo2Ref = useRef(91);
  const rrRef = useRef(26);
  const co2Ref = useRef(28);

  const ecgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spo2CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const respCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const co2CanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => { hrRef.current = hr; }, [hr]);
  useEffect(() => { spo2Ref.current = spo2; }, [spo2]);
  useEffect(() => { rrRef.current = rr; }, [rr]);
  useEffect(() => { co2Ref.current = co2; }, [co2]);

  // --- Live Clock Updates ---
  useEffect(() => {
    const updateClock = () => {
      const d = new Date();
      setTimeStr(d.toTimeString().split(" ")[0]);
      const curHour = String(d.getHours()).padStart(2, "0");
      const prevMin = String((d.getMinutes() - 1 + 60) % 60).padStart(2, "0");
      const status = d.getMinutes() % 2 === 0 ? "Restless" : "Slight Motion";
      setLookDeepTime(`${status} — ${curHour}:${prevMin}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- NIBP Countdown Timer ---
  useEffect(() => {
    const timer = setInterval(() => {
      setNibpSeconds(prev => {
        if (prev <= 1) {
          setNibpMeasuring(true);
          setTimeout(() => {
            setNibpMeasuring(false);
            // Trigger slight change in NIBP for the active patient
            setPatients(prevP => 
              prevP.map(p => {
                if (p.id === activePatientId) {
                  const s = Math.floor(80 + Math.random() * 8);
                  const d = Math.floor(45 + Math.random() * 6);
                  return { ...p, bpSys: s, bpDia: d };
                }
                return p;
              })
            );
          }, 4000);
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activePatientId]);

  // --- Real-time drift of ALL 20 patients ---
  useEffect(() => {
    if (isDriftPaused) return;
    const driftInterval = setInterval(() => {
      setPatients(prevP => {
        return prevP.map(p => {
          // 1. HR Fluctuation
          let nextHr = p.hr;
          if (p.priority === "Critical" || p.priority === "High Risk") {
            const delta = Math.random() > 0.5 ? 1 : -1;
            nextHr = Math.max(115, Math.min(145, p.hr + delta));
          } else {
            const delta = Math.random() > 0.6 ? 1 : (Math.random() < 0.4 ? -1 : 0);
            nextHr = Math.max(60, Math.min(100, p.hr + delta));
          }

          // 2. SpO2 Fluctuation (with some deteriorating indicators)
          let nextSpo2 = p.spo2;
          const isDeteriorating = ["P101", "P103", "P108", "P112", "P114", "P120"].includes(p.id);
          
          if (isDeteriorating) {
            // Trend downward with minor fluctuations
            if (Math.random() < 0.35) {
              nextSpo2 = Math.max(83, p.spo2 - 1);
            } else if (Math.random() > 0.85) {
              nextSpo2 = Math.min(97, p.spo2 + 1);
            }
          } else {
            // Healthy fluctuation
            if (Math.random() < 0.25) {
              const delta = Math.random() > 0.55 ? 1 : -1;
              nextSpo2 = Math.max(93, Math.min(100, p.spo2 + delta));
            }
          }

          // 3. Temperature Fluctuation
          const tempDelta = Math.random() > 0.5 ? 0.1 : -0.1;
          let nextTemp = p.temp + tempDelta;
          if (p.priority === "Critical" || p.priority === "High Risk") {
            nextTemp = Math.max(38.0, Math.min(39.9, nextTemp));
          } else {
            nextTemp = Math.max(36.2, Math.min(37.6, nextTemp));
          }
          nextTemp = Math.round(nextTemp * 10) / 10;

          // 4. Resp Rate Fluctuation
          let nextRr = p.rr;
          if (Math.random() < 0.3) {
            const rd = Math.random() > 0.5 ? 1 : -1;
            nextRr = Math.max(p.priority === "Critical" ? 20 : 12, Math.min(p.priority === "Critical" ? 32 : 22, p.rr + rd));
          }

          // 5. Histroy array shifts (keep length of last 5)
          const nextSpo2Hist = [...p.spo2History.slice(1), nextSpo2];
          const nextHrHist = [...p.hrHistory.slice(1), nextHr];
          const nextTempHist = [...p.tempHistory.slice(1), nextTemp];

          // Re-estimate priority category dynamically based on clinical severe abnormalities
          let nextPriority: "Critical" | "High Risk" | "Moderate" | "Stable" = p.priority;
          const { severeCount } = getPatientMetrics({ ...p, hr: nextHr, spo2: nextSpo2, temp: nextTemp });
          if (severeCount >= 2 || nextSpo2 < 88) {
            nextPriority = "Critical";
          } else if (severeCount === 1 || nextSpo2 < 93 || nextHr > 115) {
            nextPriority = "High Risk";
          } else if (nextTemp > 37.9 || nextHr > 95) {
            nextPriority = "Moderate";
          } else {
            nextPriority = "Stable";
          }

          return {
            ...p,
            hr: nextHr,
            spo2: nextSpo2,
            temp: nextTemp,
            rr: nextRr,
            priority: nextPriority,
            spo2History: nextSpo2Hist,
            hrHistory: nextHrHist,
            tempHistory: nextTempHist
          };
        });
      });
    }, 3500);

    // Dynamic Risk Score / Epic EDI Index Drift (every 4s)
    const ediDrift = setInterval(() => {
      setPatients(prevP => {
        return prevP.map(p => {
          let nextRisk = p.riskScore;
          if (p.priority === "Critical") {
            const delta = Math.random() > 0.5 ? 2 : -2;
            nextRisk = Math.max(80, Math.min(98, p.riskScore + delta));
          } else if (p.priority === "High Risk") {
            const delta = Math.random() > 0.5 ? 2 : -2;
            nextRisk = Math.max(60, Math.min(79, p.riskScore + delta));
          } else if (p.priority === "Moderate") {
            const delta = Math.random() > 0.5 ? 1 : -1;
            nextRisk = Math.max(30, Math.min(59, p.riskScore + delta));
          } else {
            const delta = Math.random() > 0.5 ? 1 : -1;
            nextRisk = Math.max(4, Math.min(29, p.riskScore + delta));
          }
          return {
            ...p,
            riskScore: nextRisk
          };
        });
      });
    }, 4000);

    return () => {
      clearInterval(driftInterval);
      clearInterval(ediDrift);
    };
  }, [isDriftPaused]);

  // --- Oscilloscope Drawing Loop ---
  useEffect(() => {
    const canvasRefs = [ecgCanvasRef, spo2CanvasRef, respCanvasRef, co2CanvasRef];
    
    const buffers = {
      ecg: new Array(1200).fill(NaN),
      spo2: new Array(1200).fill(NaN),
      resp: new Array(1200).fill(NaN),
      co2: new Array(1200).fill(NaN),
    };
    
    let writePtr = 0;
    let simTime = 0;
    let lastTime = performance.now();
    let frameId = 0;
    let timeAccumulator = 0;

    const sampleRate = 250;
    const sampleStep = 1 / sampleRate;

    const tick = (now: number) => {
      let dt = (now - lastTime) / 1000;
      if (dt > 0.1) dt = 0.1;
      lastTime = now;

      timeAccumulator += dt;
      let samplesToGen = Math.floor(timeAccumulator / sampleStep);
      timeAccumulator -= samplesToGen * sampleStep;

      if (samplesToGen > 50) samplesToGen = 50;

      for (let s = 0; s < samplesToGen; s++) {
        simTime += sampleStep;

        const currentHR = hrRef.current;
        const beatPeriod = 60 / currentHR;
        
        // 1. ECG Morphological Generation (Gaussian peaks)
        const pEcg = (simTime % beatPeriod) / beatPeriod;
        let ecgVal = 0;
        if (pEcg >= 0.12 && pEcg < 0.22) {
          ecgVal += 0.12 * Math.exp(-Math.pow((pEcg - 0.17) / 0.02, 2));
        }
        if (pEcg >= 0.32 && pEcg < 0.35) {
          ecgVal -= 0.08 * Math.exp(-Math.pow((pEcg - 0.34) / 0.01, 2));
        }
        if (pEcg >= 0.35 && pEcg < 0.39) {
          ecgVal += 1.35 * Math.exp(-Math.pow((pEcg - 0.375) / 0.006, 2));
        }
        if (pEcg >= 0.39 && pEcg < 0.43) {
          ecgVal -= 0.28 * Math.exp(-Math.pow((pEcg - 0.405) / 0.007, 2));
        }
        if (pEcg >= 0.50 && pEcg < 0.70) {
          ecgVal += 0.32 * Math.exp(-Math.pow((pEcg - 0.60) / 0.045, 2));
        }
        if (pEcg >= 0.70 && pEcg < 0.85) {
          ecgVal += 0.03 * Math.exp(-Math.pow((pEcg - 0.77) / 0.03, 2));
        }
        ecgVal += (Math.random() - 0.5) * 0.015;
        buffers.ecg[writePtr] = ecgVal;

        // 2. SPO2 Pleth
        const tSpo2 = simTime - 0.08;
        const pSpo2 = ((tSpo2 % beatPeriod) + beatPeriod) % beatPeriod / beatPeriod;
        let spo2Val = 0;
        if (pSpo2 < 0.22) {
          spo2Val = Math.sin((pSpo2 / 0.22) * Math.PI / 2);
        } else {
          const x = (pSpo2 - 0.22) / 0.78;
          const decay = Math.cos(x * Math.PI / 2);
          const notch = 0.22 * Math.exp(-Math.pow((x - 0.22) / 0.08, 2));
          spo2Val = decay + notch;
        }
        const scale = spo2Ref.current / 100;
        spo2Val = spo2Val * scale + (Math.random() - 0.5) * 0.006;
        buffers.spo2[writePtr] = spo2Val;

        // 3. Thoracic Impedance Resp
        const currentRR = rrRef.current;
        const respPeriod = 60 / currentRR;
        const pResp = (simTime % respPeriod) / respPeriod;
        const respVal = Math.sin(pResp * 2 * Math.PI) * 0.38 + 0.5 + (Math.random() - 0.5) * 0.005;
        buffers.resp[writePtr] = respVal;

        // 4. Capnograph EtCO2
        let co2Val = 0;
        if (pResp < 0.42) {
          const riseFactor = Math.min(1, pResp / 0.06);
          const plateau = 0.96 + 0.04 * (pResp / 0.42);
          co2Val = riseFactor * plateau;
        } else if (pResp < 0.46) {
          const fallFactor = 1 - (pResp - 0.42) / 0.04;
          co2Val = Math.max(0, fallFactor);
        } else {
          co2Val = 0;
        }
        co2Val += (Math.random() - 0.5) * 0.006;
        buffers.co2[writePtr] = co2Val;

        writePtr = (writePtr + 1) % 1200;
      }

      const gapSize = 30;
      for (let g = 0; g < gapSize; g++) {
        const idx = (writePtr + g) % 1200;
        buffers.ecg[idx] = NaN;
        buffers.spo2[idx] = NaN;
        buffers.resp[idx] = NaN;
        buffers.co2[idx] = NaN;
      }

      // Draw loop
      for (let k = 0; k < 4; k++) {
        const canvas = canvasRefs[k].current;
        if (!canvas) continue;

        const parent = canvas.parentElement;
        if (parent) {
          const dpr = window.devicePixelRatio || 1;
          const rect = parent.getBoundingClientRect();
          const w = Math.floor(rect.width);
          const h = Math.floor(rect.height);
          if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
          }
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        const w = canvas.width;
        const h = canvas.height;
        
        // Crisp high-contrast background & mesh coordinate grid lines
        ctx.fillStyle = "#FAFAFA"; 
        ctx.fillRect(0, 0, w, h);
        
        ctx.strokeStyle = "#E2E8F0"; // Very soft slate grid lines
        ctx.lineWidth = 0.8;
        // Verticals
        for (let gx = 0; gx < w; gx += 30) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, h);
          ctx.stroke();
        }
        // Horizontals
        for (let gy = 0; gy < h; gy += 20) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(w, gy);
          ctx.stroke();
        }

        ctx.lineWidth = 2.4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (k === 0) ctx.strokeStyle = "#059669"; // Rich emerald green
        else if (k === 1) ctx.strokeStyle = "#0284C7"; // Readable ocean blue
        else if (k === 2) ctx.strokeStyle = "#7C3AED"; // Clear royal violet
        else if (k === 3) ctx.strokeStyle = "#EA580C"; // Saturated dark orange

        ctx.beginPath();
        let insideLine = false;

        for (let i = 0; i < 1199; i++) {
          let val = 0;
          if (k === 0) val = buffers.ecg[i];
          else if (k === 1) val = buffers.spo2[i];
          else if (k === 2) val = buffers.resp[i];
          else if (k === 3) val = buffers.co2[i];

          if (isNaN(val)) {
            if (insideLine) {
              ctx.stroke();
              ctx.beginPath();
              insideLine = false;
            }
            continue;
          }

          const x = (i / 1200) * w;
          let y = 0;

          if (k === 0) {
            y = 0.62 * h - val * h * 0.35;
          } else if (k === 1) {
            y = 0.82 * h - val * h * 0.55;
          } else if (k === 2) {
            y = 0.85 * h - val * h * 0.70;
          } else if (k === 3) {
            y = 0.88 * h - val * h * 0.72;
          }

          if (!insideLine) {
            ctx.moveTo(x, y);
            insideLine = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        if (insideLine) {
          ctx.stroke();
        }
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // --- Dynamic MAP calculation ---
  const calculatedMap = Math.round((2 * nibpDia + nibpSys) / 3);

  // --- Epic EDI Color & Status dynamically based on active bed score ---
  let ediColor = "#00E676";
  let ediRiskText = "LOW RISK";
  if (ediScore > 68) {
    ediColor = "#FF5252";
    ediRiskText = "HIGH RISK";
  } else if (ediScore >= 38) {
    ediColor = "#FFD740";
    ediRiskText = "INTERMEDIATE RISK";
  }

  const ediR = 30;
  const ediCircum = 2 * Math.PI * ediR;
  const ediOffset = ediCircum - (ediScore / 100) * ediCircum;

  // --- Active Alarms on Active Patient ---
  const activeAlarmsSummary = [
    { label: "SYS LOW", level: "critical", active: nibpSys < 90 },
    { label: "TACHYCARDIA", level: "critical", active: hr > 120 },
    { label: "SPO2 DESAT", level: "warning", active: spo2 < 93 },
    { label: "FEVER HIGH", level: "warning", active: temp > 38.0 },
  ];

  // --- Filter and Sort Patients for the Board/Command views ---
  const priorityOrder = { "Critical": 0, "High Risk": 1, "Moderate": 2, "Stable": 3 };
  
  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.bedId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = priorityFilter === "All" || p.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const sortedPatients = [...filteredPatients].sort((a, b) => {
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const selectedPatient = patients.find(p => p.id === selectedPatientId) || null;

  return (
    <div id="pac-monitor-root" className="h-screen w-screen bg-[#F1F5F9] flex flex-col text-slate-800 font-sans select-none overflow-hidden relative">
      <style>{`
        @keyframes alarm-flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .animate-alarm-flash {
          animation: alarm-flash 0.9s infinite ease-in-out;
        }
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.35); opacity: 1; }
        }
        .animate-pulse-dot {
          animation: pulse-dot ${Math.max(0.4, 60 / hr).toFixed(2)}s infinite ease-in-out;
        }
      `}</style>

      {/* --- TOPBAR (44px) --- */}
      <header id="topbar" className="h-[44px] border-b border-slate-200 px-4 flex items-center justify-between bg-white shadow-sm z-10 text-slate-800 shrink-0">
        <div className="flex items-center space-x-4 text-[11px] h-full">
          <div className="flex flex-col select-none justify-center">
            <span className="font-bold text-[12px] tracking-wider text-slate-900 font-mono">CARESYNC AI</span>
            <span className="text-[7.5px] text-emerald-600 font-bold tracking-widest uppercase font-mono">COMMAND CENTER</span>
          </div>

          {/* Tab Switchers */}
          <div className="flex h-full border-l border-slate-200 ml-2">
            <button
              onClick={() => setActiveTab("live")}
              className={`px-3 text-[9.5px] font-bold tracking-wider uppercase h-full transition-all border-r border-slate-100 font-mono ${
                activeTab === "live"
                  ? "bg-[#E6F4EA] text-[#059669] border-b-2 border-[#10B981]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              Live Monitor
            </button>
            <button
              onClick={() => setActiveTab("table")}
              className={`px-3 text-[9.5px] font-bold tracking-wider uppercase h-full transition-all border-r border-slate-100 font-mono ${
                activeTab === "table"
                  ? "bg-[#FFF4E5] text-[#D97706] border-b-2 border-[#F59E0B]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              Patient Board
            </button>
            <button
              onClick={() => setActiveTab("command")}
              className={`px-3 text-[9.5px] font-bold tracking-wider uppercase h-full transition-all border-r border-slate-100 font-mono ${
                activeTab === "command"
                  ? "bg-[#F3E8FF] text-[#6D28D9] border-b-2 border-[#8B5CF6]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              ICU beds
            </button>
            <button
              onClick={() => setActiveTab("kaggle")}
              className={`px-3 text-[9.5px] font-bold tracking-wider uppercase h-full transition-all border-r border-slate-100 font-mono ${
                activeTab === "kaggle"
                  ? "bg-[#FEFCE8] text-[#A16207] border-b-2 border-[#EAB308]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              Kaggle Lab
            </button>
            <button
              onClick={() => {
                setActiveTab("presentation");
                setCurrentSlide(0);
              }}
              className={`px-3 text-[9.5px] font-bold tracking-wider uppercase h-full transition-all border-r border-slate-100 font-mono ${
                activeTab === "presentation"
                  ? "bg-slate-100 text-slate-800 border-b-2 border-slate-600 font-extrabold"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              Innovation Deck
            </button>
          </div>

          <div className="border-l border-slate-200 pl-4 hidden md:flex items-center space-x-1">
            <span className="text-slate-400">ACTIVE: </span>
            <span className="font-semibold text-slate-800">{activePatient.name}</span>
            <span className="text-[9px] bg-red-50 px-1.5 py-0.2 border border-red-200 tracking-normal text-red-600 font-bold ml-1 rounded-sm uppercase font-mono">
              {activePatient.bedId.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Alarms, Dot Pulse, Live clock */}
        <div className="flex items-center space-x-3">
          {/* Active flashing alarm pills of the ACTIVELY MONITORED patient right now */}
          <div id="alarm-pills-container" className="flex items-center space-x-2">
            {activeAlarmsSummary.map((alarm, idx) => {
              if (!alarm.active) return null;
              const isCrit = alarm.level === "critical";
              return (
                <div 
                  key={idx} 
                  onClick={() => setSelectedPatientId(activePatient.id)}
                  className={`px-2 py-0.5 text-[8.5px] font-bold border rounded-sm flex items-center space-x-1 cursor-pointer transition-colors font-mono ${
                    isCrit 
                      ? "bg-red-50 text-red-600 border-red-300 hover:bg-red-100 animate-alarm-flash"
                      : "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 animate-alarm-flash"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  <span>{activePatient.bedId}: {alarm.label}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center space-x-1.5 border-l border-slate-200 pl-3">
            <span className="text-[9px] text-slate-400 font-bold font-mono">PULSE</span>
            <div className="relative flex items-center justify-center w-3 h-3">
              <span className="absolute w-2 h-2 bg-[#10B981] rounded-full animate-pulse-dot"></span>
              <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full"></span>
            </div>
          </div>

          <div className="flex items-center space-x-2 border-l border-slate-200 pl-3 text-sm text-slate-500 font-bold tracking-wider select-none font-mono">
            <Clock size={12} className="text-slate-400" />
            <span id="systime-clock" className="text-[12px]">{timeStr}</span>
          </div>
        </div>
      </header>

      {/* --- CLINICAL OPERATIONS AND CONTROLS CONSOLE BAR --- */}
      <div id="controls-bar" className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 z-10 text-[9.5px] shrink-0 font-mono shadow-sm">
        <div className="flex items-center space-x-3">
          <span className="font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1">
            <Activity size={12} className="text-emerald-600 animate-pulse" />
            <span>Clinical Simulation Drift Control:</span>
          </span>
          {/* Pause / Resume buttons */}
          <div className="flex bg-white border border-slate-250 rounded-sm p-0.5 shadow-sm">
            <button
              onClick={() => {
                setIsDriftPaused(false);
                setDatasetSuccess("Telemetry simulation drift values resumed successfully.");
              }}
              className={`px-3 py-1 font-bold rounded-sm cursor-pointer transition-all ${!isDriftPaused ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-[#F8FAFC]'}`}
            >
              RUN SIMULATION
            </button>
            <button
              onClick={() => {
                setIsDriftPaused(true);
                setDatasetSuccess("Telemetry data streams frozen (Simulation drift paused). Feel free to inspect metrics safely.");
              }}
              className={`px-3 py-1 font-bold rounded-sm cursor-pointer transition-all ${isDriftPaused ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-600 hover:bg-[#F8FAFC]'}`}
            >
              FREEZE STREAMS
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3 flex-wrap">
          {/* Quick Vital Inj. for live monitor selected patient */}
          <div className="flex items-center space-x-1.5 bg-white border border-slate-250 px-2 py-1 rounded-sm shadow-sm">
            <span className="text-slate-500 uppercase font-bold text-[8.5px]">Inject HR (BPM):</span>
            <input
              type="number"
              value={activePatient.hr}
              onChange={(e) => {
                const val = Math.max(30, Math.min(220, parseInt(e.target.value) || 80));
                setPatients(prev => prev.map(p => p.id === activePatientId ? { ...p, hr: val } : p));
                setDatasetSuccess(`Injected custom Heart Rate of ${val} BPM for active patient ${activePatient.name}`);
              }}
              className="w-12 text-center bg-[#F8FAFC] border border-slate-300 text-slate-900 font-bold font-mono focus:outline-none py-0.5 rounded-sm"
            />
          </div>

          <div className="flex items-center space-x-1.5 bg-white border border-slate-250 px-2 py-1 rounded-sm shadow-sm">
            <span className="text-slate-500 uppercase font-bold text-[8.5px]">SpO₂ (%):</span>
            <input
              type="number"
              value={activePatient.spo2}
              onChange={(e) => {
                const val = Math.max(50, Math.min(100, parseInt(e.target.value) || 98));
                setPatients(prev => prev.map(p => p.id === activePatientId ? { ...p, spo2: val } : p));
                setDatasetSuccess(`Injected custom SpO₂ of ${val}% for active patient ${activePatient.name}`);
              }}
              className="w-12 text-center bg-[#F8FAFC] border border-slate-300 text-slate-900 font-bold font-mono focus:outline-none py-0.5 rounded-sm"
            />
          </div>

          {/* Core undo button */}
          <button
            onClick={() => {
              setPatients(initialPatients);
              setActivePatientId("P108");
              setLoadedDatasetName("System Default Simulator Patients");
              setLrWeights({});
              setLrBias(0);
              setLrAccuracy(null);
              setLrConfusionMatrix(null);
              setLrLossHistory([]);
              setLrPredictionScore(null);
              setDatasetSuccess("Reverted ICU ward database & machine learning weights back to baseline pristine defaults!");
              setDatasetError(null);
            }}
            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-800 font-bold uppercase transition-all rounded-sm flex items-center space-x-1 cursor-pointer shadow-sm"
            title="Instant easy reversal: reverts all parameters, patient details, and simulation to default system state."
          >
            <RefreshCw size={11} className="mr-0.5" />
            <span>Reset Database Defaults</span>
          </button>
        </div>
      </div>

      {/* --- GLOBAL REAL-TIME FEEDBACK ALERT BAR (Informative Feedback) --- */}
      {(datasetSuccess || datasetError) && (
        <div className={`px-4 py-2 border-b text-[10px] font-semibold flex items-center justify-between transition-all duration-300 shrink-0 font-mono ${
          datasetSuccess 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          <div className="flex items-center space-x-2">
            {datasetSuccess ? <CheckCircle size={13} className="text-emerald-600 animate-bounce" /> : <AlertCircle size={13} className="text-red-600 animate-pulse" />}
            <span>{datasetSuccess || datasetError}</span>
          </div>
          <button 
            onClick={() => { setDatasetSuccess(null); setDatasetError(null); }}
            className="text-slate-400 hover:text-slate-600 font-bold p-0.5 cursor-pointer ml-4"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* --- BODY (fills remaining height) --- */}
      <main id="monitor-body" className="flex-1 flex overflow-hidden">
        
        {/* WAVEFORMS SECTION (Changes based on selected tab) */}
        <section id="waveform-column" className="flex-1 relative flex flex-col h-full border-r border-slate-200 bg-[#F8FAFC] overflow-y-auto">
          
          {/* TAB 1: LIVE OUTPATIANCE OSCILLOSCOPE */}
          {activeTab === "live" && (
            <div className="flex-1 grid grid-rows-4 h-full relative">
              {/* Wave 1: ECG II */}
              <div id="wave-row-ecg" className="relative border-b border-slate-200 flex flex-col justify-between p-2 pb-0">
                <div className="flex justify-between items-start z-10 pointer-events-none">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold tracking-wider text-[#059669]">ECG · LEAD II</span>
                    <span className="text-[7.5px] text-slate-400 font-bold">X1.0 · FILTERED</span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-sm font-bold text-[#059669]">{hr}</span>
                    <span className="text-[8px] text-slate-400 font-bold">BPM</span>
                  </div>
                </div>
                <div className="flex-1 w-full relative">
                  <canvas ref={ecgCanvasRef} className="absolute top-0 left-0 w-full h-full" />
                </div>
              </div>

              {/* Wave 2: SpO2 */}
              <div id="wave-row-spo2" className="relative border-b border-slate-200 flex flex-col justify-between p-2 pb-0">
                <div className="flex justify-between items-start z-10 pointer-events-none">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold tracking-wider text-[#0284C7]">SPO2 · PLETH</span>
                    <span className="text-[7.5px] text-slate-400 font-bold">PLETH WAVEFORM</span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-sm font-bold text-[#0284C7]">{spo2}%</span>
                  </div>
                </div>
                <div className="flex-1 w-full relative">
                  <canvas ref={spo2CanvasRef} className="absolute top-0 left-0 w-full h-full" />
                </div>
              </div>

              {/* Wave 3: Resp */}
              <div id="wave-row-resp" className="relative border-b border-slate-200 flex flex-col justify-between p-2 pb-0">
                <div className="flex justify-between items-start z-10 pointer-events-none">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold tracking-wider text-[#7C3AED]">RESP · THORACIC</span>
                    <span className="text-[7.5px] text-slate-400 font-bold">IMPEDANCE SENSOR</span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-sm font-bold text-[#7C3AED]">{rr}</span>
                    <span className="text-[8px] text-slate-400 font-bold">/MIN</span>
                  </div>
                </div>
                <div className="flex-1 w-full relative">
                  <canvas ref={respCanvasRef} className="absolute top-0 left-0 w-full h-full" />
                </div>
              </div>

              {/* Wave 4: CO2 */}
              <div id="wave-row-co2" className="relative flex flex-col justify-between p-2 pb-0">
                <div className="flex justify-between items-start z-10 pointer-events-none">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold tracking-wider text-[#EA580C]">CO2 · CAPNOGRAPH</span>
                    <span className="text-[7.5px] text-slate-400 font-bold">SIDESTREAM INFRARED</span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-xs font-bold text-[#EA580C]">{co2}</span>
                    <span className="text-[8px] text-slate-400 font-bold">mmHg</span>
                  </div>
                </div>
                <div className="flex-1 w-full relative">
                  <canvas ref={co2CanvasRef} className="absolute top-0 left-0 w-full h-full" />
                </div>
              </div>

              {/* Floating EPIC EDI Gauge */}
              <div id="floating-edi-panel" style={{ contentVisibility: "auto" }} className="absolute top-3 right-3 w-[140px] bg-white/94 backdrop-blur-sm border border-slate-200 p-2.5 z-20 flex flex-col select-none text-slate-800 shadow-md rounded-sm">
                <div className="text-[8px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between font-mono">
                  <span>EDI · EPIC</span>
                  <span className="scale-75 text-[#DC2626] font-extrabold animate-pulse">LIVE</span>
                </div>

                {/* Donut */}
                <div className="relative w-[90px] h-[90px] mx-auto mt-1.5 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="45" cy="45" r={ediR} stroke="#F1F5F9" strokeWidth="4.5" fill="transparent" />
                    <circle
                      cx="45"
                      cy="45"
                      r={ediR}
                      stroke={ediColor}
                      strokeWidth="5"
                      strokeDasharray={ediCircum}
                      strokeDashoffset={ediOffset}
                      fill="transparent"
                      strokeLinecap="square"
                      className="transition-all duration-1000 ease-in-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[20px] font-bold font-mono" style={{ color: ediColor }}>
                      {ediScore}
                    </span>
                    <span className="text-[6.5px] text-slate-400 font-bold tracking-wide font-mono">INDEX</span>
                  </div>
                </div>

                <div className="text-center text-[7.5px] font-bold tracking-wide mt-1 font-mono" style={{ color: ediColor }}>
                  {ediRiskText}
                </div>

                <div className="h-[2.5px] w-full bg-slate-100 mt-1.5 overflow-hidden rounded-full">
                  <div className="h-full transition-all duration-1000 ease-in-out" style={{ width: `${ediScore}%`, backgroundColor: ediColor }}></div>
                </div>

                {/* Flaq pills */}
                <div className="flex flex-col space-y-1 mt-2 text-[7px] font-bold font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">MAP CRITICAL</span>
                    <span className="px-1 py-0.2 bg-red-50 text-red-600 border border-red-200 rounded-sm">RED</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">HR EXTRA-HIGH</span>
                    <span className="px-1 py-0.2 bg-red-50 text-red-600 border border-red-200 rounded-sm">RED</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">RESP ELEVATED</span>
                    <span className="px-1 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded-sm">AMBER</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MULTIPLE PATIENTS BOARD TABLE */}
          {activeTab === "table" && (
            <div className="p-4 flex flex-col h-full bg-[#F8FAFC] text-slate-800">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-xs font-bold tracking-widest text-[#EA580C] uppercase font-mono">Simulated Ward Patients</h2>
                  <p className="text-[9px] text-slate-400 font-bold">20 Beds sorted by priority (Critical first) &bull; Updates live every 3.5s</p>
                </div>

                {/* Filter and Search Controls */}
                <div className="flex items-center space-x-2 mt-2 md:mt-0 w-full md:w-auto font-mono">
                  <div className="relative flex items-center bg-white border border-slate-200 px-2 py-1 rounded-sm shadow-sm">
                    <Search size={11} className="text-slate-400 mr-1.5" />
                    <input 
                      type="text" 
                      placeholder="Search patient / bed..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-transparent text-[10px] focus:outline-none w-32 placeholder-slate-400 text-slate-800 font-bold"
                    />
                  </div>
                  <select 
                    value={priorityFilter} 
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="bg-white border border-slate-200 px-2 py-1 text-[10px] text-slate-700 focus:outline-none rounded-sm shadow-sm font-bold cursor-pointer"
                  >
                    <option value="All">All Vitals</option>
                    <option value="Critical">Critical Only</option>
                    <option value="High Risk">High Risk Only</option>
                    <option value="Moderate">Moderate Only</option>
                    <option value="Stable">Stable Only</option>
                  </select>
                </div>
              </div>

              {/* Patient Grid Table */}
              <div className="flex-1 overflow-auto border border-slate-200 bg-white rounded-sm shadow-sm">
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[8px] text-slate-400 font-extrabold uppercase tracking-widest font-mono">
                      <th className="p-2.5">Bed / ID</th>
                      <th className="p-2.5">Patient Name</th>
                      <th className="p-2.5">Age/Sex</th>
                      <th className="p-2.5 text-center">HR</th>
                      <th className="p-2.5 text-center">SpO₂</th>
                      <th className="p-2.5 text-center">BP</th>
                      <th className="p-2.5 text-center">Temp</th>
                      <th className="p-2.5 text-center">Resp</th>
                      <th className="p-2.5 text-center">EDI Score</th>
                      <th className="p-2.5">Specialist</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {sortedPatients.map((p) => {
                      const metrics = getPatientMetrics(p);
                      const isAlerting = p.priority === "Critical" || p.priority === "High Risk";
                      
                      // Row highlighting if warning is active
                      const isActivelySelectedOnMonitor = p.id === activePatientId;
                      
                      let colorHex = "#059669"; // green
                      let bgClass = "bg-green-50";
                      let borderClass = "border-green-200";
                      if (p.priority === "Critical") {
                        colorHex = "#DC2626";
                        bgClass = "bg-red-50";
                        borderClass = "border-red-200";
                      } else if (p.priority === "High Risk") {
                        colorHex = "#D97706";
                        bgClass = "bg-amber-50";
                        borderClass = "border-amber-200";
                      } else if (p.priority === "Moderate") {
                        colorHex = "#A16207";
                        bgClass = "bg-yellow-50";
                        borderClass = "border-yellow-200";
                      }

                      return (
                        <tr 
                          key={p.id} 
                          className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                            isActivelySelectedOnMonitor ? "bg-emerald-50/40 border-l-2 border-emerald-500" : ""
                          }`}
                          onClick={() => setSelectedPatientId(p.id)}
                        >
                          <td className="p-2.5 font-bold">
                            <span className="text-red-600 font-extrabold">{p.bedId}</span>
                            <div className="text-[7.5px] text-slate-400 font-bold">{p.id}</div>
                          </td>
                          <td className="p-2.5 font-bold text-slate-800">
                            {p.name}
                            {metrics.spo2Deteriorating && (
                              <span className="ml-1.5 inline-flex items-center text-[7.2px] font-bold text-[#D97706] bg-amber-50 px-1 py-0.2 border border-amber-200 animate-pulse rounded-sm">
                                ⚠ DETERIORATING
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-500 font-semibold">{p.age}y / {p.gender}</td>
                          
                          {/* HR value column */}
                          <td className="p-2.5 text-center font-bold" style={{ color: p.hr > 120 || p.hr < 60 ? "#DC2626" : "#059669" }}>
                            {p.hr}
                          </td>

                          {/* SpO2 value column */}
                          <td className="p-2.5 text-center font-bold" style={{ color: p.spo2 < 93 ? "#DC2626" : "#0284C7" }}>
                            {p.spo2}%
                          </td>

                          {/* BP value column */}
                          <td className="p-2.5 text-center text-red-600 font-bold">
                            {p.bpSys}/{p.bpDia}
                          </td>

                          {/* Temperature column */}
                          <td className="p-2.5 text-center font-bold text-[#D97706]">
                            {p.temp.toFixed(1)}°C
                          </td>

                          {/* Resp rate column */}
                          <td className="p-2.5 text-center text-[#7C3AED] font-bold">
                            {p.rr}
                          </td>

                          {/* Risk percentage */}
                          <td className="p-2.5 text-center">
                            <span className="font-extrabold px-1.5 py-0.2 bg-slate-50 border border-slate-200 rounded-sm" style={{ color: colorHex }}>
                              {p.riskScore}%
                            </span>
                          </td>

                          {/* Recommended specialist with prominence */}
                          <td className="p-2.5">
                            <span className="text-[8.5px] font-bold px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-sm">
                              {metrics.specialist}
                            </span>
                          </td>

                          {/* Actions column */}
                          <td className="p-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end space-x-1 font-mono">
                              <button 
                                onClick={() => {
                                  setActivePatientId(p.id);
                                  setActiveTab("live");
                                }}
                                className="px-2 py-0.5 border border-slate-200 bg-white hover:bg-emerald-600 hover:text-white hover:border-emerald-700 font-bold text-[8px] uppercase tracking-wider text-slate-700 shadow-sm rounded-sm transition-all cursor-pointer"
                              >
                                Monitor
                              </button>
                              <button 
                                onClick={() => setSelectedPatientId(p.id)}
                                className="px-2 py-0.5 border border-slate-200 bg-white hover:bg-slate-100 font-bold text-[8px] uppercase text-slate-600 shadow-sm rounded-sm transition-all cursor-pointer"
                              >
                                Detail
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: ICU COMMAND CENTER BEDS MATRIX MAP */}
          {activeTab === "command" && (
            <div className="p-4 flex flex-col h-full bg-[#F8FAFC]">
              <div className="mb-4 pb-2 border-b border-slate-200">
                <h2 className="text-xs font-bold tracking-widest text-[#7C3AED] uppercase font-mono">ACTIVE BED DISPATCH BOARD</h2>
                <p className="text-[8.5px] text-slate-400 font-bold">Real-time occupancy status &bull; Click on any Bed to view clinical indicators and details</p>
              </div>

              {/* Grid map for 20 beds */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 flex-1 overflow-y-auto pr-1">
                {patients.map((p) => {
                  const metrics = getPatientMetrics(p);
                  const activeOnMonitor = p.id === activePatientId;
                  
                  // Color codes
                  let statusColor = "#059669"; // green
                  let borderClr = "border-slate-200";
                  let pillBg = "bg-green-50 text-green-700 border-green-200";

                  if (p.priority === "Critical") {
                    statusColor = "#DC2626";
                    borderClr = "border-red-200 shadow-sm shadow-red-50";
                    pillBg = "bg-red-50 text-red-700 border-red-200";
                  } else if (p.priority === "High Risk") {
                    statusColor = "#D97706";
                    borderClr = "border-amber-200 shadow-sm shadow-amber-50";
                    pillBg = "bg-amber-50 text-amber-700 border-amber-200";
                  } else if (p.priority === "Moderate") {
                    statusColor = "#A16207";
                    borderClr = "border-yellow-200 shadow-sm shadow-yellow-50";
                    pillBg = "bg-yellow-50 text-yellow-700 border-yellow-200";
                  }

                  return (
                    <div 
                      key={p.id}
                      onClick={() => setSelectedPatientId(p.id)}
                      className={`relative p-3 bg-white border rounded-sm hover:border-[#7C3AED] transition-all duration-350 cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md ${
                        activeOnMonitor ? "ring-1 ring-emerald-500 bg-[#E6F4EA]/20 border-emerald-300" : borderClr
                      }`}
                    >
                      {/* Bed header */}
                      <div className="flex justify-between items-start font-mono">
                        <div>
                          <span className="text-[12px] font-extrabold text-red-600 uppercase">{p.bedId}</span>
                          <div className="text-[8px] text-slate-400 font-bold">{p.id}</div>
                        </div>
                        {/* Status light LED */}
                        <div className="flex items-center space-x-1.5">
                          <span className={`text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-sm border ${pillBg}`}>
                            {p.priority}
                          </span>
                          <span className="relative flex h-2 w-2">
                            {["Critical", "High Risk"].includes(p.priority) && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: statusColor }}></span>
                            )}
                            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: statusColor }}></span>
                          </span>
                        </div>
                      </div>

                      {/* Patient metadata */}
                      <div className="mt-2 text-[10px] text-slate-800 line-clamp-1 font-bold font-mono">{p.name}</div>
                      <div className="text-[8px] text-slate-400 line-clamp-1 font-bold font-mono">{p.dx}</div>

                      {/* Micro vitals bar */}
                      <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1.5 my-2.5 border border-slate-100 rounded-sm text-[9px] font-mono">
                        <div className="flex flex-col text-center">
                          <span className="text-[7px] text-slate-400 font-bold uppercase">HR</span>
                          <span className="font-extrabold text-[#059669]">{p.hr}</span>
                        </div>
                        <div className="flex flex-col text-center border-l border-r border-slate-100">
                          <span className="text-[7px] text-slate-400 font-bold uppercase">SpO₂</span>
                          <span className="font-extrabold text-[#0284C7]">{p.spo2}%</span>
                        </div>
                        <div className="flex flex-col text-center">
                          <span className="text-[7px] text-slate-400 font-bold uppercase">BP</span>
                          <span className="font-extrabold text-red-600 text-[8.5px]">{p.bpSys}/{p.bpDia}</span>
                        </div>
                      </div>

                      {/* Specialist and risk summary */}
                      <div className="flex justify-between items-center text-[7.5px] mt-1 pt-1.5 border-t border-slate-100 text-slate-400 font-bold font-mono">
                        <span>Risk Score: <b style={{ color: statusColor }}>{p.riskScore}%</b></span>
                        <span className="text-slate-500 border border-slate-200 rounded-sm px-1 bg-slate-50">{metrics.specialist.split(" ")[0]}</span>
                      </div>

                      {/* Live flashing warning warning ribbon */}
                      {metrics.spo2Deteriorating && (
                        <div className="absolute bottom-0 inset-x-0 h-1 bg-[#F59E0B] animate-pulse rounded-b-sm"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: KAGGLE DATASETS WORKSPACE */}
          {activeTab === "kaggle" && (
            <div className="p-4 flex flex-col h-full bg-[#F8FAFC] text-slate-800 overflow-y-auto">
              {/* Header Box */}
              <div className="mb-4 pb-3 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                  <h2 className="text-xs font-bold tracking-widest text-slate-700 uppercase flex items-center space-x-1.5 font-mono">
                    <Database size={14} className="text-[#7C3AED]" />
                    <span>Clinical Kaggle Dataset Lab & Machine Learning Workspace</span>
                  </h2>
                  <p className="text-[9px] text-slate-400 font-bold mt-1">
                    Ingest high-fidelity physiological profiles, train local binary classifiers, and request server-side Gemini decision support diagnostics.
                  </p>
                </div>
                {/* Active Source indicator */}
                <div className="mt-2 md:mt-0 px-2.5 py-1 bg-white border border-slate-200 shadow-sm flex items-center space-x-2 rounded-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[8.5px] uppercase text-slate-400 font-bold">Active Dataset Source: </span>
                  <span className="text-[9.5px] text-emerald-600 font-extrabold">{loadedDatasetName}</span>
                </div>
              </div>

              {/* Success/Error Messaging */}
              {datasetSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 flex items-start space-x-2.5 rounded-sm">
                  <CheckCircle size={14} className="text-green-600 shrink-0 mt-0.5 animate-bounce" />
                  <div className="text-[9px] leading-relaxed text-green-800 font-bold font-mono">{datasetSuccess}</div>
                </div>
              )}
              {datasetError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-250 flex items-start space-x-2.5 rounded-sm">
                  <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5 animate-pulse" />
                  <div className="text-[9px] leading-relaxed text-red-800 font-bold font-mono">{datasetError}</div>
                </div>
              )}

              {/* SECTION 1: INGESTION PIPELINE */}
              <div className="mb-6 font-mono">
                <div className="mb-2 text-[9px] uppercase tracking-wider text-slate-400 font-extrabold">1. Data Ingestion & Sync Pipeline</div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  
                  {/* Dataset 1 Card */}
                  <div className="bg-white border border-slate-200 p-3 flex flex-col justify-between shadow-sm rounded-sm">
                    <div>
                      <div className="flex justify-between items-start mb-1.5 pb-1.5 border-b border-slate-100">
                        <div>
                          <span className="text-[10.5px] font-bold text-emerald-600 block">1. PhysioNet Sepsis detection</span>
                          <span className="text-[7.5px] text-slate-400 font-bold uppercase">Kaggle ID: sepsis-survival-dataset</span>
                        </div>
                        <span className="text-[7.2px] bg-slate-50 px-1 py-0.2 text-slate-500 font-bold border border-slate-200 rounded-sm">CSV</span>
                      </div>
                      <p className="text-[9px] text-slate-600 leading-normal mb-2.5 font-bold font-sans">
                        High-frequency records tracking warning indices for ICU sepsis diagnosis. Maps vitals to early SIRS/qSOFA alerts.
                      </p>
                      <div className="text-[8px] space-y-0.5 text-slate-500 font-semibold mb-3 bg-slate-50/50 p-2 border border-slate-200 rounded-sm">
                        <div><span className="text-emerald-600 font-bold">Vitals:</span> HR, SpO2, Temperature, Blood Pressure, RR</div>
                        <div><span className="text-emerald-600 font-bold">Target Warning:</span> Early-onset systemic septic indices</div>
                      </div>
                    </div>
                    <button
                      onClick={() => loadAndInjectDataset("sepsis", "sepsis.csv")}
                      disabled={isLabbing}
                      className="w-full py-1.5 border border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50 text-emerald-650 font-bold text-[8.5px] uppercase tracking-wider transition-all cursor-pointer rounded-sm shadow-sm bg-white"
                    >
                      {isLabbing ? "Syncing..." : "Load sepsis.csv"}
                    </button>
                  </div>

                  {/* Dataset 2 Card */}
                  <div className="bg-white border border-slate-200 p-3 flex flex-col justify-between shadow-sm rounded-sm">
                    <div>
                      <div className="flex justify-between items-start mb-1.5 pb-1.5 border-b border-slate-100">
                        <div>
                          <span className="text-[10.5px] font-bold text-sky-600 block">2. UCSD Heart Failure Records</span>
                          <span className="text-[7.5px] text-slate-400 font-bold uppercase">Kaggle ID: heart-failure-clinical-data</span>
                        </div>
                        <span className="text-[7.2px] bg-slate-50 px-1 py-0.2 text-slate-500 font-bold border border-slate-200 rounded-sm">CSV</span>
                      </div>
                      <p className="text-[9px] text-slate-600 leading-normal mb-2.5 font-bold font-sans">
                        Clinical variables predicting cardiovascular failure mortality risk. Models ejection fractional and hemodynamic indices.
                      </p>
                      <div className="text-[8px] space-y-0.5 text-slate-500 font-semibold mb-3 bg-slate-50/50 p-2 border border-slate-200 rounded-sm">
                        <div><span className="text-sky-600 font-bold">Vitals:</span> Age, Sex, Heart Rate, SpO2, Systolic BP, Temp</div>
                        <div><span className="text-sky-600 font-bold">Target Warning:</span> Heart Failure risk classification</div>
                      </div>
                    </div>
                    <button
                      onClick={() => loadAndInjectDataset("heart", "heart_failure.csv")}
                      disabled={isLabbing}
                      className="w-full py-1.5 border border-sky-200 hover:border-sky-500 hover:bg-sky-50 text-sky-650 font-bold text-[8.5px] uppercase tracking-wider transition-all cursor-pointer rounded-sm shadow-sm bg-white"
                    >
                      {isLabbing ? "Syncing..." : "Load heart_failure.csv"}
                    </button>
                  </div>

                  {/* Dataset 3 Card */}
                  <div className="bg-white border border-slate-200 p-3 flex flex-col justify-between shadow-sm rounded-sm">
                    <div>
                      <div className="flex justify-between items-start mb-1.5 pb-1.5 border-b border-slate-100">
                        <div>
                          <span className="text-[10.5px] font-bold text-purple-600 block">3. WHO Maternal Health Risk</span>
                          <span className="text-[7.5px] text-slate-400 font-bold uppercase">Kaggle ID: maternal-health-risk-data</span>
                        </div>
                        <span className="text-[7.2px] bg-slate-50 px-1 py-0.2 text-slate-500 font-bold border border-slate-200 rounded-sm">CSV</span>
                      </div>
                      <p className="text-[9px] text-slate-600 leading-normal mb-2.5 font-bold font-sans">
                        Risk factors mapping pre-eclampsia and gestational hypertensive syndromes. Monitors obstetric vitals.
                      </p>
                      <div className="text-[8px] space-y-0.5 text-slate-500 font-semibold mb-3 bg-slate-50/50 p-2 border border-slate-200 rounded-sm">
                        <div><span className="text-purple-600 font-bold">Vitals:</span> Age, BP Systolic/Diastolic, Temp, Core Glucose</div>
                        <div><span className="text-purple-600 font-bold">Target Warning:</span> High-risk maternal pregnancy triage</div>
                      </div>
                    </div>
                    <button
                      onClick={() => loadAndInjectDataset("maternal", "maternal_health.csv")}
                      disabled={isLabbing}
                      className="w-full py-1.5 border border-purple-200 hover:border-purple-500 hover:bg-purple-50 text-purple-650 font-bold text-[8.5px] uppercase tracking-wider transition-all cursor-pointer rounded-sm shadow-sm bg-white"
                    >
                      {isLabbing ? "Syncing..." : "Load maternal_health.csv"}
                    </button>
                  </div>

                </div>

                {/* Direct Upload Dropzone */}
                <div className="mt-3 bg-white border border-dashed border-slate-350 p-4 text-center relative hover:border-[#7C3AED] transition-colors rounded-sm shadow-sm">
                  <input 
                    type="file" 
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center space-y-1.5 pointer-events-none">
                    <UploadCloud size={18} className="text-[#7C3AED] animate-pulse" />
                    <p className="text-[9px] font-bold text-slate-700 uppercase">
                      Drag and Drop downloaded Kaggle clinical CSV here to instantly ingest
                    </p>
                    <p className="text-[7.5px] text-slate-400 font-bold">
                      Auto-converts and injects columns to physiological telemetry matrices.
                    </p>
                  </div>
                </div>
                {/* SECTION 2: THE MACHINE LEARNING EXPERIMENTAL CENTER */}
              <div className="mb-4 text-[9px] uppercase tracking-wider text-slate-400 font-extrabold font-mono">2. Clinical Machine Learning Experimental Lab</div>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1">
                
                {/* PANEL A: FRONTEND GRADIENT DESCENT BINARY CLASSIFIER */}
                <div className="bg-white border border-slate-200 p-4 flex flex-col justify-between rounded-sm shadow-sm">
                  <div>
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 font-mono">
                      <div className="flex items-center space-x-2">
                        <Activity size={13} className="text-[#0284C7]" />
                        <h3 className="text-[11px] font-bold uppercase text-[#0284C7] tracking-wider">Frontend Math Engine (Logistic Regression)</h3>
                      </div>
                      <span className="text-[7px] bg-sky-50 text-[#0284C7] border border-sky-200 px-1.5 py-0.2 uppercase font-extrabold rounded-sm">Local Tensor</span>
                    </div>

                    <p className="text-[9px] text-slate-500 font-semibold leading-relaxed mb-4 font-sans">
                      Train a mathematically real **Logistic Regression Binary Classifier** right in your browser using gradient descent over the current dataset. Clinically predict risk based on customizable vital variables!
                    </p>

                    {/* Features Select & Hyperparams Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4 font-mono">
                      {/* Left: Checkboxes */}
                      <div className="p-2 bg-slate-50 border border-slate-100 rounded-sm">
                        <span className="text-[8px] font-extrabold text-slate-400 uppercase block mb-1.5">Input Features (X)</span>
                        <div className="space-y-1 text-[8px] font-bold text-slate-700">
                          {["hr", "spo2", "temp", "bpSys", "rr", "age"].map((feat) => {
                            const isChecked = lrSelectedFeatures.includes(feat);
                            return (
                              <label key={feat} className="flex items-center space-x-1.5 cursor-pointer uppercase hover:text-slate-900 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setLrSelectedFeatures(lrSelectedFeatures.filter(f => f !== feat));
                                    } else {
                                      setLrSelectedFeatures([...lrSelectedFeatures, feat]);
                                    }
                                  }}
                                  className="accent-[#0284C7] scale-90"
                                />
                                <span>{feat === "bpSys" ? "Systolic BP" : feat}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Right: Slider values */}
                      <div className="p-2 bg-slate-50 border border-slate-100 rounded-sm flex flex-col justify-between">
                        <div>
                          <span className="text-[8px] font-extrabold text-slate-400 uppercase block mb-1">Learning Rate (&alpha;)</span>
                          <select 
                            value={lrLearningRate}
                            onChange={(e) => setLrLearningRate(parseFloat(e.target.value))}
                            className="w-full bg-white border border-slate-250 text-[9px] px-1 py-0.5 text-slate-700 rounded-sm shadow-sm font-bold cursor-pointer"
                          >
                            <option value="0.2">0.20 (Fastest)</option>
                            <option value="0.1">0.10 (Optimized)</option>
                            <option value="0.08">0.08 (Stable)</option>
                            <option value="0.05">0.05 (Fine-tuned)</option>
                            <option value="0.01">0.01 (Conservative)</option>
                          </select>
                        </div>
                        <div className="mt-2">
                          <span className="text-[8px] font-extrabold text-slate-400 uppercase block mb-1">Epochs Counter</span>
                          <select 
                            value={lrEpochs}
                            onChange={(e) => setLrEpochs(parseInt(e.target.value))}
                            className="w-full bg-white border border-slate-250 text-[9px] px-1 py-0.5 text-slate-700 rounded-sm shadow-sm font-bold cursor-pointer"
                          >
                            <option value="50">50 Loops</option>
                            <option value="100">100 Loops</option>
                            <option value="200">200 Loops</option>
                            <option value="500">500 Loops</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Start Training Button */}
                    <button
                      onClick={trainFrontendModel}
                      disabled={lrIsTraining || lrSelectedFeatures.length === 0}
                      className="w-full py-2 bg-gradient-to-r from-sky-600 to-indigo-700 hover:from-sky-500 hover:to-indigo-600 text-white font-extrabold text-[9px] uppercase tracking-wider transition-all cursor-pointer shadow-sm rounded-sm disabled:opacity-40"
                    >
                      {lrIsTraining ? `Iterating Descent... Loop ${lrCurrentEpoch}/${lrEpochs}` : "Run Gradient Descent training loop"}
                    </button>

                    {/* Progress indicators */}
                    {lrLossHistory.length > 0 && (
                      <div className="mt-4 space-y-3 font-mono">
                        {/* Numerical Metrics Status Row */}
                        <div className="flex justify-between items-center text-[9px] bg-slate-50 p-2 border border-slate-200 rounded-sm">
                          <div>
                            <span className="text-slate-400 font-bold">ITERATION: </span>
                            <span className="text-slate-800 font-extrabold">{lrCurrentEpoch}/{lrEpochs}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold">BCE LOSS: </span>
                            <span className="text-[#DC2626] font-extrabold">
                              {lrLossHistory[lrLossHistory.length - 1]?.loss || "0.0000"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold">TRAINING ACC: </span>
                            <span className="text-[#059669] font-extrabold">
                              {lrLossHistory[lrLossHistory.length - 1]?.accuracy || "0.0"}%
                            </span>
                          </div>
                        </div>

                        {/* Live Double SVG Charts Side-by-Side */}
                        <div className="grid grid-cols-2 gap-3.5">
                          {/* Loss Chart */}
                          <div className="bg-slate-50 border border-slate-200 p-2 text-center rounded-sm">
                            <span className="text-[7.5px] font-extrabold text-red-650 block uppercase mb-1">Loss Minimization Path</span>
                            <div className="h-20 w-full relative flex items-end">
                              <svg className="w-full h-full" viewBox="0 0 240 80" preserveAspectRatio="none">
                                {/* Grid lines */}
                                <line x1="0" y1="20" x2="240" y2="20" stroke="#E2E8F0" strokeWidth="0.5" />
                                <line x1="0" y1="40" x2="240" y2="40" stroke="#E2E8F0" strokeWidth="0.5" />
                                <line x1="0" y1="60" x2="240" y2="60" stroke="#E2E8F0" strokeWidth="0.5" />
                                
                                {lrLossHistory.length > 1 && (
                                  <polyline
                                    fill="none"
                                    stroke="#DC2626"
                                    strokeWidth="1.5"
                                    points={(() => {
                                      const width = 240;
                                      const height = 80;
                                      const maxLoss = Math.max(...lrLossHistory.map(h => h.loss), 1);
                                      const minLoss = Math.min(...lrLossHistory.map(h => h.loss), 0);
                                      const lossRange = maxLoss === minLoss ? 1 : (maxLoss - minLoss);
                                      return lrLossHistory.map((h, i) => {
                                        const x = (i / (lrLossHistory.length - 1)) * width;
                                        const y = height - 5 - ((h.loss - minLoss) / lossRange) * (height - 10);
                                        return `${x},${y}`;
                                      }).join(" ");
                                    })()}
                                  />
                                )}
                              </svg>
                              <div className="absolute top-1 right-1 text-[7px] text-slate-400 font-extrabold font-mono">BCE LOSS</div>
                            </div>
                          </div>

                          {/* Accuracy Chart */}
                          <div className="bg-slate-50 border border-slate-200 p-2 text-center rounded-sm">
                            <span className="text-[7.5px] font-extrabold text-emerald-650 block uppercase mb-1">Triage Accuracy Ascent</span>
                            <div className="h-20 w-full relative flex items-end">
                              <svg className="w-full h-full" viewBox="0 0 240 80" preserveAspectRatio="none">
                                {/* Grid lines */}
                                <line x1="0" y1="20" x2="240" y2="20" stroke="#E2E8F0" strokeWidth="0.5" />
                                <line x1="0" y1="40" x2="240" y2="40" stroke="#E2E8F0" strokeWidth="0.5" />
                                <line x1="0" y1="60" x2="240" y2="60" stroke="#E2E8F0" strokeWidth="0.5" />

                                {lrLossHistory.length > 1 && (
                                  <polyline
                                    fill="none"
                                    stroke="#059669"
                                    strokeWidth="1.5"
                                    points={(() => {
                                      const width = 240;
                                      const height = 80;
                                      const maxAcc = Math.max(...lrLossHistory.map(h => h.accuracy), 100);
                                      const minAcc = Math.min(...lrLossHistory.map(h => h.accuracy), 0);
                                      const accRange = maxAcc === minAcc ? 1 : (maxAcc - minAcc);
                                      return lrLossHistory.map((h, i) => {
                                        const x = (i / (lrLossHistory.length - 1)) * width;
                                        const y = height - 5 - ((h.accuracy - minAcc) / accRange) * (height - 10);
                                        return `${x},${y}`;
                                      }).join(" ");
                                    })()}
                                  />
                                )}
                              </svg>
                              <div className="absolute top-1 right-1 text-[7px] text-slate-400 font-extrabold font-mono">ACCURACY %</div>
                            </div>
                          </div>
                        </div>

                        {/* Slopes & Intercept Weight coefficients table */}
                        {Object.keys(lrWeights).length > 0 && (
                          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-sm">
                            <div className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest mb-1">Calculated Weight Parameters / Slopes</div>
                            <div className="grid grid-cols-2 gap-1.5 text-[8.5px] leading-tight">
                              {Object.entries(lrWeights).map(([feat, wVal]) => {
                                const valNum = wVal as number;
                                const isPositive = valNum >= 0;
                                return (
                                  <div key={feat} className="flex justify-between items-center bg-white p-1 border border-slate-100 rounded-sm shadow-sm">
                                    <span className="uppercase text-slate-400 font-extrabold">{feat === "bpSys" ? "Systolic BP" : feat}:</span>
                                    <span className={isPositive ? "text-red-600 font-bold" : "text-emerald-600 font-bold"}>
                                      {isPositive ? "+" : ""}{valNum.toFixed(3)}
                                    </span>
                                  </div>
                                );
                              })}
                              <div className="col-span-2 flex justify-between items-center bg-slate-100 p-1.5 mt-0.5 text-slate-705 border border-slate-250 rounded-sm font-bold">
                                <span className="font-extrabold text-slate-400 uppercase">INTERCEPT (Bias):</span>
                                <span className={lrBias >= 0 ? "text-red-500" : "text-emerald-500"}>{lrBias.toFixed(3)}</span>
                              </div>
                            </div>
                            <p className="text-[7.2px] text-slate-400/80 font-bold mt-2 leading-normal">
                              ⚠️ <span className="text-slate-400 uppercase font-extrabold">Clinical Interpretation:</span> Highly positive values increase diagnostic alert urgency. Negative factors act as stabilizer buffers.
                            </p>
                          </div>
                        )}

                        {/* Confusion Matrix block */}
                        {lrConfusionMatrix && (
                          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-sm">
                            <div className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest mb-1">Confusion Matrix evaluation (Current Bed Database)</div>
                            <div className="grid grid-cols-2 gap-2 text-center text-[9px] font-bold">
                              <div className="p-1.5 bg-green-50 border border-green-200 text-green-800 rounded-sm">
                                <div className="text-[8px] text-green-600 uppercase">True Negatives (TN)</div>
                                <div className="text-lg font-bold text-slate-800">{lrConfusionMatrix.tn}</div>
                                <div className="text-[7.2px] text-green-700">Correctly classified Stable</div>
                              </div>
                              <div className="p-1.5 bg-red-50 border border-red-200 text-red-800 rounded-sm">
                                <div className="text-[8px] text-red-600 uppercase">False Positives (FP)</div>
                                <div className="text-lg font-bold text-slate-800">{lrConfusionMatrix.fp}</div>
                                <div className="text-[7.2px] text-red-700">False Alert triggers</div>
                              </div>
                              <div className="p-1.5 bg-red-50 border border-red-200 text-red-800 rounded-sm">
                                <div className="text-[8px] text-red-600 uppercase">False Negatives (FN)</div>
                                <div className="text-lg font-bold text-slate-800">{lrConfusionMatrix.fn}</div>
                                <div className="text-[7.2px] text-red-700">Undetected danger events</div>
                              </div>
                              <div className="p-1.5 bg-green-50 border border-green-200 text-green-800 rounded-sm">
                                <div className="text-[8px] text-green-600 uppercase">True Positives (TP)</div>
                                <div className="text-lg font-bold text-slate-800">{lrConfusionMatrix.tp}</div>
                                <div className="text-[7.2px] text-green-700">Correctly classified Emergency</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Interactive Patient Predictor Gauge using actual weights */}
                        {lrPredictionScore !== null && (
                          <div className="bg-sky-50 p-3 border border-sky-200 text-[9.5px] rounded-sm">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="font-extrabold text-slate-700">REAL-TIME FRONTEND PREDICTION GAUGE:</span>
                              <span className="text-[8px] uppercase tracking-wider text-sky-700 font-extrabold bg-sky-100 rounded-sm px-1.5 py-0.2">Trained Model</span>
                            </div>
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-bold text-slate-400">Focus bed: </span>
                                <span className="text-sky-600 font-extrabold">{activePatient.bedId}</span>
                                <span className="text-slate-500 font-bold ml-2">({activePatient.name})</span>
                              </div>
                              <div className="text-sm font-bold text-[#059669]">
                                {lrPredictionScore}% Risk index
                              </div>
                            </div>
                            <div className="w-full bg-slate-200 h-2.5 overflow-hidden relative border border-slate-300 rounded-full">
                              <div 
                                className="h-full bg-gradient-to-r from-green-500 via-amber-500 to-red-500 transition-all duration-550"
                                style={{ width: `${lrPredictionScore}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-[7px] text-slate-400 mt-1 uppercase font-extrabold">
                              <span>0% stable</span>
                              <span>50% warning threshold</span>
                              <span>100% vital failure risk</span>
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>

                  {/* Reset defaults inside Model Panel */}
                  <div className="pt-4 border-t border-slate-100 text-right mt-4 font-mono">
                    <button
                      onClick={() => {
                        setPatients(initialPatients);
                        setActivePatientId("P108");
                        setLoadedDatasetName("System Default Simulator Patients");
                        setLrWeights({});
                        setLrBias(0);
                        setLrAccuracy(null);
                        setLrConfusionMatrix(null);
                        setLrLossHistory([]);
                        setLrPredictionScore(null);
                        setDatasetSuccess("Telemetry workspace, patient state database and ML weights reset successfully.");
                      }}
                      className="px-2 py-1 border border-slate-200 bg-white hover:bg-slate-55 text-[8px] uppercase text-slate-500 font-bold shadow-sm rounded-sm transition-colors cursor-pointer"
                    >
                      Reset and Wipe trained weights
                    </button>
                  </div>
                </div>
                </div>

                {/* PANEL B: SECURE BACKEND GEMINI DECISION SUPPORT SYSTEM */}
                <div className="bg-white border border-slate-200 p-4 flex flex-col justify-between rounded-sm shadow-sm">
                  <div>
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 font-mono">
                      <div className="flex items-center space-x-2">
                        <Sparkles size={13} className="text-[#7C3AED]" />
                        <h3 className="text-[11px] font-bold uppercase text-[#7C3AED] tracking-wider">Secure Backend LLM Clinical Co-pilot</h3>
                      </div>
                      <span className="text-[7px] bg-purple-50 text-[#7C3AED] border border-purple-200 px-1.5 py-0.2 uppercase font-extrabold rounded-sm">Gemini Server API</span>
                    </div>

                    <p className="text-[9px] text-slate-500 font-semibold leading-relaxed mb-4 font-sans">
                      Connect directly to the Express server-side prediction proxy. Dispatch full patient parameters (including complex combinations, age demographics, SBP/DBP ratios and diagnosis labels) to trigger **Gemini-3.5-Flash** deep clinical rule analysis.
                    </p>

                    <div className="bg-slate-50 border border-slate-200 p-3 mb-4 text-[9.2px] rounded-sm font-mono">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase block mb-1">Target Assessment Patient</span>
                      <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-800">
                        <div>
                          <span className="text-red-650">{activePatient.bedId}</span> - {activePatient.name} ({activePatient.age}yo {activePatient.gender})
                        </div>
                        <span className="text-[8px] text-[#7C3AED] font-extrabold">{activePatient.dx}</span>
                      </div>
                      <div className="mt-2.5 grid grid-cols-4 gap-1.5 font-mono text-[8.5px] text-slate-500">
                        <div className="bg-white p-1 border border-slate-100 rounded-sm">HR: <span className="text-slate-800 font-bold">{activePatient.hr}</span></div>
                        <div className="bg-white p-1 border border-slate-100 rounded-sm font-sans font-bold">SpO₂: <span className="text-slate-800 font-bold">{activePatient.spo2}%</span></div>
                        <div className="bg-white p-1 border border-slate-100 rounded-sm">BP: <span className="text-slate-800 font-bold">{activePatient.bpSys}/{activePatient.bpDia}</span></div>
                        <div className="bg-white p-1 border border-slate-100 rounded-sm">TEMP: <span className="text-slate-800 font-bold">{activePatient.temp}°C</span></div>
                      </div>
                    </div>

                    {/* Dispatch API Button */}
                    <button
                      onClick={runBackendAIPrognosis}
                      disabled={isPrognosing}
                      className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-650 text-white font-extrabold text-[9px] uppercase tracking-wider transition-all cursor-pointer shadow-sm rounded-sm disabled:opacity-40"
                    >
                      {isPrognosing ? "Consulting medical advisory agent..." : "Dispatch server predictive API query"}
                    </button>

                    {/* API Loading Terminal Logs */}
                    {isPrognosing && (
                      <div className="mt-3.5 p-3 bg-slate-900 border border-slate-850 font-mono text-[8px] space-y-1.5 text-purple-300 rounded-sm relative">
                        <div className="flex justify-between text-[7px] text-slate-500 border-b border-slate-800 pb-1 uppercase font-bold">
                          <span>ICU System Tunnel</span>
                          <span className="animate-pulse text-indigo-400">Active Stream</span>
                        </div>
                        <div className="animate-pulse text-indigo-300">&gt; Initializing Express secure proxy on PORT 3000...</div>
                        <div className="delay-300 animate-pulse text-indigo-300">&gt; Generating physiological JSON telemetry payload...</div>
                        <div className="delay-700 animate-pulse text-purple-300 text-indigo-300">&gt; Consulting Clinical Co-pilot (gemini-3.5-flash)...</div>
                        <div className="delay-1000 animate-pulse text-emerald-400">&gt; Parsing explainable variables and nurse recommendations...</div>
                        <div className="absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full bg-purple-500 animate-ping"></div>
                      </div>
                    )}

                    {/* Clinical Prognosis response outputs */}
                    {prognosisError && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 text-[9px] text-red-800 leading-relaxed rounded-sm font-mono">
                        <span className="font-extrabold block text-red-700 mb-1">PROGNOSIS PIPELINE FAULT:</span>
                        {prognosisError}
                        <p className="mt-2 text-[8px] text-slate-500 font-semibold font-sans">
                          Verify that you have defined GEMINI_API_KEY in your AI Studio project panel. If not configured, the local prediction matrix continues to generate state predictions fully offline!
                        </p>
                      </div>
                    )}

                    {backendPrognosis && (
                      <div className="mt-4 space-y-3 font-sans">
                        
                        {/* Dynamic Clinical Verdict Header */}
                        <div className="p-3 bg-emerald-50 border border-emerald-250 rounded-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[8px] uppercase tracking-wider text-emerald-600 font-extrabold block mb-0.5">Refined Clinical Verdict</span>
                              <span className="text-[11px] font-extrabold text-emerald-950 uppercase tracking-widest">{backendPrognosis.diagnosis}</span>
                            </div>
                            <div className="px-2 py-0.5 bg-emerald-100 border border-emerald-300 text-[8.5px] font-bold text-emerald-800 uppercase rounded-sm font-sans">
                              {backendPrognosis.priority}
                            </div>
                          </div>
                        </div>

                        {/* circular hazard level */}
                        <div className="p-3 bg-slate-50 border border-slate-200 flex items-center space-x-4 rounded-sm">
                          <div className="relative flex items-center justify-center shrink-0 w-16 h-16 rounded-full border border-slate-100 bg-white shadow-sm">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle cx="32" cy="32" r="28" fill="transparent" stroke="#F1F5F9" strokeWidth="3" />
                              <circle 
                                cx="32" 
                                cy="32" 
                                r="28" 
                                fill="transparent" 
                                stroke={backendPrognosis.riskScore > 65 ? "#EF4444" : (backendPrognosis.riskScore > 35 ? "#F59E0B" : "#10B981")} 
                                strokeWidth="3" 
                                strokeDasharray={2 * Math.PI * 28}
                                strokeDashoffset={2 * Math.PI * 28 * (1 - backendPrognosis.riskScore / 100)}
                                className="transition-all duration-1000"
                              />
                            </svg>
                            <span className="absolute text-[11px] font-mono font-extrabold text-slate-800">
                              {backendPrognosis.riskScore}%
                            </span>
                          </div>
                          <div>
                            <span className="text-[7.5px] uppercase text-slate-400 font-extrabold block">AI Calculated Hazard Risk</span>
                            <p className="text-[9px] text-slate-500 font-semibold leading-normal font-sans">
                              Determined by mapping chronological vital drifts against standardized physiological protocols.
                            </p>
                          </div>
                        </div>

                        {/* reasoning text block */}
                        <div className="p-3 bg-slate-100/50 border border-slate-200 text-[9px] leading-relaxed rounded-sm font-sans shadow-inner">
                          <span className="text-[7.5px] text-[#7C3AED] font-extrabold uppercase block mb-1">Explainable AI Analysis</span>
                          <p className="text-slate-655 font-bold italic">"{backendPrognosis.reasoning}"</p>
                        </div>

                        {/* recommendations list */}
                        {backendPrognosis.recommendations && backendPrognosis.recommendations.length > 0 && (
                          <div className="p-3 bg-white border border-slate-200 rounded-sm shadow-md font-sans">
                            <span className="text-[7.5px] text-sky-600 font-extrabold uppercase block mb-1.5 ">Actionable Nurse Treatment Orders</span>
                            <ul className="space-y-1 text-[8.5px] text-slate-650 font-bold list-decimal pl-3.5">
                              {backendPrognosis.recommendations.map((rec: string, index: number) => (
                                <li key={index}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Feature Significance breakdown */}
                        {backendPrognosis.featureImportance && backendPrognosis.featureImportance.length > 0 && (
                          <div className="p-3 bg-slate-50 border border-slate-200 text-[9px] rounded-sm font-mono">
                            <span className="text-[7.5px] text-slate-400 font-extrabold uppercase block mb-2">Primary Symptom Criticality Weights</span>
                            <div className="space-y-1.5">
                              {backendPrognosis.featureImportance.map((fi: any, idx: number) => {
                                const isPositive = fi.importance >= 0;
                                const absPercent = Math.min(100, Math.round(Math.abs(fi.importance) * 100));
                                return (
                                  <div key={idx} className="space-y-0.5">
                                    <div className="flex justify-between text-[7.5px]">
                                      <span className="uppercase text-slate-550 font-bold">{fi.feature}</span>
                                      <span className={isPositive ? "text-red-650 font-extrabold" : "text-emerald-650 font-extrabold"}>
                                        {isPositive ? "Risk Catalyst" : "Risk Buffer"} ({fi.importance.toFixed(2)})
                                      </span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden pb-0">
                                      <div 
                                        className={`h-full ${isPositive ? "bg-red-550" : "bg-emerald-555"}`}
                                        style={{ width: `${absPercent}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                      </div>
                    )}

                  </div>

                  <div className="pt-4 border-t border-slate-100 text-center mt-4 text-[7.5px] text-slate-400 uppercase font-extrabold font-mono">
                    Clinical Decision Support Model • Compliant under HIPAA proxy constraints
                  </div>
                </div>

              </div>

            </div>
          )}

          {activeTab === "presentation" && (
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col justify-between" style={{ minHeight: "calc(100vh - 110px)" }}>
              <div className="max-w-4xl mx-auto w-full bg-white border border-slate-200 shadow-sm rounded-sm p-8 flex-1 flex flex-col justify-between">
                
                {/* Header of Deck */}
                <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                  <div className="flex items-center space-x-2 animate-fade-in">
                    <div className="bg-slate-100 p-1.5 rounded-sm">
                      <FileText size={16} className="text-slate-700" />
                    </div>
                    <div>
                      <h2 className="text-[14px] font-bold text-slate-800 tracking-tight">CareSync AI Innovation Pitch</h2>
                      <p className="text-[8.5px] font-mono text-slate-400">BOARD PRESENTATION • DELIVERABLE RUNTIME DEMO</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] bg-slate-150 text-slate-600 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-widest border border-slate-200">
                      SLIDE {currentSlide + 1} OF 4
                    </span>
                  </div>
                </div>

                {/* Slides Main View */}
                <div className="flex-1 py-4">
                  {/* --- SLIDE 1: Title & Executive Summary --- */}
                  {currentSlide === 0 && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-widest block font-mono">DELIVERABLES DELIVERED</span>
                        <h1 className="text-[22px] font-extrabold text-slate-900 leading-tight tracking-tight">CareSync AI Command Center</h1>
                        <p className="text-slate-500 text-[11px] font-medium leading-relaxed max-w-2xl">
                          An institutional critical-care monitoring system built to reduce alarm fatigue, streamline triage, and leverage hybrid machine learning for immediate bedside decision support.
                        </p>
                      </div>

                      {/* Expected Deliverables Checklist */}
                      <div className="bg-slate-50 border border-slate-200 p-5 rounded-sm">
                        <h3 className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-3.5 font-mono">
                          Traceability Analysis: Core Accomplishments
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          <div className="flex items-start space-x-3 bg-white p-3 border border-slate-155 rounded-sm">
                            <CheckCircle size={16} className="text-green-600 shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-[10.5px] font-bold text-slate-800 leading-snug">1. Functional Prototype</h4>
                              <p className="text-[9px] text-slate-500 font-semibold leading-normal">
                                Standardized React-Vite workspace binding directly to a containerized Express server at port 3000.
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start space-x-3 bg-white p-3 border border-slate-155 rounded-sm">
                            <CheckCircle size={16} className="text-green-600 shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-[10.5px] font-bold text-slate-800 leading-snug">2. AI-Powered Patient Monitoring</h4>
                              <p className="text-[9px] text-slate-500 font-semibold leading-normal">
                                Dual predictive pipeline with offline Edge predictions and server-side LLM diagnostic checks.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start space-x-3 bg-white p-3 border border-slate-155 rounded-sm">
                            <CheckCircle size={16} className="text-green-600 shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-[10.5px] font-bold text-slate-800 leading-snug">3. Alert & Prioritization Engine</h4>
                              <p className="text-[9px] text-slate-500 font-semibold leading-normal">
                                Real-time Bedside Dispatch matrix routing high-hazard alerts immediately to the ward coordinator.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start space-x-3 bg-white p-3 border border-slate-155 rounded-sm">
                            <CheckCircle size={16} className="text-green-600 shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-[10.5px] font-bold text-slate-800 leading-snug">4. Interactive Visualizations</h4>
                              <p className="text-[9px] text-slate-500 font-semibold leading-normal">
                                Real-time SVG oscillators, physiological drift simulators, and training loss optimization curves.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2.5 p-3 bg-purple-50 text-indigo-950 border border-purple-200 text-[10px] rounded-sm font-sans">
                        <Sparkles size={14} className="text-[#7C3AED] shrink-0" />
                        <span className="font-semibold leading-snug text-slate-700">
                          <strong>Institutional Value Statement:</strong> CareSync AI saves active clinical hours by automatically analyzing physiological indicators at the edge to replace raw threshold triggers with intelligent predictive trend vectors.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* --- SLIDE 2: Core Innovation --- */}
                  {currentSlide === 1 && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-widest block font-mono">CORE INNOVATION</span>
                        <h1 className="text-[22px] font-extrabold text-slate-900 leading-tight tracking-tight">Hybrid Intelligence Architecture</h1>
                        <p className="text-slate-500 text-[11px] font-medium leading-relaxed">
                          By partitioning execution between <strong>Deterministic Local Edge Models</strong> and <strong>Generative Server-side Cohorts</strong>, we resolve both latency constraints and edge resource budgets.
                        </p>
                      </div>

                      {/* Interactive Innovation diagram */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-[9.5px]">
                        
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-sm flex flex-col justify-between">
                          <div>
                            <div className="flex items-center space-x-1.5 mb-2 border-b border-slate-200 pb-1.5">
                              <Activity size={12} className="text-teal-600" />
                              <span className="font-extrabold text-slate-800 uppercase tracking-wide">1. Edge Telemetry</span>
                            </div>
                            <p className="text-slate-500 text-[8.5px] font-sans font-semibold leading-relaxed mb-3">
                              High-velocity vital signs (SPO2, Heart Rate, Respiration Rate, Temperature) continuously stream from bedside monitors.
                            </p>
                          </div>
                          <div className="bg-white p-2 border border-slate-150 rounded-sm text-center font-bold text-teal-700 text-[9px]">
                            120 Hz Continuous Stream
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-sm flex flex-col justify-between">
                          <div>
                            <div className="flex items-center space-x-1.5 mb-2 border-b border-slate-200 pb-1.5">
                              <Database size={12} className="text-indigo-600" />
                              <span className="font-extrabold text-slate-800 uppercase tracking-wide">2. Edge Classifier</span>
                            </div>
                            <p className="text-slate-500 text-[8.5px] font-sans font-semibold leading-relaxed mb-3">
                              Deterministic Logistic Regression maps vital thresholds locally in React. Yields instantaneous triage risk values offline.
                            </p>
                          </div>
                          <div className="bg-indigo-50 p-2 border border-indigo-200 rounded-sm text-center font-bold text-indigo-700 text-[9px] animate-pulse">
                            0ms Latency Local Prediction
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-sm flex flex-col justify-between">
                          <div>
                            <div className="flex items-center space-x-1.5 mb-2 border-b border-slate-200 pb-1.5">
                              <Sparkles size={12} className="text-[#7C3AED]" />
                              <span className="font-extrabold text-[#7C3AED] uppercase tracking-wide">3. Gemini Server</span>
                            </div>
                            <p className="text-slate-500 text-[8.5px] font-sans font-semibold leading-relaxed mb-3">
                              High-complexity patients are pushed through an Express proxy to invoke the Gemini-3.5-Flash advisor for explainable AI summaries.
                            </p>
                          </div>
                          <div className="bg-purple-50 p-2 border border-purple-200 rounded-sm text-center font-bold text-purple-700 text-[9px]">
                            Advanced Semantic Diagnosis
                          </div>
                        </div>

                      </div>

                      <div className="bg-emerald-50 border border-emerald-250 p-4 rounded-sm flex justify-between items-center text-[10px]">
                        <div>
                          <span className="font-extrabold text-emerald-800 block uppercase font-mono mb-0.5">BENEFIT: EDGE-RESILIENT CLINICAL CONTINUITY</span>
                          <span className="text-slate-600 font-semibold">
                            If hospital Wi-Fi disconnects, local edge classification continues predicting hazard risks perfectly offline inside the physician's browser session.
                          </span>
                        </div>
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-1 border border-emerald-250 uppercase font-extrabold font-mono rounded-sm text-[8.5px] shrink-0 ml-4">
                          FAIL-SAFE SECURED
                        </span>
                      </div>
                    </div>
                  )}

                  {/* --- SLIDE 3: Feasibility --- */}
                  {currentSlide === 2 && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-widest block font-mono">FEASIBILITY VALUE</span>
                        <h1 className="text-[22px] font-extrabold text-slate-900 leading-tight tracking-tight">Institutional Feasibility & Deployment</h1>
                        <p className="text-slate-500 text-[11px] font-medium leading-relaxed">
                          Engineering feasibility demands compliance with existing clinical constraints. CareSync AI works with legacy technology stacks, keeping local hospital networks safe and responsive.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-[10px]">
                        <div className="space-y-3.5">
                          <h3 className="font-extrabold text-slate-800 uppercase tracking-wider font-mono border-b border-slate-100 pb-1">
                            Technical Requirements
                          </h3>
                          <ul className="space-y-2.5 font-semibold text-slate-600 list-disc pl-4 leading-relaxed">
                            <li>
                              <strong className="text-slate-800">Browser Ready:</strong> Runs fully on zero-footprint web clients (Chrome, Safari, Edge) without local thick-app installations or driver packaging.
                            </li>
                            <li>
                              <strong className="text-slate-800">FHIR Consent Standard:</strong> Integrates easily with existing EHR vendors (Epic, Cerner) via secure HTTP/SSL API endpoints.
                            </li>
                            <li>
                              <strong className="text-slate-800">Lightweight Server Footprint:</strong> Backed by a standard Node container requiring only minimal physical resources for deployment.
                            </li>
                          </ul>
                        </div>

                        <div className="space-y-3.5">
                          <h3 className="font-extrabold text-slate-800 uppercase tracking-wider font-mono border-b border-slate-100 pb-1">
                            Administrative compliance
                          </h3>
                          <ul className="space-y-2.5 font-semibold text-slate-600 list-disc pl-4 leading-relaxed">
                            <li>
                              <strong className="text-slate-800">HIPAA Compliance Blueprint:</strong> Secure backend API proxy strips all patient identifiers (demographics, SSNs, phone numbers) before sending telemetry numbers to LLMs.
                            </li>
                            <li>
                              <strong className="text-slate-800">Low Operational Risk:</strong> Clinical decisions are always advisory. Doctors and nurses retain ultimate override capability at the bedsides.
                            </li>
                            <li>
                              <strong className="text-slate-800">Alarm Fatigue Alleviation:</strong> Intelligent threshold stabilization prevents transient noise from triggering multi-room emergency bells.
                            </li>
                          </ul>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 text-slate-500 font-mono text-[9px] text-center rounded-sm">
                        CURRENT SYSTEM COMPLIANCE RATE: <span className="font-bold text-indigo-600">100% EXCEL BASED AUDITING SANCTIONED</span>
                      </div>
                    </div>
                  )}

                  {/* --- SLIDE 4: Future Scope --- */}
                  {currentSlide === 3 && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-widest block font-mono">FUTURE SCALABILITY</span>
                        <h1 className="text-[22px] font-extrabold text-slate-900 leading-tight tracking-tight">Future Scope & IoMT Mesh</h1>
                        <p className="text-slate-500 text-[11px] font-medium leading-relaxed font-sans">
                          Integrating the "Internet of Medical Things" (IoMT) opens next-generation pathways for remote clinical guidance, chronic wearable analytics, and proactive smart wards.
                        </p>
                      </div>

                      {/* Mock IoMT Live Signal Monitor */}
                      <div className="bg-slate-950 text-slate-300 p-4 border border-slate-850 rounded-sm font-mono text-[10px]">
                        <div className="flex justify-between border-b border-slate-800 pb-2 mb-3.5 items-center">
                          <div className="flex items-center space-x-2">
                            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping"></span>
                            <span className="text-white font-bold leading-none">MOCK ACTIVE IOMT WEARABLE FEED</span>
                          </div>
                          <span className="text-[7.5px] bg-slate-800 text-indigo-400 px-1.5 py-0.2 rounded font-extrabold">PORT 3000 CONSOLE</span>
                        </div>
                        
                        <div className="space-y-2.5 text-[8.5px] font-mono text-slate-400 leading-normal">
                          <div className="flex justify-between hover:text-white transition-colors">
                            <span>[04:41:09] INGESTING WEARABLE WRIST HR TRANSMISSION...</span>
                            <span className="text-[#059669] font-bold">78 BPM (OK)</span>
                          </div>
                          <div className="flex justify-between hover:text-white transition-colors">
                            <span>[04:41:10] PARSING SMART BED MATTRESS TEMPERATURE INDEX...</span>
                            <span className="text-slate-300 font-sans">36.7 °C (STABLE)</span>
                          </div>
                          <div className="flex justify-between hover:text-white transition-colors">
                            <span>[04:41:11] CALCULATING SLEEP DRIFT ACCELEROMETRY MATRIX...</span>
                            <span className="text-indigo-455">98.2% SENSOR ACCURACY</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3.5 border-t border-slate-900 flex justify-between items-center text-[9px]">
                          <span className="text-slate-500">Target Scale: Multi-facility regional ICU routing and cloud predictive mesh networks.</span>
                          <span className="text-[8px] border border-amber-600/30 text-amber-500 px-1.5 py-0.2 rounded lowercase italic">ready for deployment testing</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans text-[10px]">
                        <div className="p-3.5 border border-slate-200 hover:border-slate-300 transition-all rounded-sm">
                          <h4 className="font-bold text-slate-800 mb-1">Wearables & Home Recovery</h4>
                          <p className="text-slate-550 font-semibold leading-relaxed">
                            Extend the active priority triage logic to home-discharge monitoring bands, allowing hospital staff to flag patients requiring urgent re-admission.
                          </p>
                        </div>
                        <div className="p-3.5 border border-slate-200 hover:border-slate-300 transition-all rounded-sm">
                          <h4 className="font-bold text-slate-800 mb-1">Smart Hospital Hardware</h4>
                          <p className="text-slate-550 font-semibold leading-relaxed">
                            Embed physical beacons on medication carts to dynamically correlate clinician attendance frequencies with target patient physiological stability curves.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Controls of Deck */}
                <div className="flex justify-between items-center border-t border-slate-100 pt-5 mt-6 font-mono">
                  <div>
                    <button
                      onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                      disabled={currentSlide === 0}
                      className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-[10px] uppercase text-slate-600 font-extrabold disabled:opacity-40 rounded-sm cursor-pointer transition-colors"
                    >
                      &larr; Previous Slide
                    </button>
                  </div>

                  {/* Dot Indicators */}
                  <div className="flex space-x-2">
                    {[0, 1, 2, 3].map(slideIdx => (
                      <button
                        key={slideIdx}
                        onClick={() => setCurrentSlide(slideIdx)}
                        className={`h-2.5 w-2.5 rounded-full transition-all ${
                          currentSlide === slideIdx ? "bg-slate-800 scale-125" : "bg-slate-200"
                        }`}
                        title={`Go to slide ${slideIdx + 1}`}
                      />
                    ))}
                  </div>

                  <div>
                    {currentSlide < 3 ? (
                      <button
                        onClick={() => setCurrentSlide(prev => Math.min(3, prev + 1))}
                        className="px-3.5 py-1.5 bg-slate-850 hover:bg-slate-750 text-white text-[10px] uppercase font-bold rounded-sm cursor-pointer transition-all flex items-center space-x-1"
                      >
                        <span>Next Slide</span>
                        <ChevronRight size={11} />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveTab("live");
                          setCurrentSlide(0);
                        }}
                        className="px-3.5 py-1.5 bg-[#E6F4EA] hover:bg-[#d8f0dc] text-[#059669] text-[10px] uppercase font-bold rounded-sm cursor-pointer transition-all border border-[#a2dfae]"
                      >
                        Launch Live Viewport &rarr;
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

        </section>

        {/* --- Right parameter column (160px fixed width) --- */}
        {/* Pinned Right - Aligns with hospital command console monitors showing ACTIVELY MONITORED patient */}
        <section id="parameter-column" className="w-[160px] h-full bg-[#E2E8F0] grid grid-rows-6 border-l border-slate-200">
          
          {/* Block 1: HR */}
          <div id="param-hr-block" style={{ contentVisibility: "auto" }} className="p-2 border-b border-slate-300 flex flex-col justify-between bg-white/70">
            <div className="flex justify-between items-start font-mono">
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#059669] uppercase">HR</span>
              <span className="text-[9px] text-slate-400 font-bold">LO 50 HI 120</span>
            </div>
            <div className="flex items-baseline justify-end space-x-0.5">
              <span className="text-[26px] font-extrabold text-[#059669] leading-none tracking-tighter font-mono">{hr}</span>
              <span className="text-[8px] font-bold text-[#059669] opacity-75 font-mono">bpm</span>
            </div>
            <div className="flex justify-between items-end text-[9px] text-slate-400 font-bold font-mono">
              <span className="text-[8px] uppercase">ECG LEAD II</span>
              {hr > 120 ? (
                <span className="text-red-600 animate-pulse font-extrabold">↑ TACHY</span>
              ) : (
                <span className="text-[#059669] font-extrabold">● OK</span>
              )}
            </div>
          </div>

          {/* Block 2: SpO2 */}
          <div id="param-spo2-block" style={{ contentVisibility: "auto" }} className="p-2 border-b border-slate-300 flex flex-col justify-between bg-white/70">
            <div className="flex justify-between items-start font-mono">
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#0284C7] uppercase">SPO2</span>
              <span className="text-[9px] text-slate-400 font-bold">LO 90 HI 100</span>
            </div>
            <div className="flex items-baseline justify-end space-x-0.5 animate-pulse">
              <span className="text-[26px] font-extrabold text-[#0284C7] leading-none tracking-tighter font-mono">{spo2}</span>
              <span className="text-[10px] font-bold text-[#0284C7] opacity-75 font-mono">%</span>
            </div>
            <div className="flex justify-between items-end text-[9px] text-slate-400 font-bold font-mono">
              <span>PR: {hr} bpm</span>
              {spo2 < 93 ? (
                <span className="text-amber-600 animate-pulse font-extrabold">↓ DESAT</span>
              ) : (
                <span className="text-[#0284C7] font-extrabold">● OK</span>
              )}
            </div>
          </div>

          {/* Block 3: NIBP */}
          <div id="param-nibp-block" style={{ contentVisibility: "auto" }} className="p-2 border-b border-slate-300 flex flex-col justify-between bg-white/70">
            <div className="flex justify-between items-start font-mono">
              <span className="text-[8px] font-bold tracking-[0.14em] text-red-600 uppercase">NIBP</span>
              <span className="text-[9px] text-slate-400 font-bold">SYS 140/90</span>
            </div>
            <div className="flex items-baseline justify-end">
              {nibpMeasuring ? (
                <span className="text-sm font-semibold text-red-650 leading-none animate-pulse font-mono">CUFF MAIN...</span>
              ) : (
                <span className="text-[26px] font-extrabold text-red-600 leading-none tracking-tighter font-mono">
                  {nibpSys}/{nibpDia}
                </span>
              )}
            </div>
            <div className="flex justify-between items-end text-[9px] text-slate-400 font-bold font-mono">
              <span>MAP: ({calculatedMap})</span>
              {nibpSys < 90 ? (
                <span className="text-red-600 animate-pulse font-extrabold">↓ HYPO</span>
              ) : (
                <span className="text-red-500 font-bold opacity-80">● APPLIED</span>
              )}
            </div>
          </div>

          {/* Block 4: Temp */}
          <div id="param-temp-block" style={{ contentVisibility: "auto" }} className="p-2 border-b border-slate-300 flex flex-col justify-between bg-white/70">
            <div className="flex justify-between items-start font-mono">
              <span className="text-[8px] font-bold tracking-[0.14em] text-amber-600 uppercase">TEMP</span>
              <span className="text-[9px] text-slate-400 font-bold">LO 36 HI 38.5</span>
            </div>
            <div className="flex items-baseline justify-end space-x-0.5">
              <span className="text-[26px] font-extrabold text-amber-600 leading-none tracking-tighter font-mono">{temp.toFixed(1)}</span>
              <span className="text-[10px] font-bold text-amber-600 opacity-75 font-mono">°C</span>
            </div>
            <div className="flex justify-between items-end text-[9px] text-slate-400 font-bold font-mono">
              <span>{((temp * 9) / 5 + 32).toFixed(1)} °F</span>
              {temp > 38.5 ? (
                <span className="text-amber-600 animate-pulse font-extrabold">↑ FEVER</span>
              ) : (
                <span className="text-amber-600 font-extrabold">● OK</span>
              )}
            </div>
          </div>

          {/* Block 5: RR */}
          <div id="param-rr-block" style={{ contentVisibility: "auto" }} className="p-2 border-b border-slate-300 flex flex-col justify-between bg-white/70">
            <div className="flex justify-between items-start font-mono">
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#7C3AED] uppercase">RESP</span>
              <span className="text-[9px] text-slate-400 font-bold">LO 8 HI 25</span>
            </div>
            <div className="flex items-baseline justify-end space-x-0.5">
              <span className="text-[26px] font-extrabold text-[#7C3AED] leading-none tracking-tighter font-mono">{rr}</span>
              <span className="text-[8px] font-bold text-[#7C3AED] opacity-75 font-mono">/min</span>
            </div>
            <div className="flex justify-between items-end text-[9px] text-slate-400 font-bold font-mono">
              <span>I:E 1:2.0</span>
              {rr > 25 ? (
                <span className="text-amber-600 font-extrabold">↑ HIGH</span>
              ) : (
                <span className="text-purple-600 font-extrabold">● OK</span>
              )}
            </div>
          </div>

          {/* Block 6: EtCO2 */}
          <div id="param-co2-block" style={{ contentVisibility: "auto" }} className="p-2 flex flex-col justify-between bg-white/70 font-mono">
            <div className="flex justify-between items-start">
              <span className="text-[8px] font-bold tracking-[0.14em] text-amber-700 uppercase">CO2</span>
              <span className="text-[9px] text-slate-400 font-bold">LO 30 HI 45</span>
            </div>
            <div className="flex items-baseline justify-end space-x-0.5">
              <span className="text-[26px] font-extrabold text-amber-700 leading-none tracking-tighter">{co2}</span>
              <span className="text-[9px] font-bold text-amber-700 opacity-75">mmHg</span>
            </div>
            <div className="flex justify-between items-end text-[9px] text-slate-400 font-bold">
              <span>FiCO2: 1</span>
              {co2 < 30 ? (
                <span className="text-amber-600 font-bold">↓ HYPO</span>
              ) : (
                <span className="text-amber-700 font-bold">● OK</span>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* --- BOTTOMBAR (36px) --- */}
      <footer id="bottombar" className="h-[36px] border-t border-[#1C2E44] grid grid-cols-5 divide-x divide-[#1C2E44] bg-[#080D18] text-[9.5px] font-bold uppercase select-none z-10">
        <div className="flex items-center justify-center space-x-1.5 px-2">
          <span className="text-neutral-500">EWS SCORE (Philips):</span>
          <span className={`${activePatient.priority === "Critical" ? "text-[#FF5252] animate-pulse" : "text-[#00E676]"}`}>
            {activePatient.priority === "Critical" ? "10/12 [CRITICAL]" : "02/12 [NORMAL]"}
          </span>
        </div>
        <div className="flex items-center justify-center space-x-1.5 px-2">
          <span className="text-neutral-500">EPIC EDI:</span>
          <span style={{ color: ediColor }}>
            {ediScore} [{ediRiskText.split(" ")[0]}]
          </span>
        </div>
        <div className="flex items-center justify-center space-x-1.5 px-2">
          <span className="text-neutral-500 font-mono text-[#FF5252] animate-pulse">▲ TREWS SEPSIS:</span>
          <span className="text-[#FF5252] animate-pulse">
            {activePatient.id === "P108" || activePatient.id === "P101" ? "ALERT — 4/5 CRITERIA" : "0/5 NORMAL WATCH"}
          </span>
        </div>
        <div className="flex items-center justify-center space-x-1.5 px-2">
          <span className="text-neutral-500">LOOKDEEP MOTION:</span>
          <span className="text-amber-500 font-semibold">{lookDeepTime}</span>
        </div>
        <div className="flex items-center justify-center space-x-1.5 px-2 text-neutral-300">
          <RefreshCw size={11} className="text-neutral-500 animate-spin" strokeWidth={2.4} style={{ animationDuration: "14s" }} />
          <span className="text-neutral-500">NEXT NIBP IN:</span>
          <span className="text-neutral-300 font-mono whitespace-nowrap">
            {Math.floor(nibpSeconds / 60)}:{String(nibpSeconds % 60).padStart(2, "0")}
          </span>
        </div>
      </footer>

      {/* --- CLINICAL PATIENT DETAIL DRAWER / OVERLAY PANEL --- */}
      {selectedPatient && (() => {
        const metrics = getPatientMetrics(selectedPatient);
        const explReasons = getExplainableAIReason(selectedPatient);
        
        let priorityColor = "#00E676";
        let cardBorder = "border-green-900/60";
        let headingBg = "bg-green-950/20";
        if (selectedPatient.priority === "Critical") {
          priorityColor = "#FF5252";
          cardBorder = "border-red-900/60";
          headingBg = "bg-red-950/20";
        } else if (selectedPatient.priority === "High Risk") {
          priorityColor = "#FF9100";
          cardBorder = "border-amber-900/60";
          headingBg = "bg-amber-950/20";
        } else if (selectedPatient.priority === "Moderate") {
          priorityColor = "#FFEE58";
          cardBorder = "border-yellow-900/30";
          headingBg = "bg-yellow-950/10";
        }

        return (
          <div className="absolute inset-0 z-50 bg-black/75 flex justify-end transition-opacity duration-300 select-text">
            {/* Main drawer body */}
            <div className="w-full max-w-[480px] h-full bg-[#141E33] border-l border-[#1C2E44] flex flex-col justify-between shadow-2xl relative">
              
              {/* Header block with close */}
              <div className="p-4 border-b border-[#1C2E44] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldAlert size={16} style={{ color: priorityColor }} className="animate-pulse" />
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-300">EPIC CLINICAL CONSOLE</h3>
                    <p className="text-[11px] font-bold text-red-500">{selectedPatient.bedId.toUpperCase()} &bull; {selectedPatient.id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPatientId(null)}
                  className="p-1 px-1.5 border border-[#1C2E44] bg-[#0E1525] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* 1. Patient profile card */}
                <div className="bg-[#0E1525] border border-[#1C2E44] p-3 text-[10px] space-y-1">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[12px] font-bold text-[#00E5FF]">{selectedPatient.name}</span>
                    <span className="text-[8px] bg-[#141E33] px-2 py-0.5 border border-[#1C2E44] text-neutral-400 uppercase font-semibold">
                      {selectedPatient.gender} &bull; {selectedPatient.age} Yrs
                    </span>
                  </div>
                  <div><span className="text-neutral-500">Diagnosis: </span><span className="text-red-400 font-semibold uppercase">{selectedPatient.dx}</span></div>
                  <div><span className="text-neutral-500">Status Alert: </span><span className="text-neutral-300">{selectedPatient.alertStatus}</span></div>
                  <div className="pt-2 flex items-center justify-between border-t border-[#1C2E44]/50 mt-1.5">
                    <span className="text-neutral-500 uppercase text-[8.5px]">Alarm Priority:</span>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold border" style={{ borderColor: priorityColor, color: priorityColor, backgroundColor: headingBg }}>
                      {selectedPatient.priority.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* 2. Deterioration Warning (Trend Detection) */}
                {metrics.spo2Deteriorating && (
                  <div className="bg-[#5c4008]/40 border border-[#FFD740] p-3 space-y-1">
                    <div className="flex items-center space-x-1.5 text-[#FFD740] font-bold text-[9.5px]">
                      <AlertTriangle size={13} className="animate-pulse" />
                      <span>⚠ EARLY DETERIORATION WARNING</span>
                    </div>
                    <p className="text-[9px] text-neutral-200 leading-relaxed">
                      "Oxygen saturation is decreasing continuously. Patient may become critical within next 30 minutes."
                    </p>
                    <div className="pt-1.5 flex items-center justify-between text-[8px] text-neutral-400 uppercase">
                      <span>SpO₂ trend sequence:</span>
                      <span className="font-bold underline text-[#00E5FF]">
                        {selectedPatient.spo2History.join(" → ")}%
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Explainable AI Clinical Triggers */}
                <div className="bg-[#0E1525] border border-[#1C2E44] p-3 space-y-1.5">
                  <div className="flex items-center justify-between border-b border-[#1C2E44] pb-1.5 mb-1 bg-[#141E33]/30 px-1">
                    <span className="text-[9px] font-bold text-[#FFEE58] uppercase flex items-center space-x-1">
                      <Sparkles size={11} className="mr-0.5 text-[#FFEE58]" />
                      <span>Explainable AI Diagnosis</span>
                    </span>
                    <span className="text-[7.5px] text-neutral-500 font-semibold uppercase">DYNAMIC CLARIFIER</span>
                  </div>
                  <p className="text-[9px] text-neutral-300 leading-normal">
                    Patient <b className="text-white">{selectedPatient.name}</b> is targeted as <b style={{ color: priorityColor }}>{selectedPatient.priority}</b> because:
                  </p>
                  <ul className="space-y-1 text-[9px] pl-1 pt-1">
                    {explReasons.length > 0 ? (
                      explReasons.map((reason, ri) => (
                        <li key={ri} className="flex items-start text-neutral-200">
                          <span className="text-red-500 mr-1.5">&bull;</span>
                          <span>{reason}</span>
                        </li>
                      ))
                    ) : (
                      <li className="flex items-start text-green-400">
                        <span className="mr-1.5">&bull;</span>
                        <span>All core vitals remain within healthy clinical thresholds.</span>
                      </li>
                    )}
                  </ul>
                  <div className="pt-1.5 text-[8.5px] font-bold text-[#FF5252] border-t border-[#1C2E44]/40 mt-1.5 uppercase">
                    Immediate medical attention recommended.
                  </div>
                </div>

                {/* 4. Specialist Recommendation Block */}
                <div className="bg-[#1c1d35]/50 border border-[#818cf8]/40 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1C2E44]/60">
                    <span className="text-[9.5px] font-bold text-[#818cf8] uppercase tracking-wider flex items-center space-x-1">
                      <Stethoscope size={11} />
                      <span>Prominent Specialist Dispatch</span>
                    </span>
                    <span className="text-[7px] text-neutral-400 border border-[#818cf8]/30 px-1 py-0.2 uppercase bg-[#0e0e18]">Rule Applied</span>
                  </div>
                  <div className="my-2 select-all">
                    <div className="text-[17px] font-bold font-mono text-[#828df9] tracking-tight uppercase">
                      {metrics.specialist}
                    </div>
                    <div className="text-[7.5px] text-neutral-500">ROUTED SPECIALIST OFFICE</div>
                  </div>
                  <p className="text-[8.5px] text-neutral-400 font-sans italic leading-tight">
                    {selectedPatient.priority === "Critical" && metrics.severeCount >= 2 
                      ? "Dispatched because multi-vitals severe failure trigger rules highlight patient's critical risk."
                      : selectedPatient.spo2 < 93 
                      ? "Pulmonologist prioritized because oxygen saturation has entered hypoxic limits (<93%)."
                      : "Cardiologist matched to evaluate core peripheral pulse indicators & abnormal perfusion values."}
                  </p>
                </div>

                {/* 5. Vitals Grid Dashboard */}
                <div className="border border-[#1C2E44]">
                  <div className="bg-[#0E1525] p-1.5 px-3 border-b border-[#1C2E44] text-[8.5px] font-bold uppercase text-neutral-400">
                    Live Vitals Record
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-y divide-[#1C2E44] bg-[#0E1525] text-left text-[9.5px]">
                    <div className="p-2 flex flex-col">
                      <span className="text-[7px] text-neutral-500 font-bold uppercase">HEART RATE</span>
                      <span className="text-[#00E676] font-bold text-[13px]">{selectedPatient.hr} <small className="text-[7.5px] text-neutral-400">bpm</small></span>
                    </div>
                    <div className="p-2 flex flex-col border-t-0!">
                      <span className="text-[7px] text-neutral-500 font-bold uppercase">SPO2</span>
                      <span className="text-[#00E5FF] font-bold text-[13px]">{selectedPatient.spo2}%</span>
                    </div>
                    <div className="p-2 flex flex-col">
                      <span className="text-[7px] text-neutral-500 font-bold uppercase">BLOOD PRESSURE</span>
                      <span className="text-[#FF5252] font-semibold text-[13px] font-mono whitespace-nowrap">{selectedPatient.bpSys}/{selectedPatient.bpDia}</span>
                    </div>
                    <div className="p-2 flex flex-col">
                      <span className="text-[7px] text-neutral-500 font-bold uppercase">TEMPERATURE</span>
                      <span className="text-[#FFD740] font-bold text-[13px]">{selectedPatient.temp.toFixed(1)}°C</span>
                    </div>
                    <div className="p-2 flex flex-col">
                      <span className="text-[7px] text-neutral-500 font-bold uppercase">RESP RATE</span>
                      <span className="text-[#AA80FF] font-bold text-[13px]">{selectedPatient.rr} <small className="text-[7.5px] text-neutral-400">/min</small></span>
                    </div>
                    <div className="p-2 flex flex-col">
                      <span className="text-[7px] text-neutral-500 font-bold uppercase">EtCO2</span>
                      <span className="text-[#FF9100] font-semibold text-[13px]">{selectedPatient.co2} <small className="text-[7px] text-neutral-400">mmHg</small></span>
                    </div>
                  </div>
                </div>

                {/* 6. Predictive Alert for Critical Risk */}
                <div className="border border-[#1C2E44] bg-[#0E1525] p-3 text-[9px] space-y-1.5">
                  <div className="flex justify-between items-center text-[7.5px] uppercase font-bold text-red-400 pb-1 border-b border-[#1C2E44]/40">
                    <span>PREDICTIVE RISKS INDEX</span>
                    <span>30-MINUTES FORECAST</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-neutral-400">Becoming Critical Probability:</span>
                    <span className="text-neutral-100 text-[11px] font-bold font-mono px-1 py-0.2 bg-[#141E33] border border-[#1C2E44]" style={{ color: priorityColor }}>
                      {selectedPatient.riskScore}% Risk
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400">Prediction Outcome: </span>
                    <span className="font-bold text-white uppercase">
                      {selectedPatient.riskScore > 65 
                        ? "Likely to become critical in next 30 minutes" 
                        : "Low chance of acute decompensation"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400">Underlying Forecast Reasoning: </span>
                    <span className="text-neutral-300 italic font-sans block text-[8.5px] leading-tight pt-0.5">
                      {selectedPatient.riskScore > 65 
                        ? "Continuous SpO₂ decrement trend coupled with high basal heart rate and febrile indices triggers risk probability."
                        : "Consistent autonomic homeostasis is maintained; vital signs fluctuations are within healthy parameters."}
                    </span>
                  </div>
                </div>

              </div>

              {/* Actions Footnote - Sync active monitor button */}
              <div className="p-3 bg-[#0E1525] border-t border-[#1C2E44] flex space-x-2">
                <button 
                  onClick={() => {
                    setActivePatientId(selectedPatient.id);
                    setActiveTab("live");
                    setSelectedPatientId(null);
                  }}
                  className="flex-1 py-2 bg-[#00E676] hover:bg-[#00c853] text-black font-bold uppercase text-[9px] tracking-widest text-center cursor-pointer transition-colors"
                >
                  SELECT AS LIVE MONITOR
                </button>
                <button 
                  onClick={() => setSelectedPatientId(null)}
                  className="px-4 py-2 border border-[#1C2E44] text-neutral-400 hover:text-white hover:bg-neutral-800 text-[9px] font-bold uppercase transition-colors cursor-pointer"
                >
                  DISMISS
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
