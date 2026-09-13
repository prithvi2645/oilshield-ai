import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_hex)
    tcPr.append(shd)

def generate_docx():
    doc = docx.Document()
    
    # Page Margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Title Header
    title = doc.add_paragraph()
    p_run = title.add_run("Oil India Limited — HSSE SIF Platform Implementation Report")
    p_run.font.name = "Arial"
    p_run.font.size = Pt(20)
    p_run.font.bold = True
    p_run.font.color.rgb = RGBColor(15, 23, 42) # Slate dark

    sub = doc.add_paragraph()
    s_run = sub.add_run("Enterprise AI-driven Incident Classification, Precursor Risk Analytics, Safety Knowledge Graph, and Compliance Enforcement System\nAligned with OISD-STD-105, DGMS OMR 2017, and IOGP Life-Saving Rules")
    s_run.font.name = "Arial"
    s_run.font.size = Pt(11)
    s_run.font.italic = True
    s_run.font.color.rgb = RGBColor(71, 85, 105)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # Meta Table
    meta_table = doc.add_table(rows=4, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        ("Target Organization", "Oil India Limited (HSSE Department)"),
        ("Project Status", "Fully Implemented, Verified, & Pushed to Private GitHub Repository"),
        ("Private Repository", "https://github.com/prithvi2645/sih-hsse-platform"),
        ("Operational Coverage", "12+ Oil India Installations (Baghjan, Duliajan, Digboi, Moran)")
    ]
    for i, (k, v) in enumerate(meta_data):
        cell_k = meta_table.cell(i, 0)
        cell_v = meta_table.cell(i, 1)
        cell_k.text = k
        cell_v.text = v
        set_cell_background(cell_k, "F1F5F9")
        cell_k.paragraphs[0].runs[0].font.bold = True
        cell_k.paragraphs[0].runs[0].font.size = Pt(9.5)
        cell_v.paragraphs[0].runs[0].font.size = Pt(9.5)

    doc.add_paragraph().paragraph_format.space_after = Pt(16)

    def add_h2(text):
        h = doc.add_paragraph()
        r = h.add_run(text)
        r.font.name = "Arial"
        r.font.size = Pt(14)
        r.font.bold = True
        r.font.color.rgb = RGBColor(217, 119, 6) # Amber Accent
        h.paragraph_format.space_before = Pt(14)
        h.paragraph_format.space_after = Pt(6)

    def add_h3(text):
        h = doc.add_paragraph()
        r = h.add_run(text)
        r.font.name = "Arial"
        r.font.size = Pt(12)
        r.font.bold = True
        r.font.color.rgb = RGBColor(30, 41, 59)
        h.paragraph_format.space_before = Pt(10)
        h.paragraph_format.space_after = Pt(4)

    def add_p(text):
        p = doc.add_paragraph()
        r = p.add_run(text)
        r.font.name = "Arial"
        r.font.size = Pt(10.5)
        r.font.color.rgb = RGBColor(51, 65, 85)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.15
        return p

    def add_bullet(bold_prefix, text):
        p = doc.add_paragraph(style='List Bullet')
        r1 = p.add_run(bold_prefix)
        r1.font.name = "Arial"
        r1.font.size = Pt(10)
        r1.font.bold = True
        r1.font.color.rgb = RGBColor(15, 23, 42)
        
        r2 = p.add_run(text)
        r2.font.name = "Arial"
        r2.font.size = Pt(10)
        r2.font.color.rgb = RGBColor(51, 65, 85)
        p.paragraph_format.space_after = Pt(4)

    # Section 1
    add_h2("1. Executive Overview")
    add_p("In upstream oil and gas operations—spanning drilling rigs, gas gathering stations, refineries, and high-pressure cross-country pipelines—traditional safety tracking often struggles to separate high-consequence Serious Injury & Fatality (SIF) precursors from routine low-severity observations.")
    add_p("This platform provides an end-to-end artificial intelligence and data-driven triage solution developed for Oil India Limited (HSSE Department). Built with a zero-external-framework Python server and offline-first ML models, it automatically ingests field safety reports (in English, Hindi, Hinglish, or Assamese regional terms), evaluates energy pathway hazards, checks safety barrier health, flags IOGP Life-Saving Rule violations, builds interactive safety knowledge graphs, and forecasts temporal risk trends across 12+ Oil India operational installations.")

    # Section 2
    add_h2("2. Summary of Implemented Features & Core Novelties")
    
    add_h3("Feature 1: AI Incident Classifier & SIF Precursor Triage")
    add_bullet("Domain NLP Tokenizer: ", "Ingests technical oilfield jargon (BOP, flare stack, wellhead pressure, H2S sensors, wireline) and normalizes mixed Hinglish/Assamese field inputs.")
    add_bullet("Dual ML Engine: ", "Binary classification model for SIF precursor detection and multi-class model for predicting 10 IOGP Life-Saving Rules.")
    add_bullet("Numeric SIF Scoring: ", "Outputs a 0–100% SIF risk probability index and automated audit rationale with OISD action recommendations.")

    add_h3("Feature 2: Safety Relationship Map (D3.js Knowledge Graph)")
    add_bullet("Graph Extraction API: ", "Dynamically extracts graph nodes and link edges linking Activity -> Hazard -> Barrier -> IOGP Rule -> Consequence.")
    add_bullet("Interactive D3.js Renderer: ", "Interactive force-directed graph with node filtering, search, physics freeze controls, and node-dragging mechanics.")

    add_h3("Feature 3: Historical Similar Incident Retrieval Engine")
    add_bullet("Cosine Similarity Search: ", "Pre-computes TF-IDF vector matrix over 500+ historical safety observations.")
    add_bullet("Near-Miss Retrieval: ", "Instant search returning top historical matching incidents, past barrier failures, and previously applied corrective measures.")

    add_h3("Feature 4: Temporal Risk Forecasting & KPI Dashboard")
    add_bullet("Polyfit Trend Extrapolation: ", "Polynomial regression calculating 30-day and 60-day projected SIF precursor rates.")
    add_bullet("Real-Time Visualizations: ", "Interactive charts for Monthly Trends, Hazard Breakdown, Barrier Conditions, and Severity Donut Chart.")

    add_h3("Feature 5: Hierarchy of Controls Remediation Engine")
    add_bullet("5-Tier Categorization: ", "Automatically maps incident risks into Elimination, Substitution, Engineering Controls, Administrative Controls, and PPE.")

    add_h3("Feature 6: Multilingual & Hinglish Incident Text Normalization")
    add_bullet("Mixed Language Processing: ", "Handles mixed field text (English, Hindi, Hinglish, Assamese terms), converting colloquial technical entries into normalized tokens.")

    add_h3("Feature 7: Role-Based Access Control (RBAC) System")
    add_bullet("Enterprise Roles: ", "Configured for HSE Manager, Site Manager, Field Supervisor, and Safety Analyst with scoped permissions.")

    add_h3("Feature 8: Multi-Site Hero Carousel & Visual Monitoring")
    add_bullet("Auto-Rotating Hero Slideshow: ", "2.5-second rotation speed with smooth 0.45s fade transitions across Baghjan Field #5, Duliajan GGS, Digboi Refinery, and Moran OCS Station.")

    add_h3("Feature 9: UTF-8 Excel-Compatible Data Export")
    add_bullet("One-Click CSV Export: ", "Serves safety report records with embedded UTF-8 Byte Order Mark (BOM), enabling Microsoft Excel on Windows to natively open columns cleanly.")

    # Section 3: API Table
    add_h2("3. REST API Specifications")
    api_table = doc.add_table(rows=8, cols=3)
    api_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers = ["Method", "Endpoint", "Description"]
    for j, h_text in enumerate(headers):
        cell = api_table.cell(0, j)
        cell.text = h_text
        set_cell_background(cell, "0F172A")
        cell.paragraphs[0].runs[0].font.bold = True
        cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
        cell.paragraphs[0].runs[0].font.size = Pt(9.5)

    api_routes = [
        ("GET", "/", "Serves main Single-Page Application (public/index.html)"),
        ("POST", "/api/classify", "Runs ML inference for SIF risk, IOGP rule & corrective actions"),
        ("POST", "/api/similar", "Executes TF-IDF cosine similarity search for near-miss retrieval"),
        ("GET", "/api/analytics", "Serves KPI summaries, hazard distributions & polyfit risk forecast"),
        ("GET", "/api/knowledge-graph", "Serves D3 graph nodes & link relationship edges"),
        ("GET", "/api/reports", "Serves safety observation records"),
        ("GET", "/api/export", "Serves UTF-8 BOM encoded CSV download for Microsoft Excel")
    ]
    for row_idx, data in enumerate(api_routes, start=1):
        for col_idx, text in enumerate(data):
            cell = api_table.cell(row_idx, col_idx)
            cell.text = text
            cell.paragraphs[0].runs[0].font.size = Pt(9)
            if row_idx % 2 == 0:
                set_cell_background(cell, "F8FAFC")

    # Section 4: Repository Structure
    add_h2("4. Architecture & Repository Layout")
    add_p("The project follows a clean, modular enterprise directory architecture:")
    
    struct_table = doc.add_table(rows=9, cols=2)
    struct_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    struct_headers = ["Module / Path", "Technical Purpose"]
    for j, h_text in enumerate(struct_headers):
        cell = struct_table.cell(0, j)
        cell.text = h_text
        set_cell_background(cell, "1E293B")
        cell.paragraphs[0].runs[0].font.bold = True
        cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
        cell.paragraphs[0].runs[0].font.size = Pt(9.5)

    modules_data = [
        ("app/server.py", "HTTP server & REST API handlers (built on Python native http.server)"),
        ("data/", "Primary dataset of 500+ observations, OSHA SIF train/test splits, processor"),
        ("models/", "Joblib binaries for binary SIF model, multi-class IOGP model & vectorizer"),
        ("public/", "Single-Page Application frontend (index.html, styles.css, app.js, images)"),
        ("src/sif_engine.py", "SIF precursor calculation & numeric risk scoring algorithm"),
        ("src/nlp_engine.py", "SafetyClassifierPipeline ML wrapper & text normalizer"),
        ("src/domain_tokenizer.py", "Oilfield vocabulary dictionary & Hinglish tokenizer"),
        ("src/train.py & tuning", "Model training, hyperparameter tuning & evaluation scripts")
    ]
    for row_idx, data in enumerate(modules_data, start=1):
        for col_idx, text in enumerate(data):
            cell = struct_table.cell(row_idx, col_idx)
            cell.text = text
            cell.paragraphs[0].runs[0].font.size = Pt(9)
            if row_idx % 2 == 0:
                set_cell_background(cell, "F8FAFC")

    # Section 5: GitHub Setup
    add_h2("5. Private GitHub Repository & Team Setup")
    add_bullet("Repository Visibility: ", "Private repository created at https://github.com/prithvi2645/sih-hsse-platform.")
    add_bullet("Collaborator Workflow: ", "Teammates invited via GitHub Collaborators with write permissions.")
    add_bullet("Branching & Safety: ", "Feature branch pattern (feature/<name>) with PR reviews. Safe push flag --force-with-lease enforced.")

    docx_path = "d:\\sih\\Oil_India_HSSE_Platform_Report.docx"
    doc.save(docx_path)
    print(f"[SUCCESS] DOCX generated: {docx_path}")

def generate_pdf():
    pdf_path = "d:\\sih\\Oil_India_HSSE_Platform_Report.pdf"
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54, rightMargin=54,
        topMargin=54, bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Palette
    c_primary = colors.HexColor("#0F172A")
    c_amber   = colors.HexColor("#D97706")
    c_text    = colors.HexColor("#334155")
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=c_primary,
        spaceAfter=6
    )
    
    sub_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#475569"),
        spaceAfter=14
    )

    h2_style = ParagraphStyle(
        'H2Style',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=c_amber,
        spaceBefore=12,
        spaceAfter=6
    )

    h3_style = ParagraphStyle(
        'H3Style',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=13,
        textColor=c_primary,
        spaceBefore=8,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13,
        textColor=c_text,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'BulletStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12.5,
        textColor=c_text,
        leftIndent=15,
        spaceAfter=3
    )

    story = []

    story.append(Paragraph("Oil India Limited — HSSE SIF Platform Implementation Report", title_style))
    story.append(Paragraph("Enterprise AI-driven Incident Classification, Precursor Risk Analytics, Safety Knowledge Graph, and Compliance Enforcement System<br/>Aligned with OISD-STD-105, DGMS OMR 2017, and IOGP Life-Saving Rules", sub_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=12))

    # Meta table
    meta_data = [
        [Paragraph("<b>Target Organization</b>", body_style), Paragraph("Oil India Limited (HSSE Department)", body_style)],
        [Paragraph("<b>Project Status</b>", body_style), Paragraph("Fully Implemented, Verified, & Pushed to Private GitHub Repository", body_style)],
        [Paragraph("<b>Private Repository</b>", body_style), Paragraph("https://github.com/prithvi2645/sih-hsse-platform", body_style)],
        [Paragraph("<b>Operational Coverage</b>", body_style), Paragraph("12+ Oil India Installations (Baghjan, Duliajan, Digboi, Moran)", body_style)]
    ]
    t_meta = Table(meta_data, colWidths=[140, 360])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#F1F5F9")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 10))

    # Section 1
    story.append(Paragraph("1. Executive Overview", h2_style))
    story.append(Paragraph("In upstream oil and gas operations—spanning drilling rigs, gas gathering stations, refineries, and high-pressure cross-country pipelines—traditional safety tracking often struggles to separate high-consequence Serious Injury & Fatality (SIF) precursors from routine low-severity observations.", body_style))
    story.append(Paragraph("This platform provides an end-to-end artificial intelligence and data-driven triage solution developed for Oil India Limited (HSSE Department). Built with a zero-external-framework Python server and offline-first ML models, it automatically ingests field safety reports (in English, Hindi, Hinglish, or Assamese regional terms), evaluates energy pathway hazards, checks safety barrier health, flags IOGP Life-Saving Rule violations, builds interactive safety knowledge graphs, and forecasts temporal risk trends across 12+ Oil India operational installations.", body_style))

    # Section 2
    story.append(Paragraph("2. Summary of Implemented Features & Core Novelties", h2_style))
    
    features = [
        ("Feature 1: AI Incident Classifier & SIF Precursor Triage", [
            "<b>Domain NLP Tokenizer:</b> Ingests technical oilfield jargon (BOP, flare stack, wellhead pressure, H2S sensors, wireline) and normalizes mixed Hinglish/Assamese field inputs.",
            "<b>Dual ML Engine:</b> Binary classification model for SIF precursor detection and multi-class model predicting 10 IOGP Life-Saving Rules.",
            "<b>Numeric SIF Scoring:</b> Outputs a 0–100% SIF probability index and automated audit rationale with OISD recommendations."
        ]),
        ("Feature 2: Safety Relationship Map (D3.js Knowledge Graph)", [
            "<b>Graph Extraction API:</b> Dynamically extracts nodes and edges linking Activity -> Hazard -> Barrier -> IOGP Rule -> Consequence.",
            "<b>Interactive D3.js Renderer:</b> Force-directed topology map with node filtering, search, physics freeze controls, and node-dragging mechanics."
        ]),
        ("Feature 3: Historical Similar Incident Retrieval Engine", [
            "<b>Cosine Similarity Search:</b> Pre-computes TF-IDF vector matrix over 500+ historical safety observations.",
            "<b>Near-Miss Retrieval:</b> Instant search returning top matching incidents, past barrier failures, and previously applied corrective measures."
        ]),
        ("Feature 4: Temporal Risk Forecasting & KPI Dashboard", [
            "<b>Polyfit Trend Extrapolation:</b> Polynomial regression calculating 30-day and 60-day projected SIF precursor rates.",
            "<b>Real-Time Visualizations:</b> Interactive charts for Monthly Trends, Hazard Breakdown, Barrier Conditions, and Severity Donut Chart."
        ]),
        ("Feature 5: Hierarchy of Controls Remediation Engine", [
            "<b>5-Tier Categorization:</b> Automatically maps incident risks into Elimination, Substitution, Engineering Controls, Administrative Controls, and PPE."
        ]),
        ("Feature 6: Multilingual & Hinglish Text Processing", [
            "<b>Mixed Language Processing:</b> Handles mixed field text (English, Hindi, Hinglish, Assamese terms), converting colloquial technical entries into normalized tokens."
        ]),
        ("Feature 7: Role-Based Access Control (RBAC) System", [
            "<b>Enterprise Roles:</b> Configured for HSE Manager, Site Manager, Field Supervisor, and Safety Analyst with scoped permissions."
        ]),
        ("Feature 8: Multi-Site Hero Carousel & Visual Monitoring", [
            "<b>Auto-Rotating Hero Slideshow:</b> 2.5-second rotation speed with smooth 0.45s fade transitions across Baghjan Field #5, Duliajan GGS, Digboi Refinery, and Moran OCS Station."
        ]),
        ("Feature 9: UTF-8 Excel-Compatible Data Export", [
            "<b>One-Click CSV Export:</b> Serves safety report records with embedded UTF-8 Byte Order Mark (BOM), enabling Microsoft Excel to natively open columns cleanly."
        ])
    ]

    for title, bullets in features:
        story.append(Paragraph(title, h3_style))
        for b in bullets:
            story.append(Paragraph(f"• {b}", bullet_style))

    # Section 3
    story.append(Paragraph("3. REST API Specifications", h2_style))
    api_headers = [Paragraph("<b>Method</b>", body_style), Paragraph("<b>Endpoint</b>", body_style), Paragraph("<b>Description</b>", body_style)]
    api_rows = [
        [Paragraph("GET", body_style), Paragraph("/", body_style), Paragraph("Serves main Single-Page Application (public/index.html)", body_style)],
        [Paragraph("POST", body_style), Paragraph("/api/classify", body_style), Paragraph("Runs ML inference for SIF risk, IOGP rule & corrective actions", body_style)],
        [Paragraph("POST", body_style), Paragraph("/api/similar", body_style), Paragraph("Executes TF-IDF cosine similarity search for near-miss retrieval", body_style)],
        [Paragraph("GET", body_style), Paragraph("/api/analytics", body_style), Paragraph("Serves KPI summaries, hazard distributions & polyfit risk forecast", body_style)],
        [Paragraph("GET", body_style), Paragraph("/api/knowledge-graph", body_style), Paragraph("Serves D3 graph nodes & link relationship edges", body_style)],
        [Paragraph("GET", body_style), Paragraph("/api/reports", body_style), Paragraph("Serves safety observation records", body_style)],
        [Paragraph("GET", body_style), Paragraph("/api/export", body_style), Paragraph("Serves UTF-8 BOM encoded CSV download for Microsoft Excel", body_style)]
    ]
    t_api = Table([api_headers] + api_rows, colWidths=[50, 110, 340])
    t_api.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F172A")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_api)

    story.append(Spacer(1, 10))
    story.append(Paragraph("4. Private GitHub Repository & Team Setup", h2_style))
    story.append(Paragraph("• <b>Repository:</b> Private repository at https://github.com/prithvi2645/sih-hsse-platform", bullet_style))
    story.append(Paragraph("• <b>Collaboration:</b> Teammates invited via GitHub Collaborators with write permissions.", bullet_style))
    story.append(Paragraph("• <b>Branching:</b> Feature branch pattern (feature/<name>) with PR reviews. Safe push flag --force-with-lease enforced.", bullet_style))

    doc.build(story)
    print(f"[SUCCESS] PDF generated: {pdf_path}")

if __name__ == "__main__":
    generate_docx()
    generate_pdf()
