# VayuIQ: AI-Powered Smart City Air Quality Command Center

[![React 18](https://img.shields.io/badge/Frontend-React%2018-blue?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Build%20Tool-Vite-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Google Gemini](https://img.shields.io/badge/AI%20Engine-Gemini%203.5%20Flash-F59E0B?logo=googlegemini&logoColor=white)](https://ai.google.dev)
[![Express](https://img.shields.io/badge/Backend-Express.js-000000?logo=express&logoColor=white)](https://expressjs.com)

**VayuIQ** is a state-of-the-art urban air quality intelligence command center tailored specifically for Indian smart city administrators. Utilizing a multi-agent framework powered by Google's **Gemini 3.5 Flash** model and integrated with **Google Maps Platform**, VayuIQ turns chaotic, multi-sensor meteorological and spatial data into highly structured, real-time, and actionable directives for public safety and regulatory enforcement.

---

## The Problem & Our Solution

### The Challenge: "Data Rich, Information Poor"
Urban centers in India (like Delhi, Mumbai, and Kolkata) are equipped with continuous ambient air quality monitoring stations (CAAQMS). However, municipal authorities struggle with **reactive decision-making**:
1. **Unattributed Spikes**: Knowing the AQI is high is not enough; administrators need to pinpoint the primary contributors (construction dust, traffic volume, agricultural waste, or industrial output).
2. **Disconnected Meteorology**: Correlating sudden weather changes with AQI levels usually requires offline scientific modeling.
3. **Delayed Public Warnings**: Generating precise health advisories for children, elderly, and vulnerable groups across multiple regional languages takes too long.
4. **Inefficient Inspection Routing**: Air quality inspectors are deployed blindly rather than targeted toward high-probability pollution culprits.

### The Solution: VayuIQ Command Center
VayuIQ bridges the gap from raw metrics to local interventions through a unified command dashboard featuring:
- **Interactive Spatial Monitoring**: Direct ward-level air quality visualization on real-world map coordinates.
- **Deterministic Action Sandbox**: A sandbox letting planners simulate changes in municipal variables (traffic, construction, waste, industry) and view immediate AQI predictions.
- **Autonomous Multi-Agent Analysis**: Four specialized Gemini-powered AI agents providing deep explanations, medical advisory translation, and targeted enforcement recommendations on-the-fly.

---

## System & Agentic Architecture

VayuIQ is built with a highly secure, full-stack **Express + React** architecture. All communication with Gemini AI is structured server-side using the official `@google/genai` SDK to keep sensitive API keys completely hidden from client browsers.

```
┌────────────────────────────────────────────────────────┐
│                   React 18 Frontend                    │
│  (Google Maps, Recharts, Simulation Dashboard, Toasts)  │
└───────────────────────────┬────────────────────────────┘
                            │ (Client API Calls)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Express.js Server                    │
│   (Secure Environment Proxies, Dev Server Middleware)   │
└───────────────────────────┬────────────────────────────┘
                            │ (Secure SDK Handshake)
                            ▼
┌────────────────────────────────────────────────────────┐
│               Gemini 3.5 Flash Engine                  │
│       - Structured Schema Enforcements (JSON)          │
│       - System Instruction-Guided Persona Routing      │
└────────────────────────────────────────────────────────┘
```

### The AI Agent Squad
We employ **four distinct, domain-specific AI agents** configured with precise JSON response schemas to guarantee deterministic, reliable intelligence:

1. **Source Attribution Agent (`/api/analyzeSources`)**
   - **Role**: Municipal forensic expert.
   - **Function**: Takes real-time ward pollution indicators and reasons *purely* from spatial percentages to identify dominant polluters without fabricating non-existent statistics.
2. **Meteorological Predictor Agent (`/api/explainForecast`)**
   - **Role**: Smart city climatologist.
   - **Function**: Interprets localized wind velocity, temperature fluctuations, and historic diurnal trends to provide a coherent 2-3 sentence explanation of anticipated AQI trends.
3. **Public Health Advisory Agent (`/api/generateAdvisory`)**
   - **Role**: Community health officer.
   - **Function**: Authoritatively generates targeted public health and operational guides for diverse demographic groups. To achieve full linguistic accessibility, it returns translated outputs in **English, Hindi, Kannada, and Tamil** simultaneously.
4. **Enforcement Intelligence Agent (`/api/justifyEnforcement`)**
   - **Role**: Regulatory operations planner.
   - **Function**: Automatically rates construction/industrial sites based on proximity, weights, and violation scores. It yields inspection recommendations complete with an **Urgency level** (Critical, High, Medium) and an **Evidence Confidence Score** (0-100%).

---

## Key Technical Implementations

- **Google Maps Integration**: Using `@vis.gl/react-google-maps` to render continuous, high-performance, ward-specific pinpoints, custom AQI heat circles, and interactive info-windows directly corresponding to urban monitoring coordinates.
- **Deterministic Simulation Core**: Seeded random generators (`Mulberry32`) provide continuous, reliable baselines across 5 mega-regions (Delhi, Mumbai, Kolkata, Chennai, Bengaluru) so simulation metrics map logically to genuine diurnal cycles.
- **Dual-Alert Notification Engine**: Features built-in browser notification permissions and synth-based auditory warnings (`Web Audio Context API`) to grab controllers' immediate attention when a ward breaches critical AQI thresholds.
- **Strict Key Security Enforcements**: Remediated all critical frontend exposures by migrating Google Maps API and Gemini SDK declarations to Express proxy routes, backed by comprehensive `.env.example` configurations.

---

## Project Directory Structure

```
├── .env.example            # Template for server-side API keys and secrets
├── package.json            # Script targets, bundlers, and npm dependencies
├── tsconfig.json           # TypeScript compilation configuration
├── vite.config.ts          # Vite bundler, asset resolvers, and build configuration
├── server.ts               # Custom Express server with mounted Vite and AI routes
├── src/
│   ├── main.tsx            # App bootstrapping entry point
│   ├── App.tsx             # Interactive dashboard and core UI command center
│   ├── LandingPage.tsx     # Clean introduction & landing interface
│   ├── index.css           # Global styles and Tailwind imports
│   └── lib/
│       ├── gemini.ts       # Secure frontend API proxies and Request Queue
│       └── syntheticData.ts # Diurnal data generators and city coordinates
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) or [Bun](https://bun.sh/)
- A **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/))
- A **Google Maps Platform API Key** (with Maps JavaScript API enabled)

### Installation
1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/vayuiq.git
   cd vayuiq
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your keys:
   ```env
   # .env
   GEMINI_API_KEY="AIzaSyYourGeminiApiKeyHere..."
   GOOGLE_MAPS_PLATFORM_KEY="AIzaSyYourGoogleMapsKeyHere..."
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```
   The application will boot and be accessible at `http://localhost:3000`.

5. **Build for Production**:
   To compile both the React client assets and bundle the CJS backend server:
   ```bash
   npm run build
   npm start
   ```

---

## Hackathon Value Propositions

- **Linguistic Inclusivity**: Real-time regional translation ensures that critical environmental warnings can be broadcasted to local vernacular news sources instantly.
- **Cost-Optimized Requests**: Fronted by a client-side `RequestQueue` and memoization cache (`_healthCache`, `_forecastCache`, etc.), preventing redundant LLM calls and managing API rate limits gracefully during concurrent traffic.
- **Fail-safe Fallbacks**: Every API route features highly robust deterministic fallbacks. If an API key is missing or the external model hits a transient error, the application seamlessly switches to structured static assessments without breaking the administrator dashboard.
- **Actionable Inspections**: Empowers regulatory officers to dispatch drones or inspect sites with a scientific audit trail rather than random spot checks.


Link to the website: https://vayuiq.ai.studio/
