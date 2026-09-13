import json
import csv
import os
import random
from datetime import datetime, timedelta

# Ensure data directory exists
os.makedirs("data", exist_ok=True)

# Set random seed for reproducibility
random.seed(42)

# Oil India Limited (OIL) specific operational locations
OIL_SITES = [
    "Duliajan GGS-1 (Gas Gathering Station)",
    "Duliajan GGS-3 (Gas Gathering Station)",
    "Moran OCS-2 (Oil Collecting Station)",
    "Digboi Refinery Area",
    "LPG Plant Duliajan",
    "Workover Rig #14 - Field Site Duliajan",
    "Drilling Rig E-1400 - Moran Block",
    "Rajasthan Project Drilling Rig #3 (Jaisalmer)",
    "KG Basin Offshore Base (Kakinada)",
    "Pipeline HQ Pump Station - Sekerkote",
    "Jorhat Compressor Station #5",
    "Makum Crude Oil Storage Terminal"
]

DEPARTMENTS = [
    "Drilling & Workover",
    "Production Oil & Gas",
    "Pipeline Services",
    "Electrical & Instrumentation",
    "Mechanical Maintenance",
    "HSE & Fire Safety",
    "Civil & Logistics"
]

# Standard IOGP Life-Saving Rules
IOGP_LSR_LIST = [
    "Bypassing Safety Controls",
    "Confined Space",
    "Driving",
    "Energy Isolation",
    "Hot Work",
    "Line of Fire",
    "Safe Mechanical Lifting",
    "System Opening",
    "Working at Height",
    "Fit for Duty"
]

BARRIER_FAILURE_TYPES = [
    "Physical / Engineering Control",
    "Procedural / Administrative",
    "PPE / Individual Protection",
    "Equipment Integrity / Maintenance",
    "Supervisory & Management Controls"
]

# High SIF-Potential reports (carrying genuine fatal/catastrophic risk)
SIF_REPORTS_POOL = [
    {
        "sif_potential": 1,
        "sif_severity_score": 0.94,
        "iogp_life_saving_rule": "Energy Isolation",
        "barrier_failure_type": "Procedural / Administrative",
        "precursor_pattern": "Unisolated Struck-By & Stored High-Pressure Energy Hazard",
        "report_type": "Near Miss",
        "report_title": "High-pressure mud line maintenance initiated without LOTO & residual pressure bleed",
        "description": "During maintenance of Mud Pump #2 at Drilling Rig E-1400 Moran, a technician began loosening the flange bolts on the 3000 PSI discharge mud line without verifying Lockout/Tagout (LOTO) or bleeding residual pressure. A minor hiss was heard, and pressure gauge still read 450 PSI. Work was immediately stopped by HSE supervisor. Bleed valve was clogged with dry mud.",
        "activity_being_performed": "Mud Pump Flange Maintenance",
        "immediate_corrective_action": "Job stopped immediately. De-pressurization confirmed through auxiliary bleed line, LOTO applied with double valve isolation."
    },
    {
        "sif_potential": 1,
        "sif_severity_score": 0.92,
        "iogp_life_saving_rule": "Line of Fire",
        "barrier_failure_type": "Equipment Integrity / Maintenance",
        "precursor_pattern": "Dropped Heavy Tubular Potential from Height",
        "report_type": "Near Miss",
        "report_title": "Frayed wire rope sling snapped partially during 4.5-ton casing pipe lift on derrick floor",
        "description": "At Workover Rig #14 Duliajan, while hoisting a bundle of 4.5-inch drill pipes (approx 4.5 tons) to the monkey board, one of the strands on the wire rope sling parted with a sharp popping sound. The load swung violently over the drill floor where three roughnecks were standing. Fortunately, safety latch held and workers scrambled out of the drop zone.",
        "activity_being_performed": "Pipe Hoisting to Derrick Monkey Board",
        "immediate_corrective_action": "Lift suspended. Defective sling removed from service, quarantined, and destroyed. Complete load-lifting tackle inspection enforced."
    },
    {
        "sif_potential": 1,
        "sif_severity_score": 0.96,
        "iogp_life_saving_rule": "Confined Space",
        "barrier_failure_type": "Procedural / Administrative",
        "precursor_pattern": "Toxic H2S Gas Exposure & Oxygen Deficiency in Closed Vessel",
        "report_type": "Unsafe Act",
        "report_title": "Contract worker attempted entry into Slop Tank #3 without gas testing or standby attendant",
        "description": "At Moran OCS-2, a contractor cleaner was observed lowering a ladder into Slop Tank #3 (classified confined space) to clean sludge without conducting pre-entry gas testing for H2S/LEL or having a trained standby attendant with SCBA present. Tank had been isolated only 2 hours prior and contained residual sour crude hydrocarbon vapors.",
        "activity_being_performed": "Slop Tank Internal Desludging",
        "immediate_corrective_action": "Worker halted immediately prior to entry. Work permit suspended; gas test conducted showing 18 ppm H2S (above STEL limit). Forced draft ventilation installed."
    },
    {
        "sif_potential": 1,
        "sif_severity_score": 0.89,
        "iogp_life_saving_rule": "Working at Height",
        "barrier_failure_type": "PPE / Individual Protection",
        "precursor_pattern": "Unanchored High Fall Hazard from Flare Stack Platform",
        "report_type": "Unsafe Act",
        "report_title": "Instrument technician unhooked safety harness dual lanyard at 22m flare stack elevation",
        "description": "At Duliajan LPG Plant, an instrument technician working at a height of 22 meters on the main flare stack platform unhooked both lanyards of his full-body harness simultaneously to reach a pressure transmitter on an outboard beam without a lifeline installed. Gusty wind conditions prevailed.",
        "activity_being_performed": "Flare Stack Pressure Transmitter Calibration",
        "immediate_corrective_action": "Technician instructed to secure self immediately. Work stopped, temporary retractable wire rope fall arrest lifeline installed before resuming."
    },
    {
        "sif_potential": 1,
        "sif_severity_score": 0.95,
        "iogp_life_saving_rule": "Hot Work",
        "barrier_failure_type": "Physical / Engineering Control",
        "precursor_pattern": "Uncontrolled Ignitable Hydrocarbon Vapor Cloud Fire Potential",
        "report_type": "Near Miss",
        "report_title": "Hot welding sparks showered near open condensate drain manifold during active transfer",
        "description": "During pipe rack structural repairs at Duliajan GGS-1, structural welding was being performed 4 meters above ground. Welding slag and hot sparks fell onto an open condensate drain trench where condensate was actively being drained from separator V-101. LEL monitor alarm sounded 45% LEL in vicinity.",
        "activity_being_performed": "Structural Welding on Pipe Rack",
        "immediate_corrective_action": "Welding power cut instantly. Drain valve shut, fire blanket habitat deployed, continuous LEL gas monitoring initiated."
    },
    {
        "sif_potential": 1,
        "sif_severity_score": 0.91,
        "iogp_life_saving_rule": "Bypassing Safety Controls",
        "barrier_failure_type": "Supervisory & Management Controls",
        "precursor_pattern": "Defeated Emergency Pressure Shut Down (ESD) Interlock",
        "report_type": "Unsafe Condition",
        "report_title": "High-pressure separator ESD trip valve jumpered out without management override authorization",
        "description": "During routine HSE audit at Moran OCS-2, auditors discovered that the high-pressure trip sensor (PSHH-204) on Crude Separator-2 had been bypassed using an electrical jumper wire on the PLC panel to prevent nuisance tripping during flow surges, leaving vessel vulnerable to catastrophic over-pressurization.",
        "activity_being_performed": "Oil Separation & Normal Operations",
        "immediate_corrective_action": "Jumper removed immediately. Emergency shutdown logic restored. Management Change (MOC) review initiated against shift engineer."
    },
    {
        "sif_potential": 1,
        "sif_severity_score": 0.90,
        "iogp_life_saving_rule": "System Opening",
        "barrier_failure_type": "Procedural / Administrative",
        "precursor_pattern": "Pressurized Toxic Hydrocarbon Spray on Operators",
        "report_type": "Near Miss",
        "report_title": "Flange broke open on live gas line mistaking it for depressurized drain line",
        "description": "At Jorhat Compressor Station #5, maintenance crew loosened all flange bolts on a 6-inch fuel gas feed pipe under 25 bar pressure, having misidentified it for the depressurized nitrogen purge line due to missing line tags. As flange gap widened, gas started escaping under high velocity.",
        "activity_being_performed": "Fuel Gas Filter Replacement",
        "immediate_corrective_action": "Workers evacuated area instantly. Main ESD valve activated. Line tagged properly and positive isolation (blind spade) installed."
    },
    {
        "sif_potential": 1,
        "sif_severity_score": 0.88,
        "iogp_life_saving_rule": "Safe Mechanical Lifting",
        "barrier_failure_type": "Physical / Engineering Control",
        "precursor_pattern": "Crane Overturn & Structural Collapse during Critical Heavy Lift",
        "report_type": "Near Miss",
        "report_title": "50-Ton Mobile Crane outriggers sank into uncompacted soil during 18-ton mud pump lift",
        "description": "At Rajasthan Project Rig #3 (Jaisalmer), a 50-ton hydraulic mobile crane was lifting an 18-ton mud pump engine skid. The front right outrigger pad suddenly sank 30cm into uncompacted sandy soil due to missing steel spreader plates. The crane tilted 12 degrees with load suspended 3 meters in air.",
        "activity_being_performed": "Heavy Rig Equipment Positioning",
        "immediate_corrective_action": "Load gently lowered back to ground. Ground load-bearing test conducted, heavy steel mats placed under outrigger pads before re-lift."
    },
    {
        "sif_potential": 1,
        "sif_severity_score": 0.93,
        "iogp_life_saving_rule": "Energy Isolation",
        "barrier_failure_type": "Equipment Integrity / Maintenance",
        "precursor_pattern": "High Voltage Electrical Flashover / Arc Blast Potential",
        "report_type": "Unsafe Condition",
        "report_title": "11kV Substation breaker racking mechanism jammed open with exposed live busbars",
        "description": "At Duliajan Main Substation, during maintenance of 11kV Feeder Breaker #4, the mechanical interlock jammed halfway while racking out breaker. The shutter mechanism failed to close, leaving 11,000V energized busbars fully exposed while technicians were working inside cabinet.",
        "activity_being_performed": "High Voltage Switchgear Maintenance",
        "immediate_corrective_action": "Substation upstream transformer opened and grounded. Shutter mechanism repaired and retrofitted with secondary physical barrier."
    },
    {
        "sif_potential": 1,
        "sif_severity_score": 0.87,
        "iogp_life_saving_rule": "Driving",
        "barrier_failure_type": "Procedural / Administrative",
        "precursor_pattern": "Heavy Explosive/Hydrocarbon Tanker Rollover on Narrow Oilfield Road",
        "report_type": "Near Miss",
        "report_title": "Heavy Crude bowser trailer lost brakes on steep incline near Digboi Hills",
        "description": "A contract crude oil tanker (32,000L capacity) suffered brake fade while descending a 12% grade oilfield access road near Digboi oilfields. Vehicle swerved into emergency runaway ramp, narrowly avoiding rollover into populated village creek. Inspection revealed non-functional trailer brake shoes.",
        "activity_being_performed": "Crude Oil Road Transportation",
        "immediate_corrective_action": "Tanker impounded. Contractor vehicle fitness audit initiated across all crude bowser fleets."
    },
    {
        "sif_potential": 1,
        "sif_severity_score": 0.95,
        "iogp_life_saving_rule": "Confined Space",
        "barrier_failure_type": "Physical / Engineering Control",
        "precursor_pattern": "Catastrophic Hydrocarbon Ingress into Crude Oil Storage Tank",
        "report_type": "Near Miss",
        "report_title": "Single valve isolation used for entry into Tank 102 while filling line was pressurized",
        "description": "At Makum Crude Oil Terminal, entry permit was issued for Tank 102 internal lining inspection using only a single closed gate valve isolation on the incoming 16-inch crude inlet header (pressurized at 14 bar). Spectacle blind was not turned to blank position.",
        "activity_being_performed": "Internal Storage Tank Inspection",
        "immediate_corrective_action": "Inspectors evacuated from tank immediately. Line de-pressurized and spectacle blind swiveled to spade position prior to re-entry."
    },
    {
        "sif_potential": 1,
        "sif_severity_score": 0.91,
        "iogp_life_saving_rule": "Working at Height",
        "barrier_failure_type": "Equipment Integrity / Maintenance",
        "precursor_pattern": "Collapse of Heavy Work Platform Scaffolding",
        "report_type": "Unsafe Condition",
        "report_title": "Scaffolding platform supporting 4 workers missing base plates and diagonal bracing",
        "description": "At Duliajan GGS-3, a 9-meter high tubular scaffolding erected for valve replacement was found missing sole boards, base plates on wet muddy ground, and 60% of diagonal cross-braces. Platform was loaded with heavy chain blocks and valves.",
        "activity_being_performed": "Elevated Manifold Valve Replacement",
        "immediate_corrective_action": "Red 'UNSAFE - DO NOT USE' tag applied. Workers ordered off platform. Scaffolding dismantled and rebuilt under certified inspector supervision."
    },
    {
        "sif_potential": 1,
        "sif_severity_score": 0.89,
        "iogp_life_saving_rule": "Hot Work",
        "barrier_failure_type": "Procedural / Administrative",
        "precursor_pattern": "Hot Work in Zone-0 Gas Environment without Continuous Monitoring",
        "report_type": "Unsafe Act",
        "report_title": "Grinding work started inside LPG bottling hall without hot work permit or LEL check",
        "description": "At LPG Plant Duliajan, maintenance fitters started angle grinding on a steel bracket inside the LPG carousel filling shed (Zone 1 hazardous area) without issuing a Hot Work PTW or performing LEL gas test. Gas odor was noticeable nearby.",
        "activity_being_performed": "Bracket Angle Grinding in LPG Shed",
        "immediate_corrective_action": "Grinding stopped instantly. Power disconnected. Gas monitoring detected 12% LEL LPG vapor. Area purged with nitrogen."
    },
    {
        "sif_potential": 1,
        "sif_severity_score": 0.93,
        "iogp_life_saving_rule": "Line of Fire",
        "barrier_failure_type": "Physical / Engineering Control",
        "precursor_pattern": "Unrestrained High-Pressure Flexible Hose Whip Hazard",
        "report_type": "Near Miss",
        "report_title": "High-pressure cement pumping hose whip-check restraint missing at 4000 PSI",
        "description": "During cementing operation at Drilling Rig E-1400 Moran, a 3-inch high-pressure flexible cement discharge line (operating at 4000 PSI) had its safety whip-check cable unhooked during rig-up. Coupling began leaking slurry under intense vibration.",
        "activity_being_performed": "Well Casing Cementing Operation",
        "immediate_corrective_action": "Cement pumps throttled down safely. Pressure bled to zero; certified steel whip-check cables installed and clamped."
    },
    {
        "sif_potential": 1,
        "sif_severity_score": 0.88,
        "iogp_life_saving_rule": "Safe Mechanical Lifting",
        "barrier_failure_type": "Procedural / Administrative",
        "precursor_pattern": "Rigging Failure & Dropped Blowout Preventer (BOP) Stack",
        "report_type": "Near Miss",
        "report_title": "Lift of 12-ton BOP stack attempted using unrated web slings attached to sharp flange edges",
        "description": "At Workover Rig #14, rig crew attempted to lift a 12-ton Blowout Preventer (BOP) stack using synthetic webbing slings wrapped directly around sharp metal flange corners without protective corner guards or shackles.",
        "activity_being_performed": "BOP Stack Nipple-Up Operation",
        "immediate_corrective_action": "Lift stopped immediately before load cleared substructure. Rigging switched to certified wire rope slings with softeners and rated shackles."
    }
]

# Non-SIF reports pool (low severity, routine housekeeping, minor tool slip, minor PPE non-compliance)
NON_SIF_REPORTS_POOL = [
    {
        "sif_potential": 0,
        "sif_severity_score": 0.25,
        "iogp_life_saving_rule": "Line of Fire",
        "barrier_failure_type": "PPE / Individual Protection",
        "precursor_pattern": "Minor Hand Pinched by Hand Tool",
        "report_type": "Incident Report",
        "report_title": "Minor hand pinch while tightening flange bolt with combination spanner",
        "description": "At Duliajan GGS-1, a mechanic slipped hand off a 24mm combination spanner while tightening a low-pressure water line bracket, pinching finger against pipe support. Resulted in minor skin abrasion on left index finger. First aid applied.",
        "activity_being_performed": "Water Line Bracket Tightening",
        "immediate_corrective_action": "First aid dressing applied. Advised worker to use correct posture and impact-resistant mechanics gloves."
    },
    {
        "sif_potential": 0,
        "sif_severity_score": 0.18,
        "iogp_life_saving_rule": "None / Housekeeping",
        "barrier_failure_type": "Procedural / Administrative",
        "precursor_pattern": "Minor Trip Hazard from Loose Cables",
        "report_type": "Unsafe Condition",
        "report_title": "Extension power cord laid across walkway without rubber cable crossover ramps",
        "description": "At Moran OCS-2 office annex, an electrical extension cord for temporary lighting was routed across the main pedestrian corridor without rubber cable protection ramps, posing a trip hazard.",
        "activity_being_performed": "Temporary Lighting Wiring",
        "immediate_corrective_action": "Cable rerouted overhead and rubber floor cable protection covers installed."
    },
    {
        "sif_potential": 0,
        "sif_severity_score": 0.22,
        "iogp_life_saving_rule": "Working at Height",
        "barrier_failure_type": "Physical / Engineering Control",
        "precursor_pattern": "Missing Handrail Toe Board on Walkway",
        "report_type": "Unsafe Condition",
        "report_title": "Toe-board missing on ground-level valve pit access platform",
        "description": "At Digboi Refinery Area, 100cm high handrail around valve pit #4 was missing a 10cm toe-board, allowing small hand tools to potentially roll into the shallow 1-meter deep pit.",
        "activity_being_performed": "Valve Pit Inspection",
        "immediate_corrective_action": "Yellow steel toe-board fabricated and bolted to platform guardrail."
    },
    {
        "sif_potential": 0,
        "sif_severity_score": 0.15,
        "iogp_life_saving_rule": "None / Housekeeping",
        "barrier_failure_type": "Procedural / Administrative",
        "precursor_pattern": "Oily Rag Storage in Non-Approved Container",
        "report_type": "Unsafe Condition",
        "report_title": "Oily cotton waste discarded in plastic bin instead of metal self-closing bin",
        "description": "At LPG Plant Duliajan mechanical workshop, oily cotton rags used for cleaning pump casings were thrown into an open plastic trash bin rather than designated heavy-duty self-closing metal fire-safe bins.",
        "activity_being_performed": "Workshop Equipment Wipedown",
        "immediate_corrective_action": "Rags transferred to designated red metal oily-waste bin. Tool box talk conducted on spontaneous combustion risks."
    },
    {
        "sif_potential": 0,
        "sif_severity_score": 0.30,
        "iogp_life_saving_rule": "Driving",
        "barrier_failure_type": "Equipment Integrity / Maintenance",
        "precursor_pattern": "Non-Functional Tail Light on Pickup Van",
        "report_type": "Unsafe Condition",
        "report_title": "Left rear tail light bulb fused on field inspection Bolero vehicle",
        "description": "During daily pre-trip inspection at Duliajan Field Operations, HSE marshal noted that the left rear tail light and brake light on inspection vehicle AS-06-X-1234 were inoperative.",
        "activity_being_performed": "Pre-Trip Vehicle Inspection",
        "immediate_corrective_action": "Vehicle sent to transport workshop for immediate bulb replacement before field deployment."
    },
    {
        "sif_potential": 0,
        "sif_severity_score": 0.12,
        "iogp_life_saving_rule": "None / Housekeeping",
        "barrier_failure_type": "Procedural / Administrative",
        "precursor_pattern": "Safety Signage Faded by Sun Exposure",
        "report_type": "Unsafe Condition",
        "report_title": "Caution sign for eye protection faded near grinding bench",
        "description": "At Workover Rig #14 workshop, mandatory PPE warning sign ('Wear Safety Goggles') near bench grinder was severely faded due to sunlight exposure and hard to read.",
        "activity_being_performed": "Workshop Maintenance",
        "immediate_corrective_action": "New high-visibility reflective vinyl warning sign installed."
    },
    {
        "sif_potential": 0,
        "sif_severity_score": 0.28,
        "iogp_life_saving_rule": "PPE / Individual Protection",
        "barrier_failure_type": "PPE / Individual Protection",
        "precursor_pattern": "Worn-out Safety Boot Soles",
        "report_type": "Unsafe Act",
        "report_title": "Contract helper wearing safety boots with completely worn-out anti-slip treads",
        "description": "During safety walk at Moran OCS-2, a contract helper was noticed wearing safety boots where the rubber outsole tread was completely worn smooth, increasing slip risk on oily steel decks.",
        "activity_being_performed": "Deck Cleaning & Sweeping",
        "immediate_corrective_action": "New pair of IS 15298 certified anti-slip safety boots issued from stores immediately."
    },
    {
        "sif_potential": 0,
        "sif_severity_score": 0.20,
        "iogp_life_saving_rule": "Hot Work",
        "barrier_failure_type": "Equipment Integrity / Maintenance",
        "precursor_pattern": "Minor Insulation Tear on Low-Voltage Welding Lead",
        "report_type": "Unsafe Condition",
        "report_title": "Small outer insulation scuff on 24V secondary welding return cable",
        "description": "At Duliajan GGS-3 fabrication yard, rubber outer jacket of a 24V welding machine ground clamp cable had a 2cm scuff. Inner copper wire was intact and dry.",
        "activity_being_performed": "Workshop Structural Pipe Welding",
        "immediate_corrective_action": "Cable wrapped with heavy-duty vulcanizing electrical insulation tape."
    },
    {
        "sif_potential": 0,
        "sif_severity_score": 0.24,
        "iogp_life_saving_rule": "None / Housekeeping",
        "barrier_failure_type": "Procedural / Administrative",
        "precursor_pattern": "Water Puddle near Office Walkway Entrance",
        "report_type": "Unsafe Condition",
        "report_title": "Rainwater accumulation near control room steps due to clogged drain spout",
        "description": "At Jorhat Compressor Station #5, heavy rain caused a 5cm deep rainwater puddle near control room entry steps because roof downspout drain was blocked with dry leaves.",
        "activity_being_performed": "Routine Facilities Maintenance",
        "immediate_corrective_action": "Drain spout cleared of leaves. Wet floor warning sign placed until concrete dried."
    },
    {
        "sif_potential": 0,
        "sif_severity_score": 0.16,
        "iogp_life_saving_rule": "None / Housekeeping",
        "barrier_failure_type": "Equipment Integrity / Maintenance",
        "precursor_pattern": "Expired Eyewash Bottle Fluid",
        "report_type": "Unsafe Condition",
        "report_title": "Portable eyewash bottle solution past expiration date in battery room",
        "description": "During monthly HSE audit at Pipeline HQ Sekerkote, 500ml sterile eyewash bottle in UPS battery room was found 2 months past expiration date printed on bottle label.",
        "activity_being_performed": "Substation Monthly HSE Audit",
        "immediate_corrective_action": "Expired bottle replaced with fresh sterile saline eyewash pack from first aid stock."
    },
    {
        "sif_potential": 0,
        "sif_severity_score": 0.22,
        "iogp_life_saving_rule": "Line of Fire",
        "barrier_failure_type": "Procedural / Administrative",
        "precursor_pattern": "Improper Storage of Hand Tools on Ladder Rung",
        "report_type": "Unsafe Act",
        "report_title": "Technician left 10-inch adjustable wrench on stepladder top tray while taking lunch break",
        "description": "At Digboi Refinery electrical shed, an electrician left an adjustable wrench on top of a 6-ft aluminum stepladder while stepping away for lunch break.",
        "activity_being_performed": "Light Fixture Replacement",
        "immediate_corrective_action": "Wrench removed and placed in electrician tool pouch. Electrician counseled on tool drop prevention."
    },
    {
        "sif_potential": 0,
        "sif_severity_score": 0.19,
        "iogp_life_saving_rule": "None / Housekeeping",
        "barrier_failure_type": "Procedural / Administrative",
        "precursor_pattern": "Unlabeled Chemical Wash Bottle",
        "report_type": "Unsafe Condition",
        "report_title": "Plastic squeeze wash bottle containing isopropyl alcohol lacked GHS hazard label",
        "description": "At LPG Plant Duliajan laboratory, a plastic squeeze bottle used for cleaning instrument sensor glass contained IPA solvent but lacked GHS chemical identification label.",
        "activity_being_performed": "Lab Analytics & Glassware Cleaning",
        "immediate_corrective_action": "Standard GHS chemical sticker printed and attached showing solvent name and flammability pictogram."
    },
    {
        "sif_potential": 0,
        "sif_severity_score": 0.21,
        "iogp_life_saving_rule": "Line of Fire",
        "barrier_failure_type": "PPE / Individual Protection",
        "precursor_pattern": "Splinter Scratch from Unhandled Wooden Pallet",
        "report_type": "Incident Report",
        "report_title": "Store helper received minor wood splinter on palm while carrying wooden pallet without leather gloves",
        "description": "At Duliajan Main Stores, a material handler lifted a rough wooden pallet without wearing leather cotton-backed work gloves, receiving a minor timber splinter in left palm.",
        "activity_being_performed": "Warehouse Material Stacking",
        "immediate_corrective_action": "Splinter removed using sterile tweezers, antiseptic swab applied. Hand gloves usage re-emphasized."
    },
    {
        "sif_potential": 0,
        "sif_severity_score": 0.17,
        "iogp_life_saving_rule": "Driving",
        "barrier_failure_type": "Equipment Integrity / Maintenance",
        "precursor_pattern": "Low Tire Pressure in Field Utility Vehicle",
        "report_type": "Unsafe Condition",
        "report_title": "Front right tire pressure low (18 PSI vs recommended 32 PSI) on field utility truck",
        "description": "At Rajasthan Project (Jaisalmer), driver noticed utility pickup pulling slightly right. Pressure check showed 18 PSI due to slow nail puncture.",
        "activity_being_performed": "Field Transport",
        "immediate_corrective_action": "Spare tire mounted; damaged tire sent for vulcanizing repair."
    },
    {
        "sif_potential": 0,
        "sif_severity_score": 0.26,
        "iogp_life_saving_rule": "Energy Isolation",
        "barrier_failure_type": "Procedural / Administrative",
        "precursor_pattern": "LOTO Padlock Master Key Tagging Error",
        "report_type": "Unsafe Condition",
        "report_title": "LOTO key box tag number slightly smudged on lockout station cabinet",
        "description": "At Moran OCS-2, paper identification label on isolation lockout box #12 was smudged by grease, making lock serial number 4821 appear like 4827.",
        "activity_being_performed": "LOTO Station Maintenance",
        "immediate_corrective_action": "Label replaced with laminated industrial barcode tag."
    }
]

def generate_calibrated_dataset(total_count=120, sif_target_pct=0.233):
    """
    Generates a dataset strictly calibrated to ~23.3% SIF Potential, matching
    the DEKRA Martin & Black / VelocityEHS benchmark (20-25% SIF potential).
    """
    dataset = []
    base_id = 1000
    
    sif_count_target = int(round(total_count * sif_target_pct))
    non_sif_count_target = total_count - sif_count_target
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=180)
    
    # 1. Generate SIF records
    for i in range(sif_count_target):
        base_report = random.choice(SIF_REPORTS_POOL)
        site = random.choice(OIL_SITES)
        dept = random.choice(DEPARTMENTS)
        random_days = random.randint(0, 180)
        report_date = (start_date + timedelta(days=random_days)).strftime("%Y-%m-%d")
        score_var = round(max(0.70, min(0.99, base_report["sif_severity_score"] + random.uniform(-0.02, 0.02))), 2)
        
        record = {
            "report_id": f"OIL-HSE-2025-{base_id + len(dataset)}",
            "date": report_date,
            "site_location": site,
            "department": dept,
            "report_type": base_report["report_type"],
            "report_title": base_report["report_title"],
            "description": base_report["description"],
            "sif_potential": 1,
            "sif_severity_score": score_var,
            "iogp_life_saving_rule": base_report["iogp_life_saving_rule"],
            "barrier_failure_type": base_report["barrier_failure_type"],
            "precursor_pattern": base_report["precursor_pattern"],
            "activity_being_performed": base_report["activity_being_performed"],
            "immediate_corrective_action": base_report["immediate_corrective_action"]
        }
        dataset.append(record)
        
    # 2. Generate Non-SIF records
    for i in range(non_sif_count_target):
        base_report = random.choice(NON_SIF_REPORTS_POOL)
        site = random.choice(OIL_SITES)
        dept = random.choice(DEPARTMENTS)
        random_days = random.randint(0, 180)
        report_date = (start_date + timedelta(days=random_days)).strftime("%Y-%m-%d")
        score_var = round(max(0.05, min(0.40, base_report["sif_severity_score"] + random.uniform(-0.02, 0.02))), 2)
        
        record = {
            "report_id": f"OIL-HSE-2025-{base_id + len(dataset)}",
            "date": report_date,
            "site_location": site,
            "department": dept,
            "report_type": base_report["report_type"],
            "report_title": base_report["report_title"],
            "description": base_report["description"],
            "sif_potential": 0,
            "sif_severity_score": score_var,
            "iogp_life_saving_rule": base_report["iogp_life_saving_rule"],
            "barrier_failure_type": base_report["barrier_failure_type"],
            "precursor_pattern": base_report["precursor_pattern"],
            "activity_being_performed": base_report["activity_being_performed"],
            "immediate_corrective_action": base_report["immediate_corrective_action"]
        }
        dataset.append(record)
        
    # Shuffle so SIF and Non-SIF reports are intermingled naturally
    random.shuffle(dataset)
    
    # Re-index report_ids chronologically or cleanly
    for idx, d in enumerate(dataset):
        d["report_id"] = f"OIL-HSE-2025-{1001 + idx}"
        
    return dataset

if __name__ == "__main__":
    dataset = generate_calibrated_dataset(500, 0.233) # 500 reports, 23.3% SIF potential
    
    # Save JSON
    json_path = os.path.join("data", "oil_safety_reports.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)
    print(f"[SUCCESS] Saved JSON dataset to {json_path}")

    # Save CSV
    csv_path = os.path.join("data", "oil_safety_reports.csv")
    fieldnames = list(dataset[0].keys())
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(dataset)
    print(f"[SUCCESS] Saved CSV dataset to {csv_path}")

    # Print Summary Statistics
    total = len(dataset)
    sif_count = sum(1 for d in dataset if d["sif_potential"] == 1)
    non_sif_count = total - sif_count
    sif_pct = (sif_count / total) * 100
    
    print("\n==============================================")
    print("      OIL INDIA LIMITED SAFETY DATASET SUMMARY ")
    print("==============================================")
    print(f"Total Safety Reports: {total}")
    print(f"SIF-Potential Reports (1): {sif_count} ({sif_pct:.1f}%) [DEKRA/VelocityEHS 20-25% Target Benchmark]")
    print(f"Non-SIF Reports (0):        {non_sif_count} ({100 - sif_pct:.1f}%)")
    
    print("\n--- Breakdown by IOGP Life-Saving Rules ---")
    lsr_counts = {}
    for d in dataset:
        lsr = d["iogp_life_saving_rule"]
        lsr_counts[lsr] = lsr_counts.get(lsr, 0) + 1
    for k, v in sorted(lsr_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  * {k:30s}: {v:2d} reports ({v/total*100:4.1f}%)")

    print("\n--- Breakdown by SIF Potential per Site ---")
    site_sif = {}
    for d in dataset:
        s = d["site_location"]
        if s not in site_sif:
            site_sif[s] = {"total": 0, "sif": 0}
        site_sif[s]["total"] += 1
        if d["sif_potential"] == 1:
            site_sif[s]["sif"] += 1
            
    for site, counts in sorted(site_sif.items(), key=lambda x: (x[1]["sif"]/x[1]["total"] if x[1]["total"] else 0), reverse=True):
        density = (counts["sif"] / counts["total"]) * 100 if counts["total"] else 0
        print(f"  * {site:45s}: {counts['sif']:2d}/{counts['total']:2d} SIF ({density:5.1f}% SIF Density)")
