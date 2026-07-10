# 🩺 CareSync (Patient Monitor Core)
### *Next-Gen Bedside ICU Monitor, Predictive Sepsis Engine, and Geriatric Pill-ID Voice Assistant*

CareSync is a full-stack, medically grounded ICU simulation suite and patient safety workbench. It integrates real-time bedside wave telemetry, predictive clinical alert queues, a generative clinical command room, internet of medical things (IoMT) dashboards, and an optical-vision pill identity broadcast system built to assist low-literacy geriatric outpatients.

The platform's user interface is inspired by high-density bedside equipment like standard **Philips IntelliVue screens**, deep integration layers like **Epic Systems EDI**, real-time sepsis alerting tools like **TREWS (Targeted Real-time Early Warning System)**, and vision-assisted patient companion technologies like **LookDeep Health**.

---

## 🚀 Key Architectural Modules

CareSync is structured into seven high-density, interactive views, each addressing critical modern clinical workflows:

### 1. 📺 Interactive Bedside Waveform Display (`Live View`)
- **Philips IntelliVue Engine**: Renders live, scrolling, high-frequency waveforms for **ECG (Electrocardiography)**, **SpO₂ (Photoplethysmogram)**, **Respiration frequency**, and **Capnography (CO₂)** inside performant HTML5 canvases.
- **Dynamic Vital Alarms**: Adjust thresholds for heart rate (HR), oxygen saturation (SpO₂), blood pressure (BP), and respiratory rates (RR). Features interactive audio siren alerts with real-time flashing clinical visual panels when vitals slip into critical zones.
- **Vitals Controller**: Fine-tune patient physiological trends dynamically to prototype how the system alerts bedside staff during hypoxemia, tachypnea, or cardiac arrest instances.

### 2. ⚡ SEPSIS early alert queue (`Alert Queue`)
- **TREWS & qSOFA Integrations**: Evaluates the quick Sequential Organ Failure Assessment indices continuously. Checks variables (Respiratory Rate ≥ 22, Systolic BP ≤ 100, altered Glasgow Coma Scale) to forecast severe infection outbreaks.
- **Continuous Clinical Logger**: Documents real-time telemetry updates, Sepsis probability levels (0-100%), and historical clinical interventions inside a structured database grid.

### 3. 🤖 Clinical Gemini Command Assistant (`Command tab`)
- **Diagnostic Assistant**: Combines real-time patient physiological trends and current diagnosis descriptions to generate professional physician-level diagnostic breakdowns with Google Gemini.
- **Clinical Formulation**: Instantly writes accurate clinical notes, suggests next-step bed diagnostics, synthesizes lab schedules, and parses medical acronyms into simplified terms.

### 4. 🌐 IoMT Wearables & Smart Room Ecosystem (`IoMT Ecosystem`)
- **Smart Bedside Elevators**: Monitors mattress inclination angles to prevent ventilator-associated pneumonia (VAP), triggering alerts if angles fall below the clinical recommendation of 30°.
- **Infusion Pump Monitoring**: Displays live chemical infusion drip rates (e.g., Norepinephrine, Propofol) and warns when pump volume thresholds approach depletion.
- **Wearable Sensors**: Simulates wireless geriatric dermal patches tracking skin moisture, core body temperature, and physical step activity.

### 5. 💊 Geriatric Pill Identity & Multilingual Voice (`Pill ID tab`)
- **Gemini-Vision Lens**: Utilizes Gemini 2.x Vision modules to process camera streams or uploaded medication images. Identifies chemical designations, active dosages, clinical purposes, shapes, colors, and dietary constraints.
- **Native Regional Voice Translators**: Translates instructions into warm, highly accessible voice guidelines in regional scripts including **தமிழ் (Tamil)**, **తెలుగు (Telugu)**, **മലയാളം (Malayalam)**, **हिन्दी (Hindi)**, and **English**.
- **Virtual Outbound VoIP Dialer**: Simulates direct outbound telephony phone reminders. Outlines trunks routing logs and synthesizes reminders over virtual handset SIP trunks—ideal for grandmothers who struggle with smartphone applications.

### 6. 📹 Virtual Nurse Companion & Vision Security (LookDeep Bedside Core)
- **Posture & Fall-Risk Evaluation**: Simulates room-boundary computer-vision bounds. Gauges active patient motion patterns, body posture, pressure sore redistribution cycles, and immediate room-exit risks.
- **On-Demand Remote Caregiver Stream**: Offers instant video-feed toggles and virtual-nurse audio broadcasts directly facing the bedside terminal.

### 7. 📥 High-Density Clinical Imports (`Kaggle Core`)
- **Kaggle Ingest Sandbox**: Replicates imports of high-frequency datasets (e.g., MIMIC-IV Clinical ICU logs, sepsis cohorts) to evaluate predictive alert structures against large clinical databases.

### 👥 8. Unified Clinician Central Access Hub (`Central Access Console`)
- **Master Access Gateway**: Solves the core challenge of patient data fragmentation. Provides a single, secure console for a single clinician to access all 20 ICU ward beds' live telemetry data instantly from any tab.
- **Global Patient Switcher & Search**: Includes real-time keyword search (by name, diagnosis, bed, or condition) and quick-filtering by clinical severity (Critical, High Risk, Stable). Switching patients instantly updates the entire dashboard focus.
- **Real-Time Ward Status Overview**: Displays compact metrics (active critical counts, high-risk counts) and live physiological readings for the entire ICU ward in a high-density, centralized popover directory.

---

## 🛠️ Physiological Formulas & Scoring Engine

CareSync applies clinically verified calculation structures to guarantee logical accuracy during offline simulation fallbacks:

### Sepsis Predictor (qSOFA Score calculation)
$$qSOFA = (RR \ge 22) + (SBP \le 100) + (GCS < 15)$$
- **Score $\ge$ 2**: High risk of poor clinical outcomes and prolonged ICU stay.
- **Score < 2**: Standard ward observation indicated.

### SIRS (Systemic Inflammatory Response Syndrome)
$$SIRS = (HR > 90) + (Temp > 38^\circ C \text{ or } < 36^\circ C) + (RR > 20) + (WBC \text{ abnormal})$$
- Score $\ge 2$ triggers intermediate sepsis monitoring safeguards inside the alert table logs.

---

## 💻 Tech Stack & Project Dependencies

CareSync is designed on a full-stack Node.js & TypeScript pipeline:

*   **Frontend**: React 19, Vite (v6), and Tailwind CSS (v4) with high-performance CSS custom properties.
*   **Animations**: Motion (v12) for fluid layout translations and alert banner pulses.
*   **Icons**: Lucide React for pixel-accurate clinical symbol designs.
*   **Backend**: Express Server supporting a TypeScript runtime with `tsx` inside dev modes.
*   **Bundling**: Esbuild for fast production JS compilation and type-stripping support.
*   **Core SDK**: `@google/genai` (v2.x) Client for structured JSON, text analyses, and vision inputs.

---

## 📦 Detailed Installation and Local Setup Guide

Follow these steps to run the complete full-stack workspace locally:

### 1. Clone the Workspace and Install Dependencies
Install all required project tools (ensure Node.js 18+ is active on your device):
```bash
# Register correct folders and pull initial packages
npm install
```

### 2. Configure Environment Secrets
Create a `.env` file in the root directory. CareSync utilizes server-side API requests exclusively to shield credentials from client-side developer tools:
```env
# Absolute secret key. Do NOT add VITE_ prefixes.
GEMINI_API_KEY=your_google_ai_studio_api_key_here
```

### 3. Launch Development Server
Boot up the concurrent Express-Vite backend service. Vite compiles asset hot-swaps while Express binds the api proxy layers:
```bash
# Launches tsx node wrapper on port 3000
npm run dev
```
Open your browser and navigate to `http://localhost:3000` to interact with the system.

### 4. Build for Production Bundles
CareSync compiles the backend TypeScript server into a single bundled `dist/server.cjs` file using `esbuild`. This approach resolves all relative ES Module import paths at compile time, bypassing strict runtime relative import constraints:
```bash
# Builds React frontend and bundles Express into dist/server.cjs
npm run build
```

### 5. Launch Production Build
```bash
# Starts the compiled application in high-efficiency standalone mode
npm run start
```

---

## 🔒 Safe SDK & API Key Architecture

CareSync implements a robust, secure clinical gateway:
- **Zero Client exposure**: Secret keys like `GEMINI_API_KEY` are read strictly server-side by Express handlers. No API keys are prefixed with `VITE_` or exposed to the browser.
- **Fail-Safe Grounded Fallbacks**: If the required API key is not present in the settings environment, the system gracefully shifts to standard, clinically verified medical rule fallbacks (using qSOFA/SIRS algorithms). This ensures the ICU waveforms, IoMT alerts, and Pill ID simulations operate seamlessly even in decoupled environments.
- **Exponential Backoff Operations**: Incorporates dedicated automated retry cycles when interfacing with remote visual models to mitigate network volatility and ensure high system availability.

---

## 👩‍⚕️ Clinical Testing Presets for Evaluators

For clinical presentations or technical evaluations, use these simulated testing patterns to demonstrate the platform’s real-time responsive architecture:

1.  **Induce Sepsis Alert**: Navigate to **Live View**, select **Sarah Jenkins (P108)**, and drag her **Blood Pressure (Systolic)** down to $85 \text{ mmHg}$ and her **Respiratory Rate** up to $26\text{ breaths/min}$. Shift to the **Sepsis Alert Queue** or **Gemini Command AI** to view real-time qSOFA risk alarms and automated clinical reviews.
2.  **Ventilator-Associated Pneumonia Safeguard**: Go to the **IoMT Ecosystem** tab, find the **Bed Elevation Angle** controller, and lower the mattress below $30^\circ$. A critical bedside caregiver safety warning will trigger instantly.
3.  **Low-Literacy Geriatric Pill ID**: In the **Pill ID & Tamil Voice** dashboard, select the **Red Capsule** under presets, click **Identify Visual**, set language translation to **தமிழ் (Tamil)**, and trigger **Play Local Audio Speaker** or **Dispatch Call Reminder** to listen to the geriatric speech broadcast.

---
*CareSync Patient Bedside Core: Engineered with meticulous care to protect clinical life critical workflows.*
