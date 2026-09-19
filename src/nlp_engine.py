import os
import pickle
from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

try:
    from src.sif_engine import analyze_incident
    from src.iogp_matcher import IOGPSemanticMatcher
    from src.domain_tokenizer import UpstreamDomainTokenizer
except ModuleNotFoundError:
    from sif_engine import analyze_incident
    from iogp_matcher import IOGPSemanticMatcher
    from domain_tokenizer import UpstreamDomainTokenizer

class SafetyClassifierPipeline:
    def __init__(self):
        self.vectorizer = None
        self.sif_model = None
        self.lsr_model = None
        self.lsr_matcher = IOGPSemanticMatcher()
        self.domain_tokenizer = UpstreamDomainTokenizer()
        self.is_trained = False
        self.load_or_train()

    def load_or_train(self):
        base_dir = Path(__file__).resolve().parents[1]
        vec_path = base_dir / "models" / "tfidf_vectorizer.pkl"
        sif_path = base_dir / "models" / "sif_classifier.pkl"
        lsr_path = base_dir / "models" / "lsr_classifier.pkl"

        if os.path.exists(vec_path) and os.path.exists(sif_path):
            try:
                with open(vec_path, "rb") as f:
                    self.vectorizer = pickle.load(f)
                with open(sif_path, "rb") as f:
                    self.sif_model = pickle.load(f)
                if os.path.exists(lsr_path):
                    with open(lsr_path, "rb") as f:
                        self.lsr_model = pickle.load(f)
                self.is_trained = True
                print("[SUCCESS] Loaded pre-trained Safety AI model artifacts from models/")
                return True
            except Exception as e:
                print(f"[WARN] Error loading model artifacts: {e}. Re-training model...")

        return self.train()

    def train(self, data_path="data/oil_safety_reports.csv"):
        data_path = Path(data_path)
        if not data_path.is_absolute():
            data_path = Path(__file__).resolve().parents[1] / data_path
        if not data_path.exists():
            print(f"[WARN] Data file {data_path} not found. Operating on DEKRA rule engine fallback.")
            return False

        print(f"Training Safety AI Pipeline on dataset: {data_path}...")
        df = pd.read_csv(data_path)
        
        # Apply Layer 1 normalization during training
        X_raw = df['description'].fillna("")
        X = [self.domain_tokenizer.normalize(text)[0] for text in X_raw]
        y_sif = df['sif_potential']

        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=4000, sublinear_tf=True, stop_words='english')
        self.sif_model = LogisticRegression(C=2.0, class_weight='balanced', random_state=42)

        X_vec = self.vectorizer.fit_transform(X)
        self.sif_model.fit(X_vec, y_sif)
        
        self.is_trained = True
        print("[SUCCESS] Model trained successfully.")
        return True

    def detect_language(self, text: str):
        if not text:
            return {"language": "en", "language_label": "English (Standard Domain)", "normalized_text": text}

        # Check for Devanagari Unicode script (U+0900 to U+097F)
        has_devanagari = any('\u0900' <= char <= '\u097f' for char in text)

        # Common Hinglish safety terms mapping to standard domain English
        hinglish_map = {
            "suraksha": "safety",
            "khatra": "hazard / risk",
            "paip": "pipe / line",
            "pankha": "fan / ventilation",
            "aag": "fire",
            "hawa": "gas / air",
            "gadi": "vehicle",
            "chhat": "height / derrick platform",
            "bina": "without",
            "belt": "harness / belt",
            "pehna": "wearing",
            "kapa": "severed / cut",
            "tel": "oil / hydrocarbon",
            "loto": "lockout tagout",
            "dhyan": "attention / observation"
        }

        text_lower = text.lower()
        has_hinglish = any(word in text_lower for word in hinglish_map.keys())

        if has_devanagari or has_hinglish:
            lang_code = "hi" if has_devanagari else "mixed"
            lang_label = "Hindi / Hinglish Detected — Auto-Normalized"
        else:
            lang_code = "en"
            lang_label = "English (Standard Domain)"

        return {
            "language": lang_code,
            "language_label": lang_label
        }

    def predict(self, text: str):
        if not text:
            return {"error": "Empty text"}

        # 0. Language Detection
        lang_info = self.detect_language(text)

        # 1. Layer 1 Domain Normalization & DEKRA Physics Audit
        dekra_result = analyze_incident(text)
        normalized_text = dekra_result.get("normalized_text", text)

        # 2. ML Probability Score (using normalized text)
        if self.is_trained and self.vectorizer and self.sif_model:
            vec = self.vectorizer.transform([normalized_text])
            ml_prob = float(self.sif_model.predict_proba(vec)[0][1])
        else:
            ml_prob = 0.88 if dekra_result["is_sif_potential"] else 0.12

        # 3. Hybrid Consensus Logic
        # Suppress ML if contextual zero energy verification confirmed
        if dekra_result.get("has_zero_energy_verification", False) and not dekra_result["is_sif_potential"]:
            final_is_sif = False
            severity_score = 0.12
        else:
            final_is_sif = dekra_result["is_sif_potential"] or (ml_prob >= 0.48)
            severity_score = round(max(ml_prob, 0.94 if dekra_result["is_sif_potential"] else 0.18), 2)

        # 4. IOGP LSR Tagging
        if dekra_result["primary_iogp_rule"] != "None / General Safety":
            primary_rule = dekra_result["primary_iogp_rule"]
            lsr_conf = 0.96
        else:
            primary_rule, lsr_conf = self.lsr_matcher.classify_iogp_rule(normalized_text)

        lsr_model_rule = "UNAVAILABLE"
        lsr_model_confidence = 0.0
        if self.is_trained and self.vectorizer and self.lsr_model:
            lsr_vector = self.vectorizer.transform([normalized_text])
            lsr_model_rule = str(self.lsr_model.predict(lsr_vector)[0])
            if hasattr(self.lsr_model, "predict_proba"):
                lsr_model_confidence = float(self.lsr_model.predict_proba(lsr_vector)[0].max())

        # 5. Generate OISD Barrier Action Plan & Hierarchy of Controls
        action_plan, corrective_actions = self._generate_oisd_action_plan(primary_rule, dekra_result["barrier_condition"], final_is_sif)
        explainability = self._build_explainability(
            text,
            dekra_result,
            primary_rule,
            severity_score,
            ml_prob,
            final_is_sif,
        )

        return {
            "text": text,
            "normalized_text": normalized_text,
            "language": lang_info["language"],
            "language_label": lang_info["language_label"],
            "entities_extracted": dekra_result.get("entities_extracted", {"acronyms": [], "assets": []}),
            "sif_potential": 1 if final_is_sif else 0,
            "classification_label": "SIF_POTENTIAL" if final_is_sif else ("DEFENDED_NEAR_MISS" if dekra_result["classification"] == "DEFENDED_NEAR_MISS" else "NON_SIF_OBSERVATION"),
            "sif_confidence": severity_score,
            "dekra_verdict": dekra_result["classification"],
            "energy_sources": dekra_result["detected_energy_sources"],
            "barrier_condition": dekra_result["barrier_condition"],
            "has_zero_energy_verification": dekra_result.get("has_zero_energy_verification", False),
            "iogp_life_saving_rule": primary_rule,
            "lsr_confidence": round(lsr_conf, 2),
            "lsr_model_rule": lsr_model_rule,
            "lsr_model_confidence": round(lsr_model_confidence, 2),
            "lsr_model_agreement": lsr_model_rule == primary_rule if lsr_model_rule != "UNAVAILABLE" else None,
            "audit_rationale": dekra_result["audit_rationale"],
            "oisd_action_plan": action_plan,
            "corrective_actions": corrective_actions,
            **explainability,
        }

    def _build_explainability(self, text, dekra_result, primary_rule, severity_score, ml_prob, is_sif):
        energy_sources = dekra_result.get("detected_energy_sources", [])
        barrier_condition = dekra_result.get("barrier_condition", "UNKNOWN_OR_NOT_MENTIONED")
        normalized_text = dekra_result.get("normalized_text", text)
        lower_text = normalized_text.lower()

        evidence = []
        evidence_patterns = [
            ("High-energy source", energy_sources),
            ("Barrier failure language", barrier_condition == "FAILED_OR_ABSENT"),
            ("Zero-energy verification", dekra_result.get("has_zero_energy_verification", False)),
        ]
        for label, matched in evidence_patterns:
            if matched:
                evidence.append({"factor": label, "matched": True})

        trigger_terms = [
            "without", "missing", "failed", "unsecured", "unisolated", "bypassed",
            "no gas testing", "no attendant", "without lanyard", "without loto",
        ]
        matched_triggers = [term for term in trigger_terms if term in lower_text]
        consequences = {
            "Confined Space": "Toxic exposure, oxygen deficiency, or asphyxiation",
            "Energy Isolation": "Unexpected electrical, mechanical, or stored-energy release",
            "Line of Fire": "Struck-by, caught-between, hose-whip, or pressure-release injury",
            "Hot Work": "Fire, explosion, or toxic combustion exposure",
            "Work at Height": "Fall from elevation or dropped-object injury",
            "Safe Mechanical Lifting": "Crush injury or suspended-load strike",
        }
        if is_sif:
            consequence = consequences.get(primary_rule, "Serious injury or fatality from uncontrolled hazard exposure")
        else:
            consequence = "No immediate fatal-potential consequence identified"

        if severity_score >= 0.80:
            confidence_band = "HIGH"
        elif severity_score >= 0.55:
            confidence_band = "MEDIUM"
        else:
            confidence_band = "LOW"

        risk_factors = [
            {"name": "ML SIF probability", "value": round(ml_prob, 3)},
            {"name": "Energy pathway", "value": "present" if energy_sources else "not detected"},
            {"name": "Barrier state", "value": barrier_condition},
            {"name": "Life-Saving Rule", "value": primary_rule},
        ]
        return {
            "confidence_band": confidence_band,
            "evidence_items": evidence,
            "trigger_terms": matched_triggers,
            "potential_consequence": consequence,
            "risk_factors": risk_factors,
            "human_review_required": confidence_band == "LOW" or (0.40 <= severity_score <= 0.65),
        }

    def _generate_oisd_action_plan(self, rule: str, barrier_state: str, is_sif: bool):
        hierarchy_plans = {
            "Work at Height": [
                {"level": "Elimination", "action": "Eliminate elevated manual work by utilizing ground-level remote telemetry and hydraulic positioning systems."},
                {"level": "Engineering Controls", "action": "Install certified wire rope retractable inertia reel lifelines and engineered perimeter safety nets per OISD-STD-105."},
                {"level": "Administrative Controls", "action": "Issue Stop Work Authority (SWA), mandate 100% dual lanyard tie-off verification, and inspect scaffolding base plates."},
                {"level": "PPE", "action": "Equip personnel with EN 361 certified full-body harness with shock-absorbing lanyard."}
            ],
            "Energy Isolation": [
                {"level": "Elimination", "action": "Depressurize lines and drain all stored hydrostatic energy prior to initiating maintenance."},
                {"level": "Engineering Controls", "action": "Apply Lockout/Tagout (LOTO) double-block and bleed mechanical isolation per OISD-STD-137."},
                {"level": "Administrative Controls", "action": "Conduct mandatory 4-eye zero-energy pressure bleed verification audit and log LOTO permit."},
                {"level": "PPE", "action": "Require dielectric gloves, arc flash face shield, and chemical splash apron during line breaking."}
            ],
            "Line of Fire": [
                {"level": "Elimination", "action": "Relocate non-essential personnel outside the 15-meter swing and drop radius."},
                {"level": "Engineering Controls", "action": "Install certified heavy-duty steel whip-check cables on pressurized lines (>100 PSI) and interlocked rotating shaft guards."},
                {"level": "Administrative Controls", "action": "Demarcate high-energy line-of-fire exclusion zone with physical barricades and warning tags."},
                {"level": "PPE", "action": "Mandate high-impact safety glasses, steel-toed metacarpal safety boots, and hard hats."}
            ],
            "Confined Space": [
                {"level": "Elimination", "action": "Perform external automated tank washing or remote camera inspection to avoid internal entry."},
                {"level": "Engineering Controls", "action": "Deploy continuous forced-air mechanical ventilation and calibrated multi-gas detection monitors."},
                {"level": "Administrative Controls", "action": "Conduct pre-entry H2S/LEL testing, issue Confined Space Entry PTW, and station trained standby attendant."},
                {"level": "PPE", "action": "Equip entry personnel with Positive Pressure Self-Contained Breathing Apparatus (SCBA)."}
            ],
            "Hot Work": [
                {"level": "Elimination", "action": "Substitute spark-producing hot cutting/welding with cold mechanical pipe cutting tools."},
                {"level": "Engineering Controls", "action": "Erect fire-resistant pressurized habitat blankets and 360-degree continuous LEL gas monitors."},
                {"level": "Administrative Controls", "action": "Conduct pre-job gas monitoring, issue Hot Work PTW per OISD-STD-105, and maintain 60-min post-job fire watch."},
                {"level": "PPE", "action": "Require flame-retardant coveralls, leather welding apron, and auto-darkening welding helmet."}
            ],
            "Safe Mechanical Lifting": [
                {"level": "Elimination", "action": "Avoid manual rigging adjustments directly under suspended crane loads."},
                {"level": "Engineering Controls", "action": "Verify crane anti-two-block limit switches, outrigger hydraulic locks, and load chart limiters."},
                {"level": "Administrative Controls", "action": "Inspect wire rope sling strands, verify rigger certification, and conduct lifting plan JSA review."},
                {"level": "PPE", "action": "Mandate high-vis reflective vests, heavy-duty leather rigging gloves, and steel-toed safety boots."}
            ],
            "Bypassing Safety Controls": [
                {"level": "Elimination", "action": "Discontinue manual override practices by redesigning process control interlocks."},
                {"level": "Engineering Controls", "action": "Remove unauthorized electrical jumpers and restore ESD automatic trip logic."},
                {"level": "Administrative Controls", "action": "Enforce Management of Change (MOC) authorization protocol for temporary safety system bypasses."},
                {"level": "PPE", "action": "Require standard safety boots, flame-resistant clothing, and safety glasses."}
            ]
        }

        default_actions = [
            {"level": "Engineering Controls", "action": "Inspect and repair local physical defect or housekeeping hazard."},
            {"level": "Administrative Controls", "action": "Log observation in shift handover register and review at next toolbox meeting."},
            {"level": "PPE", "action": "Verify mandatory site PPE compliance before resuming task."}
        ]

        if is_sif:
            actions = hierarchy_plans.get(rule, [
                {"level": "Elimination", "action": "Halt unsafe task immediately via Stop Work Authority (SWA)."},
                {"level": "Engineering Controls", "action": "Isolate high-energy hazard area using physical barricades."},
                {"level": "Administrative Controls", "action": "Conduct mandatory Job Safety Analysis (JSA) review per OISD standards."},
                {"level": "PPE", "action": "Ensure task-specific mandatory protective gear is worn."}
            ])
            summary_plan = f"CRITICAL: {actions[0]['action']} {actions[1]['action']}"
        else:
            actions = default_actions
            summary_plan = "ROUTINE: Correct operational defect on site, log in shift handover register, and reinforce hazard awareness at next toolbox meeting."

        return summary_plan, actions

if __name__ == "__main__":
    pipeline = SafetyClassifierPipeline()
    test_text = "During workover operations at Baghjan, 2-inch Chiksan line surged to 2400 PSI while whip check cable was unsecured."
    res = pipeline.predict(test_text)
    import json
    print(json.dumps(res, indent=2))
