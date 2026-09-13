"""
Layer 1: Upstream Oil & Gas Domain Tokenizer & Safety Gazetteer
Oil India Limited (OIL) Operational Asset & Hazard Standardization Engine

Expands specialized upstream oilfield abbreviations (BOP, LOTO, LEL, Chiksan, SCBA, FGGS, etc.)
and normalizes OIL asset locations (Baghjan, Duliajan, Moran, Digboi, Jaisalmer).
"""

import re
from typing import Dict, Tuple

# Upstream Oilfield Abbreviation Gazetteer
UPSTREAM_GAZETTEER: Dict[str, str] = {
    r"\bbop\b": "Blowout Preventer (BOP)",
    r"\bfggs\b": "Fire and Gas Grid System (FGGS)",
    r"\bloto\b": "Lockout Tagout (LOTO) Energy Isolation",
    r"\blel\b": "Lower Explosive Limit (LEL)",
    r"\bchiksan\b": "High-Pressure Swivel Line (Chiksan)",
    r"\bscba\b": "Self-Contained Breathing Apparatus (SCBA)",
    r"\bjmp\b": "Journey Management Plan (JMP)",
    r"\bptw\b": "Permit to Work (PTW)",
    r"\besd\b": "Emergency Shutdown System (ESD)",
    r"\bswa\b": "Stop Work Authority (SWA)",
    r"\bpsv\b": "Pressure Safety Valve (PSV)",
    r"\bprv\b": "Pressure Relief Valve (PRV)",
    r"\bmcc\b": "Motor Control Center (MCC)",
    r"\bjsa\b": "Job Safety Analysis (JSA)",
    r"\bppe\b": "Personal Protective Equipment (PPE)",
    r"\beei\b": "Edison Electric Institute (EEI)",
    r"\boisd\b": "Oil Industry Safety Directorate (OISD)",
    r"\bh2s\b": "Hydrogen Sulfide Toxic Gas (H2S)",
    r"\bua/uc\b": "Unsafe Act and Unsafe Condition",
    r"\bpsif\b": "Potential Serious Injury or Fatality (PSIF)",
    r"\bsif\b": "Serious Injury or Fatality (SIF)",
}

# OIL Operational Assets Gazetteer
ASSET_GAZETTEER: Dict[str, str] = {
    r"\bbaghjan\b": "Baghjan Oilfield Installation",
    r"\bduliajan\b": "Duliajan Central Field Complex",
    r"\bmoran\b": "Moran Asset Operations",
    r"\bdigboi\b": "Digboi Historical Operations",
    r"\bjaisalmer\b": "Jaisalmer Natural Gas Field",
    r"\bworkover\b": "Workover Rig Operation",
}

class UpstreamDomainTokenizer:
    """
    Layer 1 Tokenizer & Entity Normalizer.
    Pre-processes raw field safety narratives into standardized context-rich text.
    """
    def __init__(self):
        self.abbrev_patterns = [(re.compile(pattern, re.IGNORECASE), replacement) 
                               for pattern, replacement in UPSTREAM_GAZETTEER.items()]
        self.asset_patterns = [(re.compile(pattern, re.IGNORECASE), replacement) 
                              for pattern, replacement in ASSET_GAZETTEER.items()]

    def normalize(self, text: str) -> Tuple[str, Dict[str, list]]:
        """
        Cleans field input, expands abbreviations, and extracts oilfield entities.
        
        Returns:
            normalized_text (str): Expanded text ready for Layer 2 parsing.
            entities_extracted (dict): Dictionary of detected entities/acronyms.
        """
        if not text or not isinstance(text, str):
            return "", {"acronyms": [], "assets": []}

        text_clean = text.strip()
        acronyms_found = []
        assets_found = []

        # 1. Detect and Expand Acronyms
        for pattern, replacement in self.abbrev_patterns:
            if pattern.search(text_clean):
                acronyms_found.append(replacement.split("(")[-1].rstrip(")").strip() if "(" in replacement else replacement)
                text_clean = pattern.sub(replacement, text_clean)

        # 2. Detect and Expand Assets
        for pattern, replacement in self.asset_patterns:
            if pattern.search(text_clean):
                assets_found.append(replacement)
                text_clean = pattern.sub(replacement, text_clean)

        return text_clean, {
            "acronyms": list(set(acronyms_found)),
            "assets": list(set(assets_found))
        }

if __name__ == "__main__":
    tokenizer = UpstreamDomainTokenizer()
    sample = "Roustabout at Baghjan rig 7 opened Chiksan line without verifying LOTO or testing H2S gas levels on SCBA."
    norm_text, ents = tokenizer.normalize(sample)
    print("Original:", sample)
    print("Normalized:", norm_text)
    print("Entities:", ents)
