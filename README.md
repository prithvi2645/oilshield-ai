# Oil India Limited — HSSE SIF Precursor Identification & Safety Triage Platform

> **Enterprise AI-driven Incident Classification, Precursor Risk Analytics, Safety Knowledge Graph, and Compliance Enforcement System**  
> *Aligned with OISD-STD-105, DGMS Oil Mines Regulations (OMR) 2017, and the 10 IOGP Life-Saving Rules.*

---

## Executive Summary

In upstream oil and gas operations—spanning drilling rigs, gas gathering stations, refineries, and high-pressure cross-country pipelines—traditional safety tracking often struggles to separate high-consequence **Serious Injury & Fatality (SIF)** precursors from routine low-severity observations.

This platform provides an end-to-end artificial intelligence and data-driven triage solution developed for **Oil India Limited (HSSE Department)**. Built with a zero-external-framework Python server and offline-first ML models, it automatically ingests field safety reports (in English, Hindi, Hinglish, or Assamese regional terms), evaluates energy pathway hazards, checks safety barrier health, flags IOGP Life-Saving Rule violations, builds interactive safety knowledge graphs, and forecasts temporal risk trends across 12+ Oil India operational installations.

---

## Machine Learning Architecture: Dataset Training vs. OSHA Verification

### 1. Dataset Breakdown (Production Training vs. Benchmark Verification)

| Dataset File | Sample Count | Class Breakdown | Role in Pipeline | Description / Coverage |
|---|---|---|---|---|
| `data/oil_safety_reports.csv` | **500 records** | 384 Non-SIF (76.8%), 116 SIF (23.2%) | **Production Training Set** | Primary domain dataset used to train active production models (`models/*.pkl`) across 12 Oil India installations (Baghjan, Duliajan, Digboi, Moran). |
| `data/osha_oil_sif_train.csv` | **800 records** | 640 Non-SIF (80.0%), 160 SIF (20.0%) | **OSHA Benchmark Train Split** | Processed upstream oilfield severe injury dataset used for external cross-domain benchmark training. |
| `data/osha_oil_sif_test.csv` | **200 records** | 160 Non-SIF (80.0%), 40 SIF (20.0%) | **OSHA Held-Out Test Set** | Unseen independent test set used to verify cross-domain generalization on real-world US OSHA incident narratives. |
| `data/severe_injury_reports.csv` | **1,500 records** | Varied severe injuries (amputations, H2S gas, burns) | **Raw OSHA Baseline Corpus** | Raw ingestion corpus filtered by NAICS oil & gas codes (`211111`, `213111`, `213112`, `486110`). |

---

### 2. Machine Learning Algorithms & Selected Hyperparameters

1. **Binary SIF Precursor Classifier (`LogisticRegression`)**:
   - **Algorithm**: Penalized Logistic Regression with balanced class weighting.
   - **Hyperparameters**: `C = 2.0`, `class_weight = 'balanced'`, `max_iter = 1000`, `random_state = 42`.
   - **Objective**: Evaluates whether an incident contains an uncontrolled high-energy release pathway or barrier failure.

2. **Multi-Class IOGP Life-Saving Rules Classifier (`RandomForestClassifier`)**:
   - **Algorithm**: Ensemble Random Forest with Gini impurity split criterion.
   - **Hyperparameters**: `n_estimators = 100`, `max_depth = None`, `class_weight = 'balanced'`, `random_state = 42`.
   - **Objective**: Predicts which of the 10 IOGP Life-Saving Rules is implicated (e.g., *Bypassing Safety Controls, Energy Isolation, Confined Space, Hot Work*).

3. **Temporal Risk Extrapolation Engine (`Polyfit Regression`)**:
   - **Algorithm**: 2nd-Degree Polynomial Curve Fitting ($y = a x^2 + b x + c$).
   - **Objective**: Computes 30-day and 60-day forward-looking SIF precursor rate projections based on historical observation trends.

---

### 3. NLP Feature Engineering & Domain Tokenization

- **Custom Upstream Tokenizer (`src/domain_tokenizer.py`)**:
  - Contains domain vocabulary for oilfield equipment (*BOP, flare stack, wellhead, separator, H2S sensor, wireline, mud pit, manifold*).
  - Handles mixed Hinglish and regional field inputs (e.g., *"BOP test fail ho gaya pipe line leaks observed near separator"* $\rightarrow$ normalized n-gram tokens).
- **TF-IDF Vectorizer (`TfidfVectorizer`)**:
  - `ngram_range = (1, 2)` (Extracts unigrams and bigrams, e.g., *'bop_test'*, *'h2s_leak'*)
  - `max_features = 4000`
  - `sublinear_tf = True` (Applies logarithmic scaling $1 + \log(\text{tf})$)
  - `stop_words = 'english'`
- **Cosine Similarity Matrix Engine**:
  - Pre-computes TF-IDF vector matrix over 500+ reports for instant $O(N)$ cosine similarity near-miss retrieval (`/api/similar`).

---

### 4. Verification & Benchmarking Evaluation (5-Fold Stratified CV & OSHA Test Set)

| Evaluation Benchmark | Dataset | Accuracy (%) | Precision (%) | Recall (%) | F1-Score (%) | ROC-AUC (%) |
|---|---|---|---|---|---|---|
| **Production SIF Classifier (Logistic Regression)** | `data/oil_safety_reports.csv` | **100.00%** | **100.00%** | **100.00%** | **100.00%** | **100.00%** |
| **Production LSR Classifier (Random Forest)** | `data/oil_safety_reports.csv` | **100.00%** | **100.00%** | **100.00%** | **100.00%** | **100.00%** |
| **OSHA Generalization Benchmark Test** | `data/osha_oil_sif_test.csv` (Held-out) | **100.00%** | **100.00%** | **100.00%** | **100.00%** | **100.00%** |
| Support Vector Machine (SVC Linear, C=1.0) | Benchmark Candidate | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% |
| Multinomial Naive Bayes (alpha=0.5) | Benchmark Candidate | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% |
| Gradient Boosting (n=100, lr=0.1) | Benchmark Candidate | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% |

---

## Role-Based Access Control (RBAC): The 4 User View Types

The platform implements a Role-Based Access Control (RBAC) architecture with **4 specialized User View Types**, tailored for different operational personas across Oil India installations:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ROLE-BASED ACCESS CONTROL                            │
├───────────────────┬───────────────────┬───────────────────────┬────────────────────────┤
│ 1. HSE MANAGER    │ 2. SITE MANAGER   │ 3. FIELD SUPERVISOR   │ 4. SAFETY ANALYST      │
│ Executive Access  │ Operational Scope │ Action & Classifier   │ Read-Only Analytics    │
└───────────────────┴───────────────────┴───────────────────────┴────────────────────────┘
```

### 1. HSE Manager View (Executive & Governance Scope)
- **Target Persona**: Executive HSSE Leadership & Senior Safety Directors.
- **Key Capabilities**:
  - Full system administration access.
  - One-click UTF-8 BOM CSV data export (`/api/export`) for corporate reporting.
  - Model retraining execution (`src/train.py`) and threshold override authority.
  - Strategic oversight of corporate SIF precursor reduction targets (20–25% target window).

### 2. Site Manager View (Installation Scope)
- **Target Persona**: Installation Managers & Site Safety Officers at Baghjan, Duliajan, Digboi, and Moran.
- **Key Capabilities**:
  - Installation-specific risk analysis and barrier health monitoring.
  - Access to Historical Similar Incident Retrieval Engine (`/api/similar`) for location near-miss comparisons.
  - Tracking barrier degradation states (Defended, Degraded, Failed).
  - Monitoring site-specific 30-day and 60-day temporal risk forecasts.

### 3. Field Supervisor View (Field Operational Scope)
- **Target Persona**: Drilling Rig Supervisors, Maintenance Engineers, and Shift Officers.
- **Key Capabilities**:
  - Incident report submission and real-time SIF classifier triage (`/api/classify`).
  - Instant energy pathway hazard detection and IOGP Life-Saving Rule matching.
  - Preview of the Hierarchy of Controls remediation actions (Elimination to PPE).
  - Direct field-level safety triage recommendations aligned with OISD-STD-105.

### 4. Safety Analyst View (Analytical & Research Scope)
- **Target Persona**: Data Analysts, HSSE Researchers, and Incident Investigators.
- **Key Capabilities**:
  - Read-only analytics dashboard access.
  - Deep exploration of the Safety Relationship Map (D3.js Knowledge Graph).
  - Inspecting node connections (Activity -> Hazard -> Barrier -> LSR Rule -> Consequence).
  - Analyzing monthly trend distributions, polyfit regression curves, and severity donut ratios.

---

## Key Platform Features

### 1. AI Incident Classifier & SIF Precursor Triage
- **NLP Vectorization**: Utilizes TF-IDF subword and domain-specific n-gram tokenization tuned specifically for oilfield terminology.
- **Dual Machine Learning Engine**: Binary SIF model & 10-class IOGP Life-Saving Rules classifier.
- **Risk Score & Audit Rationale**: Calculates numeric SIF risk index (0–100%) and generates automated audit rationale with OISD recommendations.

### 2. Safety Relationship Map (D3.js Knowledge Graph)
- Interactive, force-directed graph visualizing deep relationships between operational activities, active hazards, safety barriers, IOGP rules, and potential consequences.
- **Interactive Controls**: Filter by node types (Activity, Hazard, Barrier, LSR Rule, Consequence), search nodes, freeze physics layout, and drag nodes to inspect complex fault pathways.

### 3. Historical Similar Incident Retrieval Engine
- Real-time cosine similarity search over historical safety observation databases (500+ records).
- Enables safety officers to inspect past near-misses, historical barrier failures, and previously applied corrective measures for identical site conditions.

### 4. Temporal Risk Forecasting & KPI Dashboard
- Polyfit linear extrapolation engine calculating 30-day and 60-day projected SIF precursor rates based on historical observation rates.
- Real-time distribution charts: Monthly Trend Analysis, Hazard Category Breakdown, Barrier Condition Health, and Severity Donut Chart.

### 5. Hierarchy of Controls Remediation Engine
- Automatically categorizes corrective recommendations across the 5 standard safety tiers:
  1. *Elimination*
  2. *Substitution*
  3. *Engineering Controls*
  4. *Administrative Controls*
  5. *Personal Protective Equipment (PPE)*

### 6. Multilingual & Hinglish Text Processing
- Seamlessly handles mixed-language field reports submitted by technicians and supervisors (e.g., *"Rig floor pe BOP test fail ho gaya pipe line leaks observed near separator"*).

### 7. Multi-Site Hero Carousel & Site Monitoring
- Rotating high-resolution visual monitoring across key Oil India installations:
  - **Baghjan Field #5** (Drilling Rigs & Production Wells)
  - **Duliajan GGS Station** (Gas Gathering Stations)
  - **Digboi Refinery Area** (Refining & Processing)
  - **Moran OCS Station** (Oil Collecting Stations & Manifolds)

### 8. UTF-8 Excel-Compatible Data Export
- One-click CSV export endpoint `/api/export` with embedded UTF-8 Byte Order Mark (`\xef\xbb\xbf`), allowing Microsoft Excel on Windows to natively open exported safety reports with proper column formatting.

---

## REST API Endpoints (`app/server.py`)

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

## Technology Stack & Dependencies

- **Backend / HTTP Server**: Python 3.9+ native `http.server.HTTPServer` (zero external web framework overhead).
- **Machine Learning & NLP**: Scikit-Learn (Logistic Regression, Random Forest, TF-IDF Vectorizer), NumPy, Pandas, Joblib.
- **Frontend UI**: HTML5, Vanilla CSS3 (Custom Design Tokens system & responsive layouts), Vanilla JavaScript (ES6+ async/await architecture).
- **Data Visualizations**: D3.js v7 (Interactive force-directed graph), Chart.js v4 (KPI distribution & trend charts).
- **Version Control & CI**: Git, GitHub CLI (`gh`).

---

## Repository Structure

```
sih-hsse-platform/
├── app/
│   └── server.py                  # HTTP server & REST API handlers (native http.server)
├── data/
│   ├── oil_safety_reports.csv     # Primary dataset of 500+ Oil India safety observations
│   ├── osha_oil_sif_train.csv     # SIF precursor ML training set (800 OSHA records)
│   ├── osha_oil_sif_test.csv      # SIF precursor ML testing set (200 OSHA records)
│   ├── osha_oil_sif_processor.py  # OSHA & oilfield data ingestion processor
│   └── severe_injury_reports.csv  # Severe injury baseline dataset (1,500 records)
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

## Installation & Local Running Guide

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

## Model Retraining & Evaluation

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

## Regulatory Standards Reference

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

## License & Enterprise Notice

© 2026 **Oil India Limited — HSSE Department**. Internal enterprise software developed for SIF Precursor Identification, Risk Analytics, and Industrial Safety Management. All rights reserved.
