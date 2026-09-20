import re
from typing import Dict, Any, List

try:
    from src.domain_tokenizer import UpstreamDomainTokenizer
except ModuleNotFoundError:
    from domain_tokenizer import UpstreamDomainTokenizer

# Instantiate Layer 1 Tokenizer
domain_tokenizer = UpstreamDomainTokenizer()

# 1. High-Energy Ontology (EEI / DEKRA Heavy Industrial Thresholds & OIL India Terms)
ENERGY_RULES = {
    "GRAVITY_HEIGHT": {
        "keywords": [r"\bmast\b", r"\bderrick\b", r"\bmonkey\s*board\b", r"\bscaffold\b", r"\belevat\w+", r"\blight\s*tower\b", r"\bflare\s*stack\b", r"\bpipe\s*rack\b"],
        "threshold_regex": r"(\d+(?:\.\d+)?)\s*(?:m|meter|metre|ft|feet)",
        "high_energy_cutoff": 2.0, # 2 meters / 6 feet is standard EEI fall threshold
        "default_high_energy": True,  # Working aloft on oil rigs is inherently high-energy
        "iogp_rule": "Work at Height"
    },
    "PRESSURE": {
        "keywords": [r"\bchiksan\b", r"\bhammer\s*union\b", r"\bbop\b", r"\bwellhead\b", r"\bmanifold\b", r"\bbleed-?off\b", r"\bmud\s*pump\b", r"\bscrubber\b", r"\bseparator\b", r"\bflange\b", r"\bpig\s*launcher\b"],
        "threshold_regex": r"(\d+(?:\.\d+)?)\s*(?:psi|bar|kg/cm2)",
        "high_energy_cutoff": 100.0, # 100 PSI / 7 bar threshold
        "default_high_energy": False,
        "iogp_rule": "Line of Fire"
    },
    "SUSPENDED_LOAD": {
        "keywords": [r"\bcrane\b", r"\bhoist\b", r"\bwinch\b", r"\btubular\b", r"\bdrill\s*collar\b", r"\bcasing\b", r"\bsling\b", r"\brigging\b", r"\bblock\b", r"\bswung\b"],
        "threshold_regex": r"(\d+(?:\.\d+)?)\s*(?:ton|tonne|kg)",
        "high_energy_cutoff": 500.0, # 500 kg or 0.5 ton
        "default_high_energy": True,
        "iogp_rule": "Safe Mechanical Lifting"
    },
    "ELECTRICAL": {
        "keywords": [r"\bmcc\b", r"\bswitchgear\b", r"\btransformer\b", r"\bbusbar\b", r"\bpanel\b", r"\bsubstation\b", r"\bbreaker\b", r"\bhigh\s*voltage\b"],
        "threshold_regex": r"(\d+(?:\.\d+)?)\s*(?:v|volt|kv)",
        "high_energy_cutoff": 50.0, # 50 Volts
        "default_high_energy": False,
        "iogp_rule": "Energy Isolation"
    },
    "FLAMMABLE_TOXIC": {
        "keywords": [r"\bh2s\b", r"\bhydrocarbon\b", r"\bgas\s*leak\b", r"\blel\b", r"\bcondensate\b", r"\bcrude\s*tank\b", r"\blpg\b", r"\bflare\b", r"\bslop\s*tank\b", r"\bsour\s*gas\b"],
        "default_high_energy": True,
        "iogp_rule": "Hot Work"
    }
}

# 2. Layer 2A Contextual Negation & Zero-Energy Verification Lexicon
NEGATION_PATTERNS = [
    r"\b0\s*(?:psi|bar|v|volt|kv|lel|ppm|m|meter|ft|feet)\b",
    r"\bzero\s*(?:psi|bar|v|volt|kv|lel|ppm|pressure|voltage|energy|gas|leak)\b",
    r"\btested\s+with\s+(?:0|zero)\b",
    r"\bde-?energized\s+to\s+(?:0|zero)\b",
    r"\bmeasured\s+(?:0|zero)\b",
    r"\bno\s+(?:gas\s*leak|pressure|voltage|h2s|hydrocarbon|leak)\s*(?:found|detected|present)?\b",
    r"\bzero\s+reading\b",
    r"\bisolated\s+with\s+0\b",
    r"\bverified\s+(?:zero|0)\b"
]

# 3. Critical Barrier Status Lexicon
BARRIER_STATES = {
    "COMPROMISED_OR_ABSENT": [
        r"\bwithout\b", r"\bbypassed\b", r"\bmissing\b", r"\bfailed\b", r"\bnot\s+used\b",
        r"\bno\s+lanyard\b", r"\bno\s+ptw\b", r"\bno\s+loto\b", r"\bunsecured\b",
        r"\bmakeshift\b", r"\buncalibrated\b", r"\bdead\s+battery\b", r"\bwhipped\b",
        r"\bviolated\b", r"\bbreached\b", r"\bno\s+whip\s*check\b", r"\bunisolated\b",
        r"\bunhooked\b", r"\bopen\s+trench\b", r"\bjumpered\b", r"\bunclamped\b"
    ],
    "EFFECTIVE": [
        r"\barrested\s+by\b", r"\bcaught\s+by\s+safety\s+net\b", r"\bheld\s+by\s+whip\s*check\b",
        r"\bisolated\s+properly\b", r"\bppe\s+prevented\b", r"\bsniffer\s+alarmed\b",
        r"\bheld\s+line\b", r"\bprevented\s+whipping\b", r"\bloto\s+applied\b",
        r"\bcurtain\s+contained\b", r"\bsafety\s+latch\s+held\b"
    ]
}

def analyze_incident(text: str) -> Dict[str, Any]:
    if not text or not isinstance(text, str):
        return {
            "input_text": "",
            "normalized_text": "",
            "classification": "NON_SIF_OBSERVATION",
            "priority": "LOW",
            "is_sif_potential": False,
            "primary_iogp_rule": "None / General Safety",
            "detected_energy_sources": [],
            "barrier_condition": "UNKNOWN_OR_NOT_MENTIONED",
            "audit_rationale": "Empty text provided."
        }

    # --- Step 1: Layer 1 Domain Tokenizer & Upstream Gazetteer ---
    normalized_text, entities = domain_tokenizer.normalize(text)
    text_lower = normalized_text.lower()
    
    # Check for Layer 2A Contextual Negation / Zero Energy Verification
    has_zero_energy_verification = any(re.search(pat, text_lower) for pat in NEGATION_PATTERNS)

    detected_energies = []
    matched_rules = set()
    
    # --- Step 2: Detect Energy Sources & Severity ---
    for energy_cat, rules in ENERGY_RULES.items():
        energy_flag = False
        
        # Check keyword presence
        for kw in rules["keywords"]:
            if re.search(kw, text_lower):
                energy_flag = True
                break
        
        # Quantify magnitude if numeric threshold exists
        if "threshold_regex" in rules:
            match = re.search(rules["threshold_regex"], text_lower)
            if match:
                value = float(match.group(1))
                cutoff = rules.get("high_energy_cutoff", 0.0)
                # Check for kV vs V
                if "kv" in match.group(0).lower() and energy_cat == "ELECTRICAL":
                    value *= 1000.0
                
                # If magnitude is below cutoff (or 0), suppress high energy flag for this metric
                if value < cutoff:
                    energy_flag = False
                else:
                    energy_flag = True
        elif rules.get("default_high_energy", False):
            # Check if this default high energy source was negated (e.g. "no gas leak found", "0 H2S")
            if has_zero_energy_verification and energy_cat in ["FLAMMABLE_TOXIC", "PRESSURE"]:
                energy_flag = False
        
        if energy_flag:
            detected_energies.append(energy_cat)
            matched_rules.add(rules["iogp_rule"])

    # --- Step 3: Detect Critical Barrier State ---
    barrier_status = "UNKNOWN_OR_NOT_MENTIONED"
    for comp_pattern in BARRIER_STATES["COMPROMISED_OR_ABSENT"]:
        if re.search(comp_pattern, text_lower):
            barrier_status = "FAILED_OR_ABSENT"
            break
            
    if barrier_status != "FAILED_OR_ABSENT":
        for eff_pattern in BARRIER_STATES["EFFECTIVE"]:
            if re.search(eff_pattern, text_lower):
                barrier_status = "FUNCTIONING_EFFECTIVE"
                break

    # --- Step 4: EEI / DEKRA Truth Table Decision Logic ---
    is_high_energy = len(detected_energies) > 0
    
    if is_high_energy and barrier_status == "FAILED_OR_ABSENT":
        classification = "SIF_POTENTIAL"
        priority = "CRITICAL"
        explanation = f"High-energy source ({', '.join(detected_energies)}) detected with compromised/absent barrier controls."
    elif is_high_energy and barrier_status == "FUNCTIONING_EFFECTIVE":
        classification = "DEFENDED_NEAR_MISS"
        priority = "MODERATE"
        explanation = f"High-energy source ({', '.join(detected_energies)}) present, but protective barrier successfully contained the energy."
    elif is_high_energy:
        classification = "SIF_POTENTIAL"
        priority = "HIGH"
        explanation = f"High-energy source ({', '.join(detected_energies)}) detected. Barrier integrity unconfirmed on site."
    elif has_zero_energy_verification:
        classification = "NON_SIF_OBSERVATION"
        priority = "LOW"
        explanation = "Contextual analysis confirmed zero-energy state or verified de-energization (safe procedure)."
    else:
        classification = "NON_SIF_OBSERVATION"
        priority = "LOW"
        explanation = "Absence of fatal-energy mechanisms or standard low-severity operational observation."

    if re.search(r"\b(?:loto|lockout[\s-]*tagout|lock\s*out\s*/?\s*tag\s*out)\b", text_lower):
        primary_rule = "Energy Isolation"
    elif matched_rules:
        primary_rule = list(matched_rules)[0]
    else:
        primary_rule = "General Safety"

    is_sif_bool = classification in ["SIF_POTENTIAL"]
    sev_estimate = 0.85 if is_sif_bool else (0.45 if priority == "MODERATE" else 0.20)
    risk_info = compute_report_risk_score(is_sif_bool, sev_estimate, is_high_energy)
    hierarchy = get_hierarchy_of_controls(primary_rule, barrier_status, text)

    return {
        "input_text": text,
        "normalized_text": normalized_text,
        "entities_extracted": entities,
        "classification": classification,
        "priority": priority,
        "priority_tier": risk_info["priority_tier"],
        "risk_pct": risk_info["risk_pct"],
        "is_sif_potential": is_sif_bool,
        "primary_iogp_rule": primary_rule,
        "detected_energy_sources": detected_energies,
        "barrier_condition": barrier_status,
        "has_zero_energy_verification": has_zero_energy_verification,
        "hierarchy_of_controls": hierarchy,
        "audit_rationale": explanation
    }

def compute_report_risk_score(sif_potential: bool, severity_score: float, is_high_energy: bool = False) -> Dict[str, Any]:
    """
    Computes exact Risk % Score (0–100%) and SIF Priority Tier (P1 to P4).
    """
    try:
        sev = float(severity_score) if severity_score is not None else 0.0
    except (ValueError, TypeError):
        sev = 0.0

    sif_val = 1.0 if (sif_potential is True or sif_potential == 1 or sif_potential == "1") else 0.0
    energy_val = 1.0 if is_high_energy else 0.0

    # Risk Score Algorithm
    raw_score = (sif_val * 45.0) + (sev * 45.0) + (energy_val * 10.0)
    risk_pct = round(min(100.0, max(5.0, raw_score)), 1)

    # Priority Tier
    if risk_pct >= 75.0 or (sif_val == 1.0 and energy_val == 1.0):
        priority_tier = "P1 Critical"
        resolution_sla = "Immediate 4-Hour Emergency Stop & Leadership Escalation"
    elif risk_pct >= 50.0 or sif_val == 1.0:
        priority_tier = "P2 High"
        resolution_sla = "24-Hour Mandatory Remediation & Barrier Verification"
    elif risk_pct >= 30.0:
        priority_tier = "P3 Moderate"
        resolution_sla = "7-Day Action Plan & Department Safety Audit"
    else:
        priority_tier = "P4 Low"
        resolution_sla = "Routine Shift Maintenance & General Housekeeping"

    return {
        "risk_pct": risk_pct,
        "priority_tier": priority_tier,
        "resolution_sla": resolution_sla
    }

def get_hierarchy_of_controls(iogp_rule: str, barrier_type: str = "", hazard_text: str = "") -> Dict[str, str]:
    """
    Generates structured corrective action recommendations based on the OSHA / ISO 45001 Hierarchy of Controls.
    """
    rule = iogp_rule or "General Safety"

    controls_db = {
        "Work at Height": {
            "elimination": "Eliminate aloft work by assembling structures, pipe brackets, and light fixtures at ground level before hoisting.",
            "substitution": "Replace temporary wooden scaffolding or step-ladders with certified self-propelled hydraulic aerial work platforms.",
            "engineering": "Install permanent perimeter guardrails (100cm height), toe-boards, double-rigged inertia reel lifelines, and safety netting.",
            "administrative": "Mandate 100% Permit to Work (PTW), pre-job toolbox talks, daily harness inspection, and certified scaffolding tags.",
            "ppe": "Equip personnel with EN 361 full-body safety harnesses with double lanyards, shock absorbers, and chin-strap helmets."
        },
        "Energy Isolation": {
            "elimination": "Redesign piping systems to install permanent double-block-and-bleed (DBB) isolation valves.",
            "substitution": "Replace manual mechanical lockout pins with key-coded pneumatic/electrical interlock safety systems.",
            "engineering": "Install tamper-proof LOTO key boxes, lockable circuit breakers, and calibrated digital zero-energy bleed gauges.",
            "administrative": "Execute mandatory LOTO zero-voltage/zero-pressure verification logs countersigned by two certified shift engineers.",
            "ppe": "Provide arc-flash rated face shields, dielectric gloves, and flame-retardant anti-static coveralls during electrical racking."
        },
        "Line of Fire": {
            "elimination": "Re-route high-pressure lines and heavy mechanical hoist paths away from active personnel walkways.",
            "substitution": "Use automated remote-operated hydraulic casing tongs and whip-check cables instead of manual pipe wrenches.",
            "engineering": "Install heavy-duty steel whip-restraints on Chiksan lines, safety shields on rotating shafts, and load-sensing crane interlocks.",
            "administrative": "Enforce strict red-zone exclusion barrier tape around active lifting and pressure testing operations.",
            "ppe": "Issue heavy-duty impact-resistant mechanics gloves, steel-toed boots, and high-visibility reflective vests."
        },
        "Hot Work": {
            "elimination": "Utilize cold-cutting tools, mechanical flange clamps, or bolt-on connections to eliminate open flame welding.",
            "substitution": "Substitute solvent-based flammable degreasers with non-combustible water-based ultrasonic cleaning agents.",
            "engineering": "Deploy continuous LEL/H2S dual-gas monitors with automated ESD interlocks and portable fire blankets.",
            "administrative": "Require mandatory Hot Work PTW, continuous fire-watch attendant for 30 minutes post-work, and sniffer testing.",
            "ppe": "Supply leather welding aprons, welding helmets with shade 10-12 auto-darkening filters, and SCBA standby apparatus."
        }
    }

    fallback = {
        "elimination": "Remove the physical hazard source or de-energize equipment completely before starting work.",
        "substitution": "Replace high-hazard tools, high-pressure fittings, or toxic chemicals with safer certified alternatives.",
        "engineering": "Install physical safety guards, automatic ESD interlocks, pressure relief valves, and barrier covers.",
        "administrative": "Enforce Job Safety Analysis (JSA), Permit to Work (PTW), pre-job safety briefings, and standard operating procedures.",
        "ppe": "Mandate mandatory certified PPE (helmets, safety boots, safety glasses, anti-impact gloves, and respiratory gear)."
    }

    return controls_db.get(rule, fallback)

def simulate_barrier_impact(incident_text: str, barrier_removed: str) -> Dict[str, Any]:
    """
    Safety Simulator: Computes simulated risk escalation when a specific safety barrier is removed.
    """
    base_analysis = analyze_incident(incident_text)
    base_risk = base_analysis["risk_pct"]

    removal_impacts = {
        "loto": {"name": "Lockout Tagout (LOTO) Energy Isolation", "risk_delta": 42.0, "escalated_sif": True, "escalated_rule": "Energy Isolation"},
        "scba": {"name": "SCBA / Toxic Gas Atmospheric Monitor", "risk_delta": 38.0, "escalated_sif": True, "escalated_rule": "Confined Space"},
        "fall_protection": {"name": "Fall Lifeline & Harness Protection", "risk_delta": 45.0, "escalated_sif": True, "escalated_rule": "Work at Height"},
        "esd_interlock": {"name": "Emergency Shutdown System (ESD)", "risk_delta": 50.0, "escalated_sif": True, "escalated_rule": "Bypassing Safety Controls"},
        "whip_check": {"name": "Chiksan Line Whip-Check Safety Cable", "risk_delta": 35.0, "escalated_sif": True, "escalated_rule": "Line of Fire"}
    }

    impact = removal_impacts.get(barrier_removed.lower(), {"name": barrier_removed, "risk_delta": 25.0, "escalated_sif": True, "escalated_rule": "General Safety"})

    simulated_risk = min(100.0, base_risk + impact["risk_delta"])
    simulated_priority = "P1 Critical" if simulated_risk >= 75.0 else ("P2 High" if simulated_risk >= 50.0 else "P3 Moderate")

    return {
        "original_risk_pct": base_risk,
        "simulated_risk_pct": simulated_risk,
        "risk_increase_delta": round(impact["risk_delta"], 1),
        "removed_barrier": impact["name"],
        "base_priority": base_analysis["priority_tier"],
        "simulated_priority": simulated_priority,
        "escalated_sif": impact["escalated_sif"],
        "consequence_summary": f"CRITICAL ESCALATION: Removing '{impact['name']}' increases SIF risk from {base_risk}% to {simulated_risk}%. Potential catastrophic asset failure or fatality."
    }

if __name__ == "__main__":
    test_cases = [
        "Worker slipped on oily canteen walkway near Duliajan administrative office, sustained severe ankle sprain.",
        "During workover operations at Baghjan, 2-inch Chiksan line surged to 2400 PSI while whip check cable was unsecured.",
        "Technician tested flange on high pressure line with 0 PSI residual pressure; verified zero pressure before breaking line.",
        "Roustabout entered tank with SCBA after testing showed zero H2S toxic gas levels."
    ]

    print("==========================================================")
    print("      DEKRA / EEI SIF PRECURSOR ENGINE VERIFICATION       ")
    print("==========================================================")
    for idx, test in enumerate(test_cases, 1):
        result = analyze_incident(test)
        print(f"\n--- Scenario {idx} ---")
        print(f"Report: {result['input_text']}")
        print(f"Verdict: {result['classification']} [{result['priority']}]")
        print(f"IOGP Rule: {result['primary_iogp_rule']}")
        print(f"Energy: {result['detected_energy_sources']} | Barrier: {result['barrier_condition']}")
        print(f"Audit Note: {result['audit_rationale']}")
