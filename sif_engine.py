from src.sif_engine import analyze_incident, ENERGY_RULES, BARRIER_STATES

if __name__ == "__main__":
    test_cases = [
        # Case 1: High Drama, Low Energy (Slip/Trip with loud screaming/injury)
        "Worker slipped on oily canteen walkway near Duliajan administrative office, sustained severe ankle sprain and screaming in pain.",
        
        # Case 2: Zero Injury, High Energy + Missing Barrier (Classic Fatal Precursor)
        "During workover operations at Baghjan, 2-inch Chiksan line surged to 2400 PSI while whip check cable was unsecured.",
        
        # Case 3: Working aloft with harness detached
        "Roustabout spotted at 22m elevation on derrick monkey board without secondary safety lanyard hooked.",
        
        # Case 4: High Energy present, but barrier worked (Defended Near-Miss)
        "Hydraulic hose burst at 3000 PSI on rig floor; whip check successfully held line and prevented whipping."
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
