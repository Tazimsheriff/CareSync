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
import { PatientCompanion } from "./components/PatientCompanion";
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

// --- DOCTOR & ESCALATION SYSTEM DOMAIN DATA ---
export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  status: "Available" | "Busy";
}

export interface ActiveAlert {
  id: string;
  patientName: string;
  bedId: string;
  riskScore: number;
  priority: string;
  vitals: {
    hr: number;
    spo2: number;
    bp: string;
    temp: number;
  };
  assignedDoctor: string;
  assignedDoctorStatus: "Not Responding" | "Handling" | "Forwarded";
  escalationLevel: number; // 1 to 4
  timeSinceAlert: number; // in seconds
  eta: number | null; // minutes to intervention
  backupDoctor: string | null;
  status: "Critical" | "Stable" | "Resolved";
  notifiedChannels: string[]; // ["Dashboard", "Email", "SMS", "WhatsApp", "Push"]
  notificationLogs: string[];
}

const initialDoctorsList: Doctor[] = [
  { id: "D1", name: "Dr. Smith", specialization: "Pulmonologist", status: "Busy" },
  { id: "D2", name: "Dr. David", specialization: "Cardiologist", status: "Available" },
  { id: "D3", name: "Dr. Emma", specialization: "Critical Care", status: "Busy" },
  { id: "D4", name: "Dr. John", specialization: "Critical Care", status: "Available" },
];

export default function App() {
  // --- Master Patient State ---
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [isDriftPaused, setIsDriftPaused] = useState<boolean>(false);

  // --- Doctors & Smart Escalation States ---
  const [doctorsList, setDoctorsList] = useState<Doctor[]>(initialDoctorsList);
  const [isEscalationFastMode, setIsEscalationFastMode] = useState<boolean>(false);
  const [escalantAlert, setEscalantAlert] = useState<ActiveAlert>({
    id: "A1023",
    patientName: "Alice Sepsis Core",
    bedId: "Bed 05",
    riskScore: 94,
    priority: "CRITICAL",
    vitals: {
      hr: 140,
      spo2: 82,
      bp: "85/55",
      temp: 103,
    },
    assignedDoctor: "Dr. Emma",
    assignedDoctorStatus: "Not Responding",
    escalationLevel: 1,
    timeSinceAlert: 0,
    eta: null,
    backupDoctor: "Dr. John",
    status: "Critical",
    notifiedChannels: ["Dashboard"],
    notificationLogs: ["[00:00:00] Emergency Detected! Ingested vital indicators (SPO2: 82%, HR: 140, Temp: 103°F).", "[00:00:01] Dashboard Critical Beacon activated in Central Command HUD."],
  });

  // --- Monitored Bed Selection ---
  const [activePatientId, setActivePatientId] = useState<string>("P108"); // starts with Jenkins, Sarah (ICU-08)

  // --- Navigation Tabs ---
  const [activeTab, setActiveTab] = useState<"live" | "table" | "command" | "kaggle" | "escalation" | "ecosystem">("live");

  // --- Wearable & Future Ecosystem Simulation States ---
  const [wearableVitals, setWearableVitals] = useState({
    hr: 125,
    spo2: 87,
    ecg: "Irregular (AFib detected)",
    steps: 1420,
    sleep: 4.2,
    stress: 84, // out of 100
  });
  const [wearablePulseStatus, setWearablePulseStatus] = useState<"abnormal" | "stable" | "afib">("abnormal");
  const [familyNotifySent, setFamilyNotifySent] = useState<boolean>(false);
  const [ambulanceStatus, setAmbulanceStatus] = useState<"idle" | "booking" | "dispatched" | "arrived">("idle");
  const [ambulanceEta, setAmbulanceEta] = useState<number>(6);
  const [voiceNurseQuery, setVoiceNurseQuery] = useState<string>("");
  const [voiceNurseAnswer, setVoiceNurseAnswer] = useState<string>("Select an oracle prompt above or ask a clinical question to activate the Voice AI Nurse.");
  const [voiceNurseIsTyping, setVoiceNurseIsTyping] = useState<boolean>(false);

  // --- Post-Discharge Patient Care & Medication Companion States ---
  const [companionSubTab, setCompanionSubTab] = useState<"hospital" | "patient">("patient");
  const [selectedCompanionMed, setSelectedCompanionMed] = useState<"Metformin" | "Aspirin" | "Atorvastatin">("Metformin");
  const [preferredCompLanguage, setPreferredCompLanguage] = useState<"Tamil" | "English" | "Hindi" | "Telugu" | "Malayalam">("Tamil");
  const [companionExplanation, setCompanionExplanation] = useState<string>("சுசன் அம்மா, காலை 8 மணி ஆகிவிட்டது. வெள்ளை நிற வட்ட மாத்திரையான மெட்ஃபார்மினை காலை உணவுக்குப் பிறகு எடுத்துக்கொள்ளுங்கள். இது உங்கள் சர்க்கரை நோயை கட்டுப்படுத்த உதவும்.");
  const [companionExplIsLoading, setCompanionExplIsLoading] = useState<boolean>(false);
  const [companionAudioPlaying, setCompanionAudioPlaying] = useState<boolean>(false);
  
  // Pill Identification States
  const [scannedPillResult, setScannedPillResult] = useState<{
    medicine: string;
    color: string;
    shape: string;
    dosage: string;
    purpose: string;
    food: string;
  } | null>(null);
  const [pillScannerLoading, setPillScannerLoading] = useState<boolean>(false);
  const [presetPillChoice, setPresetPillChoice] = useState<"white_round" | "red_capsule" | "yellow_hex" | "blue_oval">("white_round");

  // Patient Chat Q&A States
  const [patientUserMessage, setPatientUserMessage] = useState<string>("");
  const [patientChatHistory, setPatientChatHistory] = useState<Array<{ sender: "patient" | "system"; text: string }>>([
    { sender: "system", text: "Hello Susan, I am your CareSync AI Companion. You can ask me any question about your medications or health routines! (e.g., 'Can I take my pills with hot coffee?')" }
  ]);
  const [patientChatLoading, setPatientChatLoading] = useState<boolean>(false);

  // Medication Scheduled Alerts & Adherence Metrics
  const [scheduledReminders, setScheduledReminders] = useState<Array<{
    id: string;
    medicine: string;
    time: string;
    food: string;
    status: "taken" | "skipped" | "missed" | "pending";
    timeTaken?: string;
  }>>([
    { id: "1", medicine: "Metformin", time: "8:00 AM", food: "After breakfast", status: "taken", timeTaken: "8:02 AM" },
    { id: "2", medicine: "Aspirin", time: "2:00 PM", food: "Before lunch", status: "missed" },
    { id: "3", medicine: "Atorvastatin", time: "9:00 PM", food: "After dinner", status: "pending" }
  ]);

  const [missedAlarmsLogs, setMissedAlarmsLogs] = useState<string[]>([
    "[08:00 AM] 🔔 Reminder: Metformin checklist sent to Susan White.",
    "[08:02 AM] ✅ Susan confirmed: Metformin taken successfully.",
    "[02:00 PM] 🔔 Reminder: Aspirin checklist sent to Susan White.",
    "[02:15 PM] ⚠️ Warning: Aspirin medication not confirmed by Susan within 15 mins.",
    "[02:30 PM] 📱 Escalation Level 1: Daughter (Sarah White) dispatched SMS alert for missed/skipped Aspirin.",
    "[04:00 PM] ⚕️ Escalation Level 2: Caregiver and Dr. David's dashboard updated with Aspirin adherence failure."
  ]);

  const [dailyAdherence, setDailyAdherence] = useState<{ [key: string]: "taken" | "missed" | "pending" }>({
    "Monday": "taken",
    "Tuesday": "taken",
    "Wednesday": "missed",
    "Thursday": "taken",
    "Friday": "taken",
    "Saturday": "taken",
    "Sunday": "pending"
  });

  const speakText = (text: string, lang: string) => {
    if (!window.speechSynthesis) return;
    
    // Stop any existing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Map language code to standard voices for high quality
    const langCodes: Record<string, string> = {
      Tamil: "ta-IN",
      English: "en-US",
      Hindi: "hi-IN",
      Telugu: "te-IN",
      Malayalam: "ml-IN"
    };
    utterance.lang = langCodes[lang] || "en-US";
    
    // Attempt to select corresponding native language voice if available
    const voices = window.speechSynthesis.getVoices();
    const targetedVoice = voices.find(v => v.lang.startsWith(langCodes[lang] || "en"));
    if (targetedVoice) {
      utterance.voice = targetedVoice;
    }
    
    utterance.onstart = () => {
      setCompanionAudioPlaying(true);
    };
    utterance.onend = () => {
      setCompanionAudioPlaying(false);
    };
    utterance.onerror = () => {
      setCompanionAudioPlaying(false);
    };
    
    window.speechSynthesis.speak(utterance);
  };

  const fetchAndSpeakExplanation = async (med: string, lang: string) => {
    setCompanionExplIsLoading(true);
    setCompanionAudioPlaying(false);
    try {
      const response = await fetch("/api/explain-med", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicine: med, language: lang, age: 68 })
      });
      const data = await response.json();
      if (data.success && data.text) {
        setCompanionExplanation(data.text);
        speakText(data.text, lang);
      } else {
        throw new Error(data.error || "Cannot get translation");
      }
    } catch (err) {
      console.error(err);
      // Fallback statically if server is offline or fails
      const fallbackExplanations: Record<string, Record<string, string>> = {
        Metformin: {
          Tamil: "சுசன் அம்மா, காலை 8 மணி ஆகிவிட்டது. வெள்ளை நிற வட்ட மாத்திரையான மெட்ஃபார்மினை காலை உணவுக்குப் பிறகு எடுத்துக்கொள்ளுங்கள். இது உங்கள் சர்க்கரை நோயை கட்டுப்படுத்த உதவும்.",
          English: "Susan, it is 8 AM. Please take your white round tablet, Metformin. This medicine helps control your blood sugar. Take it after breakfast.",
          Hindi: "सुसान जी, कृपया नाश्ते के बाद अपनी मेटफॉर्मिन दवा लें। यह आपके ब्लड शुगर को नियंत्रित करने में मदद करेगी।",
          Telugu: "సుసాన్ గారు, దయచేసి అల్పాహారం తర్వాత మీ మెట్‌ఫార్మిన్ టాబ్లెట్ తీసుకోండి. ఇది రక్తంలో చక్కెరను నియంత్రిస్తుంది.",
          Malayalam: "സുസൻ, ദയവായി പ്രഭാതഭക്ഷണത്തിന് ശേഷം മെറ്റ്ഫോർമിൻ കഴിക്കുക. ഇത് നിങ്ങളുടെ രക്തത്തിലെ പഞ്ചസാരയുടെ അളവ് നിയന്ത്രിക്കാൻ സഹായിക്കും."
        },
        Aspirin: {
          Tamil: "சுசன் அம்மா, மதியம் 2 மணி ஆயிற்று. ஆஸ்பிரின் மாத்திரையை மதிய உணவுக்கு முன் எடுத்துக்கொள்ளுங்கள். இது உங்கள் இரத்த ஓட்டத்தை சீராக்க உதவும்.",
          English: "Susan, it is 2 PM. Please take your Aspirin tablet before lunch. This medicine helps maintain smooth blood circulation.",
          Hindi: "सुसान जी, दोपहर 2 बजे हो चुके हैं। कृपया भोजन से पहले एस्पिरिन लें। यह रक्त परिसंचरण को ठीक रखता है।",
          Telugu: "సుసాన్ గారు, మధ్యాహ్నం 2 గంటలయింది. భోజనానికి ముందు ఆస్పిరిన్ తీసుకోండి. ఇది రక్త ప్రసరణను పెంచుతుంది.",
          Malayalam: "സുസൻ, ഉച്ചയ്ക്ക് 2 മണിയായി. ഉച്ചഭക്ഷണത്തിന് മുൻപ് ആസ്പിരിൻ ഗുളിക കഴിക്കുക."
        },
        Atorvastatin: {
          Tamil: "சுசன் அம்மா, இரவு 9 மணி ஆயிற்று. அடோர்வாஸ்டாடின் மாத்திரையை இரவு உணவிற்குப் பிறகு எடுத்துக்கொள்ளுங்கள். இது உங்கள் கொழுப்பைக் குறைக்க உதவும்.",
          English: "Susan, it is 9 PM. Please take your Atorvastatin tablet after dinner. This medicine helps lower cardial cholesterol levels.",
          Hindi: "सुसान जी, रात 9 बजे हो चुके हैं। कृपया रात के भोजन के बाद एटोरवास्टेटिन लें। यह कोलेस्ट्रॉल कम करता है।",
          Telugu: "సుసాన్ గారు, రాత్రి 9 గంటలయింది. భోజనం తర్వాత అటోర్వాస్టాటిన్ తీసుకోండి. ఇది కొలెస్ట్రాల్‌ను తగ్గిస్తుంది.",
          Malayalam: "സുസൻ, രാത്രി 9 മണിയായി. അത്താഴത്തിന് ശേഷം അറ്റോർവാസ്റ്റാറ്റിൻ ഗുളിക കഴിക്കുക."
        }
      };
      
      const medFallbacks = fallbackExplanations[med as "Metformin" | "Aspirin" | "Atorvastatin"] || fallbackExplanations["Metformin"];
      const text = medFallbacks[lang] || medFallbacks["English"];
      setCompanionExplanation(text);
      speakText(text, lang);
    } finally {
      setCompanionExplIsLoading(false);
    }
  };

  const handleScanPill = async () => {
    setPillScannerLoading(true);
    setScannedPillResult(null);
    try {
      const presets: Record<string, string> = {
        white_round: "I am showing a white round tablet. Detail name, shape, standard strength, and dosage.",
        red_capsule: "I am showing a red capsule pharmaceutical pill. Detail name, color, purpose, and dietary guidelines.",
        yellow_hex: "I have a yellow hexagonal tablet. Is it Atorvastatin 20mg? Detail cholesterol benefits and dinner requirements.",
        blue_oval: "I am holding a blue oval tablet. Please analyze."
      };
      
      const query = presets[presetPillChoice] || "Identify this medicine tablet.";
      
      const res = await fetch("/api/identify-pill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textQuery: query })
      });
      const responseData = await res.json();
      if (responseData.success && responseData.data) {
        setScannedPillResult(responseData.data);
      } else {
        throw new Error("No success result from image scan");
      }
    } catch (err) {
      console.error(err);
      // Fallback
      const fallbacks: Record<string, any> = {
        white_round: {
          medicine: "Metformin 500mg",
          color: "White",
          shape: "Round",
          dosage: "One tablet",
          purpose: "Controls blood glucose level and enhances insulin response.",
          food: "Take after breakfast with cup of water."
        },
        red_capsule: {
          medicine: "Aspirin 75mg Low-Dose",
          color: "Red",
          shape: "Capsule/Oval",
          dosage: "One tablet",
          purpose: "Thin blood and prevent cardiovascular clots or heart stroke.",
          food: "Take before meal with warm water."
        },
        yellow_hex: {
          medicine: "Atorvastatin 20mg (Lower Lipids)",
          color: "Yellow",
          shape: "Hexagonal",
          dosage: "One tablet",
          purpose: "Reduces cholesterol / lipid synthesis inside clinical studies.",
          food: "Take after dinner before going to bed."
        },
        blue_oval: {
          medicine: "Metoprolol 50mg (Beta-Blocker)",
          color: "Blue",
          shape: "Oval",
          dosage: "Half tablet",
          purpose: "Maintains optimal heart beat and drops severe hypertension.",
          food: "Take with breakfast meal daily."
        }
      };
      setScannedPillResult(fallbacks[presetPillChoice]);
    } finally {
      setPillScannerLoading(false);
    }
  };

  const handleSendPatientMessage = async () => {
    if (!patientUserMessage.trim()) return;
    const msg = patientUserMessage;
    setPatientChatHistory(prev => [...prev, { sender: "patient", text: msg }]);
    setPatientUserMessage("");
    setPatientChatLoading(true);

    try {
      const response = await fetch("/api/patient-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          language: preferredCompLanguage,
          age: 68,
          selectedMed: selectedCompanionMed
        })
      });
      const data = await response.json();
      if (data.success && data.text) {
        setPatientChatHistory(prev => [...prev, { sender: "system", text: data.text }]);
      } else {
        throw new Error("Failed patient chat answer");
      }
    } catch (err) {
      console.error(err);
      // Simple fallback Q&A logic matching common topics
      let replyText = "";
      if (msg.toLowerCase().includes("coffee") || msg.toLowerCase().includes("milk") || msg.toLowerCase().includes("tea")) {
        replyText = "Dearest Susan, it is highly recommended to take your Metformin or Aspirin only with clean, room-temperature water. Drinks like coffee, hot tea, or sweet juices can alter how fast the pill dissolves and may elevate your stomach acidity. Please drink a full glass of water instead!";
      } else if (msg.toLowerCase().includes("what does") || msg.toLowerCase().includes("purpose") || msg.toLowerCase().includes("do")) {
        replyText = `Your prescribed ${selectedCompanionMed} is critical for your recovery. It works to stabilize your systemic indicators like blood glucose or cardial circulation. Please verify with Dr. David if you need more custom dosage guidance!`;
      } else if (msg.toLowerCase().includes("forget") || msg.toLowerCase().includes("miss")) {
        replyText = "Do not worry! If you miss a dose by less than 2 hours, please take it immediately. However, if it is almost time for your afternoon or evening pill, skip the missed round completely and resume your normal pattern. Never take double doses.";
      } else {
        replyText = `Susan White, I am tracking your active home recovery on your wearable watch. Taking your ${selectedCompanionMed} regularly is helping your heart parameters stay completely stable. Please contact Sarah or Dr. David immediately if you experience dizziness or fatigue!`;
      }
      setPatientChatHistory(prev => [...prev, { sender: "system", text: replyText }]);
    } finally {
      setPatientChatLoading(false);
    }
  };

  const [digitalTwinOptions, setDigitalTwinOptions] = useState({
    oxygen: false,
    antibiotics: false,
    fluids: false,
  });
  const [twinSurvivalChance, setTwinSurvivalChance] = useState<number>(70);
  const [twinLog, setTwinLog] = useState<string[]>([
    "Virtual Baseline: Alice's Sepsis simulation loaded.",
    "Survival likelihood estimated at 70% with standard diagnostic delay."
  ]);

  // --- Smart Escalation Helper Handlers ---
  const triggerEscalationScenario = (patientKey: "alice" | "bob" | "stable") => {
    if (patientKey === "alice") {
      setEscalantAlert({
        id: "A1023",
        patientName: "Alice Sepsis Core",
        bedId: "Bed 05",
        riskScore: 94,
        priority: "CRITICAL",
        vitals: {
          hr: 140,
          spo2: 82,
          bp: "85/55",
          temp: 103,
        },
        assignedDoctor: "Dr. Emma",
        assignedDoctorStatus: "Not Responding",
        escalationLevel: 1,
        timeSinceAlert: 0,
        eta: null,
        backupDoctor: "Dr. John",
        status: "Critical",
        notifiedChannels: ["Dashboard"],
        notificationLogs: [
          `[00:00:00] 🔍 Ingested raw real-time physiological indicators (SPO2 82%, HR 140 bpm, Temp 103°F).`,
          `[00:00:01] 🧠 CareSync AI computed Risk Level 94% [CRITICAL]. Identified high Sepsis probability.`,
          `[00:00:02] 🚨 Central Command HUD warning sirens triggered. Level 1 pager dispatched to Primary Doctor Dr. Emma (status: Busy).`
        ]
      });
    } else if (patientKey === "bob") {
      setEscalantAlert({
        id: "A1024",
        patientName: "Bob Heart Shock",
        bedId: "Bed 12",
        riskScore: 91,
        priority: "CRITICAL",
        vitals: {
          hr: 128,
          spo2: 86,
          bp: "80/50",
          temp: 97.5,
        },
        assignedDoctor: "Dr. David",
        assignedDoctorStatus: "Not Responding",
        escalationLevel: 1,
        timeSinceAlert: 0,
        eta: null,
        backupDoctor: "Dr. John",
        status: "Critical",
        notifiedChannels: ["Dashboard", "SMS"],
        notificationLogs: [
          `[00:00:00] 🔍 Cardiogenic feedback loop processed for Bob Heart Shock (BP 80/50, SPO2 86%).`,
          `[00:00:01] 🧠 Mean Arterial Pressure (MAP) is dangerously low. Critical Heart Failure exacerbation flagged.`,
          `[00:00:02] 📱 Level 1 notice dispatched to Primary Cardiologist Dr. David (status: Available).`
        ]
      });
    } else {
      setEscalantAlert({
        id: "A1020",
        patientName: "Normal Ward Surveillance",
        bedId: "Bed 19",
        riskScore: 12,
        priority: "STABLE",
        vitals: {
          hr: 72,
          spo2: 99,
          bp: "120/80",
          temp: 98.6,
        },
        assignedDoctor: "Dr. Smith",
        assignedDoctorStatus: "Handling",
        escalationLevel: 1,
        timeSinceAlert: 0,
        eta: null,
        backupDoctor: null,
        status: "Stable",
        notifiedChannels: ["Dashboard"],
        notificationLogs: [`[00:00:00] Ward conditions normalized. System in standard background surveillance loop.`]
      });
    }
  };

  const handleDoctorAccept = () => {
    setEscalantAlert(prev => {
      const logs = [...prev.notificationLogs];
      const m = Math.floor(prev.timeSinceAlert / 60);
      const s = prev.timeSinceAlert % 60;
      const tStr = `[${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}]`;
      
      logs.push(`${tStr} ✅ Alert Accepted! ${prev.assignedDoctor} dispatched explicit bedside confirm.`);
      logs.push(`${tStr} ⏳ Calculated Time to Intervention (ETI) active: 2.0 minutes. Safe coverage achieved.`);
      return {
        ...prev,
        assignedDoctorStatus: "Handling",
        eta: 2,
        notificationLogs: logs
      };
    });
  };

  const handleDoctorForward = () => {
    setEscalantAlert(prev => {
      const logs = [...prev.notificationLogs];
      const m = Math.floor(prev.timeSinceAlert / 60);
      const s = prev.timeSinceAlert % 60;
      const tStr = `[${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}]`;
      
      logs.push(`${tStr} ❌ Alert DECLINED / REJECTED by ${prev.assignedDoctor}. Triggering re-allocation protocol.`);
      
      // Auto routing: scan doctorsList for first available who is not the current assigned one
      const nextAvailable = doctorsList.find(d => d.status === "Available" && d.name !== prev.assignedDoctor);
      const candidateName = nextAvailable ? nextAvailable.name : "Dr. John";
      
      logs.push(`${tStr} 🔍 CareSync AI automated routing searching alternative clinical responders...`);
      logs.push(`${tStr} 🔄 Auto-assigned secondary specialist ${candidateName} (Critical Care · Available) as active prime lead.`);
      
      return {
        ...prev,
        assignedDoctorStatus: "Not Responding",
        assignedDoctor: candidateName,
        notificationLogs: logs,
        eta: nextAvailable ? 3 : 1
      };
    });
  };

  const handleManualEscalate = () => {
    setEscalantAlert(prev => {
      if (prev.escalationLevel >= 4) return prev;
      const logs = [...prev.notificationLogs];
      const m = Math.floor(prev.timeSinceAlert / 60);
      const s = prev.timeSinceAlert % 60;
      const tStr = `[${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}]`;
      
      const newLevel = prev.escalationLevel + 1;
      logs.push(`${tStr} ⚡ Manual Escalation overridden by Ward Coordinator. Upgrading to Level ${newLevel}.`);
      
      const nextChannels = [...prev.notifiedChannels];
      if (newLevel === 2) {
        if (!nextChannels.includes("SMS")) nextChannels.push("SMS");
        if (!nextChannels.includes("Email")) nextChannels.push("Email");
      } else if (newLevel === 3) {
        if (!nextChannels.includes("WhatsApp")) nextChannels.push("WhatsApp");
      } else if (newLevel === 4) {
        if (!nextChannels.includes("Push")) nextChannels.push("Push");
      }

      return {
        ...prev,
        escalationLevel: newLevel,
        notificationLogs: logs,
        notifiedChannels: nextChannels
      };
    });
  };

  const toggleDoctorStatus = (docId: string) => {
    setDoctorsList(prev => 
      prev.map(d => {
        if (d.id === docId) {
          const nextStatus = d.status === "Available" ? "Busy" : "Available";
          return { ...d, status: nextStatus };
        }
        return d;
      })
    );
  };

  // --- Wearable & Future Ecosystem Helper Handlers ---
  const setWearableScenario = (scenario: "stable" | "hypoxia" | "afib") => {
    setWearablePulseStatus(scenario);
    setFamilyNotifySent(false);
    if (scenario === "stable") {
      setWearableVitals({
        hr: 72,
        spo2: 98,
        ecg: "Normal Sinus Rhythm",
        steps: 8420,
        sleep: 7.5,
        stress: 24,
      });
    } else if (scenario === "hypoxia") {
      setWearableVitals({
        hr: 125,
        spo2: 87,
        ecg: "Sinus Tachycardia",
        steps: 1420,
        sleep: 4.2,
        stress: 84,
      });
    } else {
      setWearableVitals({
        hr: 142,
        spo2: 91,
        ecg: "Irregular AFib detected (High HRV)",
        steps: 2200,
        sleep: 3.1,
        stress: 92,
      });
    }
  };

  const handleToggleTwinOption = (option: "oxygen" | "antibiotics" | "fluids") => {
    setDigitalTwinOptions(prev => {
      const updated = { ...prev, [option]: !prev[option] };
      let score = 70;
      const logs = ["Virtual Patient: Simulating alterations in real time..."];
      
      if (updated.oxygen) {
        score += 12;
        logs.push("✓ Standardized high-humidity Oxygen Enrichment activated (+12% oxygen delivery saturation).");
      } else {
        logs.push("⚠ Lacking high-flow oxygen. Hypoxia hazard continues.");
      }
      
      if (updated.antibiotics) {
        score += 15;
        logs.push("✓ Intravenous empiric Sepsis antibiotics administered (+15% bacterial clearance target).");
      } else {
        logs.push("⚠ Lacking antibiotic dosage. Bacterial replication is unbound.");
      }
      
      if (updated.fluids) {
        score += 8;
        logs.push("✓ Bolus crystalloid fluid resuscitation initiated (+8% mean arterial pressure stability).");
      } else {
        logs.push("⚠ Blood pressure continues hovering at low margins.");
      }
      
      setTwinSurvivalChance(score);
      setTwinLog(logs);
      return updated;
    });
  };

  const askVoiceAI = (q: string) => {
    setVoiceNurseIsTyping(true);
    setVoiceNurseQuery(q);
    
    let ans = "";
    if (q.includes("critical")) {
      ans = "Analyzing ICU Central Command feeds: Currently 2 patients are flagged as Critical. Sarah Jenkins (Sepsis, 94% Risk index, Oxygen dropped to 82%, Temp 103°F) and Bob Heart Shock (Cardiogenic failure risk, HR 128 bpm, BP 80/50). Immediate bedside intervention is recommended.";
    } else if (q.includes("Sarah") || q.includes("Sepsis") || q.includes("Why")) {
      ans = "Sarah's risk score scaled to 94% due to synchronized Sepsis indicators: Her core body temperature surged to 103.0°F indicating systemic inflammatory response syndrome (SIRS), paired with progressive arterial hypoxia reaching 82% SPO2 and tachycardia at 140 bpm. The deterministic local edge model triggers an urgent escalation pathway.";
    } else if (q.includes("twin")) {
      ans = "The CareSync Digital Twin performs micro-simulations of bedside alterations: Activating Oxygen Enrichment increases survival expectations from 70% to 82%. Adding intravenous empiric antibiotics and crystalloid fluid resuscitation stabilizes her risk of mortality down to less than 5% with 95% survival path confidence.";
    } else if (q.includes("outbreak") || q.includes("Disease")) {
      ans = "Early Warning clustering is active: CareSync isolated 5 synchronous cases of high-fever anomalies in the West Ward. Clinical workflow recommends an local airborne quarantine sweep and preventative testing block to buffer county public health containment.";
    } else {
      ans = "Standard monitoring limits look functional. Continuous hospital IoT edge streams indicate 98.2% telemetry data fidelity across all bed slots on the active ward roster.";
    }

    setTimeout(() => {
      setVoiceNurseAnswer(ans);
      setVoiceNurseIsTyping(false);
    }, 400);
  };

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
  const [isVitalsOpen, setIsVitalsOpen] = useState(false);

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

  // --- Smart Escalation Clock Ticker Effect ---
  useEffect(() => {
    if (escalantAlert.status !== "Critical") return;
    
    const tickRate = isEscalationFastMode ? 5 : 1; 
    const timer = setInterval(() => {
      setEscalantAlert(prev => {
        if (prev.status !== "Critical" || prev.assignedDoctorStatus === "Handling") {
          return prev;
        }

        const nextTime = prev.timeSinceAlert + tickRate;
        let nextLevel = prev.escalationLevel;
        const nextLogs = [...prev.notificationLogs];
        const nextChannels = [...prev.notifiedChannels];

        const formatTime = (sec: number) => {
          const m = Math.floor(sec / 60);
          const s = sec % 60;
          return `[${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}]`;
        };

        // Transition from Level 1 -> 2
        if (prev.timeSinceAlert < 30 && nextTime >= 30) {
          nextLevel = 2;
          nextLogs.push(`${formatTime(30)} ⏳ Level 1 Timeout for ${prev.assignedDoctor} (No response). Escalating...`);
          nextLogs.push(`${formatTime(31)} 📱 Level 2 Activated: Dispatched alert to Cardiology Specialist.`);
          if (!nextChannels.includes("Email")) nextChannels.push("Email");
          if (!nextChannels.includes("SMS")) nextChannels.push("SMS");
        }

        // Transition from Level 2 -> 3
        if (prev.timeSinceAlert < 60 && nextTime >= 60) {
          nextLevel = 3;
          nextLogs.push(`${formatTime(60)} ⏳ Level 2 Response clock expired. Critical specialist assigned is busy.`);
          nextLogs.push(`${formatTime(62)} 💬 Level 3 Activated: Direct routing to ICU Nurse Station & Paging Roster.`);
          if (!nextChannels.includes("WhatsApp")) nextChannels.push("WhatsApp");
        }

        // Transition from Level 3 -> 4
        if (prev.timeSinceAlert < 95 && nextTime >= 95) {
          nextLevel = 4;
          nextLogs.push(`${formatTime(95)} 🚨 Level 3 Timeout. Life-threatening duration threshold exceeded!`);
          nextLogs.push(`${formatTime(97)} 🌍 Level 4 Activated: Initiating Hospital-wide Emergency Broadcast & FCM Mobile Push Alarm.`);
          if (!nextChannels.includes("Push")) nextChannels.push("Push");
        }

        return {
          ...prev,
          timeSinceAlert: nextTime,
          escalationLevel: nextLevel,
          notifiedChannels: nextChannels,
          notificationLogs: nextLogs
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [escalantAlert.status, isEscalationFastMode, doctorsList]);

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
      <header id="topbar" className="h-[44px] border-b border-slate-200 px-2 sm:px-4 flex items-center justify-between bg-white shadow-sm z-10 text-slate-800 shrink-0 select-none">
        <div className="flex items-center space-x-1.5 sm:space-x-4 text-[11px] h-full overflow-hidden">
          <div className="flex flex-col select-none justify-center shrink-0">
            <span className="font-bold text-[10px] sm:text-[12px] tracking-wider text-slate-900 font-mono">CARESYNC</span>
            <span className="text-[6.5px] sm:text-[7.5px] text-emerald-600 font-bold tracking-widest uppercase font-mono">AI MONITOR</span>
          </div>

          {/* Tab Switchers (Scrollable on small screens) */}
          <div className="flex h-full border-l border-slate-200 ml-1 sm:ml-2 overflow-x-auto whitespace-nowrap scrollbar-none flex-nowrap shrink max-w-[120px] xs:max-w-[180px] sm:max-w-xs md:max-w-none">
            <button
              onClick={() => setActiveTab("live")}
              className={`px-2 sm:px-3 text-[9px] sm:text-[9.5px] shrink-0 font-bold tracking-wider uppercase h-full transition-all border-r border-slate-100 font-mono ${
                activeTab === "live"
                  ? "bg-[#E6F4EA] text-[#059669] border-b-2 border-[#10B981]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              Live Monitor
            </button>
            <button
              onClick={() => setActiveTab("table")}
              className={`px-2 sm:px-3 text-[9px] sm:text-[9.5px] shrink-0 font-bold tracking-wider uppercase h-full transition-all border-r border-slate-100 font-mono ${
                activeTab === "table"
                  ? "bg-[#FFF4E5] text-[#D97706] border-b-2 border-[#F59E0B]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              Patient Board
            </button>
            <button
              onClick={() => setActiveTab("command")}
              className={`px-2 sm:px-3 text-[9px] sm:text-[9.5px] shrink-0 font-bold tracking-wider uppercase h-full transition-all border-r border-slate-100 font-mono ${
                activeTab === "command"
                  ? "bg-[#F3E8FF] text-[#6D28D9] border-b-2 border-[#8B5CF6]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              ICU beds
            </button>
            <button
              onClick={() => setActiveTab("kaggle")}
              className={`px-2 sm:px-3 text-[9px] sm:text-[9.5px] shrink-0 font-bold tracking-wider uppercase h-full transition-all border-r border-slate-100 font-mono ${
                activeTab === "kaggle"
                  ? "bg-[#FEFCE8] text-[#A16207] border-b-2 border-[#EAB308]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              Kaggle Lab
            </button>
            <button
               onClick={() => {
                 setActiveTab("escalation");
               }}
               className={`px-2 sm:px-3 text-[9px] sm:text-[9.5px] shrink-0 font-bold tracking-wider uppercase h-full transition-all border-r border-slate-100 font-mono ${
                 activeTab === "escalation"
                   ? "bg-[#FAF5FF] text-[#7E22CE] border-b-2 border-[#9333EA] font-extrabold"
                   : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
               }`}
            >
              🚨 Smart Escalation
            </button>
            <button
               onClick={() => {
                 setActiveTab("ecosystem");
               }}
               className={`px-2 sm:px-3 text-[9px] sm:text-[9.5px] shrink-0 font-bold tracking-wider uppercase h-full transition-all border-r border-slate-100 font-mono ${
                 activeTab === "ecosystem"
                   ? "bg-[#ECFDF5] text-[#047857] border-b-2 border-[#059669] font-extrabold"
                   : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
               }`}
            >
              🌐 IoMT Ecosystem
            </button>

          </div>

          <div className="border-l border-slate-200 pl-4 hidden md:flex items-center space-x-1 shrink-0">
            <span className="text-slate-400">ACTIVE: </span>
            <span className="font-semibold text-slate-800">{activePatient.name}</span>
            <span className="text-[9px] bg-red-50 px-1.5 py-0.2 border border-red-200 tracking-normal text-red-600 font-bold ml-1 rounded-sm uppercase font-mono">
              {activePatient.bedId.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Alarms, Dot Pulse, Live clock */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
          
          {/* Active flashing alarm pills of the ACTIVELY MONITORED patient right now */}
          <div id="alarm-pills-container" className="hidden lg:flex items-center space-x-2">
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

          {/* Compact alert warning label for custom mobile displays */}
          {activeAlarmsSummary.some(a => a.active) && (
            <div 
              onClick={() => setSelectedPatientId(activePatient.id)}
              className="lg:hidden flex items-center justify-center p-1 font-mono rounded-sm cursor-pointer bg-red-50 text-red-600 border border-red-200"
              title="Active Critical Alerts present for patient"
            >
              <AlertTriangle size={13} className="animate-bounce" />
            </div>
          )}

          {/* Mobile Vitals Sidebar Toggle */}
          <button
            onClick={() => setIsVitalsOpen(!isVitalsOpen)}
            className="lg:hidden px-2 py-1 text-[8px] sm:text-[9.5px] font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm font-mono flex items-center space-x-1 transition-colors"
          >
            <Activity size={10} className="text-emerald-600 animate-pulse shrink-0" />
            <span>{isVitalsOpen ? "Hide Vitals" : "Vitals"}</span>
          </button>

          <div className="hidden xs:flex items-center space-x-1.5 border-l border-slate-200 pl-3">
            <span className="text-[9px] text-slate-400 font-bold font-mono">PULSE</span>
            <div className="relative flex items-center justify-center w-3 h-3">
              <span className="absolute w-2 h-2 bg-[#10B981] rounded-full animate-pulse-dot"></span>
              <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full"></span>
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-2 border-l border-slate-200 pl-3 text-sm text-slate-500 font-bold tracking-wider select-none font-mono">
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
          {/* TAB 1: LIVE OUTPATIANCE COCKPIT */}
          {activeTab === "live" && (() => {
            const activeMetrics = getPatientMetrics(activePatient);
            const activeAIExplanation = getExplainableAIReason(activePatient);

            return (
              <div className="flex flex-col h-full bg-[#F8FAFC]">
                
                {/* Question 1: WHO IS CRITICAL? (Hospital Statistics top panel) */}
                <div className="p-4 pb-2 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 shrink-0">
                  <div className="bg-white border-l-4 border-[#DC2626] border border-slate-200 p-3 shadow-xs rounded-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">Critical priority</span>
                      <h4 className="text-[22px] font-extrabold text-[#DC2626] font-mono leading-tight mt-0.5">
                        {patients.filter(p => p.priority === "Critical").length} Patients
                      </h4>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-red-50 flex items-center justify-center text-[#DC2626]">
                      <ShieldAlert size={18} className="animate-pulse" />
                    </div>
                  </div>

                  <div className="bg-white border-l-4 border-[#F97316] border border-slate-200 p-3 shadow-xs rounded-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">High Risk</span>
                      <h4 className="text-[22px] font-extrabold text-[#F97316] font-mono leading-tight mt-0.5">
                        {patients.filter(p => p.priority === "High Risk").length} Patients
                      </h4>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-amber-50 flex items-center justify-center text-[#F97316]">
                      <AlertTriangle size={18} />
                    </div>
                  </div>

                  <div className="bg-white border-l-4 border-[#22C55E] border border-slate-200 p-3 shadow-xs rounded-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">Stable / Under Watch</span>
                      <h4 className="text-[22px] font-extrabold text-slate-800 font-mono leading-tight mt-0.5">
                        {patients.filter(p => p.priority === "Stable" || p.priority === "Moderate").length} Patients
                      </h4>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-emerald-50 flex items-center justify-center text-[#22C55E]">
                      <CheckCircle size={18} />
                    </div>
                  </div>
                </div>

                {/* MAIN CONTENT SPLIT GRID */}
                <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-4 p-4 pt-2 min-h-0">
                  
                  {/* Question 2: Which patient should I see first? (Left-side queue, 3/12 cols) */}
                  <div className="xl:col-span-3 bg-white border border-slate-200 p-3 flex flex-col h-[520px] xl:h-full rounded-sm shadow-xs overflow-hidden">
                    <div className="mb-2 shrink-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">PRIORITY QUEUE</span>
                        <span className="text-[8px] font-extrabold bg-[#E6F4EA] text-[#059669] px-1.5 py-0.2 rounded-sm font-mono uppercase">REAL-TIME</span>
                      </div>
                      <div className="text-[11px] font-bold text-slate-800 mt-1">Which patient should I see first?</div>
                      <p className="text-[9px] text-slate-400 leading-tight mt-0.5">Sorted strictly by predictive decompensation risk score.</p>
                    </div>

                    {/* List Container */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 pt-1">
                      {[...patients]
                        .sort((a, b) => b.riskScore - a.riskScore)
                        .map((p) => {
                          const isActivelyFocused = p.id === activePatientId;
                          let dotColor = "bg-[#22C55E]";
                          let riskColor = "text-[#22C55E]";
                          let cardBorder = "border-slate-100";
                          if (p.priority === "Critical") {
                            dotColor = "bg-[#DC2626]";
                            riskColor = "text-[#DC2626]";
                            if (isActivelyFocused) cardBorder = "border-[#DC2626] ring-1 ring-[#DC2626]/20 bg-red-50/10";
                          } else if (p.priority === "High Risk") {
                            dotColor = "bg-[#F97316]";
                            riskColor = "text-[#F97316]";
                            if (isActivelyFocused) cardBorder = "border-[#F97316] ring-1 ring-[#F97316]/20 bg-amber-50/10";
                          } else {
                            if (isActivelyFocused) cardBorder = "border-[#2563EB] ring-1 ring-[#2563EB]/20 bg-blue-50/10";
                          }

                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                setActivePatientId(p.id);
                                setDatasetSuccess(`Focussed on ${p.name} (${p.bedId}) clinical status.`);
                              }}
                              className={`p-2.5 bg-white border ${cardBorder} shadow-2xs hover:shadow-xs hover:border-slate-300 rounded-sm cursor-pointer transition-all flex flex-col justify-between`}
                            >
                              <div className="flex justify-between items-start font-mono">
                                <div className="flex items-center space-x-1.5">
                                  <span className={`h-2 w-2 rounded-full ${dotColor}`}></span>
                                  <span className="text-[11px] font-extrabold text-slate-800 line-clamp-1">{p.name}</span>
                                </div>
                                <span className="text-[10px] font-bold text-red-650 uppercase font-mono">{p.bedId}</span>
                              </div>
                              <div className="flex justify-between items-center mt-2 text-[9.5px] font-mono">
                                <div>
                                  <span className="text-slate-400">Risk score: </span>
                                  <span className={`font-extrabold ${riskColor}`}>{p.riskScore}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400">SpO₂: </span>
                                  <span className={`font-extrabold ${p.spo2 < 93 ? "text-red-700" : "text-[#0284C7]"}`}>{p.spo2}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Question 3: Why is patient critical? (Center detail view, 6/12 cols) */}
                  <div className="xl:col-span-6 bg-white border border-slate-200 p-4 rounded-sm shadow-xs flex flex-col overflow-y-auto">
                    <div className="border-b border-slate-100 pb-3 mb-3 shrink-0">
                      <div className="flex flex-wrap justify-between items-center gap-2 font-mono">
                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 font-extrabold font-mono rounded-sm">
                            {activePatient.bedId.toUpperCase()}
                          </span>
                          <h3 className="text-sm font-extrabold text-slate-900">{activePatient.name}</h3>
                        </div>
                        <span className="text-[9.5px] font-bold text-slate-400">PATIENT ID: {activePatient.id}</span>
                      </div>

                      <div className="flex flex-wrap gap-2.5 text-[10px] text-slate-500 font-bold mt-2 font-mono">
                        <span>Age: {activePatient.age}y</span>
                        <span>&bull;</span>
                        <span>Sex: {activePatient.gender}</span>
                        <span>&bull;</span>
                        <span>Diagnosis: <b className="text-red-600 uppercase">{activePatient.dx}</b></span>
                      </div>
                    </div>

                    {/* Vitals Box - Extremely Tidy Big Clinical Numbers */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 font-mono">
                      
                      {/* HR */}
                      <div className="p-3 bg-[#F8FAFC]/70 border border-slate-200 rounded-sm flex flex-col justify-between h-[80px]">
                        <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-tight">
                          <span>Heart rate</span>
                          <span className="text-[#059669]">50-120</span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-2xl font-extrabold text-[#059669]">{activePatient.hr}</span>
                          <span className="text-[8.5px] text-slate-400">BPM</span>
                        </div>
                        <div className="text-[8px] font-bold text-slate-400 mt-1 uppercase">
                          {activePatient.hr > 120 ? (
                            <span className="text-red-600 font-extrabold">↑ Increasing</span>
                          ) : activePatient.hr < 60 ? (
                            <span className="text-red-500 font-extrabold">↓ Falling</span>
                          ) : (
                            <span className="text-[#059669] font-bold">● Stable watch</span>
                          )}
                        </div>
                      </div>

                      {/* SpO2 */}
                      <div className="p-3 bg-[#F8FAFC]/70 border border-slate-200 rounded-sm flex flex-col justify-between h-[80px]">
                        <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-tight">
                          <span>SpO₂ sat</span>
                          <span className="text-[#0284C7]">90-100</span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-2xl font-extrabold text-[#0284C7]">{activePatient.spo2}</span>
                          <span className="text-[8.5px] text-slate-400">%</span>
                        </div>
                        <div className="text-[8px] font-bold text-slate-400 mt-1 uppercase">
                          {activePatient.spo2 < 93 ? (
                            <span className="text-red-600 font-extrabold">↓ Falling</span>
                          ) : (
                            <span className="text-[#0284C7] font-bold">● Stable watch</span>
                          )}
                        </div>
                      </div>

                      {/* Blood Pressure */}
                      <div className="p-3 bg-[#F8FAFC]/70 border border-slate-200 rounded-sm flex flex-col justify-between h-[80px]">
                        <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-tight">
                          <span>Blood pressure</span>
                          <span className="text-red-650 text-[7.5px]">90/50 - 140/90</span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-xl font-extrabold text-red-600 tracking-tight">{activePatient.bpSys}/{activePatient.bpDia}</span>
                          <span className="text-[8px] text-slate-400">mmHg</span>
                        </div>
                        <div className="text-[8.5px] font-bold text-slate-400 mt-1 uppercase">
                          {activePatient.bpSys < 90 ? (
                            <span className="text-red-650 font-extrabold">↓ Hypotension</span>
                          ) : (
                            <span className="text-slate-400">● Stable watch</span>
                          )}
                        </div>
                      </div>

                      {/* Temperature */}
                      <div className="p-3 bg-[#F8FAFC]/70 border border-slate-200 rounded-sm flex flex-col justify-between h-[80px]">
                        <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-tight">
                          <span>Temp</span>
                          <span className="text-amber-600">36.0 - 38.5</span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-2xl font-extrabold text-amber-600">{activePatient.temp.toFixed(1)}</span>
                          <span className="text-[9.5px] text-slate-500">°C</span>
                        </div>
                        <div className="text-[8px] font-bold text-slate-400 mt-1 uppercase">
                          {activePatient.temp > 38.0 ? (
                            <span className="text-amber-700 font-extrabold">↑ High Fever</span>
                          ) : (
                            <span className="text-[#059669] font-bold">● Stable watch</span>
                          )}
                        </div>
                      </div>

                      {/* Respiratory rate */}
                      <div className="p-3 bg-[#F8FAFC]/70 border border-slate-200 rounded-sm flex flex-col justify-between h-[80px]">
                        <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-tight">
                          <span>Resp Rate</span>
                          <span className="text-[#7C3AED]">8-25</span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-2xl font-extrabold text-[#7C3AED]">{activePatient.rr}</span>
                          <span className="text-[8.5px] text-slate-400">/min</span>
                        </div>
                        <div className="text-[8px] font-bold text-slate-400 mt-1 uppercase">
                          {activePatient.rr > 22 ? (
                            <span className="text-[#7C3AED] font-extrabold">↑ Tachypnea</span>
                          ) : (
                            <span className="text-[#7C3AED] font-bold">● Stable watch</span>
                          )}
                        </div>
                      </div>

                      {/* Risk predict */}
                      <div className="p-3 bg-[#F8FAFC]/70 border border-slate-200 rounded-sm flex flex-col justify-between h-[80px]">
                        <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-tight">
                          <span>EDI Risk score</span>
                          <span className="text-slate-400">MIN 0 MAX 100</span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-2xl font-extrabold" style={{ color: activePatient.riskScore > 65 ? "#DC2626" : "#22C55E" }}>
                            {activePatient.riskScore}%
                          </span>
                        </div>
                        <div className="text-[8px] font-bold mt-1 uppercase">
                          {activePatient.riskScore > 75 ? (
                            <span className="text-red-600 font-extrabold">Critical</span>
                          ) : activePatient.riskScore > 40 ? (
                            <span className="text-amber-600 font-bold">High Risk</span>
                          ) : (
                            <span className="text-[#22C55E] font-extrabold">Stable</span>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Explainable AI block (Answering WHY is the patient critical?) */}
                    <div className="bg-slate-50 border border-slate-200 p-3.5 mb-4 rounded-sm">
                      <div className="flex items-center space-x-1.5 text-[10px] font-extrabold text-[#2563EB] uppercase tracking-wider font-mono">
                        <Sparkles size={12} />
                        <span>CareSync Explainable AI Clinical Guard</span>
                      </div>
                      
                      <p className="text-[10px] text-slate-700 leading-normal mt-1.5 font-sans">
                        Patient <strong className="text-slate-900 font-bold">{activePatient.name}</strong> has a computed Early Deterioration Index of <strong className="text-red-600 font-extrabold">{activePatient.riskScore}%</strong> because:
                      </p>

                      <ul className="space-y-1 mt-2 pl-3 text-[10px] text-slate-600 list-disc font-sans leading-relaxed">
                        {activeAIExplanation.length > 0 ? (
                          activeAIExplanation.map((reason, ri) => (
                            <li key={ri} className="text-slate-700">
                              <strong>{reason.split(" ")[0]}</strong> {reason.split(" ").slice(1).join(" ")}
                            </li>
                          ))
                        ) : (
                          <li className="text-emerald-700 font-semibold list-none pl-0">
                            ✓ All active vitals metrics reside perfectly inside their non-alarm normal ward bounds.
                          </li>
                        )}
                        
                        {activeMetrics.spo2Deteriorating && (
                          <li className="text-[#D97706] font-bold">
                            ⚠ TREND ALERT: SpO₂ history sequence exhibits continuous hypoxic slope deterioration: {activePatient.spo2History.join("% → ")}%. Predictive algorithms trigger immediate warning alert.
                          </li>
                        )}
                      </ul>

                      <div className="text-[9.5px] text-slate-400 font-mono mt-3 border-t border-slate-100 pt-2 flex items-center justify-between">
                        <span>Routing recommendation:</span>
                        <span className="text-indigo-650 font-bold uppercase">{activeMetrics.specialist}</span>
                      </div>
                    </div>

                    {/* Beautiful Clinical Timeline (Doctors love this!) */}
                    <div className="bg-white border border-slate-200 p-3.5 mb-4 rounded-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">
                         Clinical Trend Timeline
                      </div>
                      <div className="relative pl-4 border-l-2 border-slate-200 ml-1 space-y-3 pb-1 text-[10px] font-sans">
                        
                        {/* Timeline Node 1 */}
                        <div className="relative">
                          <span className="absolute -left-[21px] top-0.5 h-2 w-2 rounded-full border border-slate-300 bg-slate-350"></span>
                          <div className="flex justify-between items-baseline">
                            <span className="font-bold text-slate-800">12:00</span>
                            <span className="text-[9px] text-slate-400 font-medium">Baseline Watch</span>
                          </div>
                          <p className="text-[9.5px] text-slate-500 mt-0.5 leading-tight">Patient was stable. Autonomic homeostasis maintained. SpO₂ ~ {Math.min(100, activePatient.spo2 + 6)}%, HR ~ {activePatient.hr - 15} bpm.</p>
                        </div>

                        {/* Timeline Node 2 */}
                        <div className="relative">
                          <span className="absolute -left-[21px] top-0.5 h-2 w-2 rounded-full border border-amber-300 bg-amber-400"></span>
                          <div className="flex justify-between items-baseline">
                            <span className="font-bold text-[#E65100]">12:10</span>
                            <span className="text-[9px] text-amber-600 font-bold font-mono">Deterioration Slope</span>
                          </div>
                          <p className="text-[9.5px] text-slate-500 mt-0.5 leading-tight">SpO₂ level sequence recognized as continuous downward trend. Heart Rate slightly elevated to {activePatient.hr - 8} bpm.</p>
                        </div>

                        {/* Timeline Node 3 */}
                        <div className="relative">
                          <span className="absolute -left-[21px] top-0.5 h-2 w-2 rounded-full border border-red-300 bg-red-500 animate-pulse"></span>
                          <div className="flex justify-between items-baseline">
                            <span className="font-bold text-[#DC2626]">12:25</span>
                            <span className="text-[9px] text-red-600 font-bold font-mono uppercase">Telemetry Alarm Triggered</span>
                          </div>
                          <p className="text-[9.5px] text-slate-650 mt-0.5 leading-tight font-semibold">
                            Current active patient vitals recorded: SpO₂ value at {activePatient.spo2}%, heart rate {activePatient.hr} bpm, blood pressure {activePatient.bpSys}/{activePatient.bpDia} mmHg.
                          </p>
                        </div>
                        
                      </div>
                    </div>

                    {/* Clinician One-Click Actions */}
                    <div className="mt-auto shrink-0 pt-3 border-t border-slate-100 font-mono">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bedside Emergency Actions</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] font-bold">
                        <button
                          onClick={() => {
                            setDatasetSuccess(`✅ CENTRAL COMMAND ALERT: ICU coordinator notified immediately for ${activePatient.name} in ${activePatient.bedId}. Dispatching coordinator...`);
                          }}
                          className="py-2 px-1 text-center bg-[#DC2626] text-white hover:bg-red-750 tracking-tight transition-colors uppercase rounded-sm cursor-pointer shadow-2xs text-[8.5px]"
                        >
                          Notify ICU
                        </button>
                        <button
                          onClick={() => {
                            setDatasetSuccess(`✅ CLINICIAN ASSIGNED: Dr. John Doe (lowest workload, available) assigned to supervise ${activePatient.name} bedside monitor.`);
                          }}
                          className="py-2 px-1 text-center bg-[#2563EB] text-white hover:bg-blue-700 tracking-tight transition-colors uppercase rounded-sm cursor-pointer shadow-2xs text-[8.5px]"
                        >
                          Assign Doctor
                        </button>
                        <button
                          onClick={() => {
                            setDatasetSuccess(`✅ DISPATCH SUCCESS: Specialist Team [${activeMetrics.specialist.toUpperCase()}] dispatched to ${activePatient.bedId} with life-support tools.`);
                          }}
                          className="py-2 px-1 text-center bg-indigo-600 text-white hover:bg-indigo-700 tracking-tight transition-colors uppercase rounded-sm cursor-pointer shadow-2xs text-[8.5px]"
                        >
                          Call Team
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPatientId(activePatient.id);
                          }}
                          className="py-2 px-1 text-center bg-slate-50 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-300 transition-colors uppercase rounded-sm cursor-pointer text-[8.5px]"
                        >
                          Details Panel
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Operations column (Right, 3/12 cols) */}
                  <div className="xl:col-span-3 flex flex-col gap-4 text-slate-800 h-full">
                    
                    {/* ICU Command Center Matrix Grid */}
                    <div className="bg-white border border-slate-200 p-3 rounded-sm shadow-xs flex flex-col">
                      <div className="mb-2 pb-1.5 border-b border-slate-100 flex justify-between items-center shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">ICU BEDS GRID</span>
                        <span className="text-[8px] font-bold bg-indigo-50 text-indigo-700 px-1.5 rounded-sm uppercase tracking-wide font-mono">20 BEDS</span>
                      </div>

                      <div className="grid grid-cols-5 gap-1.5 flex-1 select-none font-mono">
                        {patients.map((p) => {
                          const isFocusedOnMain = p.id === activePatientId;
                          let bgLed = "bg-[#22C55E]";
                          let bgCell = "bg-white border-slate-200 hover:border-slate-300";
                          
                          if (p.priority === "Critical") {
                            bgLed = "bg-[#DC2626]";
                            bgCell = isFocusedOnMain ? "bg-red-50 border-[#DC2626] ring-1 ring-[#DC2626]/20" : "bg-white border-slate-200 hover:border-[#DC2626]";
                          } else if (p.priority === "High Risk") {
                            bgLed = "bg-[#F97316]";
                            bgCell = isFocusedOnMain ? "bg-amber-50 border-[#F97316] ring-1 ring-[#F97316]/20" : "bg-white border-slate-200 hover:border-[#F97316]";
                          } else {
                            bgCell = isFocusedOnMain ? "bg-blue-50 border-[#2563EB] ring-1 ring-[#2563EB]/20" : "bg-white border-slate-200 hover:border-[#2563EB]";
                          }

                          const bedNumOnly = p.bedId.replace("Bed ", "");

                          return (
                            <div
                              key={p.id}
                              title={`${p.name} - ${p.priority} priority`}
                              onClick={() => {
                                setActivePatientId(p.id);
                                setDatasetSuccess(`Selected ${p.name} (${p.bedId}) from central beds matrix.`);
                              }}
                              className={`p-1.5 flex flex-col justify-between items-center text-center h-[42px] border rounded-sm cursor-pointer transition-all ${bgCell}`}
                            >
                              <span className="text-[10px] font-extrabold text-slate-800">{bedNumOnly}</span>
                              <span className={`h-1.5 w-1.5 rounded-full ${bgLed} ${p.priority === "Critical" ? "animate-pulse" : ""}`}></span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Doctor Workload / Availability Matrix */}
                    <div className="bg-white border border-slate-200 p-3.5 rounded-sm shadow-xs flex-1 flex flex-col">
                      <div className="mb-2 pb-1 border-b border-slate-100 flex justify-between items-baseline shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">STAFF MATRIX</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase font-mono">ON-DUTY</span>
                      </div>

                      <div className="space-y-2 mt-1">
                        
                        {/* Doctor 1 */}
                        <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-150 rounded-sm font-mono text-[9.5px]">
                          <div>
                            <div className="font-extrabold text-slate-800">Dr. John Doe</div>
                            <span className="text-[8px] text-slate-400 uppercase">Emergency Med</span>
                          </div>
                          <div className="text-right">
                            <span className="px-1.5 py-0.1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-sm uppercase text-[7px]">
                              Available
                            </span>
                            <div className="text-[8px] text-slate-500 font-bold mt-0.5">2 Patients</div>
                          </div>
                        </div>

                        {/* Doctor 2 */}
                        <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-150 rounded-sm font-mono text-[9.5px]">
                          <div>
                            <div className="font-extrabold text-slate-800">Dr. Emma Brooks</div>
                            <span className="text-[8px] text-slate-400 uppercase">Pulmonology Specialist</span>
                          </div>
                          <div className="text-right">
                            <span className="px-1.5 py-0.1 bg-amber-50 text-amber-700 border border-amber-200 font-bold rounded-sm uppercase text-[7px]">
                              Busy
                            </span>
                            <div className="text-[8px] text-slate-500 font-bold mt-0.5">8 Patients</div>
                          </div>
                        </div>

                        {/* Doctor 3 */}
                        <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-150 rounded-sm font-mono text-[9.5px]">
                          <div>
                            <div className="font-extrabold text-slate-800">Dr. James Smith</div>
                            <span className="text-[8px] text-slate-400 uppercase">Cardiology Specialist</span>
                          </div>
                          <div className="text-right">
                            <span className="px-1.5 py-0.1 bg-amber-50 text-amber-700 border border-amber-200 font-bold rounded-sm uppercase text-[7px]">
                              Busy
                            </span>
                            <div className="text-[8px] text-slate-500 font-bold mt-0.5">5 Patients</div>
                          </div>
                        </div>

                      </div>

                      {/* AI Suggested Doctor recommendation */}
                      <div className="mt-auto pt-3 border-t border-slate-100">
                        <div className="p-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-sm text-[9.5px]">
                          <div className="flex items-center space-x-1 font-bold text-[#1E40AF] font-mono text-[8px] uppercase tracking-wide">
                            <Sparkles size={11} className="text-[#2563EB]" />
                            <span>AI Dispatch recommendation</span>
                          </div>
                          <div className="text-slate-850 text-[10px] font-bold mt-1.5">
                            Suggested on-duty: <strong className="text-[#1E40AF]">Dr. John Doe</strong>
                          </div>
                          <p className="text-[9px] text-[#1D4ED8] mt-0.5 leading-normal font-sans">
                            Lowest caseload (2 patients). ETA: <strong>2 mins</strong>.
                          </p>
                          
                          <button
                            onClick={() => {
                              setDatasetSuccess(`✅ DISPATCH SUCCESS: Bedward pager alert dispatched to Dr. John Doe. Estimated arrival at ${activePatient.bedId}: 120s.`);
                            }}
                            className="mt-2 w-full py-1 bg-[#2563EB] text-white font-bold uppercase hover:bg-blue-750 text-[8px] rounded-sm transition-all cursor-pointer text-center font-mono"
                          >
                            Assign Pager & Call
                          </button>
                        </div>
                      </div>

                    </div>

                  </div>

                </div>
              </div>
            );
          })()}

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

          {activeTab === "escalation" && (
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100 flex flex-col justify-between" style={{ minHeight: "calc(100vh - 110px)" }}>
              <div className="max-w-6xl mx-auto w-full bg-white border border-slate-200 shadow-sm rounded-sm p-4 sm:p-6 flex-1 flex flex-col">
                
                {/* Header segment */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 mb-4 select-none">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="h-2 w-2 rounded-full bg-[#9333EA] animate-pulse"></span>
                      <h2 className="text-xs font-bold tracking-widest text-[#7E22CE] uppercase font-mono">CareSync AI Smart Escalation</h2>
                    </div>
                    <h1 className="text-[18px] sm:text-[20px] font-extrabold text-slate-900 tracking-tight mt-0.5">Clinical Crisis Automation Deck</h1>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Automates hospital dispatch when primary assigned clinicians are busy or unresponsive.</p>
                  </div>
                  
                  {/* Scenario Trigger Board */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3 md:mt-0 font-mono">
                    <button
                      onClick={() => triggerEscalationScenario("alice")}
                      className={`px-2.5 py-1.5 text-[9px] font-extrabold uppercase rounded-sm border transition-all cursor-pointer ${
                        escalantAlert.id === "A1023" && escalantAlert.status === "Critical"
                          ? "bg-purple-900 text-white border-purple-950 shadow-md"
                          : "bg-purple-50 text-[#7E22CE] hover:bg-purple-100 border-purple-200"
                      }`}
                    >
                      🚨 Alice (Sepsis Lead)
                    </button>
                    <button
                      onClick={() => triggerEscalationScenario("bob")}
                      className={`px-2.5 py-1.5 text-[9px] font-extrabold uppercase rounded-sm border transition-all cursor-pointer ${
                        escalantAlert.id === "A1024" && escalantAlert.status === "Critical"
                          ? "bg-pink-900 text-white border-pink-950 shadow-md"
                          : "bg-pink-50 text-pink-700 hover:bg-pink-100 border-pink-200"
                      }`}
                    >
                      🩺 Bob (Cardiogenic Shock)
                    </button>
                    <button
                      onClick={() => triggerEscalationScenario("stable")}
                      className={`px-2.5 py-1.5 text-[9px] font-extrabold uppercase rounded-sm border transition-all cursor-pointer ${
                        escalantAlert.status === "Stable"
                          ? "bg-slate-800 text-white border-slate-900"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-250"
                      }`}
                    >
                      🛡️ Reset Stable
                    </button>

                    <button
                      onClick={() => setIsEscalationFastMode(!isEscalationFastMode)}
                      className={`ml-1 px-2 py-1.5 text-[8.5px] font-bold uppercase rounded-sm border flex items-center space-x-1 cursor-pointer transition-all ${
                        isEscalationFastMode 
                          ? "bg-red-500 text-white border-red-650 animate-pulse font-extrabold"
                          : "bg-slate-150 text-slate-750 hover:bg-slate-200 border-slate-300"
                      }`}
                      title="Simulates 30-second delay countdowns at 5x rapid speed for faster testing"
                    >
                      <RefreshCw size={10} className={`${isEscalationFastMode ? "animate-spin" : ""}`} />
                      <span>{isEscalationFastMode ? "5x FAST-FORWARD ACTIVE" : "FAST-FORWARD (5x)"}</span>
                    </button>
                  </div>
                </div>

                {/* Main simulation grids */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
                  
                  {/* Left block (7 cols): The active incident HUD & Doctors Availability */}
                  <div className="lg:col-span-7 flex flex-col space-y-4">
                    
                    {/* Active Incident status console */}
                    <div className="border border-slate-200 rounded-sm bg-white overflow-hidden shadow-xs flex flex-col">
                      <div className={`p-2.5 flex justify-between items-center ${escalantAlert.status === "Critical" ? "bg-red-650 text-white" : "bg-slate-750 text-white"}`}>
                        <div className="flex items-center space-x-2 font-mono text-[9px] sm:text-[10px] font-bold">
                          <span className="animate-pulse">●</span>
                          <span>INCIDENT REPORT #{escalantAlert.id}</span>
                        </div>
                        <div className="px-2 py-0.5 bg-white/20 text-[8.5px] font-bold rounded-sm uppercase tracking-wider font-mono">
                          STATUS: {escalantAlert.priority}
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50/50 border-b border-indigo-50/50 grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[8px] font-semibold text-slate-450 uppercase block tracking-wider font-mono">PATIENT IDENTIFICATION</span>
                          <span className="text-sm font-extrabold text-slate-800 font-sans block">{escalantAlert.patientName}</span>
                          <span className="text-[10px] text-[#A16207] bg-amber-50 px-1.5 py-0.2 rounded-sm border border-amber-250 font-bold mt-1 inline-block font-mono">
                            {escalantAlert.bedId.toUpperCase()} &bull; CRITICAL WARD
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[8px] font-semibold text-slate-450 uppercase block tracking-wider font-mono">CARE ASSISTANCE SUGGESTION</span>
                          <span className="text-[11px] font-bold text-[#7E22CE] font-sans block mt-0.5">Critical Care ICU Specialist</span>
                          <span className="text-[16px] font-black text-rose-600 font-mono block">RISK INDEX: {escalantAlert.riskScore}%</span>
                        </div>
                      </div>

                      {/* Vital Indicator strip */}
                      <div className="p-3 bg-white grid grid-cols-4 gap-2 border-b border-slate-100 select-none">
                        <div className="p-2 border border-slate-200 rounded-sm text-center">
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase block font-mono font-mono">HEART RATE</span>
                          <span className={`text-[13px] font-extrabold font-mono block ${escalantAlert.vitals.hr > 120 ? "text-rose-600" : "text-emerald-600"}`}>
                            {escalantAlert.vitals.hr} <span className="text-[8px] text-slate-400">bpm</span>
                          </span>
                        </div>
                        <div className="p-2 border border-slate-200 rounded-sm text-center">
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase block font-mono font-mono">OXYGEN SAT</span>
                          <span className={`text-[13px] font-extrabold font-mono block ${escalantAlert.vitals.spo2 < 90 ? "text-red-500" : "text-emerald-600"}`}>
                            {escalantAlert.vitals.spo2}%
                          </span>
                        </div>
                        <div className="p-2 border border-slate-200 rounded-sm text-center">
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase block font-mono font-mono">BLOOD PRESSURE</span>
                          <span className="text-[13px] font-extrabold font-mono text-indigo-755 block">
                            {escalantAlert.vitals.bp}
                          </span>
                        </div>
                        <div className="p-2 border border-slate-200 rounded-sm text-center">
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase block font-mono font-mono">BODY TEMP</span>
                          <span className={`text-[13px] font-extrabold font-mono block ${escalantAlert.vitals.temp >= 38.3 || escalantAlert.vitals.temp >= 100 ? "text-red-500" : "text-emerald-600"}`}>
                            {escalantAlert.vitals.temp}°F
                          </span>
                        </div>
                      </div>

                      {/* Assigned Doctor Area */}
                      <div className="p-4 bg-slate-50 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-white rounded-sm border border-slate-200">
                          <span className="text-[8px] font-bold text-slate-450 uppercase block tracking-wider font-mono">PRIMARY CLINICIAN</span>
                          <div className="flex items-center space-x-2 mt-1">
                            <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-indigo-700 border border-indigo-200 font-mono">
                              {escalantAlert.assignedDoctor?.charAt(4) || "D"}
                            </div>
                            <div>
                              <span className="text-xs font-extrabold text-slate-700 font-mono block">{escalantAlert.assignedDoctor}</span>
                              <span className="text-[8.5px] text-slate-450 block font-sans font-semibold">Assigned Ward Lead</span>
                            </div>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between font-mono">
                            <span className="text-[8.5px] font-bold text-slate-400">PAGER RESPONSE:</span>
                            {escalantAlert.assignedDoctorStatus === "Handling" ? (
                              <span className="text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-250 px-1.5 py-0.2 rounded font-black uppercase">
                                ✓ ACCEPTED (ACTIVE)
                              </span>
                            ) : (
                              <span className="text-[8px] bg-rose-50 text-rose-600 border border-rose-250 px-1.5 py-0.2 rounded font-black uppercase animate-pulse">
                                ❌ NOT RESPONDING (L{escalantAlert.escalationLevel})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-3 bg-white rounded-sm border border-slate-200 flex flex-col justify-between">
                          <div>
                            <span className="text-[8px] font-bold text-slate-450 uppercase block tracking-wider font-mono">ESTIMATED RESPONSE TIMING</span>
                            {escalantAlert.assignedDoctorStatus === "Handling" ? (
                              <div className="mt-1 flex items-baseline space-x-1.5 text-emerald-700">
                                <span className="text-[17px] font-black leading-none font-mono">~2.0</span>
                                <span className="text-[8.5px] font-bold uppercase font-mono">minutes ETI (Bedside arrival)</span>
                              </div>
                            ) : (
                              <div className="mt-1 flex items-baseline space-x-1.5 text-rose-600 text-sm font-bold font-mono font-mono">
                                <span className="text-[15px] font-extrabold leading-none animate-pulse">-- : --</span>
                                <span className="text-[8.5px] text-slate-450 font-normal">Awaiting bedside confirmation</span>
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-mono text-[8px] text-slate-400">
                            <span>BACKUP: {escalantAlert.backupDoctor ? escalantAlert.backupDoctor : "Central ICU Team"}</span>
                            <span>FAILFAST LIMIT: 5 MINS</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Doctors Availability Table */}
                    <div className="border border-slate-200 rounded-sm bg-white p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide font-mono">Care Specialist Roster</h3>
                          <p className="text-[8.5px] text-slate-400 font-bold">Interactive Availability - Click pill status to toggle Busy/Available</p>
                        </div>
                        <span className="text-[7.5px] bg-slate-150 text-slate-500 border border-slate-250 px-1.5 py-0.2 uppercase font-extrabold font-mono">
                          Live Central Directory
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[9px] border-collapse font-mono">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-450 text-[8px] font-extrabold uppercase">
                              <th className="p-2">Specialist Name</th>
                              <th className="p-2">Focus Specialty</th>
                              <th className="p-2 text-center">Live Status</th>
                              <th className="p-2 text-right">Active Priority Duty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {doctorsList.map((doc) => {
                              const isTargetAssigned = escalantAlert.assignedDoctor === doc.name && escalantAlert.status === "Critical";
                              return (
                                <tr key={doc.id} className={`hover:bg-slate-50/50 transition-colors ${isTargetAssigned ? "bg-purple-50/40" : ""}`}>
                                  <td className="p-2">
                                    <div className="flex items-center space-x-1.5">
                                      <span className={`h-1.5 w-1.5 rounded-full ${isTargetAssigned ? "bg-purple-650 animate-ping" : "bg-slate-300"}`}></span>
                                      <span className="font-extrabold text-[#1E293B]">{doc.name}</span>
                                    </div>
                                  </td>
                                  <td className="p-2 text-slate-500 font-semibold">{doc.specialization}</td>
                                  <td className="p-2 text-center">
                                    <button
                                      onClick={() => toggleDoctorStatus(doc.id)}
                                      className={`px-2 py-0.5 text-[8px] font-extrabold rounded-full border cursor-pointer select-none transition-all ${
                                        doc.status === "Available"
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                          : "bg-red-50 text-red-650 border-red-200 hover:bg-red-100"
                                      }`}
                                    >
                                      {doc.status === "Available" ? "● AVAILABLE" : "■ BUSY"}
                                    </button>
                                  </td>
                                  <td className="p-2 text-right">
                                    {isTargetAssigned ? (
                                      <span className="text-[7.5px] bg-[#9333EA] text-white px-1.5 py-0.2 rounded-sm font-extrabold">Active Incident Respondee</span>
                                    ) : (
                                      <span className="text-slate-450 font-normal italic">Ready state</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Right block (5 cols): Escalation Hierarchy Progress and Mobile Device Simulator */}
                  <div className="lg:col-span-5 flex flex-col space-y-4">
                    
                    {/* Visual Escalation Progress tower */}
                    <div className="border border-slate-200 rounded-sm bg-white p-4">
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide font-mono mb-3.5">Escalation Fail-Safe Stack</h3>
                      
                      <div className="space-y-3 font-mono">
                        
                        {/* LEVEL 1 CARD */}
                        <div className={`p-2.5 border rounded-sm flex items-start space-x-3 transition-colors ${
                          escalantAlert.status === "Critical" && escalantAlert.escalationLevel === 1
                            ? "border-purple-650 bg-purple-50/50"
                            : escalantAlert.status === "Critical" && escalantAlert.escalationLevel > 1 
                              ? "border-slate-200 bg-slate-50/70 opacity-60" 
                              : "border-slate-250 bg-white"
                        }`}>
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-extrabold border shrink-0 ${
                            escalantAlert.escalationLevel >= 1 && escalantAlert.status === "Critical"
                              ? "bg-[#7E22CE] text-white border-purple-800"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}>
                            1
                          </div>
                          <div className="flex-1 leading-normal text-[9px]">
                            <div className="flex justify-between items-center">
                              <span className="font-extrabold text-slate-800 block">Level 1: Clinical Lead Notification</span>
                              <span className="text-[7px] text-slate-400 uppercase tracking-wider">Delay: 30s limit</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-semibold italic">Alert dispatched to designated specialist pager.</span>
                            {escalantAlert.escalationLevel === 1 && escalantAlert.status === "Critical" && (
                              <div className="mt-1 flex items-center justify-between text-[7px] text-red-650 font-extrabold bg-red-50 p-1 rounded">
                                <span>AWAITING HANDSHAKE OVER PROTOCOL</span>
                                <span className="animate-pulse">{30 - (escalantAlert.timeSinceAlert % 30)}s remaining</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* LEVEL 2 CARD */}
                        <div className={`p-2.5 border rounded-sm flex items-start space-x-3 transition-colors ${
                          escalantAlert.status === "Critical" && escalantAlert.escalationLevel === 2
                            ? "border-amber-500 bg-amber-50/50"
                            : escalantAlert.status === "Critical" && escalantAlert.escalationLevel > 2 
                              ? "border-slate-200 bg-slate-50/70 opacity-60" 
                              : "border-slate-250 bg-white"
                        }`}>
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-extrabold border shrink-0 ${
                            escalantAlert.escalationLevel >= 2 && escalantAlert.status === "Critical"
                              ? "bg-amber-600 text-white border-amber-700"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}>
                            2
                          </div>
                          <div className="flex-1 leading-normal text-[9px]">
                            <div className="flex justify-between items-center">
                              <span className="font-extrabold text-slate-800 block">Level 2: Hospital Department Backup</span>
                              <span className="text-[7px] text-slate-400 uppercase tracking-wider">Delay: 60s limit</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-semibold italic">Alert routed to clinical supervisor & duty backup roster.</span>
                            {escalantAlert.escalationLevel === 2 && escalantAlert.status === "Critical" && (
                              <div className="mt-1 flex items-center justify-between text-[7px] text-amber-700 font-extrabold bg-amber-50 p-1 rounded border border-amber-200">
                                <span>COMMUNICATING WITH CARDIO/PULM CONSULTANTS</span>
                                <span className="animate-pulse">{60 - (escalantAlert.timeSinceAlert % 60)}s remaining</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* LEVEL 3 CARD */}
                        <div className={`p-2.5 border rounded-sm flex items-start space-x-3 transition-colors ${
                          escalantAlert.status === "Critical" && escalantAlert.escalationLevel === 3
                            ? "border-orange-550 bg-orange-50/50"
                            : escalantAlert.status === "Critical" && escalantAlert.escalationLevel > 3 
                              ? "border-slate-200 bg-slate-50/70 opacity-60" 
                              : "border-slate-250 bg-white"
                        }`}>
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-extrabold border shrink-0 ${
                            escalantAlert.escalationLevel >= 3 && escalantAlert.status === "Critical"
                              ? "bg-orange-600 text-white border-orange-700"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}>
                            3
                          </div>
                          <div className="flex-1 leading-normal text-[9px]">
                            <div className="flex justify-between items-center">
                              <span className="font-extrabold text-slate-800 block">Level 3: ICU Nurse Station Alarms</span>
                              <span className="text-[7px] text-slate-400 uppercase tracking-wider">Delay: 95s limit</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-semibold italic">Flashes full screen sirens across the ICU central desk monitors.</span>
                            {escalantAlert.escalationLevel === 3 && escalantAlert.status === "Critical" && (
                              <div className="mt-1 flex items-center justify-between text-[7px] text-orange-700 font-bold bg-orange-550 p-1 rounded border border-orange-250">
                                <span>DISTRIBUTED ICU WARD PAGING DEPLOYED</span>
                                <span className="animate-pulse">{95 - (escalantAlert.timeSinceAlert % 95)}s limit</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* LEVEL 4 CARD */}
                        <div className={`p-2.5 border rounded-sm flex items-start space-x-3 transition-colors ${
                          escalantAlert.status === "Critical" && escalantAlert.escalationLevel === 4
                            ? "border-red-650 bg-red-50/50"
                            : "border-slate-200 bg-white"
                        }`}>
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-extrabold border shrink-0 ${
                            escalantAlert.escalationLevel >= 4 && escalantAlert.status === "Critical"
                              ? "bg-red-600 text-white border-red-800 animate-bounce"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}>
                            4
                          </div>
                          <div className="flex-1 leading-normal text-[9px]">
                            <div className="flex justify-between items-center">
                              <span className="font-extrabold text-slate-800 block">Level 4: Emergency Broadcast sirens</span>
                              <span className="text-[7px] text-white bg-red-650 px-1 py-0.2 rounded tracking-wider uppercase">ALL CHANNELS ACTIVE</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-semibold italic">Omni-channel broadcast: all available specialists paged. Audio sirens.</span>
                            {escalantAlert.escalationLevel === 4 && escalantAlert.status === "Critical" && (
                              <div className="mt-1 text-[7.5px] text-rose-700 font-black flex items-center space-x-1.5 animate-pulse font-mono">
                                <AlertTriangle size={10} />
                                <span>HOSPITAL BROADCAST SIRENING & ALL MOBILE FCM PUSH FLUSHED</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Clinician On-Call Device Simulator */}
                    <div className="border border-slate-250 rounded-sm bg-slate-905 text-white p-4 font-mono bg-slate-900">
                      
                      {/* Mobile phone mock screen header */}
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2 text-[8px] text-slate-400 uppercase">
                        <div className="flex items-center space-x-1 font-mono">
                          <Activity size={10} className="text-[#059669] animate-pulse" />
                          <span>CARESYNC PUSH INTERACTION CLIENT</span>
                        </div>
                        <span>WiFi Active &bull; SIM CELL-01</span>
                      </div>

                      {/* Phone Banner Mockup */}
                      <div className="bg-slate-800 p-2.5 rounded border border-white/10 text-left text-[9.5px] leading-relaxed mb-3">
                        <div className="flex justify-between items-center text-[8px] border-b border-slate-700 pb-1 mb-1 text-purple-450 uppercase">
                          <span className="font-extrabold flex items-center space-x-1">
                            <span>🚨 EMERGENCY CALLOUT</span>
                          </span>
                          <span className="font-mono text-slate-500 uppercase">Alert ID: #{escalantAlert.id}</span>
                        </div>
                        
                        <div className="text-slate-250 font-semibold">
                          Patient: <span className="font-extrabold text-white font-sans">{escalantAlert.patientName}</span> ({escalantAlert.bedId})
                        </div>
                        <div className="text-[8.5px] text-slate-405 leading-normal mt-0.5">
                          Condition Alerting Sepsis risk at <span className="text-rose-500 font-extrabold">{escalantAlert.riskScore}%</span> probability. Vitals indicating HR: {escalantAlert.vitals.hr}bpm, SpO2: {escalantAlert.vitals.spo2}%.
                        </div>
                        <div className="mt-1.5 text-[8px] text-indigo-350">
                          Specialist Assigned: <span className="font-extrabold text-indigo-200">{escalantAlert.assignedDoctor}</span>
                        </div>
                      </div>

                      {/* Doctor actions feedback portal */}
                      <div className="space-y-1.5 text-[9.5px]">
                        <span className="text-slate-400 text-[8.5px] uppercase font-bold block mb-1">Clinician Interactive Handshake Decision</span>
                        
                        {escalantAlert.status === "Critical" && escalantAlert.assignedDoctorStatus !== "Handling" ? (
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={handleDoctorAccept}
                              className="px-2.5 py-2 hover:bg-emerald-700 bg-emerald-600 text-white font-black uppercase text-[8.5px] rounded border border-emerald-800 cursor-pointer text-center font-mono hover:scale-101 active:scale-99 transition-all"
                            >
                              ✓ Accept Case
                            </button>
                            <button
                              onClick={handleDoctorForward}
                              className="px-2.5 py-2 hover:bg-red-700 bg-red-650 text-white font-black uppercase text-[8.5px] rounded border border-red-800 cursor-pointer text-center font-mono hover:scale-101 active:scale-99 transition-all"
                            >
                              ✕ Reject / Route
                            </button>
                          </div>
                        ) : (
                          <div className="p-2 border border-emerald-555 bg-emerald-950/25 rounded text-center text-[9px] text-[#22C55E] font-black uppercase tracking-wide">
                            {escalantAlert.status === "Stable" 
                              ? "Surveillance Active: Bed conditions healthy." 
                              : `Responded: ${escalantAlert.assignedDoctor} on bedside duty.`}
                          </div>
                        )}

                        <button
                          onClick={handleManualEscalate}
                          disabled={escalantAlert.escalationLevel >= 4 || escalantAlert.status !== "Critical"}
                          className={`w-full mt-2 px-2 py-1 border uppercase font-bold text-[8.5px] text-center rounded block cursor-pointer transition-colors ${
                            escalantAlert.escalationLevel < 4 && escalantAlert.status === "Critical"
                              ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                              : "bg-slate-900/40 text-slate-600 border-slate-800 opacity-40 cursor-not-allowed"
                          }`}
                        >
                          ⚡ Bypass Delay Timer: Force Immediate Level-Up
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dispatch Channel Matrix Indicator & Logs block */}
                <div className="mt-4 border border-slate-200 rounded-sm bg-white overflow-hidden flex flex-col">
                  
                  {/* Comm channel dispatch indicators */}
                  <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2 select-none font-mono">
                    <span className="text-[8px] font-extrabold text-slate-450 uppercase tracking-widest mt-0.5">DISPATCH CHANNELS STABILITY:</span>
                    
                    <div className="flex flex-wrap items-center gap-1.5 text-[8px] font-bold">
                      <span className={`px-2 py-0.5 border rounded-sm flex items-center space-x-1 ${
                        escalantAlert.notifiedChannels.includes("Dashboard") ? "bg-[#E6F4EA] text-[#059669] border-[#10B981]" : "bg-slate-100 text-slate-405 border-slate-200"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${escalantAlert.notifiedChannels.includes("Dashboard") ? "bg-[#059669] animate-ping" : "bg-slate-300"}`}></span>
                        <span>🖥️ COMMAND HUD</span>
                      </span>

                      <span className={`px-2 py-0.5 border rounded-sm flex items-center space-x-1 ${
                        escalantAlert.notifiedChannels.includes("Email") ? "bg-amber-50 text-amber-700 border-amber-250" : "bg-slate-100 text-slate-405 border-slate-200"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${escalantAlert.notifiedChannels.includes("Email") ? "bg-amber-500 animate-ping" : "bg-slate-300"}`}></span>
                        <span>📧 EMAIL (RESEND)</span>
                      </span>

                      <span className={`px-2 py-0.5 border rounded-sm flex items-center space-x-1 ${
                        escalantAlert.notifiedChannels.includes("SMS") ? "bg-[#E0F2FE] text-[#0284C7] border-[#38BDF8]" : "bg-slate-100 text-slate-405 border-slate-200"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${escalantAlert.notifiedChannels.includes("SMS") ? "bg-[#0284C7] animate-ping" : "bg-slate-300"}`}></span>
                        <span>💬 SMS (TWILIO API)</span>
                      </span>

                      <span className={`px-2 py-0.5 border rounded-sm flex items-center space-x-1 ${
                        escalantAlert.notifiedChannels.includes("WhatsApp") ? "bg-green-50 text-green-700 border-green-250" : "bg-slate-100 text-slate-405 border-slate-200"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${escalantAlert.notifiedChannels.includes("WhatsApp") ? "bg-green-600 animate-ping" : "bg-slate-300"}`}></span>
                        <span>🟢 WHATSAPP BUSINESS</span>
                      </span>

                      <span className={`px-2 py-0.5 border rounded-sm flex items-center space-x-1 ${
                        escalantAlert.notifiedChannels.includes("Push") ? "bg-rose-50 text-rose-600 border-rose-250" : "bg-slate-100 text-slate-405 border-slate-200"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${escalantAlert.notifiedChannels.includes("Push") ? "bg-red-600 animate-ping" : "bg-slate-300"}`}></span>
                        <span>📱 GOOGLE FCM PUSH</span>
                      </span>
                    </div>
                  </div>

                  {/* Telemetry Logger component */}
                  <div className="bg-slate-950 p-4 font-mono text-[9px] text-slate-300 flex-1 flex flex-col justify-between" style={{ minHeight: "150px" }}>
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2 uppercase text-[7.5px] text-slate-500">
                      <span>Clinical Telemetry logger &bull; real-time failure monitor</span>
                      <span>ACTIVE FEED RATE: 1000 HZ</span>
                    </div>

                    <div className="space-y-1.5 flex-1 max-h-[140px] overflow-y-auto pr-1">
                      {escalantAlert.notificationLogs.slice().reverse().map((logLine, idx) => {
                        let colorClass = "text-slate-450";
                        if (logLine.includes("✅")) colorClass = "text-[#10B981] font-bold";
                        else if (logLine.includes("🚨") || logLine.includes("❌")) colorClass = "text-rose-500 font-extrabold";
                        else if (logLine.includes("⏳") || logLine.includes("⚡")) colorClass = "text-amber-500 font-bold";
                        else if (logLine.includes("🔄") || logLine.includes("🔍")) colorClass = "text-[#38BDF8] font-bold";

                        return (
                          <div key={idx} className={`leading-normal ${colorClass}`}>
                            {logLine}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3.5 pt-2 border-t border-slate-900 flex justify-between items-center text-[7.5px] text-slate-500 select-none">
                      <span>CareSync Automated Dispatching Router Engine &bull; Version 2.0.1 GA-HACKSTORE</span>
                      <span className="text-indigo-400 uppercase tracking-widest font-bold">FAILFAST DEPLOYMENT SUCCESSFUL</span>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

          {activeTab === "ecosystem" && (
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100 flex flex-col justify-between" style={{ minHeight: "calc(100vh - 110px)" }}>
              <div className="max-w-7xl mx-auto w-full bg-white border border-slate-200 shadow-sm rounded-sm p-4 sm:p-6 flex-1 flex flex-col">
                
                {/* Header segment */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 mb-4 select-none">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <h2 className="text-xs font-bold tracking-widest text-emerald-700 uppercase font-mono">CareSync Omnipresent Health IoT</h2>
                    </div>
                    <h1 className="text-[18px] sm:text-[20px] font-extrabold text-slate-900 tracking-tight mt-0.5">🌐 IoMT Wearables & Healthcare Ecosystem</h1>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Bridges remote patients, automated ambulance dispatching, Digital Twin forecast simulations, and Chatbot assistance.</p>
                  </div>
                  
                  <div className="flex items-center space-x-2 mt-2 md:mt-0 bg-emerald-50 px-3 py-1.5 border border-emerald-250 rounded font-mono text-[9px] text-emerald-800">
                    <Sparkles size={11} className="text-emerald-600 animate-pulse" />
                    <span className="font-extrabold uppercase">CareSync One-Line USP: Any Patient, Anywhere.</span>
                  </div>
                </div>

                {/* Mode Selector Tab */}
                <div className="flex border-b border-slate-200 mb-5 text-slate-600 select-none bg-slate-50/50 p-1 rounded-md max-w-fit mt-1">
                  <button
                    onClick={() => setCompanionSubTab("hospital")}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-sm text-[11px] font-bold tracking-tight cursor-pointer transition-all ${
                      companionSubTab === "hospital"
                        ? "bg-white text-slate-900 border-b-2 border-emerald-500 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Activity size={13} className={companionSubTab === "hospital" ? "text-emerald-500 animate-pulse" : ""} />
                    <span>🏥 Hospital Edge Ambulance & ICU HUD</span>
                  </button>
                  <button
                    id="patient-companion-mode-btn"
                    onClick={() => setCompanionSubTab("patient")}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-sm text-[11px] font-bold tracking-tight cursor-pointer transition-all ${
                      companionSubTab === "patient"
                        ? "bg-white text-slate-900 border-b-2 border-blue-500 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Sparkles size={13} className={companionSubTab === "patient" ? "text-blue-500 animate-[pulse_2s_infinite]" : ""} />
                    <span className="font-mono font-black animate-pulse bg-blue-105 text-blue-800 px-1 py-0.2 rounded-xs mr-1 text-[8px]">NEW</span>
                    <span>🏡 Post-Discharge Smart Patient & Medication Companion</span>
                  </button>
                </div>

                {companionSubTab === "hospital" ? (
                  /* Main bento structural grid */
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
                  
                  {/* LEFT BENTO (Span 4): Smartwatch Device Simulator & iOS Message Center */}
                  <div className="lg:col-span-4 flex flex-col space-y-4">
                    
                    {/* Wearable Watch Block */}
                    <div className="border border-slate-200 rounded-sm bg-slate-900 text-white p-4 font-mono relative overflow-hidden flex flex-col justify-between animate-[fadeIn_0.5s_ease-out-east]" style={{ minHeight: "330px" }}>
                      
                      {/* Background accent */}
                      <div className="absolute right-[-20px] top-[-20px] h-32 w-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

                      <div className="flex justify-between items-center border-b border-slate-800 pb-2 text-[8px] text-slate-400">
                        <span className="flex items-center space-x-1 font-bold">
                          <Activity size={9} className="text-emerald-500 animate-pulse" />
                          <span>CARESYNC REMOTE BAND v4.8</span>
                        </span>
                        <span>BATTERY 94%</span>
                      </div>

                      {/* Mock Watch Face UI */}
                      <div className="my-3 text-center">
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-widest">Active Remote Subject</span>
                        <span className="text-md font-extrabold text-[#E2E8F0] tracking-tight block">Mubashir T. (Age 68)</span>
                        <div className="mt-2.5 flex justify-center items-baseline space-x-1">
                          <span className={`${wearablePulseStatus === "stable" ? "text-emerald-400" : "text-rose-500"} text-[30px] font-black tracking-tighter leading-none`}>
                            {wearableVitals.hr}
                          </span>
                          <span className="text-[10px] text-slate-405 uppercase font-bold">bpm</span>
                        </div>
                      </div>

                      {/* Heartbeat ECG wave visual SVG */}
                      <div className="h-10 border border-slate-800/60 rounded bg-slate-950 flex items-center relative overflow-hidden mb-3">
                        <div className="absolute left-2.5 top-1 text-[7px] text-slate-500 font-semibold uppercase select-none tracking-wider font-mono">
                          Live ECG Rhythm: {wearableVitals.ecg}
                        </div>
                        <svg className="w-full h-full" viewBox="0 0 360 60">
                          <path
                            fill="none"
                            stroke={wearablePulseStatus === "stable" ? "#10B981" : "#EF4444"}
                            strokeWidth="2"
                            d="M 0 30 Q 15 30 25 30 L 30 10 L 35 50 L 40 30 L 70 30 L 80 30 Q 95 30 105 30 L 110 10 L 115 50 L 120 30 L 150 30 L 160 30 Q 175 30 185 30 L 190 10 L 195 50 L 200 30 L 230 30 L 240 30 Q 255 30 265 30 L 270 10 L 275 50 L 280 30 L 310 30 L 320 30 Q 335 30 345 30 L 350 10 L 355 50 L 360 30"
                            className={wearablePulseStatus !== "stable" ? "animate-pulse" : ""}
                          />
                        </svg>
                      </div>

                      {/* Wearable stats strip */}
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px] select-none mb-3">
                        <div className="p-1.5 bg-slate-850 rounded border border-slate-800">
                          <span className="text-[7.5px] text-slate-400 uppercase block font-semibold">OXYGEN SAT</span>
                          <span className={`font-extrabold ${wearableVitals.spo2 < 90 ? "text-red-400 font-black animate-pulse" : "text-emerald-400"}`}>
                            {wearableVitals.spo2}% SpO₂
                          </span>
                        </div>
                        <div className="p-1.5 bg-slate-850 rounded border border-slate-800">
                          <span className="text-[7.5px] text-slate-400 uppercase block font-semibold">STRESS SCALE</span>
                          <span className={`font-extrabold ${wearableVitals.stress > 80 ? "text-amber-400" : "text-[#38BDF8]"}`}>
                            {wearableVitals.stress}/100
                          </span>
                        </div>
                        <div className="p-1.5 bg-slate-850 rounded border border-slate-800">
                          <span className="text-[7.5px] text-slate-400 uppercase block font-semibold">STAMINA</span>
                          <span className="font-extrabold text-yellow-500 font-sans">{wearableVitals.steps} steps</span>
                        </div>
                      </div>

                      {/* Wrist Simulator scenario buttons */}
                      <div className="border-t border-slate-800 pt-3 flex flex-wrap gap-1.5 justify-center">
                        <button
                          onClick={() => setWearableScenario("stable")}
                          className={`px-2 py-1 text-[8px] font-black uppercase rounded cursor-pointer transition-all border ${
                            wearablePulseStatus === "stable"
                              ? "bg-emerald-600 text-white border-emerald-900"
                              : "bg-slate-850 text-slate-400 border-slate-700 hover:bg-slate-800"
                          }`}
                        >
                          🟢 Rest Stable (72 bpm)
                        </button>
                        <button
                          onClick={() => setWearableScenario("hypoxia")}
                          className={`px-2 py-1 text-[8px] font-black uppercase rounded cursor-pointer transition-all border ${
                            wearablePulseStatus === "abnormal"
                              ? "bg-rose-950 text-rose-300 border-rose-900 shadow-md"
                              : "bg-slate-850 text-slate-400 border-slate-700 hover:bg-rose-950/20"
                          }`}
                        >
                          🔴 Hypoxia Drop (87%)
                        </button>
                        <button
                          onClick={() => setWearableScenario("afib")}
                          className={`px-2 py-1 text-[8px] font-black uppercase rounded cursor-pointer transition-all border ${
                            wearablePulseStatus === "afib"
                              ? "bg-amber-950 text-amber-300 border-amber-900 shadow-md"
                              : "bg-slate-850 text-slate-400 border-slate-700 hover:bg-amber-950/20"
                          }`}
                        >
                          🩺 AFib Trigger (142 bpm)
                        </button>
                      </div>
                    </div>

                    {/* Family SMS notification panel */}
                    <div className="border border-slate-200 rounded-sm bg-white p-4 shadow-xs flex flex-col justify-between flex-1">
                      <div>
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2.5">
                          <div>
                            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide font-mono">Family Emergency Broadcast</h3>
                            <p className="text-[8.5px] text-slate-400 font-bold">Simulates automated IoT safety notifications to patient guardians.</p>
                          </div>
                          <span className="text-[7.5px] bg-[#E0F2FE] text-[#0284C7] border border-[#38BDF8] px-1.5 py-0.2 uppercase font-extrabold font-mono">
                            SMS API GATEWAY
                          </span>
                        </div>

                        {wearableVitals.spo2 < 90 || wearablePulseStatus === "afib" ? (
                          <div className="bg-sky-50 rounded border border-sky-150 p-3 text-left font-mono text-[9px] relative mt-1.5 select-none">
                            <span className="absolute top-[-5.5px] left-2 bg-[#0284C7] text-white px-1.5 py-0.2 rounded text-[7px] font-extrabold uppercase">
                              Active Notification Sendout
                            </span>
                            <div className="text-[#0369A1] font-bold mt-1 uppercase text-[8px]">
                              OUTGOING TO: DAUGHTER (SARAH T.) &bull; +91 94443 XXXXX
                            </div>
                            <p className="text-[#0C4A6E] font-semibold italic leading-relaxed mt-1.5 bg-white p-2 border border-sky-200 rounded">
                              "CARESYNC ADVISOR 🚨: Mubashir's oxygen dropped critical to <span className="text-red-650 font-black">{wearableVitals.spo2}%</span>. Auto-booking Ambulance to Anna Nagar, Destination: Apollo Speciality Clinic. Distance: 3.2 km, ETA: 6 mins."
                            </p>
                            <span className="text-[8px] bg-sky-205 text-[#0369A1] px-1 py-0.2 rounded-sm font-extrabold inline-block mt-2">
                              ✓ SENT VIA TWILIO GATEWAY (AUTO)
                            </span>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded text-center text-slate-400 text-[9px] font-medium leading-relaxed italic select-none">
                            Monitoring patient remote status. No crisis detected. Inactive standby mode.
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[8px] text-slate-400 font-mono">
                        <span>EMERGENCY DISPATCH NO.: TR-4921</span>
                        <span>DURABLE SECURE PERSISTENCE</span>
                      </div>
                    </div>
                  </div>

                  {/* MIDDLE BENTO (Span 4): Ambulance Recommendation & Bed AI Digital Twin */}
                  <div className="lg:col-span-4 flex flex-col space-y-4">
                    
                    {/* Smart Ambulance Routing HUD */}
                    <div className="border border-slate-200 rounded-sm bg-white p-4">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide font-mono">Ambulance Routing Station</h3>
                          <p className="text-[8.5px] text-slate-400 font-bold">Dynamic hospital proximity routing and auto-booking system.</p>
                        </div>
                        <span className="text-[7.5px] bg-red-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 uppercase font-extrabold font-mono">
                          ICU ROUTER
                        </span>
                      </div>

                      <div className="space-y-3 font-mono text-[9px]">
                        <div className="p-2 border border-slate-200 rounded-sm bg-slate-50 relative mt-1 select-none">
                          <span className="text-[7px] text-slate-450 uppercase tracking-wider block font-bold font-mono">ORIGIN LOCATION</span>
                          <span className="text-[11px] font-extrabold text-slate-800">Residential Quarter, Anna Nagar</span>
                          
                          <span className="text-[7px] text-slate-450 uppercase tracking-wider block font-bold font-mono mt-2">RECOMMENDED DESTINATION</span>
                          <span className="text-[11px] font-extrabold text-purple-750">Apollo Chennai Speciality Hospital (3.2 km)</span>
                        </div>

                        <div className="p-2.5 border border-slate-200 rounded-sm bg-slate-50 flex justify-between items-center select-none font-mono">
                          <div>
                            <span className="text-[7.5px] text-slate-450 block font-bold">AMBULANCE DISPATCH CAR</span>
                            <span className="text-[12px] font-extrabold text-slate-800">VEHICLE ID: TN-01-AMB-4320</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[7.5px] text-slate-450 block font-bold font-mono">ETA BEDSIDE</span>
                            <span className="text-sm font-extrabold text-rose-650 animate-pulse">{ambulanceStatus === "dispatched" || ambulanceStatus === "arrived" ? `${ambulanceEta} MINS` : "-- : --"}</span>
                          </div>
                        </div>

                        {ambulanceStatus === "idle" ? (
                          <button
                            onClick={() => {
                              setAmbulanceStatus("dispatched");
                              setAmbulanceEta(6);
                            }}
                            className="w-full px-2 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold uppercase rounded shadow-xs cursor-pointer text-center select-none transition-all font-mono"
                          >
                            ⚡ Book Emergency ICU Ambulance Now
                          </button>
                        ) : (
                          <div className="flex space-x-1.5">
                            <div className="flex-1 p-2 bg-emerald-50 border border-emerald-200 rounded text-center text-emerald-700 font-extrabold uppercase text-[8.5px] animate-pulse font-mono">
                              🚑 DISPATCHED CASE OK
                            </div>
                            <button
                              onClick={() => setAmbulanceStatus("idle")}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[9px] font-bold cursor-pointer font-mono"
                              title="Reset dispatch simulator"
                            >
                              Reset
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Digital Twin Simulation console */}
                    <div className="border border-slate-200 rounded-sm bg-white p-4 shadow-xs flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2.5">
                          <div>
                            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide font-mono">Physiological Digital Twin</h3>
                            <p className="text-[8.5px] text-slate-400 font-bold">Simulates diagnostic treatment alterations before active execution.</p>
                          </div>
                          <span className="text-[7.5px] bg-[#FAF5FF] text-[#7E22CE] border border-purple-200 px-1.5 py-0.2 uppercase font-extrabold font-mono">
                            TWIN v2.5
                          </span>
                        </div>

                        {/* Survival Forecast display dashboard */}
                        <div className="p-3 bg-slate-50 border border-indigo-50/50 rounded-sm flex items-center justify-between mb-3 select-none">
                          <div className="font-mono">
                            <span className="text-[7.5px] text-slate-450 block font-bold font-mono">SIMULATED SURVIVAL ODDS:</span>
                            <span className={`text-[23px] font-black ${twinSurvivalChance >= 94 ? "text-emerald-700" : twinSurvivalChance >= 80 ? "text-[#0284C7]" : "text-amber-500"} leading-none block font-mono mt-0.5`}>
                              {twinSurvivalChance}% Probability
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[7.5px] text-slate-455 block font-bold font-mono">SEPSIS HAZARD DRIFT:</span>
                            <span className="text-[12px] font-black text-rose-550 block truncate font-mono">
                              {100 - twinSurvivalChance}% Risk Factor
                            </span>
                          </div>
                        </div>

                        {/* Interactive Digital Twin Controls */}
                        <div className="space-y-2 select-none font-sans text-[10px]">
                          <span className="text-[8px] text-slate-400 uppercase tracking-widest font-bold block mb-1 font-mono">Simulate Therapeutic Options</span>
                          
                          <label className="flex items-center space-x-2.5 p-2 border border-slate-200 hover:bg-slate-50 rounded cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={digitalTwinOptions.oxygen}
                              onChange={() => handleToggleTwinOption("oxygen")}
                              className="rounded border-slate-300 text-indigo-650 h-3.5 w-3.5 cursor-pointer"
                            />
                            <div>
                              <span className="font-extrabold text-slate-800 block">Deploy Oxygen Enrichment (+12%)</span>
                              <span className="text-[8.5px] text-slate-450 block font-semibold leading-none">Increases target systemic oxygen delivery saturation index</span>
                            </div>
                          </label>

                          <label className="flex items-center space-x-2.5 p-2 border border-slate-200 hover:bg-slate-50 rounded cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={digitalTwinOptions.antibiotics}
                              onChange={() => handleToggleTwinOption("antibiotics")}
                              className="rounded border-slate-300 text-indigo-650 h-3.5 w-3.5 cursor-pointer"
                            />
                            <div>
                              <span className="font-extrabold text-slate-800 block">Infuse Broad-spectrum Sepsis Antibiotics (+15%)</span>
                              <span className="text-[8.5px] text-slate-450 block font-semibold leading-none">Limits systemic bacterial replication cascade rates</span>
                            </div>
                          </label>

                          <label className="flex items-center space-x-2.5 p-2 border border-slate-200 hover:bg-slate-50 rounded cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={digitalTwinOptions.fluids}
                              onChange={() => handleToggleTwinOption("fluids")}
                              className="rounded border-slate-300 text-indigo-650 h-3.5 w-3.5 cursor-pointer"
                            />
                            <div>
                              <span className="font-extrabold text-slate-800 block">Initiate Bolus Crystalloid Fluids Resuscitation (+8%)</span>
                              <span className="text-[8.5px] text-slate-450 block font-semibold leading-none">Stabilizes arterial blood pressure above hypoxia constraints</span>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Twin log terminal readout */}
                      <div className="mt-3.5 border border-slate-800 rounded bg-slate-950 p-2 text-left font-mono text-[8.5px] text-slate-300 leading-snug">
                        <div className="text-[7px] text-indigo-400 border-b border-indigo-950 pb-1.5 mb-1.5 uppercase font-extrabold">Active Simulator Prediction Streams</div>
                        <div className="h-[55px] overflow-y-auto space-y-1">
                          {twinLog.map((logStr, idx) => (
                            <div key={idx} className={logStr.includes("✓") ? "text-[#10B981] font-bold" : "text-slate-405 font-medium"}>
                              {logStr}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT BENTO (Span 4): Interactive Voice AI Nurse & Caseload Allocator */}
                  <div className="lg:col-span-4 flex flex-col space-y-4">
                    
                    {/* Voice AI Nurse interaction console */}
                    <div className="border border-slate-200 rounded-sm bg-white p-4 shadow-xs flex flex-col justify-between" style={{ minHeight: "260px" }}>
                      
                      <div>
                        {/* Header block */}
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2.5 select-none font-mono">
                          <div>
                            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide font-mono">Voice AI Nurse Dispatch</h3>
                            <p className="text-[8.5px] text-slate-400 font-bold font-semibold">Interactive Chatbot queries hospital feeds instantaneously.</p>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                            <span className="text-[7.5px] bg-[#EEF2F6] text-slate-500 border border-slate-200 px-1.5 py-0.2 uppercase font-extrabold tracking-wider">
                              ACTIVE MIC
                            </span>
                          </div>
                        </div>

                        {/* Interactive questions panel */}
                        <div className="flex flex-col space-y-1 mb-2.5 font-mono select-none font-sans">
                          <span className="text-[8px] text-slate-400 uppercase tracking-wider font-bold block font-mono">Quick Question Selectors:</span>
                          <button
                            onClick={() => askVoiceAI("Show me critical patients")}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-[#6D28D9] border border-indigo-150 rounded text-[8.5px] font-bold uppercase text-left cursor-pointer truncate transition-colors font-mono"
                          >
                            🩺 "Show me critical patient profiles"
                          </button>
                          <button
                            onClick={() => askVoiceAI("Why is Sarah Jenkins Sepsis score spiking")}
                            className="px-2 py-1 bg-red-50 hover:bg-red-100 text-rose-700 border border-red-150 rounded text-[8.5px] font-bold uppercase text-left cursor-pointer truncate transition-colors font-mono"
                          >
                            ⚠️ "Why is Sarah Jenkins' score spiked?"
                          </button>
                          <button
                            onClick={() => askVoiceAI("Explain digital twin outcomes")}
                            className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-[#7E22CE] border border-purple-150 rounded text-[8.5px] font-bold uppercase text-left cursor-pointer truncate transition-colors font-mono"
                          >
                            🔬 "Explain physiological Twin outcomes"
                          </button>
                        </div>

                        {/* Chat Response console */}
                        <div className="bg-slate-50 border border-slate-200 p-3 rounded font-serif text-[10px] leading-relaxed relative flex-1">
                          <span className="font-mono text-[8px] font-bold uppercase block text-slate-450 border-b border-slate-200/80 pb-1 mb-1.5">Voice Companion Audio Output:</span>
                          {voiceNurseIsTyping ? (
                            <div className="flex items-center space-x-2 text-indigo-500 font-mono text-[9px] py-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce"></span>
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce delay-100"></span>
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce delay-200"></span>
                              <span>CareSync Voice AI processing audio streams...</span>
                            </div>
                          ) : (
                            <p className="text-slate-800 italic font-medium leading-relaxed font-sans text-[9px]">
                              "{voiceNurseAnswer}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-slate-100 flex justify-between items-center text-[7.5px] text-slate-400 select-none font-mono">
                        <span>AUDIO DECODER: SPEECH-TO-TEXT ACTIVE</span>
                        <span className="text-[#10B981] font-extrabold uppercase animate-pulse">● STABLE FEED</span>
                      </div>
                    </div>

                    {/* Doctors caseload allocation & predictive bed assignment */}
                    <div className="border border-slate-200 rounded-sm bg-white p-4 shadow-xs flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2 select-none font-mono">
                          <div>
                            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide font-mono">Caseload Matrix & Bed Forecasts</h3>
                            <p className="text-[8.5px] text-slate-400 font-bold font-semibold">Auto-assigns doctors by workload balances to optimize emergency arrival times.</p>
                          </div>
                        </div>

                        <div className="overflow-x-auto my-2 select-none">
                          <table className="w-full text-left text-[8.5px] border-collapse font-mono">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[7.5px] text-slate-450 font-bold uppercase">
                                <th className="p-1">Specialist On Duty</th>
                                <th className="p-1 text-center">Active Caseload</th>
                                <th className="p-1 text-right">Ecosystem Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              <tr>
                                <td className="p-1 text-[#1E293B] font-extrabold">Dr. Smith</td>
                                <td className="p-1 text-center text-red-650 font-black font-mono">10 Patients (Full)</td>
                                <td className="p-1 text-right text-slate-500">Standby overload</td>
                              </tr>
                              <tr className="bg-emerald-50 text-emerald-900 border-y border-emerald-100">
                                <td className="p-1 font-extrabold">Dr. David</td>
                                <td className="p-1 text-center text-emerald-800 font-extrabold font-mono">2 Patients (Idle)</td>
                                <td className="p-1 text-right text-emerald-800 font-bold">Recommended Task Route</td>
                              </tr>
                              <tr>
                                <td className="p-1 text-[#1E293B]">Dr. Emma</td>
                                <td className="p-1 text-center font-mono">7 Patients</td>
                                <td className="p-1 text-right text-slate-500">Normal duty</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Bed conversion risk profile */}
                        <div className="p-2 border border-slate-200 rounded-sm bg-slate-50 select-none">
                          <span className="text-[7.5px] text-slate-400 block font-extrabold font-mono">PREDICTIVE 2-HOUR ICU BED REQUIREMENT:</span>
                          <div className="flex justify-between items-center text-[9px] mt-1 pr-1 font-mono">
                            <div>
                              <span className="font-extrabold text-[#1E293B]">Patient Emma:</span>
                              <span className="text-[#B91C1C] font-black block leading-none mt-0.5">85% ICU Needed</span>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-[#1E293B]">Patient Alice:</span>
                              <span className="text-emerald-700 font-extrabold block leading-none mt-0.5">22% ICU Needed</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 text-center select-none font-mono">
                        <button
                          onClick={() => askVoiceAI("Analyze bed resource constraints")}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase hover:scale-101 transition-all rounded text-[8px] cursor-pointer"
                        >
                          🔬 Trigger Smart Case Resource Planning Query
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <PatientCompanion />
              )}

                {/* Ultimate CareSync Ecosystem Flow horizontal infographic */}
                <div className="mt-4 border border-slate-200 bg-slate-900 text-slate-400 p-4 font-mono select-none rounded">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-3">
                    <span className="text-[8.5px] font-black text-slate-100 uppercase tracking-widest block font-mono">CareSync Global AI Ecosystem Pipeline</span>
                    <span className="text-[7.5px] bg-slate-800 text-emerald-400 px-1.5 py-0.2 rounded font-extrabold">LIVE ARCHITECTURE SCHEMA</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-9 gap-3 text-center text-[7.5px] font-bold leading-normal relative">
                    <div className="p-2 border border-slate-800 bg-slate-950/40 rounded flex flex-col justify-between">
                      <span className="text-white">1. Wearable Watch</span>
                      <span className="text-[6.5px] text-slate-500 font-semibold block mt-1">Ingests HR, SpO₂, ECG, sleep anomalies on wrist</span>
                    </div>
                    <div className="p-2 border border-slate-800 bg-slate-950/40 rounded flex flex-col justify-between">
                      <span className="text-[#38BDF8]">2. Edge Gateway</span>
                      <span className="text-[6.5px] text-slate-500 font-semibold block mt-1">SIM card edge data streams via fast WebSockets</span>
                    </div>
                    <div className="p-2 border border-slate-800 bg-slate-950/40 rounded flex flex-col justify-between">
                      <span className="text-amber-500 animate-pulse">3. AI Predictor</span>
                      <span className="text-[6.5px] text-slate-500 font-semibold block mt-1">Local Edge ML maps triage health hazards in real-time</span>
                    </div>
                    <div className="p-2 border border-slate-800 bg-slate-950/40 rounded flex flex-col justify-between">
                      <span className="text-purple-400">4. Handshake Stack</span>
                      <span className="text-[6.5px] text-slate-505 font-semibold block mt-1">Pagers alert designated clinical duty leads</span>
                    </div>
                    <div className="p-2 border border-slate-800 bg-slate-950/40 rounded flex flex-col justify-between">
                      <span className="text-[#10B981]">5. Family Alert</span>
                      <span className="text-[6.5px] text-slate-500 font-semibold block mt-1">Dispatches auto SMS notifications to daughter with health logs</span>
                    </div>
                    <div className="p-2 border border-slate-800 bg-slate-950/40 rounded flex flex-col justify-between">
                      <span className="text-rose-500">6. Ambulance ETA</span>
                      <span className="text-[6.5px] text-slate-500 font-semibold block mt-1">Auto-books emergency carrier and calculates ETA route</span>
                    </div>
                    <div className="p-2 border border-slate-800 bg-slate-950/40 rounded flex flex-col justify-between">
                      <span className="text-indigo-400">7. Ward Admission</span>
                      <span className="text-[6.5px] text-slate-500 font-semibold block mt-1">Coordinates hospital entry based on ICU bed forecasts</span>
                    </div>
                    <div className="p-2 border border-slate-800 bg-slate-950/40 rounded flex flex-col justify-between">
                      <span className="text-teal-400">8. Digital Clone</span>
                      <span className="text-[6.5px] text-slate-500 font-semibold block mt-1">Digital Twin assesses clinical interventions before execution</span>
                    </div>
                    <div className="p-2 border border-indigo-950 bg-indigo-900 text-white rounded flex flex-col justify-between shadow-lg">
                      <span>9. Intervention</span>
                      <span className="text-[6.5px] text-indigo-200 font-semibold block mt-1">Drastically reduces Bedside Estimated Arrival (ETI) times</span>
                    </div>
                  </div>

                  {/* Social outreach & spot rural Village use case */}
                  <div className="mt-3.5 pt-3.5 border-t border-slate-800 text-[8.5px] flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="bg-[#10B981] text-white px-1.5 py-0.2 rounded text-[7.5px] font-extrabold uppercase">Spotlight: Primary Rural Health Outreach</span>
                      <p className="text-slate-400 font-semibold">Allows low-resource villages with cheap SpO₂ bands to enjoy world-class predictive, offline-resilient ICU alert safeguards.</p>
                    </div>
                    <div className="text-slate-500 uppercase font-black text-[7.5px] tracking-widest text-right">
                      CareSync Global Health Automation Framework &bull; All Rights Reserved
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        </section>

        {/* --- Right parameter column (160px fixed width) --- */}
        {/* Pinned Right - Aligns with hospital command console monitors showing ACTIVELY MONITORED patient */}
        <section 
          id="parameter-column" 
          className={`${
            isVitalsOpen ? "fixed right-0 top-[44px] bottom-0 z-30 shadow-2xl w-[150px] border-l border-slate-300 grid grid-rows-6" : "hidden"
          } lg:static lg:grid lg:w-[160px] lg:grid-rows-6 lg:shadow-none h-full bg-[#E2E8F0] border-l border-slate-200 transition-all duration-300`}
        >
          
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
        
        let priorityColor = "#22C55E";
        let cardBorder = "border-[#22C55E]/30";
        let headingBg = "bg-[#22C55E]/10";
        let badgeStyle = "bg-green-50 text-green-700 border-green-200";
        if (selectedPatient.priority === "Critical") {
          priorityColor = "#DC2626";
          cardBorder = "border-[#DC2626]/30";
          headingBg = "bg-[#DC2626]/10";
          badgeStyle = "bg-red-50 text-red-700 border-red-250";
        } else if (selectedPatient.priority === "High Risk") {
          priorityColor = "#F97316";
          cardBorder = "border-[#F97316]/30";
          headingBg = "bg-[#F97316]/10";
          badgeStyle = "bg-amber-50 text-amber-700 border-amber-250";
        } else if (selectedPatient.priority === "Moderate") {
          priorityColor = "#D97706";
          cardBorder = "border-[#D97706]/30";
          headingBg = "bg-[#D97706]/10";
          badgeStyle = "bg-amber-55 text-amber-700 border-amber-205";
        }

        return (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity duration-300 select-text">
            {/* Main drawer body */}
            <div className="w-full max-w-[480px] h-full bg-white border-l border-slate-200 flex flex-col justify-between shadow-2xl relative text-slate-800">
              
              {/* Header block with close */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-2">
                  <ShieldAlert size={16} style={{ color: priorityColor }} className="animate-pulse" />
                  <div>
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 font-mono">CLINICAL PROFILE DRAWER</h3>
                    <p className="text-[11px] font-bold text-slate-800 leading-none mt-0.5">{selectedPatient.bedId.toUpperCase()} &bull; Patient ID: {selectedPatient.id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPatientId(null)}
                  className="p-1.5 border border-slate-200 bg-white text-slate-400 hover:text-slate-800 transition-colors cursor-pointer rounded-sm hover:border-slate-300"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans bg-[#F8FAFC]">
                
                {/* 1. Patient profile card */}
                <div className="bg-white border border-slate-200 p-3 text-[10px] space-y-2 rounded-sm shadow-2xs">
                  <div className="flex justify-between items-baseline border-b border-slate-100 pb-1.5 mb-1">
                    <span className="text-[14px] font-extrabold text-slate-900 tracking-tight">{selectedPatient.name}</span>
                    <span className="text-[8px] bg-slate-50 px-2 py-0.5 border border-slate-200 text-slate-500 font-bold uppercase rounded-sm">
                      {selectedPatient.gender} &bull; {selectedPatient.age} Yrs
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600 font-medium">
                    <span>Diagnosis:</span>
                    <span className="text-red-650 font-bold uppercase">{selectedPatient.dx}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600 font-medium">
                    <span>Alert Condition:</span>
                    <span className="text-slate-800 font-bold">{selectedPatient.alertStatus}</span>
                  </div>
                  <div className="pt-2 flex items-center justify-between border-t border-slate-100 mt-1.5">
                    <span className="text-slate-400 uppercase text-[8px] font-bold font-mono">Priority Classification:</span>
                    <span className={`px-2 py-0.5 text-[9px] font-extrabold border uppercase rounded-sm ${badgeStyle}`}>
                      {selectedPatient.priority}
                    </span>
                  </div>
                </div>

                {/* 2. Deterioration Warning (Trend Detection) */}
                {metrics.spo2Deteriorating && (
                  <div className="bg-amber-50 border border-amber-200 p-3 space-y-2 text-slate-800 rounded-sm">
                    <div className="flex items-center space-x-1.5 text-amber-700 font-bold text-[9.5px] font-mono">
                      <AlertTriangle size={13} className="animate-pulse" />
                      <span>⚠ AUTOMATED DECOMPENSATION WARNING</span>
                    </div>
                    <p className="text-[9.5px] text-slate-700 leading-normal">
                      Oxygen saturation displays sequence deterioration on wrist monitor feed. Early intervention protocols active.
                    </p>
                    <div className="pt-1.5 border-t border-amber-200/60 flex items-center justify-between text-[8px] text-slate-500 font-bold font-mono uppercase">
                      <span>Oxygen trend sequence:</span>
                      <span className="font-extrabold text-red-600">
                        {selectedPatient.spo2History.join(" → ")}%
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Explainable AI Clinical Triggers */}
                <div className="bg-white border border-slate-200 p-3.5 space-y-2 rounded-sm shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1">
                    <span className="text-[9px] font-extrabold text-indigo-750 uppercase flex items-center space-x-1 font-mono">
                      <Sparkles size={11} className="mr-0.5 text-indigo-650" />
                      <span>Explainable AI Core Triggers</span>
                    </span>
                    <span className="text-[7.5px] text-slate-400 font-bold uppercase font-mono">Telemetry Check</span>
                  </div>
                  <p className="text-[9.5px] text-slate-650 leading-normal">
                    Assigned Index score of <strong className="text-slate-900">{selectedPatient.riskScore}%</strong> is derived mathematically according to clinical indicators:
                  </p>
                  <ul className="space-y-1 text-[9.5px] pl-1 font-sans font-medium text-slate-700">
                    {explReasons.length > 0 ? (
                      explReasons.map((reason, ri) => (
                        <li key={ri} className="flex items-start text-slate-700">
                          <span className="text-red-500 mr-2 font-bold">&bull;</span>
                          <span>{reason}</span>
                        </li>
                      ))
                    ) : (
                      <li className="flex items-start text-green-700 font-semibold">
                        <span className="mr-2 font-bold text-[#22C55E]">&bull;</span>
                        <span>Vitals metrics reside entirely inside standard homeostatic boundaries.</span>
                      </li>
                    )}
                  </ul>
                  <div className="pt-2 text-[8px] font-bold text-red-600 border-t border-slate-100 mt-2 uppercase tracking-wide font-mono">
                    Supervised CareSync ruleset: 6 criteria surveyed.
                  </div>
                </div>

                {/* 4. Specialist Recommendation Block */}
                <div className="bg-indigo-50 border border-indigo-100 p-3.5 flex flex-col justify-between rounded-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-indigo-100/60">
                    <span className="text-[9.5px] font-extrabold text-indigo-850 uppercase tracking-wider flex items-center space-x-1 font-mono">
                      <Stethoscope size={11} />
                      <span>Specialist Placement recommendation</span>
                    </span>
                    <span className="text-[7.5px] text-indigo-600 font-bold uppercase bg-white border border-indigo-150 px-1.5 py-0.2 rounded-sm font-mono">Rule active</span>
                  </div>
                  <div className="my-2 select-all font-mono">
                    <div className="text-[17px] font-black text-indigo-805 tracking-tight uppercase text-indigo-750">
                      {metrics.specialist}
                    </div>
                    <div className="text-[7.5px] text-indigo-500 uppercase font-black tracking-widest mt-0.5">Assigned Target Team</div>
                  </div>
                  <p className="text-[9px] text-[#1E40AF] font-sans leading-tight font-medium">
                    {selectedPatient.priority === "Critical" && metrics.severeCount >= 2 
                      ? "Dispatched because multi-vitals severe failure trigger rules highlight patient's critical risk."
                      : selectedPatient.spo2 < 93 
                      ? "Pulmonologist prioritized because oxygen saturation has entered hypoxic limits (<93%)."
                      : "Cardiologist matched to evaluate core peripheral pulse indicators & abnormal perfusion values."}
                  </p>
                </div>

                {/* 5. Vitals Grid Dashboard */}
                <div className="border border-slate-200 bg-white rounded-sm overflow-hidden shadow-2xs">
                  <div className="bg-slate-50 p-2 px-3 border-b border-slate-200 text-[8px] font-bold uppercase text-slate-400 font-mono tracking-wider">
                    Recent telemetry measurement capture
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-y divide-slate-100 bg-white text-left text-[9.5px] font-mono">
                    <div className="p-2.5 flex flex-col">
                      <span className="text-[7px] text-slate-400 font-bold uppercase">HERT RATE</span>
                      <span className="text-[#059669] font-extrabold text-[13px]">{selectedPatient.hr} <small className="text-[7.5px] text-slate-400 font-medium font-sans">bpm</small></span>
                    </div>
                    <div className="p-2.5 flex flex-col border-t-0!">
                      <span className="text-[7px] text-slate-400 font-bold uppercase">SPO2 SAT</span>
                      <span className="text-[#0284C7] font-extrabold text-[13px]">{selectedPatient.spo2}%</span>
                    </div>
                    <div className="p-2.5 flex flex-col">
                      <span className="text-[7px] text-slate-400 font-bold uppercase">ART. BP</span>
                      <span className="text-red-650 font-extrabold text-[13px] whitespace-nowrap">{selectedPatient.bpSys}/{selectedPatient.bpDia}</span>
                    </div>
                    <div className="p-2.5 flex flex-col">
                      <span className="text-[7px] text-slate-400 font-bold uppercase">TEMP</span>
                      <span className="text-amber-600 font-extrabold text-[13px]">{selectedPatient.temp.toFixed(1)}°C</span>
                    </div>
                    <div className="p-2.5 flex flex-col">
                      <span className="text-[7px] text-slate-400 font-bold uppercase">RESP RATE</span>
                      <span className="text-[#7C3AED] font-extrabold text-[13px]">{selectedPatient.rr} <small className="text-[7.5px] text-slate-400 font-medium font-sans">/min</small></span>
                    </div>
                    <div className="p-2.5 flex flex-col">
                      <span className="text-[7px] text-slate-400 font-bold uppercase">EtCO2</span>
                      <span className="text-[#EA580C] font-extrabold text-[13px]">{selectedPatient.co2} <small className="text-[7px] text-slate-400 font-medium font-sans">mmHg</small></span>
                    </div>
                  </div>
                </div>

                {/* 6. Predictive Alert for Critical Risk */}
                <div className="border border-slate-200 bg-white p-3 space-y-1.5 rounded-sm shadow-2xs font-mono">
                  <div className="flex justify-between items-center text-[7.5px] uppercase font-black text-slate-400 pb-1.5 border-b border-slate-100">
                    <span>INDEXED FORECAST MATHS</span>
                    <span>30-MINUTES WINDOW</span>
                  </div>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-slate-500 font-bold text-[9px]">Deterioration probability:</span>
                    <span className="text-slate-800 text-[11px] font-black px-1.5 py-0.2 bg-slate-50 border border-slate-200 rounded-sm">
                      {selectedPatient.riskScore}%
                    </span>
                  </div>
                  <div className="text-[9px] leading-tight">
                    <span className="text-slate-500 font-bold">Severity designation: </span>
                    <span className="font-extrabold text-[#DC2626]" style={{ color: priorityColor }}>
                      {selectedPatient.priority.toUpperCase()} ACTION REQUIRED
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-100">
                    <span className="text-slate-500 font-bold text-[8.5px] block uppercase tracking-wider mb-0.5">Algorithmic rationale:</span>
                    <span className="text-slate-600 italic font-sans block text-[9px] leading-tight pt-0.5">
                      {selectedPatient.riskScore > 65 
                        ? "Continuous SpO₂ decrement trend coupled with high basal heart rate and febrile indices triggers risk probability."
                        : "Consistent autonomic homeostasis is maintained; vital signs fluctuations are within healthy parameters."}
                    </span>
                  </div>
                </div>

              </div>

              {/* Actions Footnote - Sync active monitor button */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex space-x-2">
                <button 
                  onClick={() => {
                    setActivePatientId(selectedPatient.id);
                    setActiveTab("live");
                    setSelectedPatientId(null);
                  }}
                  className="flex-1 py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-extrabold uppercase text-[9px] tracking-wider text-center cursor-pointer transition-colors rounded-sm shadow-2xs"
                >
                  ASSIGN MAIN COCKPIT FOCUS
                </button>
                <button 
                  onClick={() => setSelectedPatientId(null)}
                  className="px-4 py-3 border border-slate-250 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-[9px] font-extrabold uppercase transition-colors cursor-pointer rounded-sm"
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
