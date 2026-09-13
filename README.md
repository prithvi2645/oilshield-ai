# 🛢️ Oil India Limited — HSSE SIF Precursor Identification & Safety Triage Platform

> **Enterprise AI-driven Incident Classification, Precursor Risk Analytics, Safety Knowledge Graph, and Compliance Enforcement System**  
> *Aligned with OISD-STD-105, DGMS Oil Mines Regulations (OMR) 2017, and the 10 IOGP Life-Saving Rules.*

---

## 📌 Executive Summary

In upstream oil and gas operations—spanning drilling rigs, gas gathering stations, refineries, and high-pressure cross-country pipelines—traditional safety tracking often struggles to separate high-consequence **Serious Injury & Fatality (SIF)** precursors from routine low-severity observations.

This platform provides an end-to-end artificial intelligence and data-driven triage solution developed for **Oil India Limited (HSSE Department)**. Built with a zero-external-framework Python server and offline-first ML models, it automatically ingests field safety reports (in English, Hindi, Hinglish, or Assamese regional terms), evaluates energy pathway hazards, checks safety barrier health, flags IOGP Life-Saving Rule violations, builds interactive safety knowledge graphs, and forecasts temporal risk trends across 12+ Oil India operational installations.

---

## ✨ Key Platform Features

### 1. 🤖 AI Incident Classifier & SIF Precursor Triage
- **NLP Vectorization**: Utilizes TF-IDF subword and domain-specific n-gram tokenization tuned specifically for oilfield terminology (e.g., *BOP, flare stack, wellhead pressure, H2S sensor, hot work, wireline*).
- **Dual Machine Learning Engine**:
  - **SIF Precursor Detector**: Binary classification model identifying uncontrolled high-energy release pathways and barrier breaches.
  - **IOGP Life-Saving Rule Classifier**: Multi-class model predicting the exact implicated Life-Saving Rule out of the 10 core IOGP rules.
- **Risk Score & Audit Rationale**: Calculates a numeric SIF risk index (0–100%) and generates an automated audit rationale with OISD action recommendations.

### 2. 🕸️ Safety Relationship Map (D3.js Knowledge Graph)
- Interactive, force-directed graph visualizing deep relationships between operational activities, active hazards, safety barriers, IOGP rules, and potential consequences.
- **Interactive Controls**: Filter by node types (Activity, Hazard, Barrier, LSR Rule, Consequence), search nodes, freeze physics layout, and drag nodes to inspect complex fault pathways.

### 3. 🔍 Historical Similar Incident Retrieval Engine
- Real-time cosine similarity search over historical safety observation databases (500+ records).
- Enables safety officers to inspect past near-misses, historical barrier failures, and previously applied corrective measures for identical site conditions.

### 4. 📈 Temporal Risk Forecasting & KPI Dashboard
- Polyfit linear extrapolation engine calculating 30-day and 60-day projected SIF precursor trends based on historical observation rates.
- Real-time distribution charts: Monthly Trend Analysis, Hazard Category Breakdown, Barrier Condition Health, and Severity Donut Chart.

### 5. 🛡️ Hierarchy of Controls Remediation Engine
- Automatically categorizes corrective recommendations across the 5 standard safety tiers:
  1. **Elimination**
  2. **Substitution**
  3. **Engineering Controls**
  4. **Administrative Controls**
  5. **Personal Protective Equipment (PPE)**

### 6. 🌐 Multilingual & Hinglish Text Processing
- Seamlessly handles mixed-language field reports submitted by technicians and supervisors (e.g., *"Rig floor pe BOP test fail ho gaya pipe line leaks observed near separator"*).

### 7. 🔒 Role-Based Access Control (RBAC)
- 4 pre-configured enterprise roles:
  - **HSE Manager**: Full system access, CSV export, model retraining, and governance.
  - **Site Manager**: Site risk analysis, similar incident search, and barrier tracking.
  - **Field Supervisor**: Incident report submission and hierarchy of controls preview.
  - **Safety Analyst**: Read-only analytics, knowledge graph exploration, and trend viewing.

### 8. 🖼️ Multi-Site Hero Carousel & Site Monitoring
- Rotating high-resolution visual monitoring across key Oil India installations:
  - **Baghjan Field #5** (Drilling Rigs & Production Wells)
  - **Duliajan GGS Station** (Gas Gathering Stations)
  - **Digboi Refinery Area** (Refining & Processing)
  - **Moran OCS Station** (Oil Collecting Stations & Manifolds)

### 9. 📊 UTF-8 Excel-Compatible Data Export
- One-click CSV export endpoint `/api/export` with embedded UTF-8 Byte Order Mark (`\xef\xbb\xbf`), allowing Microsoft Excel on Windows to natively open exported safety reports with proper column formatting.

---

## ⚡ REST API Endpoints (`app/server.py`)

| Endpoint | Method | Description |
|---|---|---|
| `/` | `GET` | Serves main Single-Page Application (`public/index.html`) |
| `/api/classify` | `POST` | Ingests incident text, runs ML inference, returns SIF risk, IOGP rule, rationale & hierarchy of controls |
| `/api/similar` | `POST` | Ingests incident text, performs TF-IDF cosine similarity search, returns top 3 historical near-misses |
| `/api/analytics` | `GET` | Returns summary KPIs, hazard distributions, monthly trend arrays, and polyfit 60-day risk forecasts |
| `/api/knowledge-graph` | `GET` | Returns extracted graph nodes (Activities, Hazards, Barriers, Rules, Consequences) and link edges |
| `/api/reports` | `GET` | Serves safety report records from `data/oil_safety_reports.csv` |
| `/api/export` | `GET` | Serves UTF-8 BOM encoded CSV download for Microsoft Excel compatibility |

---

## 🛠️ Technology Stack & Dependencies

- **Backend / HTTP Server**: Python 3.9+ native `http.server.HTTPServer` (zero external web framework overhead).
- **Machine Learning & NLP**: Scikit-Learn (Logistic Regression, TF-IDF Vectorizer), NumPy, Pandas, Joblib.
- **Frontend UI**: HTML5, Vanilla CSS3 (Custom Design Tokens system & responsive layouts), Vanilla JavaScript (ES6+ async/await architecture).
- **Data Visualizations**: D3.js v7 (Interactive force-directed graph), Chart.js v4 (KPI distribution & trend charts).
- **Version Control & CI**: Git, GitHub (Private Repository), GitHub CLI (`gh`).

---

## 📂 Repository Structure

```
sih-hsse-platform/
├── app/
│   └── server.py                  # HTTP server & REST API handlers (native http.server)
├── data/
│   ├── oil_safety_reports.csv     # Primary dataset of 500+ Oil India safety observations
│   ├── osha_oil_sif_train.csv     # SIF precursor ML training set (OSHA & domain data)
│   ├── osha_oil_sif_test.csv      # SIF precursor ML testing & validation set
│   ├── osha_oil_sif_processor.py  # OSHA & oilfield data ingestion processor
│   └── severe_injury_reports.csv  # Severe injury baseline dataset
├── models/
│   ├── sif_classifier.pkl         # Trained Binary SIF Precursor Classification Model
│   ├── lsr_classifier.pkl         # Trained Multi-class IOGP Life-Saving Rule Model
│   └── tfidf_vectorizer.pkl       # Fitted subword & n-gram TF-IDF Vectorizer
├── public/
│   ├── index.html                 # Single-Page Application HTML layout
│   ├── styles.css                 # Enterprise CSS design system & responsive rules
│   ├── app.js                     # Frontend state manager, API caller & D3 graph renderer
│   ├── data/                      # Client-accessible static dataset copies
│   └── images/                    # Installation photos (Baghjan, Duliajan, Digboi, Moran)
├── src/
│   ├── sif_engine.py              # SIF precursor evaluation & numeric risk scoring
│   ├── nlp_engine.py              # SafetyClassifierPipeline wrapper & text normalizer
│   ├── domain_tokenizer.py        # Oilfield domain vocabulary & Hinglish tokenizer
│   ├── iogp_matcher.py            # Rule matcher against 10 IOGP Life-Saving Rules
│   ├── train.py                   # Model training & joblib serialization pipeline
│   ├── evaluate_experiments.py    # Metric evaluation (Precision, Recall, F1, Confusion Matrix)
│   └── hyperparameter_tuning.py   # Grid search & C-parameter optimization script
├── sif_engine.py                  # Root-level entry point module for SIF calculations
├── .gitignore                     # Git ignore file for bytecode, logs, and venvs
└── README.md                      # Complete enterprise documentation
```

---

## 🚀 Installation & Local Running Guide

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Python 3.9+**
- **Git**
- Modern Web Browser (Chrome, Edge, Firefox, Safari)

### 2. Clone the Repository
```bash
git clone https://github.com/prithvi2645/sih-hsse-platform.git
cd sih-hsse-platform
```

### 3. Install Python ML Dependencies
```bash
python -m pip install scikit-learn numpy pandas joblib
```

### 4. Launch the Server
Start the backend HTTP server:
```bash
python app/server.py
```
*(The server will initialize pre-computed TF-IDF matrices, load ML artifacts from `models/`, and start listening on `http://localhost:8080`)*

### 5. Access the Platform
Open your browser and navigate to:
```
http://localhost:8080
```

---

## 🧪 Model Retraining & Evaluation

If you wish to retrain the ML models or evaluate model metrics locally:

```bash
# 1. Retrain SIF and IOGP classifiers
python src/train.py

# 2. Run hyperparameter tuning (Grid search over C values & n-grams)
python src/hyperparameter_tuning.py

# 3. Evaluate model performance & generate metrics
python src/evaluate_experiments.py
```

---

## 👥 Team Collaboration & Git Best Practices

To maintain a clean, authentic team contribution history:

1. **Local Git Identity Configuration**:
   Each teammate must set their Git name and verified GitHub email before committing:
   ```bash
   git config user.name "Your Full Name"
   git config user.email "your-github-email@example.com"
   ```

2. **Feature Branching**:
   Never commit directly to `main`. Create feature branches for new work:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

3. **Submitting Changes**:
   Push feature branch and open a Pull Request (PR) on GitHub:
   ```bash
   git add .
   git commit -m "feat: add real-time barrier condition tracker"
   git push -u origin feature/your-feature-name
   ```

4. **Destructive Command Warning**:
   - Avoid `git reset --hard` (deletes local uncommitted work). Use `git stash` or `git revert`.
   - Avoid `git push --force`. Use `git push --force-with-lease` to prevent overwriting teammates' remote commits.

---

## 📜 Regulatory Standards Reference

- **OISD-STD-105**: Work Permit System for Oil & Gas Industry Safety.
- **DGMS Oil Mines Regulations (OMR) 2017**: Standards for Machinery, Pressure Vessels, and Electrical Safety in Oil Fields.
- **IOGP 10 Life-Saving Rules**:
  1. *Bypassing Safety Controls*
  2. *Confined Space Entry*
  3. *Driving & Road Safety*
  4. *Energy Isolation*
  5. *Hot Work Operations*
  6. *Line of Sight / Dropped Objects*
  7. *Safe Mechanical Lifting*
  8. *Toxic Gas / H2S Exposure*
  9. *Work Authorization / Permits*
  10. *Working at Height*

---

## 📄 License & Enterprise Notice

© 2026 **Oil India Limited — HSSE Department**. Internal enterprise software developed for SIF Precursor Identification, Risk Analytics, and Industrial Safety Management. All rights reserved.
