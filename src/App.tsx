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

  // --- Monitored Bed Selection ---
  const [activePatientId, setActivePatientId] = useState<string>("P108"); // starts with Jenkins, Sarah (ICU-08)

  // --- Navigation Tabs ---
  const [activeTab, setActiveTab] = useState<"live" | "table" | "command" | "kaggle">("live");

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

  // Get active patient object
  const activePatient = patients.find(p => p.id === activePatientId) || patients[0];
  const { hr, spo2, bpSys: nibpSys, bpDia: nibpDia, temp, rr, co2, riskScore: ediScore } = activePatient;

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
  }, []);

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
        ctx.clearRect(0, 0, w, h);

        ctx.lineWidth = 2.4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (k === 0) ctx.strokeStyle = "#00E676";
        else if (k === 1) ctx.strokeStyle = "#00E5FF";
        else if (k === 2) ctx.strokeStyle = "#AA80FF";
        else if (k === 3) ctx.strokeStyle = "#FF9100";

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
    <div id="pac-monitor-root" className="h-screen w-screen bg-[#080D18] flex flex-col text-white font-mono select-none overflow-hidden relative">
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
      <header id="topbar" className="h-[44px] border-b border-[#1C2E44] px-4 flex items-center justify-between bg-[#080D18] z-10">
        <div className="flex items-center space-x-4 text-[11px] h-full">
          <div className="flex flex-col select-none justify-center">
            <span className="font-bold text-[12px] tracking-wider text-neutral-300">CARESYNC AI</span>
            <span className="text-[7.5px] text-green-500 font-semibold tracking-widest uppercase">COMMAND CENTER</span>
          </div>

          {/* Tab Switchers */}
          <div className="flex h-full border-l border-[#1C2E44] ml-2">
            <button
              onClick={() => setActiveTab("live")}
              className={`px-3 text-[9.5px] font-bold tracking-wider uppercase h-full transition-colors ${
                activeTab === "live"
                  ? "bg-[#141E33] text-[#00E676] border-b-2 border-[#00E676]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Live Monitor
            </button>
            <button
              onClick={() => setActiveTab("table")}
              className={`px-3 text-[9.5px] font-bold tracking-wider uppercase h-full transition-colors ${
                activeTab === "table"
                  ? "bg-[#141E33] text-[#FF9100] border-b-2 border-[#FF9100]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Patient Board
            </button>
            <button
              onClick={() => setActiveTab("command")}
              className={`px-3 text-[9.5px] font-bold tracking-wider uppercase h-full transition-colors ${
                activeTab === "command"
                  ? "bg-[#141E33] text-[#AA80FF] border-b-2 border-[#AA80FF]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              ICU beds
            </button>
            <button
              onClick={() => setActiveTab("kaggle")}
              className={`px-3 text-[9.5px] font-bold tracking-wider uppercase h-full transition-colors ${
                activeTab === "kaggle"
                  ? "bg-[#141E33] text-[#FFEE58] border-b-2 border-[#FFEE58]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Kaggle Lab
            </button>
          </div>

          <div className="border-l border-[#1C2E44] pl-4 hidden md:flex items-center space-x-1">
            <span className="text-neutral-500">ACTIVE: </span>
            <span className="font-semibold text-neutral-300">{activePatient.name}</span>
            <span className="text-[9px] bg-[#141E33] px-1.5 py-0.2 border border-[#1C2E44] tracking-normal text-red-500 ml-1">
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
                  className={`px-2 py-0.5 text-[8.5px] font-bold border rounded-none flex items-center space-x-1 cursor-pointer transition-colors ${
                    isCrit 
                      ? "bg-red-950/40 text-[#FF5252] border-[#FF5252]/60 hover:bg-red-900/40 animate-alarm-flash"
                      : "bg-amber-950/30 text-[#FFD740] border-[#FFD740]/60 hover:bg-amber-900/30 animate-alarm-flash"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  <span>{activePatient.bedId}: {alarm.label}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center space-x-1.5 border-l border-[#1C2E44] pl-3">
            <span className="text-[9px] text-neutral-500">PULSE</span>
            <div className="relative flex items-center justify-center w-3 h-3">
              <span className="absolute w-2 h-2 bg-[#00E676] rounded-full animate-pulse-dot"></span>
              <span className="w-1.5 h-1.5 bg-[#00E676] rounded-full"></span>
            </div>
          </div>

          <div className="flex items-center space-x-2 border-l border-[#1C2E44] pl-3 text-sm text-neutral-300 font-bold tracking-wider select-none">
            <Clock size={12} className="text-neutral-500" />
            <span id="systime-clock" className="text-[12px]">{timeStr}</span>
          </div>
        </div>
      </header>

      {/* --- BODY (fills remaining height) --- */}
      <main id="monitor-body" className="flex-1 flex overflow-hidden">
        
        {/* WAVEFORMS SECTION (Changes based on selected tab) */}
        <section id="waveform-column" className="flex-1 relative flex flex-col h-full border-r border-[#1C2E44] bg-[#080D18] overflow-y-auto">
          
          {/* TAB 1: LIVE OUTPATIANCE OSCILLOSCOPE */}
          {activeTab === "live" && (
            <div className="flex-1 grid grid-rows-4 h-full relative">
              {/* Wave 1: ECG II */}
              <div id="wave-row-ecg" className="relative border-b border-[#1C2E44] flex flex-col justify-between p-2 pb-0">
                <div className="flex justify-between items-start z-10 pointer-events-none">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold tracking-wider text-[#00E676]">ECG · LEAD II</span>
                    <span className="text-[7.5px] text-neutral-500">X1.0 · FILTERED</span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-xs font-bold text-[#00E676]">{hr}</span>
                    <span className="text-[8px] text-neutral-500">BPM</span>
                  </div>
                </div>
                <div className="flex-1 w-full relative">
                  <canvas ref={ecgCanvasRef} className="absolute top-0 left-0 w-full h-full" />
                </div>
              </div>

              {/* Wave 2: SpO2 */}
              <div id="wave-row-spo2" className="relative border-b border-[#1C2E44] flex flex-col justify-between p-2 pb-0">
                <div className="flex justify-between items-start z-10 pointer-events-none">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold tracking-wider text-[#00E5FF]">SPO2 · PLETH</span>
                    <span className="text-[7.5px] text-neutral-500">PLETH WAVEFORM</span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-xs font-bold text-[#00E5FF]">{spo2}%</span>
                  </div>
                </div>
                <div className="flex-1 w-full relative">
                  <canvas ref={spo2CanvasRef} className="absolute top-0 left-0 w-full h-full" />
                </div>
              </div>

              {/* Wave 3: Resp */}
              <div id="wave-row-resp" className="relative border-b border-[#1C2E44] flex flex-col justify-between p-2 pb-0">
                <div className="flex justify-between items-start z-10 pointer-events-none">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold tracking-wider text-[#AA80FF]">RESP · THORACIC</span>
                    <span className="text-[7.5px] text-neutral-500">IMPEDANCE SENSOR</span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-xs font-bold text-[#AA80FF]">{rr}</span>
                    <span className="text-[8px] text-neutral-500">/MIN</span>
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
                    <span className="text-[9px] font-bold tracking-wider text-[#FF9100]">CO2 · CAPNOGRAPH</span>
                    <span className="text-[7.5px] text-neutral-500">SIDESTREAM INFRARED</span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-xs font-bold text-[#FF9100]">{co2}</span>
                    <span className="text-[8px] text-neutral-500">mmHg</span>
                  </div>
                </div>
                <div className="flex-1 w-full relative">
                  <canvas ref={co2CanvasRef} className="absolute top-0 left-0 w-full h-full" />
                </div>
              </div>

              {/* Floating EPIC EDI Gauge */}
              <div id="floating-edi-panel" style={{ contentVisibility: "auto" }} className="absolute top-3 right-3 w-[140px] bg-[#141E33]/94 border border-[#1C2E44] p-2.5 z-20 flex flex-col select-none text-white">
                <div className="text-[8px] font-bold tracking-wider text-neutral-500 uppercase flex items-center justify-between">
                  <span>EDI · EPIC</span>
                  <span className="scale-75 text-[#FF5252] font-semibold animate-pulse">LIVE</span>
                </div>

                {/* Donut */}
                <div className="relative w-[90px] h-[90px] mx-auto mt-1.5 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="45" cy="45" r={ediR} stroke="#1C2E44" strokeWidth="4.5" fill="transparent" />
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
                    <span className="text-[20px] font-bold" style={{ color: ediColor }}>
                      {ediScore}
                    </span>
                    <span className="text-[6.5px] text-neutral-500 font-semibold tracking-wide">INDEX</span>
                  </div>
                </div>

                <div className="text-center text-[7.5px] font-bold tracking-wide mt-1" style={{ color: ediColor }}>
                  {ediRiskText}
                </div>

                <div className="h-[2.5px] w-full bg-[#1C2E44] mt-1.5 overflow-hidden">
                  <div className="h-full transition-all duration-1000 ease-in-out" style={{ width: `${ediScore}%`, backgroundColor: ediColor }}></div>
                </div>

                {/* Flaq pills */}
                <div className="flex flex-col space-y-1 mt-2 text-[7px] font-bold">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">MAP CRITICAL</span>
                    <span className="px-1 py-0.2 bg-red-950/50 text-[#FF5252] border border-red-900/40">RED</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">HR EXTRA-HIGH</span>
                    <span className="px-1 py-0.2 bg-red-950/50 text-[#FF5252] border border-red-900/40">RED</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">RESP ELEVATED</span>
                    <span className="px-1 py-0.2 bg-[#3a2f1a] text-[#FFD740] border border-[#ffb300]/20">AMBER</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MULTIPLE PATIENTS BOARD TABLE */}
          {activeTab === "table" && (
            <div className="p-4 flex flex-col h-full bg-[#080D18] text-white">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 pb-3 border-b border-[#1C2E44]">
                <div>
                  <h2 className="text-xs font-bold tracking-widest text-[#FF9100] uppercase">Simulated Ward Patients</h2>
                  <p className="text-[9px] text-neutral-500">20 Beds sorted by priority (Critical first) &bull; Updates live every 3.5s</p>
                </div>

                {/* Filter and Search Controls */}
                <div className="flex items-center space-x-2 mt-2 md:mt-0 w-full md:w-auto">
                  <div className="relative flex items-center bg-[#0E1525] border border-[#1C2E44] px-2 py-1">
                    <Search size={11} className="text-neutral-500 mr-1.5" />
                    <input 
                      type="text" 
                      placeholder="Search patient / bed..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-transparent text-[10px] focus:outline-none w-32 placeholder-neutral-500 text-white"
                    />
                  </div>
                  <select 
                    value={priorityFilter} 
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="bg-[#0E1525] border border-[#1C2E44] px-2 py-1 text-[10px] text-neutral-300 focus:outline-none"
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
              <div className="flex-1 overflow-auto border border-[#1C2E44] bg-[#0E1525]">
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-[#141E33] border-b border-[#1C2E44] text-[8px] text-neutral-500 uppercase tracking-widest">
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
                  <tbody className="divide-y divide-[#1C2E44]">
                    {sortedPatients.map((p) => {
                      const metrics = getPatientMetrics(p);
                      const isAlerting = p.priority === "Critical" || p.priority === "High Risk";
                      
                      // Row highlighting if warning is active
                      const isActivelySelectedOnMonitor = p.id === activePatientId;
                      
                      let colorHex = "#00E676"; // green
                      let bgClass = "bg-green-950/20";
                      let borderClass = "border-green-900/60";
                      if (p.priority === "Critical") {
                        colorHex = "#FF5252";
                        bgClass = "bg-red-950/20";
                        borderClass = "border-red-900/60";
                      } else if (p.priority === "High Risk") {
                        colorHex = "#FF9100";
                        bgClass = "bg-amber-950/20";
                        borderClass = "border-amber-900/60";
                      } else if (p.priority === "Moderate") {
                        colorHex = "#FFEE58";
                        bgClass = "bg-yellow-950/10";
                        borderClass = "border-yellow-900/30";
                      }

                      return (
                        <tr 
                          key={p.id} 
                          className={`hover:bg-[#141E33]/60 cursor-pointer transition-colors ${
                            isActivelySelectedOnMonitor ? "bg-[#141E33] border-l-2 border-[#00E676]" : ""
                          }`}
                          onClick={() => setSelectedPatientId(p.id)}
                        >
                          <td className="p-2.5 font-bold">
                            <span className="text-red-500 font-semibold">{p.bedId}</span>
                            <div className="text-[7.5px] text-neutral-500">{p.id}</div>
                          </td>
                          <td className="p-2.5 font-semibold text-neutral-200">
                            {p.name}
                            {metrics.spo2Deteriorating && (
                              <span className="ml-1.5 inline-flex items-center text-[7.5px] font-bold text-[#FFD740] bg-yellow-950/40 px-1 py-0.2 border border-yellow-900/40 animate-pulse">
                                ⚠ DETERIORATING
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-neutral-400">{p.age}y / {p.gender}</td>
                          
                          {/* HR value column */}
                          <td className="p-2.5 text-center font-bold" style={{ color: p.hr > 120 || p.hr < 60 ? "#FF5252" : "#00E676" }}>
                            {p.hr}
                          </td>

                          {/* SpO2 value column */}
                          <td className="p-2.5 text-center font-bold" style={{ color: p.spo2 < 93 ? "#FF5252" : "#00E5FF" }}>
                            {p.spo2}%
                          </td>

                          {/* BP value column */}
                          <td className="p-2.5 text-center text-red-400 font-mono">
                            {p.bpSys}/{p.bpDia}
                          </td>

                          {/* Temperature column */}
                          <td className="p-2.5 text-center font-semibold text-[#FFD740]">
                            {p.temp.toFixed(1)}°C
                          </td>

                          {/* Resp rate column */}
                          <td className="p-2.5 text-center text-[#AA80FF] font-semibold">
                            {p.rr}
                          </td>

                          {/* Risk percentage */}
                          <td className="p-2.5 text-center">
                            <span className="font-bold font-mono px-1.5 py-0.2 bg-[#141E33] border border-[#1C2E44]" style={{ color: colorHex }}>
                              {p.riskScore}%
                            </span>
                          </td>

                          {/* Recommended specialist with prominence */}
                          <td className="p-2.5">
                            <span className="text-[8.5px] px-1.5 py-0.5 bg-[#141E33] border border-[#1C2E44] text-neutral-300">
                              {metrics.specialist}
                            </span>
                          </td>

                          {/* Actions column */}
                          <td className="p-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end space-x-1">
                              <button 
                                onClick={() => {
                                  setActivePatientId(p.id);
                                  setActiveTab("live");
                                }}
                                className="px-2 py-0.5 border border-[#1C2E44] bg-[#141E33] hover:bg-[#00E676] hover:text-black font-semibold text-[8px] uppercase tracking-wider text-neutral-300 transition-colors"
                              >
                                Monitor
                              </button>
                              <button 
                                onClick={() => setSelectedPatientId(p.id)}
                                className="px-2 py-0.5 border border-[#1C2E44] bg-[#141E33] hover:bg-neutral-800 font-semibold text-[8px] uppercase text-neutral-400"
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
            <div className="p-4 flex flex-col h-full bg-[#080D18]">
              <div className="mb-4 pb-2 border-b border-[#1C2E44]">
                <h2 className="text-xs font-bold tracking-widest text-[#AA80FF] uppercase">ACTIVE BED DISPATCH BOARD</h2>
                <p className="text-[8.5px] text-neutral-500">Real-time occupancy status &bull; Click on any Bed to view clinical indicators and details</p>
              </div>

              {/* Grid map for 20 beds */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 flex-1 overflow-y-auto pr-1">
                {patients.map((p) => {
                  const metrics = getPatientMetrics(p);
                  const activeOnMonitor = p.id === activePatientId;
                  
                  // Color codes
                  let statusColor = "#00E676"; // green
                  let borderClr = "border-[#1C2E44]";
                  let pillBg = "bg-green-950/20 text-[#00E676]";

                  if (p.priority === "Critical") {
                    statusColor = "#FF5252";
                    borderClr = "border-red-900/60";
                    pillBg = "bg-red-950/40 text-[#FF5252]";
                  } else if (p.priority === "High Risk") {
                    statusColor = "#FF9100";
                    borderClr = "border-amber-900/60";
                    pillBg = "bg-amber-950/30 text-[#FF9100]";
                  } else if (p.priority === "Moderate") {
                    statusColor = "#FFEE58";
                    borderClr = "border-yellow-900/30";
                    pillBg = "bg-yellow-950/10 text-yellow-300";
                  }

                  return (
                    <div 
                      key={p.id}
                      onClick={() => setSelectedPatientId(p.id)}
                      className={`relative p-3 bg-[#0E1525] border hover:border-yellow-400 transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                        activeOnMonitor ? "ring-1 ring-[#00E676] bg-[#141E33]" : borderClr
                      }`}
                    >
                      {/* Bed header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[12px] font-bold text-red-500 uppercase">{p.bedId}</span>
                          <div className="text-[8px] text-neutral-500">{p.id}</div>
                        </div>
                        {/* Status light LED */}
                        <div className="flex items-center space-x-1.5">
                          <span className={`text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-none ${pillBg}`}>
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
                      <div className="mt-2 text-[10px] text-neutral-300 line-clamp-1 font-semibold">{p.name}</div>
                      <div className="text-[8px] text-neutral-500 line-clamp-1">{p.dx}</div>

                      {/* Micro vitals bar */}
                      <div className="grid grid-cols-3 gap-1 bg-[#141E33] p-1.5 my-2.5 border border-[#1C2E44]/70 text-[9px]">
                        <div className="flex flex-col text-center">
                          <span className="text-[7px] text-neutral-500 font-bold uppercase">HR</span>
                          <span className="font-bold text-[#00E676]">{p.hr}</span>
                        </div>
                        <div className="flex flex-col text-center border-l border-r border-[#1C2E44]">
                          <span className="text-[7px] text-neutral-500 font-bold uppercase">SpO₂</span>
                          <span className="font-bold text-[#00E5FF]">{p.spo2}%</span>
                        </div>
                        <div className="flex flex-col text-center">
                          <span className="text-[7px] text-neutral-500 font-bold uppercase">BP</span>
                          <span className="font-sans font-semibold text-red-400 text-[8.5px]">{p.bpSys}/{p.bpDia}</span>
                        </div>
                      </div>

                      {/* Specialist and risk summary */}
                      <div className="flex justify-between items-center text-[7.5px] mt-1 pt-1.5 border-t border-[#1C2E44]/40 text-neutral-500 font-bold">
                        <span>Risk Score: <b style={{ color: statusColor }}>{p.riskScore}%</b></span>
                        <span className="text-neutral-400 border border-[#1C2E44] px-1">{metrics.specialist.split(" ")[0]}</span>
                      </div>

                      {/* Live flashing warning warning ribbon */}
                      {metrics.spo2Deteriorating && (
                        <div className="absolute bottom-0 inset-x-0 h-1 bg-[#FFD740] animate-pulse"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: KAGGLE DATASETS WORKSPACE */}
          {activeTab === "kaggle" && (
            <div className="p-4 flex flex-col h-full bg-[#080D18] text-white overflow-y-auto">
              {/* Header Box */}
              <div className="mb-4 pb-3 border-b border-[#1C2E44] flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                  <h2 className="text-xs font-bold tracking-widest text-[#FFEE58] uppercase flex items-center space-x-1.5">
                    <Database size={14} className="text-[#FFEE58]" />
                    <span>Clinical Kaggle Dataset Lab</span>
                  </h2>
                  <p className="text-[9px] text-neutral-400 mt-1">
                    Load, parse, and analyze real clinical Kaggle data on the live ICU waveforms & beds.
                  </p>
                </div>
                {/* Active Source indicator */}
                <div className="mt-2 md:mt-0 px-2.5 py-1 bg-[#141E33] border border-[#1C2E44] flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-[8.5px] uppercase text-neutral-400">Active Source: </span>
                  <span className="text-[9.5px] text-[#00E5FF] font-bold">{loadedDatasetName}</span>
                </div>
              </div>

              {/* Success/Error Messaging */}
              {datasetSuccess && (
                <div className="mb-4 p-3 bg-green-950/30 border border-green-500/50 flex items-start space-x-2.5">
                  <CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" />
                  <div className="text-[9px] leading-relaxed text-green-200">{datasetSuccess}</div>
                </div>
              )}
              {datasetError && (
                <div className="mb-4 p-3 bg-red-950/30 border border-red-500/50 flex items-start space-x-2.5">
                  <AlertCircle size={14} className="text-[#FF5252] shrink-0 mt-0.5" />
                  <div className="text-[9px] leading-relaxed text-red-200">{datasetError}</div>
                </div>
              )}

              {/* INSTRUCTION BLOCK: Where to save. */}
              <div className="mb-5 p-4 bg-[#0E1525] border border-dashed border-[#1C2E44] text-[9.5px]">
                <h3 className="font-bold uppercase text-[#FFEE58] tracking-wider mb-2 flex items-center space-x-1">
                  <Sparkles size={11} />
                  <span>Clinical Integration & File Location Guide</span>
                </h3>
                <p className="text-neutral-300 leading-normal mb-2.5">
                  The Patient Monitor is pre-configured to fetch and read downloaded CSVs natively. If you download clinical dataset files from Kaggle, please rename and save them directly in the workspace at the following absolute paths:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[8.5px] text-neutral-400">
                  <div className="p-2 bg-[#080D18] border border-[#1C2E44]/60">
                    <span className="text-[#00E676] font-semibold block mb-0.5">Sepsis Detection Dataset</span>
                    <span className="text-white select-all">/public/datasets/sepsis.csv</span>
                  </div>
                  <div className="p-2 bg-[#080D18] border border-[#1C2E44]/60">
                    <span className="text-[#00E5FF] font-semibold block mb-0.5">Heart Failure Records</span>
                    <span className="text-white select-all">/public/datasets/heart_failure.csv</span>
                  </div>
                  <div className="p-2 bg-[#080D18] border border-[#1C2E44]/60">
                    <span className="text-[#AA80FF] font-semibold block mb-0.5">Maternal Health Risk</span>
                    <span className="text-white select-all">/public/datasets/maternal_health.csv</span>
                  </div>
                </div>
                <div className="mt-3 text-[8px] text-neutral-500 italic">
                  *We prepared pre-loaded high-fidelity sample files at those locations so you can test loading and mapping them right now!
                </div>
              </div>

              {/* THREE KAGGLE DATASETS INTERACTIVE CARDS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
                
                {/* Dataset 1 Card */}
                <div className="bg-[#0E1525] border border-[#1C2E44] p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-1.5 pb-1.5 border-b border-[#1C2E44]">
                      <div>
                        <span className="text-[11px] font-bold text-[#00E676] block">1. PhysioNet Sepsis detection</span>
                        <span className="text-[7.5px] text-neutral-500 uppercase">Kaggle ID: sepsis-survival-dataset</span>
                      </div>
                      <span className="text-[7.5px] bg-[#141E33] px-1 py-0.2 text-neutral-400 font-bold">CSV</span>
                    </div>
                    <p className="text-[9px] text-neutral-300 leading-tight mb-3">
                      High-frequency physiological records tracking clinical early warning indices for ICU sepsis diagnosis. Includes correlation ratios.
                    </p>
                    <div className="text-[8px] space-y-1 text-neutral-500 font-semibold mb-4 bg-[#141E33]/30 p-2 border border-[#1C2E44]/40">
                      <div><span className="text-[#00E676] font-bold">Mapped Vitals:</span> HR, SpO2, Temperature, Blood Pressure, Respiratory Rate</div>
                      <div><span className="text-[#00E676] font-bold">Early Warn:</span> TREWS Sepsis Alert, EPIC EDI index</div>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => loadAndInjectDataset("sepsis", "sepsis.csv")}
                      disabled={isLabbing}
                      className="w-full py-2 border border-[#00E676]/40 hover:border-[#00E676] hover:bg-[#00E676]/10 text-[#00E676] font-bold text-[9px] uppercase tracking-wider transition-colors"
                    >
                      {isLabbing ? "Generating Matrix..." : "Sync /public/sepsis.csv"}
                    </button>
                  </div>
                </div>

                {/* Dataset 2 Card */}
                <div className="bg-[#0E1525] border border-[#1C2E44] p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-1.5 pb-1.5 border-b border-[#1C2E44]">
                      <div>
                        <span className="text-[11px] font-bold text-[#00E5FF] block">2. UCSD Heart Failure Records</span>
                        <span className="text-[7.5px] text-neutral-500 uppercase">Kaggle ID: heart-failure-clinical-data</span>
                      </div>
                      <span className="text-[7.5px] bg-[#141E33] px-1 py-0.2 text-neutral-400 font-bold">CSV</span>
                    </div>
                    <p className="text-[9px] text-neutral-300 leading-tight mb-3">
                      Clinical variables predicting cardiovascular failure mortality and decompensation risk. Features serum creatinine / ejection fractions.
                    </p>
                    <div className="text-[8px] space-y-1 text-neutral-500 font-semibold mb-4 bg-[#141E33]/30 p-2 border border-[#1C2E44]/40">
                      <div><span className="text-[#00E5FF] font-bold">Mapped Vitals:</span> Age, Sex, Heart Rate, SpO2, SBP, BP (Hypotension risk)</div>
                      <div><span className="text-[#00E5FF] font-bold">Specialist:</span> Dispatches cardiologist, maps EF indicators</div>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => loadAndInjectDataset("heart", "heart_failure.csv")}
                      disabled={isLabbing}
                      className="w-full py-2 border border-[#00E5FF]/40 hover:border-[#00E5FF] hover:bg-[#00E5FF]/10 text-[#00E5FF] font-bold text-[9px] uppercase tracking-wider transition-colors"
                    >
                      {isLabbing ? "Generating Matrix..." : "Sync /public/heart_failure.csv"}
                    </button>
                  </div>
                </div>

                {/* Dataset 3 Card */}
                <div className="bg-[#0E1525] border border-[#1C2E44] p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-1.5 pb-1.5 border-b border-[#1C2E44]">
                      <div>
                        <span className="text-[11px] font-bold text-[#AA80FF] block">3. WHO Maternal Health Risk</span>
                        <span className="text-[7.5px] text-neutral-500 uppercase">Kaggle ID: maternal-health-risk-data</span>
                      </div>
                      <span className="text-[7.5px] bg-[#141E33] px-1 py-0.2 text-neutral-400 font-bold">CSV</span>
                    </div>
                    <p className="text-[9px] text-neutral-300 leading-tight mb-3">
                      Risk indicators mapping pre-eclampsia and gestational hypertensive syndromes. Monitors obstetric vitals and blood sugar variables.
                    </p>
                    <div className="text-[8px] space-y-1 text-neutral-500 font-semibold mb-4 bg-[#141E33]/30 p-2 border border-[#1C2E44]/40">
                      <div><span className="text-[#AA80FF] font-bold">Mapped Vitals:</span> Age, Systolic BP, Diastolic BP, Glucose, Temperature, Pupil Rate</div>
                      <div><span className="text-[#AA80FF] font-bold">Triage:</span> Obstetric hypertension risk classification</div>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => loadAndInjectDataset("maternal", "maternal_health.csv")}
                      disabled={isLabbing}
                      className="w-full py-2 border border-[#AA80FF]/40 hover:border-[#AA80FF] hover:bg-[#AA80FF]/10 text-[#AA80FF] font-bold text-[9px] uppercase tracking-wider transition-colors"
                    >
                      {isLabbing ? "Generating Matrix..." : "Sync /public/maternal_health.csv"}
                    </button>
                  </div>
                </div>

              </div>

              {/* DIRECT DRAG AND DROP ZONE */}
              <div className="bg-[#0E1525] border border-dashed border-[#1C2E44] p-6 text-center relative hover:border-[#FFEE58] transition-colors">
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                  <UploadCloud size={24} className="text-[#FFEE58] animate-bounce" style={{ animationDuration: "3s" }} />
                  <p className="text-[10px] font-bold text-neutral-300 uppercase">
                    Drag and Drop downloaded Kaggle clinical CSV here
                  </p>
                  <p className="text-[8px] text-neutral-500">
                    Supports sepsis.csv, heart_failure.csv, maternal_health.csv, or any custom medical sheet.
                  </p>
                  <p className="text-[9px] text-[#FFEE58] underline mt-1">
                    Click to browse local files
                  </p>
                </div>
              </div>

              {/* Reset to System Defaults Option */}
              <div className="mt-5 text-right">
                <button
                  onClick={() => {
                    setPatients(initialPatients);
                    setActivePatientId("P108");
                    setLoadedDatasetName("System Default Simulator Patients");
                    setDatasetSuccess("Restored clinical workspace to system-default real-time ICU simulator databases.");
                    setDatasetError(null);
                  }}
                  className="px-3 py-1.5 border border-[#1C2E44] hover:bg-neutral-800 text-[8.5px] uppercase text-neutral-400 hover:text-white transition-colors"
                >
                  Reset To Clinical Simulator Defaults
                </button>
              </div>

            </div>
          )}

        </section>

        {/* --- Right parameter column (160px fixed width) --- */}
        {/* Pinned Right - Aligns with hospital command console monitors showing ACTIVELY MONITORED patient */}
        <section id="parameter-column" className="w-[160px] h-full bg-[#0E1525] grid grid-rows-6">
          
          {/* Block 1: HR */}
          <div id="param-hr-block" style={{ contentVisibility: "auto" }} className="p-2 border-b border-[#1C2E44] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#00E676] uppercase">HR</span>
              <span className="text-[9px] text-neutral-500">LO 50 HI 120</span>
            </div>
            <div className="flex items-baseline justify-end space-x-0.5">
              <span className="text-[26px] font-semibold text-[#00E676] leading-none tracking-tighter">{hr}</span>
              <span className="text-[8px] text-[#00E676] opacity-75">bpm</span>
            </div>
            <div className="flex justify-between items-end text-[9px] text-neutral-500">
              <span className="text-[8px]">ECG LEAD II</span>
              {hr > 120 ? (
                <span className="text-red-500 animate-pulse font-bold">↑ TACHY</span>
              ) : (
                <span className="text-[#00E676] font-bold">● OK</span>
              )}
            </div>
          </div>

          {/* Block 2: SpO2 */}
          <div id="param-spo2-block" style={{ contentVisibility: "auto" }} className="p-2 border-b border-[#1C2E44] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#00E5FF] uppercase">SPO2</span>
              <span className="text-[9px] text-neutral-500">LO 90 HI 100</span>
            </div>
            <div className="flex items-baseline justify-end space-x-0.5">
              <span className="text-[26px] font-semibold text-[#00E5FF] leading-none tracking-tighter">{spo2}</span>
              <span className="text-[10px] text-[#00E5FF] opacity-75">%</span>
            </div>
            <div className="flex justify-between items-end text-[9px] text-neutral-500">
              <span>PR: {hr} bpm</span>
              {spo2 < 93 ? (
                <span className="text-amber-500 animate-pulse font-bold">↓ DESAT</span>
              ) : (
                <span className="text-[#00E5FF] font-bold">● OK</span>
              )}
            </div>
          </div>

          {/* Block 3: NIBP */}
          <div id="param-nibp-block" style={{ contentVisibility: "auto" }} className="p-2 border-b border-[#1C2E44] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#FF5252] uppercase">NIBP</span>
              <span className="text-[9px] text-neutral-500">SYS 140/90</span>
            </div>
            <div className="flex items-baseline justify-end">
              {nibpMeasuring ? (
                <span className="text-sm font-semibold text-[#FF5252] leading-none animate-pulse">CUFF MAIN...</span>
              ) : (
                <span className="text-[26px] font-semibold text-[#FF5252] leading-none tracking-tighter">
                  {nibpSys}/{nibpDia}
                </span>
              )}
            </div>
            <div className="flex justify-between items-end text-[9px] text-neutral-400">
              <span>MAP: ({calculatedMap})</span>
              {nibpSys < 90 ? (
                <span className="text-red-500 animate-pulse font-bold">↓ HYPO</span>
              ) : (
                <span className="text-red-500 font-bold opacity-60">● APPLIED</span>
              )}
            </div>
          </div>

          {/* Block 4: Temp */}
          <div id="param-temp-block" style={{ contentVisibility: "auto" }} className="p-2 border-b border-[#1C2E44] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#FFD740] uppercase">TEMP</span>
              <span className="text-[9px] text-neutral-500">LO 36 HI 38.5</span>
            </div>
            <div className="flex items-baseline justify-end space-x-0.5">
              <span className="text-[26px] font-semibold text-[#FFD740] leading-none tracking-tighter">{temp.toFixed(1)}</span>
              <span className="text-[10px] text-[#FFD740] opacity-75">°C</span>
            </div>
            <div className="flex justify-between items-end text-[9px] text-neutral-500">
              <span>{((temp * 9) / 5 + 32).toFixed(1)} °F</span>
              {temp > 38.5 ? (
                <span className="text-amber-500 animate-pulse font-bold">↑ FEVER</span>
              ) : (
                <span className="text-yellow-500 font-bold">● OK</span>
              )}
            </div>
          </div>

          {/* Block 5: RR */}
          <div id="param-rr-block" style={{ contentVisibility: "auto" }} className="p-2 border-b border-[#1C2E44] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#AA80FF] uppercase">RESP</span>
              <span className="text-[9px] text-neutral-500">LO 8 HI 25</span>
            </div>
            <div className="flex items-baseline justify-end space-x-0.5">
              <span className="text-[26px] font-semibold text-[#AA80FF] leading-none tracking-tighter">{rr}</span>
              <span className="text-[8px] text-[#AA80FF] opacity-75">/min</span>
            </div>
            <div className="flex justify-between items-end text-[9px] text-neutral-500">
              <span>I:E 1:2.0</span>
              {rr > 25 ? (
                <span className="text-amber-500 font-bold">↑ HIGH</span>
              ) : (
                <span className="text-purple-500 font-bold">● OK</span>
              )}
            </div>
          </div>

          {/* Block 6: EtCO2 */}
          <div id="param-co2-block" style={{ contentVisibility: "auto" }} className="p-2 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#FF9100] uppercase">CO2</span>
              <span className="text-[9px] text-neutral-500">LO 30 HI 45</span>
            </div>
            <div className="flex items-baseline justify-end space-x-0.5">
              <span className="text-[26px] font-semibold text-[#FF9100] leading-none tracking-tighter">{co2}</span>
              <span className="text-[9px] text-[#FF9100] opacity-75">mmHg</span>
            </div>
            <div className="flex justify-between items-end text-[9px] text-neutral-500">
              <span>FiCO2: 1</span>
              {co2 < 30 ? (
                <span className="text-amber-500 font-bold">↓ HYPO</span>
              ) : (
                <span className="text-orange-500 font-bold">● OK</span>
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
