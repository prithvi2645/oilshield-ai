 Oil India Limited — HSSE SIF Precursor Identification & Safety Triage Platform

> **Enterprise AI-driven Incident Classification, Precursor Risk Analytics, Safety Knowledge Graph, and Compliance Enforcement System**  
> *Aligned with OISD-STD-105, DGMS Oil Mines Regulations (OMR) 2017, and the 10 IOGP Life-Saving Rules.*

---

 Executive Summary

In upstream oil and gas operations—spanning drilling rigs, gas gathering stations, refineries, and high-pressure cross-country pipelines—traditional safety tracking often struggles to separate high-consequence **Serious Injury & Fatality (SIF)** precursors from routine low-severity observations.

This platform provides an end-to-end artificial intelligence and data-driven triage solution developed for **Oil India Limited (HSSE Department)**. It automatically ingests field safety reports (in English, Hindi, Hinglish, or Assamese regional terms), evaluates energy pathway hazards, checks safety barrier health, flags IOGP Life-Saving Rule violations, builds interactive safety knowledge graphs, and forecasts temporal risk trends across 12+ Oil India operational installations.

---

 Key Platform Features

### 1.  AI Incident Classifier & SIF Precursor Triage
- **NLP Vectorization**: Utilizes TF-IDF subword and domain-specific n-gram tokenization tuned specifically for oilfield terminology (e.g., *BOP, flare stack, wellhead pressure, H2S sensor, hot work, wireline*).
- **Dual Machine Learning Engine**:
  - **SIF Precursor Detector**: Identifies uncontrolled high-energy release pathways and barrier breaches.
  - **IOGP Life-Saving Rule Classifier**: Predicts the exact implicated Life-Saving Rule out of the 10 core IOGP rules.
- **Risk Score & Audit Rationale**: Calculates a numeric SIF risk index (0–100%) and generates an automated audit rationale with OISD action recommendations.

### 2.  Safety Relationship Map (D3.js Knowledge Graph)
- Interactive, force-directed graph visualizing deep relationships between operational activities, active hazards, safety barriers, IOGP rules, and potential consequences.
- **Interactive Controls**: Filter by node types (Activity, Hazard, Barrier, LSR Rule, Consequence), search nodes, freeze physics layout, and drag nodes to inspect complex fault pathways.

### 3.  Historical Similar Incident Retrieval Engine
- Real-time cosine similarity search over historical safety observation databases (500+ records).
- Enables safety officers to inspect past near-misses, historical barrier failures, and previously applied corrective measures for identical site conditions.

### 4.  Temporal Risk Forecasting & KPI Dashboard
- Polyfit linear extrapolation engine calculating 30-day and 60-day projected SIF precursor trends based on historical observation rates.
- Real-time distribution charts: Monthly Trend Analysis, Hazard Category Breakdown, Barrier Condition Health, and Severity Donut Chart.

### 5.  Hierarchy of Controls Remediation Engine
- Automatically categorizes corrective recommendations across the 5 standard safety tiers:
  1. **Elimination**
  2. **Substitution**
  3. **Engineering Controls**
  4. **Administrative Controls**
  5. **Personal Protective Equipment (PPE)**

### 6.  Multilingual & Hinglish Text Processing
- Seamlessly handles mixed-language field reports submitted by technicians and supervisors (e.g., *"Rig floor pe BOP test fail ho gaya pipe line leaks observed near separator"*).

### 7.  Role-Based Access Control (RBAC)
- 4 pre-configured enterprise roles:
  - **HSE Manager**: Full system access, CSV export, model retraining, and governance.
  - **Site Manager**: Site risk analysis, similar incident search, and barrier tracking.
  - **Field Supervisor**: Incident report submission and hierarchy of controls preview.
  - **Safety Analyst**: Read-only analytics, knowledge graph exploration, and trend viewing.

### 8.  Multi-Site Hero Carousel & Site Monitoring
- Rotating high-resolution visual monitoring across key Oil India installations:
  - **Baghjan Field #5** (Drilling Rigs & Production Wells)
  - **Duliajan GGS Station** (Gas Gathering Stations)
  - **Digboi Refinery Area** (Refining & Processing)
  - **Moran OCS Station** (Oil Collecting Stations & Manifolds)

---

##  Technology Stack

- **Backend**: Python 3.9+, Flask (REST API), Scikit-Learn, NumPy, Pandas, Joblib.
- **Frontend**: HTML5, Vanilla CSS3 (Custom Design System with Design Tokens & Modern Dark/Light Theme), Vanilla JavaScript (ES6+).
- **Visualization Libraries**: D3.js v7 (Force-directed Graph Topology), Chart.js v4 (Analytics & Donuts).
- **Machine Learning**: TF-IDF Vectorization, Logistic Regression, Multi-class Classification, Cosine Similarity.
- **Version Control & CI**: Git, GitHub (Private Repository), GitHub CLI (`gh`).

---

##  Repository Structure

```
sih-hsse-platform/
├── app/
│   └── server.py                  # Flask HTTP web server & REST API endpoints
├── data/
│   ├── oil_safety_reports.csv     # Synthetic & curated Oil India safety observations
│   ├── osha_oil_sif_train.csv     # Training dataset for SIF precursor classifier
│   ├── osha_oil_sif_test.csv      # Testing & validation dataset
│   └── severe_injury_reports.csv  # High-consequence severe injury baseline data
├── models/
│   ├── sif_classifier.pkl         # Trained Binary SIF Precursor Model
│   ├── lsr_classifier.pkl         # Trained Multi-class IOGP Rule Classifier
│   └── tfidf_vectorizer.pkl       # Domain-fitted TF-IDF Vectorizer
├── public/
│   ├── index.html                 # Main Enterprise Single-Page Application (SPA)
│   ├── styles.css                 # Custom CSS Design System & Responsive Layouts
│   ├── app.js                     # Frontend Application Logic, API integration & D3 Graph
│   ├── data/                      # Client-accessible static CSV datasets
│   └── images/                    # Industrial installation imagery & hero assets
├── src/
│   ├── sif_engine.py              # SIF calculation & risk scoring core logic
│   ├── nlp_engine.py              # Text pre-processing & Hinglish normalization
│   ├── domain_tokenizer.py        # Oilfield domain vocabulary & tokenization
│   ├── iogp_matcher.py            # Rule matching against 10 IOGP Life-Saving Rules
│   ├── train.py                   # Model training and serialization script
│   ├── evaluate_experiments.py    # Metric evaluation & accuracy reporting
│   └── hyperparameter_tuning.py   # Grid search & model optimization pipeline
├── .gitignore                     # Git ignore rules for Python/Web artifacts
└── README.md                      # Comprehensive project documentation
```

---

 Installation & Local Running Guide

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Python 3.9+**
- **Git**
- Modern web browser (Chrome, Edge, Firefox, Safari)

### 2. Clone the Repository
```bash
git clone https://github.com/prithvi2645/sih-hsse-platform.git
cd sih-hsse-platform
```

### 3. Install Python Dependencies
```bash
python -m pip install flask scikit-learn numpy pandas joblib
```

### 4. Launch the Application Server
Run the Flask server script:
```bash
python app/server.py
```
*(The server will initialize pre-computed analytics, load ML models from `models/`, and start serving on `http://localhost:8080`)*

### 5. Access the Web Dashboard
Open your browser and navigate to:
```
http://localhost:8080
```


---

##  Regulatory Standards Reference

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

##  License & Enterprise Notice

© 2026 **Oil India Limited — HSSE Department**. Internal enterprise software developed for SIF Precursor Identification, Risk Analytics, and Industrial Safety Management. All rights reserved.
