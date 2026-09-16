import os
import re
import pickle
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
        vec_path = os.path.join("models", "tfidf_vectorizer.pkl")
        sif_path = os.path.join("models", "sif_classifier.pkl")
        lsr_path = os.path.join("models", "lsr_classifier.pkl")

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
        if not os.path.exists(data_path):
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

    def anonymize_text(self, text: str) -> str:
        """
        PII Privacy & Security Layer: Sanitizes personal identifiable information.
        """
        if not text:
            return text

        # Mask phone numbers
        text = re.sub(r"\b(?:\+91[\s-]?)?[6-9]\d{9}\b", "[ANONYMIZED_PHONE]", text)
        # Mask employee IDs (e.g. EMP-1049, OIL-EMP-849)
        text = re.sub(r"\b(?:EMP|OIL-EMP|ID)[-_\s]?\d{3,6}\b", "[ANONYMIZED_EMP_ID]", text, flags=re.IGNORECASE)
        # Mask email addresses
        text = re.sub(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "[ANONYMIZED_EMAIL]", text)
        # Mask common personal name patterns (e.g. Mr. Sharma, Technician Rahul)
        text = re.sub(r"\b(?:Mr\.|Mrs\.|Ms\.|Shri|Worker|Technician)\s+[A-Z][a-z]+\b", "[ANONYMIZED_PERSONNEL]", text)

        return text

    def enhance_report_narrative(self, text: str) -> Dict[str, str]:
        """
        Poorly Written Report Intelligence Enhancer: Converts vague field notes into structured HSE reports.
        """
        if not text or len(text.strip()) < 5:
            return {"original": text, "enhanced": text, "is_enhanced": False}

        raw = text.strip()
        raw_lower = raw.lower()

        patterns = [
            (r"slip|tripped|canteen|fall|sprain|ankle", 
             "Unsafe Condition & Operational Hazard: Slip hazard identified on walkway due to surface fluid/oil accumulation near facility. Immediate housekeeping dispatched to clean spill, apply absorbent material, and secure walkway."),
            (r"chiksan|pressure|surge|2400|2,400|psi",
             "Critical SIF Precursor / Line of Fire: High-pressure process line surge observed during workover operations. Immediate verification of line integrity, pressure relief valve calibration, and whip-check restraint installation required."),
            (r"derrick|height|lanyard|mast|monkey board|elevation",
             "Unsafe Act / Work at Height Defect: Personnel observed working at elevated derrick platform without 100% dual lanyard fall arrest tie-off. Stop Work Authority (SWA) executed until safety harness is secured."),
            (r"hose|burst|hydraulic|whip-check|whipping",
             "Defended Near Miss: High-pressure hydraulic line rupture occurred. Engineering control (whip-check safety cable) successfully contained line whipping, preventing injury."),
            (r"bulb\s*bad|light\s*fused|bulb\s*fused|no\s*light", 
             "Unsafe Condition: Auxiliary light fixture fused. Maintenance required to replace bulb and inspect wiring to ensure adequate night visibility."),
            (r"pipe\s*leak|leak\s*in\s*pipe|oil\s*drip|fluid\s*leak", 
             "Unsafe Condition: Hydrocarbon / process line leak observed. Line pressure needs to be verified, LOTO applied, and flange gasket replaced immediately."),
            (r"wire\s*touched|open\s*wire|scuffed\s*wire|cable\s*bare", 
             "Unsafe Condition: Exposed electrical wiring identified on site without rubber insulation protection. Electrical team dispatched to de-energize and re-insulate lead."),
            (r"no\s*belt|harness\s*missing|working\s*top", 
             "Unsafe Act: Personnel observed working at elevated height without EN 361 fall protection safety harness. Stop Work Authority (SWA) executed."),
            (r"no\s*loto|tag\s*missing|valve\s*open", 
             "Unsafe Act / Procedural Defect: Process isolation initiated without Lockout/Tagout (LOTO) tags or double-block-and-bleed verification.")
        ]

        enhanced = None
        for pattern, replacement in patterns:
            if re.search(pattern, raw_lower):
                enhanced = f"Standardized Technical Observation: {replacement} Original Field Context: '{raw}'."
                break

        if not enhanced:
            enhanced = f"Structured Field Safety Report: {raw.strip()}. Rig Safety Verification: Field team conducted energy source audit, barrier condition check, and logged task mitigation per OISD-STD-105."

        return {
            "original": raw,
            "enhanced": enhanced,
            "is_enhanced": True
        }

    def detect_and_translate_multilingual(self, text: str):
        if not text:
            return {"language": "en", "translated_text": text}

        # Regional Language Lexicon (Assamese, Hindi, Bengali, Kannada)
        assamese_terms = ["duliajan", "digboi", "moran", "baghjan", "bojo", "aag", "saap", "haat", "tel", "ghor"]
        kannada_terms = ["niru", "beeli", "kaaya", "bina", "kelasa", "gadi"]
        hindi_terms = ["khatra", "suraksha", "paip", "pankha", "aag", "hawa", "gadi", "bina", "pehna", "loto"]

        text_lower = text.lower()
        is_assamese = any(w in text_lower for w in assamese_terms)
        is_kannada = any(w in text_lower for w in kannada_terms)
        is_hindi = any(w in text_lower for w in hindi_terms)

        if is_assamese:
            lang = "as"
            lang_label = "Assamese (OIL Assam Operations)"
        elif is_kannada:
            lang = "kn"
            lang_label = "Kannada (KG Basin / Southern Asset)"
        elif is_hindi:
            lang = "hi"
            lang_label = "Hindi / Hinglish"
        else:
            lang = "en"
            lang_label = "English (Standard)"

        # Normalize Hinglish/Regional terms into English
        normalized, _ = self.domain_tokenizer.normalize(text)

        return {
            "language": lang,
            "language_label": lang_label,
            "translated_text": normalized
        }

    def predict(self, text: str):
        if not text:
            return {"error": "Empty text"}

        # 0. PII Sanitization
        clean_text = self.anonymize_text(text)

        # 0B. Multilingual & Narrative Enhancer
        multi_info = self.detect_and_translate_multilingual(clean_text)
        enhancer_info = self.enhance_report_narrative(clean_text)

        processed_text = enhancer_info["enhanced"]

        # 1. Layer 1 Domain Normalization & DEKRA Physics Audit
        dekra_result = analyze_incident(processed_text)
        normalized_text = dekra_result.get("normalized_text", processed_text)

        # 2. ML Probability Score
        if self.is_trained and self.vectorizer and self.sif_model:
            vec = self.vectorizer.transform([normalized_text])
            ml_prob = float(self.sif_model.predict_proba(vec)[0][1])
        else:
            ml_prob = 0.88 if dekra_result["is_sif_potential"] else 0.12

        # 3. Hybrid Consensus Logic
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

        # 5. Confidence + Human-in-the-Loop (HITL) Calculation
        confidence_score = round(max(lsr_conf * 100, severity_score * 100), 1)
        requires_hitl = confidence_score < 75.0 or (dekra_result["barrier_condition"] == "UNKNOWN")
        hitl_reason = "Model confidence below 75% threshold. Senior HSE Officer verification recommended." if requires_hitl else "Model prediction high confidence."

        # 6. Generate OISD Barrier Action Plan & Hierarchy of Controls
        action_plan, corrective_actions = self._generate_oisd_action_plan(primary_rule, dekra_result["barrier_condition"], final_is_sif)

        # Hazard causation chain
        hazard_chain = {
            "hazard_identified": ", ".join(dekra_result["detected_energy_sources"]) if dekra_result["detected_energy_sources"] else "Operational Hazard",
            "lsr_breached": primary_rule,
            "barrier_failure_mode": dekra_result["barrier_condition"],
            "sif_verdict": "SIF Potential" if final_is_sif else "Non-SIF Observation"
        }

        return {
            "text": clean_text,
            "enhanced_text": processed_text,
            "is_narrative_enhanced": enhancer_info["is_enhanced"],
            "normalized_text": normalized_text,
            "language": multi_info["language"],
            "language_label": multi_info["language_label"],
            "entities_extracted": dekra_result.get("entities_extracted", {"acronyms": [], "assets": []}),
            "sif_potential": 1 if final_is_sif else 0,
            "classification_label": "SIF_POTENTIAL" if final_is_sif else ("DEFENDED_NEAR_MISS" if dekra_result["classification"] == "DEFENDED_NEAR_MISS" else "NON_SIF_OBSERVATION"),
            "sif_confidence": severity_score,
            "confidence_pct": confidence_score,
            "requires_hitl_review": requires_hitl,
            "hitl_reason": hitl_reason,
            "dekra_verdict": dekra_result["classification"],
            "energy_sources": dekra_result["detected_energy_sources"],
            "barrier_condition": dekra_result["barrier_condition"],
            "has_zero_energy_verification": dekra_result.get("has_zero_energy_verification", False),
            "iogp_life_saving_rule": primary_rule,
            "lsr_confidence": round(lsr_conf, 2),
            "hazard_causation_chain": hazard_chain,
            "audit_rationale": dekra_result["audit_rationale"],
            "oisd_action_plan": action_plan,
            "corrective_actions": corrective_actions
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
