import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    from src.domain_tokenizer import UpstreamDomainTokenizer
except ModuleNotFoundError:
    from domain_tokenizer import UpstreamDomainTokenizer

# Instantiate Layer 1 Tokenizer
domain_tokenizer = UpstreamDomainTokenizer()

# Definition of standard IOGP Life-Saving Rules and semantic keyword anchors
IOGP_RULES = {
    "Work at Height": "fall protection elevated platform scaffold ladder safety harness monkey board derrick floor lifeline fall height roof beams derrick superstructure mast drop height",
    "Line of Fire": "struck by falling tubular pressurized hose burst swinging heavy load whipping line pinch point rotating shaft entanglement dropped object struck pipe winch recoil impact chiksan line swivel",
    "Energy Isolation": "lockout tagout loto electrical switch residual pressure bleed off circuit breaker double block bleed de energize unisolated breaker sub station voltage mccs zero voltage verified",
    "Hot Work": "welding torch cutting flammable gas ignition spark shield hydrocarbon sniffer test lel monitor grinding sparks hazardous area arc flame burn combustible sour gas h2s",
    "Confined Space": "atmospheric gas testing oxygen deficit h2s toxicity manhole entry storage tank sludge cleaning scba standby attendant enclosed vessel pit toxic vapor entry permit",
    "Bypassing Safety Controls": "overriding relief valve tampering safety interlock bypassing emergency shutdown esd disabling gas detector jumpering plc trip jumper safety bypass psv prv",
    "Safe Mechanical Lifting": "crane rigging crane capacity limit lifting sling tag line dropped cargo outrigger pad stability crane load boom hoist wire rope sling snap crane tilt",
    "System Opening": "process line breaking opening flange under pressure sampling valve hydrocarbon spray spading blind nitrogen purge live pipe gasket loosen line break bleed zero pressure test",
    "Driving": "vehicle speeding seatbelt violation tanker brake fade driver fatigue shift journey management plan jmp road rollover transport bowser truck collision runaway slope",
    "Fit for Duty": "alcohol impairment drug test failure extreme fatigue physical unfitness critical task breathalyzer shift exhaustion duty hours violation"
}

class IOGPSemanticMatcher:
    def __init__(self):
        print("Initializing Scikit-Learn TF-IDF N-Gram IOGP Life-Saving Rules Matcher with Layer 1 Upstream Domain Tokenizer...")
        self.rule_labels = list(IOGP_RULES.keys())
        self.rule_descriptions = [domain_tokenizer.normalize(desc)[0] for desc in IOGP_RULES.values()]
        
        # Sub-linear TF scaling + word/char n-grams for technical safety vocabulary
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            sublinear_tf=True,
            stop_words='english'
        )
        
        self.rule_vectors = self.vectorizer.fit_transform(self.rule_descriptions)
        print("IOGP Semantic Matcher initialized successfully.")

    def classify_iogp_rule(self, incident_text: str, confidence_threshold: float = 0.12):
        if not incident_text or not isinstance(incident_text, str):
            return "None / Housekeeping", 0.0

        # Layer 1 Domain Tokenizer & Entity Normalization
        norm_text, _ = domain_tokenizer.normalize(incident_text)

        text_vector = self.vectorizer.transform([norm_text])
        similarities = cosine_similarity(text_vector, self.rule_vectors)[0]
        
        best_match_idx = np.argmax(similarities)
        confidence = float(similarities[best_match_idx])

        if confidence < confidence_threshold:
            return "None / Housekeeping", confidence

        return self.rule_labels[best_match_idx], confidence

if __name__ == "__main__":
    matcher = IOGPSemanticMatcher()

    test_samples = [
        "Roustabout standing near mud pump at Baghjan when 2-inch Chiksan line severed under pressure, striking shoulder.",
        "Technician opened flange on gas line without verifying LOTO or testing ESD interlock.",
        "Scaffolding platform missing base plates collapsed while workers were replacing valves at 8m elevation.",
        "Worker entered slop tank after SCBA gas sniffer showed 0 ppm H2S.",
        "Oily rag left on workshop floor after cleaning pump."
    ]

    print("\n--- IOGP SEMANTIC MATCHER TEST ---")
    for sample in test_samples:
        rule, conf = matcher.classify_iogp_rule(sample)
        print(f"\nReport: {sample}\n -> Matched Rule: [{rule}] (Similarity Score: {conf:.4f})")
