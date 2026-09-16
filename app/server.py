import os
import re
import sys
import json
import tempfile
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("src"))

try:
    from src.nlp_engine import SafetyClassifierPipeline
except ModuleNotFoundError:
    from nlp_engine import SafetyClassifierPipeline

from sklearn.metrics.pairwise import cosine_similarity

REPORT_COLUMNS = [
    "report_id",
    "date",
    "site_location",
    "department",
    "report_type",
    "report_title",
    "description",
    "sif_potential",
    "sif_severity_score",
    "iogp_life_saving_rule",
    "barrier_failure_type",
    "precursor_pattern",
    "activity_being_performed",
    "immediate_corrective_action",
]

REPORT_TYPES = {"Unsafe Act", "Unsafe Condition", "Near Miss", "Incident Report"}
REQUIRED_REPORT_FIELDS = {
    "date",
    "site_location",
    "department",
    "report_type",
    "report_title",
    "description",
    "activity_being_performed",
}
MAX_REPORT_FIELD_LENGTH = 2000
SUBMITTED_REPORTS_METADATA_FILE = os.path.abspath("data/submitted_reports_metadata.json")

def load_submitted_reports_metadata():
    if os.path.isfile(SUBMITTED_REPORTS_METADATA_FILE):
        try:
            with open(SUBMITTED_REPORTS_METADATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception:
            pass

    metadata = {}
    csv_path = os.path.abspath("data/oil_safety_reports.csv")
    if os.path.isfile(csv_path):
        try:
            df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
            baseline_path = os.path.abspath("public/data/oil_safety_reports.csv")
            historical_ids = set()
            if os.path.isfile(baseline_path):
                b_df = pd.read_csv(baseline_path, dtype=str, keep_default_na=False)
                historical_ids = set(b_df["report_id"].astype(str))
            else:
                historical_ids = {f"OIL-HSE-2025-{i}" for i in range(1001, 1501)}

            for r_id in df["report_id"].astype(str):
                if r_id and r_id not in historical_ids:
                    metadata[r_id] = {
                        "report_id": r_id,
                        "created_via": "new_report_submission",
                        "is_new_submission": True,
                    }
        except Exception:
            pass

    save_submitted_reports_metadata(metadata)
    return metadata

def save_submitted_reports_metadata(metadata):
    temp_path = None
    try:
        os.makedirs(os.path.dirname(SUBMITTED_REPORTS_METADATA_FILE), exist_ok=True)
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            suffix=".json",
            dir=os.path.dirname(SUBMITTED_REPORTS_METADATA_FILE),
            delete=False,
        ) as temp_file:
            temp_path = temp_file.name
            json.dump(metadata, temp_file, indent=2)
        os.replace(temp_path, SUBMITTED_REPORTS_METADATA_FILE)
        temp_path = None
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

def is_newly_submitted_report(report_id, row=None):
    if not report_id:
        return False
    if row is not None:
        if "is_new_submission" in row and str(row["is_new_submission"]).strip().lower() in {"1", "true", "yes"}:
            return True
    metadata = load_submitted_reports_metadata()
    return report_id in metadata

# Initialize AI Pipeline & Pre-compute Dataset Vectors for Similarity Search
pipeline = SafetyClassifierPipeline()
pipeline.train("data/oil_safety_reports.csv")

dataset_df = None
dataset_vectors = None

def init_dataset_search():
    global dataset_df, dataset_vectors
    csv_path = "data/oil_safety_reports.csv"
    if os.path.exists(csv_path):
        dataset_df = pd.read_csv(csv_path)
        descriptions = dataset_df['description'].fillna("").tolist()
        if pipeline.vectorizer:
            norm_texts = [pipeline.domain_tokenizer.normalize(txt)[0] for txt in descriptions]
            dataset_vectors = pipeline.vectorizer.transform(norm_texts)
            print(f"[SUCCESS] Pre-computed TF-IDF similarity matrix for {len(descriptions)} reports.")

init_dataset_search()

class SafetyDashboardHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        req_path = parsed_path.path
        
        if req_path == "/api/reports":
            self.send_json_response(self.get_reports())
        elif req_path == "/api/analytics":
            self.send_json_response(self.get_analytics())
        elif req_path == "/api/knowledge-graph":
            self.send_json_response(self.get_knowledge_graph())
        elif req_path == "/api/recurring-precursors":
            self.send_json_response(self.get_recurring_precursors())
        elif req_path == "/api/predictive-risk":
            self.send_json_response(self.get_predictive_risk())
        elif req_path == "/api/hse-summary":
            self.send_json_response(self.get_hse_summary())
        elif req_path in ["/data/oil_safety_reports.csv", "/api/export", "/export", "/api/export-csv", "/download-csv"]:
            self.serve_csv_download()
        else:
            clean_path = urllib.parse.unquote(req_path.lstrip("/")).replace("/", os.sep)
            if not clean_path or clean_path == "index.html":
                local_file = os.path.normpath(os.path.join("public", "index.html"))
                mime = "text/html"
            else:
                local_file = os.path.normpath(os.path.join("public", clean_path))
                if req_path.lower().endswith(".css"):
                    mime = "text/css"
                elif req_path.lower().endswith(".js"):
                    mime = "application/javascript"
                elif req_path.lower().endswith(".csv"):
                    mime = "text/csv"
                elif req_path.lower().endswith(".png"):
                    mime = "image/png"
                elif req_path.lower().endswith(".jpg") or req_path.lower().endswith(".jpeg"):
                    mime = "image/jpeg"
                elif req_path.lower().endswith(".svg"):
                    mime = "image/svg+xml"
                elif req_path.lower().endswith(".webp"):
                    mime = "image/webp"
                else:
                    mime = "application/octet-stream"
            
            self.serve_file(local_file, mime)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/classify":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            try:
                data = json.loads(post_data)
                text = data.get("text", "")
                result = pipeline.predict(text)
                self.send_json_response(result)
            except Exception as e:
                self.send_json_response({"error": str(e)}, status=400)
        elif self.path == "/api/similar-retrieval":
            try:
                data = self.read_json_body()
                text = data.get("text", "")
                matches = self.get_similar_reports(text, top_k=4)
                self.send_json_response({"query": text, "similar_retrieval": matches})
            except Exception as e:
                self.send_json_response({"error": str(e)}, status=400)
        elif self.path == "/api/simulate-safety":
            try:
                data = self.read_json_body()
                text = data.get("text", "Workover operations at Baghjan high pressure line")
                barrier = data.get("barrier_removed", "loto")
                try:
                    from src.sif_engine import simulate_barrier_impact
                except ModuleNotFoundError:
                    from sif_engine import simulate_barrier_impact
                res = simulate_barrier_impact(text, barrier)
                self.send_json_response(res)
            except Exception as e:
                self.send_json_response({"error": str(e)}, status=400)
        elif self.path == "/api/enhance-narrative":
            try:
                data = self.read_json_body()
                text = data.get("text", "")
                res = pipeline.enhance_report_narrative(text)
                self.send_json_response(res)
            except Exception as e:
                self.send_json_response({"error": str(e)}, status=400)
        elif self.path == "/api/hse-ask":
            try:
                data = self.read_json_body()
                query = data.get("query", "")
                res = self.get_hse_ask_answer(query)
                self.send_json_response(res)
            except Exception as e:
                self.send_json_response({"error": str(e)}, status=400)
        elif self.path == "/api/reports":
            try:
                data = self.read_json_body()
                created_report, analysis = self.create_report(data)
                self.send_json_response({
                    "success": True,
                    "report": created_report,
                    "analysis": analysis,
                }, status=201)
            except ValueError as e:
                self.send_json_response({"error": str(e)}, status=400)
            except Exception as e:
                self.send_json_response({"error": f"Unable to save report: {e}"}, status=500)
        elif re.fullmatch(r"/api/reports/([^/]+)", self.path):
            match = re.fullmatch(r"/api/reports/([^/]+)", self.path)
            url_report_id = match.group(1)
            try:
                data = self.read_json_body()
                updated_report, analysis = self.update_report(url_report_id, data)
                self.send_json_response({
                    "success": True,
                    "report": updated_report,
                    "analysis": analysis,
                }, status=200)
            except LookupError as e:
                self.send_json_response({"error": str(e)}, status=404)
            except PermissionError as e:
                self.send_json_response({"error": str(e)}, status=403)
            except ValueError as e:
                self.send_json_response({"error": str(e)}, status=400)
            except Exception as e:
                self.send_json_response({"error": f"Unable to update report: {e}"}, status=500)
        elif self.path == "/api/similar":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(post_data)
                text = data.get("text", "")
                similar_reports = self.get_similar_reports(text)
                self.send_json_response(similar_reports)
            except Exception as e:
                self.send_json_response({"error": str(e)}, status=400)
        else:
            self.send_error(404, "Endpoint not found")

    def do_PUT(self):
        parsed_path = urllib.parse.urlparse(self.path)
        req_path = parsed_path.path

        match = re.fullmatch(r"/api/reports(?:/([^/]+))?", req_path)
        if match:
            url_report_id = match.group(1)
            try:
                data = self.read_json_body()
                report_id = url_report_id or data.get("report_id") or data.get("edit_report_id")
                if not report_id:
                    self.send_json_response({"error": "Report ID is required."}, status=400)
                    return
                updated_report, analysis = self.update_report(report_id, data)
                self.send_json_response({
                    "success": True,
                    "report": updated_report,
                    "analysis": analysis,
                }, status=200)
            except LookupError as e:
                self.send_json_response({"error": str(e)}, status=404)
            except PermissionError as e:
                self.send_json_response({"error": str(e)}, status=403)
            except ValueError as e:
                self.send_json_response({"error": str(e)}, status=400)
            except Exception as e:
                self.send_json_response({"error": f"Unable to update report: {e}"}, status=500)
        else:
            self.send_error(404, "Endpoint not found")

    def do_DELETE(self):
        parsed_path = urllib.parse.urlparse(self.path)
        req_path = parsed_path.path

        match = re.fullmatch(r"/api/reports/([^/]+)", req_path)
        if match:
            report_id = match.group(1)
            try:
                result = self.delete_report(report_id)
                self.send_json_response(result, status=200)
            except LookupError as e:
                self.send_json_response({"error": str(e)}, status=404)
            except PermissionError as e:
                self.send_json_response({"error": str(e)}, status=403)
            except ValueError as e:
                self.send_json_response({"error": str(e)}, status=400)
            except Exception as e:
                self.send_json_response({"error": f"Unable to delete report: {e}"}, status=500)
        else:
            self.send_error(404, "Endpoint not found")

    def read_json_body(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
        except (TypeError, ValueError):
            raise ValueError("Invalid Content-Length header.")

        if content_length <= 0:
            raise ValueError("Request body is required.")
        if content_length > 100_000:
            raise ValueError("Request body is too large.")

        try:
            post_data = self.rfile.read(content_length).decode("utf-8")
            data = json.loads(post_data)
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ValueError("Request body must contain valid UTF-8 JSON.")

        if not isinstance(data, dict):
            raise ValueError("Request body must be a JSON object.")
        return data

    def create_report(self, data):
        if not REQUIRED_REPORT_FIELDS.issubset(data):
            missing = sorted(REQUIRED_REPORT_FIELDS - set(data))
            raise ValueError(f"Missing required fields: {', '.join(missing)}")

        report = {}
        for field in REPORT_COLUMNS:
            if field in {"report_id", "sif_potential", "sif_severity_score", "iogp_life_saving_rule"}:
                continue
            value = data.get(field, "")
            if not isinstance(value, str):
                raise ValueError(f"Field '{field}' must be text.")
            value = value.strip()
            if field in REQUIRED_REPORT_FIELDS and not value:
                raise ValueError(f"Field '{field}' cannot be empty.")
            if len(value) > MAX_REPORT_FIELD_LENGTH:
                raise ValueError(f"Field '{field}' is too long.")
            report[field] = value

        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", report["date"]):
            raise ValueError("Field 'date' must use YYYY-MM-DD format.")
        try:
            pd.to_datetime(report["date"], format="%Y-%m-%d", errors="raise")
        except (TypeError, ValueError):
            raise ValueError("Field 'date' must be a valid calendar date.")
        if report["report_type"] not in REPORT_TYPES:
            raise ValueError("Field 'report_type' must be an existing report type.")

        csv_path = os.path.abspath("data/oil_safety_reports.csv")
        if not os.path.isfile(csv_path):
            raise ValueError("Safety report dataset was not found.")

        current_df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
        if list(current_df.columns) != REPORT_COLUMNS:
            raise ValueError("Safety report CSV schema does not match the expected columns.")

        original_ids = set(current_df["report_id"].astype(str))
        id_matches = [
            re.fullmatch(r"(.+?)(\d+)$", report_id)
            for report_id in original_ids
        ]
        if not id_matches or any(match is None for match in id_matches):
            raise ValueError("Existing report IDs do not use a supported format.")

        prefix = id_matches[0].group(1)
        if any(match.group(1) != prefix for match in id_matches):
            raise ValueError("Existing report IDs use inconsistent prefixes.")

        next_suffix = max(int(match.group(2)) for match in id_matches) + 1
        new_id = f"{prefix}{next_suffix:04d}"
        if new_id in original_ids:
            raise ValueError("Generated report ID already exists.")

        analysis = pipeline.predict(report["description"])
        if not isinstance(analysis, dict) or analysis.get("error"):
            raise ValueError(analysis.get("error", "AI analysis did not return a valid result."))

        report["report_id"] = new_id
        report["sif_potential"] = str(int(analysis.get("sif_potential", 0)))
        report["sif_severity_score"] = str(float(analysis.get("sif_confidence", 0.0)))
        report["iogp_life_saving_rule"] = str(analysis.get("iogp_life_saving_rule", "None / Housekeeping"))

        new_row = pd.DataFrame([[report[column] for column in REPORT_COLUMNS]], columns=REPORT_COLUMNS)
        updated_df = pd.concat([current_df, new_row], ignore_index=True)
        if len(updated_df) != len(current_df) + 1:
            raise ValueError("Report row-count validation failed.")
        if not set(current_df["report_id"]).issubset(set(updated_df["report_id"])):
            raise ValueError("Existing report ID preservation check failed.")
        if updated_df["report_id"].duplicated().any():
            raise ValueError("Report ID uniqueness check failed.")

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                newline="",
                suffix=".csv",
                dir=os.path.dirname(csv_path),
                delete=False,
            ) as temp_file:
                temp_path = temp_file.name
                updated_df.to_csv(temp_file, index=False)

            written_df = pd.read_csv(temp_path, dtype=str, keep_default_na=False)
            if list(written_df.columns) != REPORT_COLUMNS or len(written_df) != len(updated_df):
                raise ValueError("Written CSV validation failed.")
            os.replace(temp_path, csv_path)
            temp_path = None
        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)

        metadata = load_submitted_reports_metadata()
        metadata[new_id] = {
            "report_id": new_id,
            "created_at": pd.Timestamp.now().isoformat(),
            "is_new_submission": True,
        }
        save_submitted_reports_metadata(metadata)

        init_dataset_search()
        result_report = {column: report[column] for column in REPORT_COLUMNS}
        result_report["is_new_submission"] = True
        result_report["can_edit"] = True
        return result_report, analysis

    def get_hse_ask_answer(self, query):
        q = str(query).strip().lower()
        csv_path = os.path.abspath("data/oil_safety_reports.csv")
        if not os.path.exists(csv_path):
            return {"answer": "Safety reports database not found.", "evidence_table": []}

        try:
            df = pd.read_csv(csv_path, dtype=str)
        except Exception as e:
            return {"answer": f"Error reading safety database: {e}", "evidence_table": []}

        df['sif_potential_int'] = df['sif_potential'].apply(lambda x: 1 if str(x).strip() in ['1', 'true', 'True'] else 0)
        df['score_float'] = df['sif_severity_score'].apply(lambda x: float(x) if str(x).replace('.', '', 1).isdigit() else 0.0)

        total = len(df)
        sif_cnt = int(df['sif_potential_int'].sum())
        sif_pct = round((sif_cnt / total) * 100, 1) if total > 0 else 0.0

        # Department intent
        depts = ['drilling', 'workover', 'pipeline', 'mechanical', 'civil', 'logistics', 'electrical', 'refinery', 'hse', 'fire']
        matched_dept = [d for d in depts if d in q]

        # Report type intent
        types = ['unsafe act', 'unsafe condition', 'near miss', 'incident report']
        matched_type = [t for t in types if t in q]

        # Site intent
        sites = ['baghjan', 'makum', 'digboi', 'jorhat', 'duliajan', 'moran', 'rajasthan', 'lpg', 'sekerkote']
        matched_site = [s for s in sites if s in q]

        # Specific keywords intent
        keywords = ['pressure', 'leak', 'h2s', 'gas', 'fire', 'ladder', 'wrench', 'crane', 'valve', 'pipe', 'glove', 'flange', 'vehicle', 'truck', 'slop tank', 'splinter', 'sign', 'battery', 'cable', 'wire', 'hot work', 'confined space', 'driving', 'line of fire', 'working at height', 'lockout', 'tagout', 'lifting']
        matched_keywords = [k for k in keywords if k in q]

        if matched_dept:
            dept_key = matched_dept[0]
            sub_df = df[df['department'].str.lower().str.contains(dept_key, na=False)]
            d_total = len(sub_df)
            d_sif = int(sub_df['sif_potential_int'].sum())
            d_rate = round((d_sif / d_total) * 100, 1) if d_total > 0 else 0.0
            top_lsr = sub_df['iogp_life_saving_rule'].mode().iloc[0] if len(sub_df) > 0 else "None / Housekeeping"

            table = sub_df[['report_id', 'site_location', 'report_type', 'report_title', 'sif_severity_score', 'iogp_life_saving_rule']].head(6).to_dict(orient='records')
            dept_name = sub_df['department'].iloc[0] if len(sub_df) > 0 else dept_key.capitalize()

            return {
                "answer": f"Analysis for <strong>{dept_name}</strong>: Found <strong>{d_total} logged safety observations</strong> including <strong>{d_sif} SIF Precursors ({d_rate}% SIF Rate)</strong>. Most frequent IOGP Rule breached: <strong>{top_lsr}</strong>.",
                "evidence_table": table
            }

        elif matched_type:
            type_key = matched_type[0]
            sub_df = df[df['report_type'].str.lower().str.contains(type_key, na=False)]
            t_total = len(sub_df)
            t_sif = int(sub_df['sif_potential_int'].sum())
            t_rate = round((t_sif / t_total) * 100, 1) if t_total > 0 else 0.0

            table = sub_df[['report_id', 'site_location', 'department', 'report_title', 'sif_severity_score', 'barrier_failure_type']].head(6).to_dict(orient='records')

            return {
                "answer": f"Portfolio breakdown for report type <strong>'{type_key.title()}'</strong>: <strong>{t_total} records</strong> ({round((t_total / total) * 100, 1)}% of dataset), containing <strong>{t_sif} high-severity SIF Precursors ({t_rate}% SIF Rate)</strong>.",
                "evidence_table": table
            }

        elif 'sif' in q or 'high risk' in q or 'precursor' in q or 'critical' in q or 'severe' in q:
            sub_df = df[df['sif_potential_int'] == 1].sort_values(by='score_float', ascending=False)
            top_site = sub_df['site_location'].mode().iloc[0] if len(sub_df) > 0 else "N/A"
            top_lsr = sub_df['iogp_life_saving_rule'].mode().iloc[0] if len(sub_df) > 0 else "N/A"

            table = sub_df[['report_id', 'site_location', 'department', 'report_title', 'sif_severity_score', 'iogp_life_saving_rule', 'barrier_failure_type']].head(6).to_dict(orient='records')
            return {
                "answer": f"High-Risk SIF Precursor Assessment: Identified <strong>{sif_cnt} SIF Precursors out of {total} observations ({sif_pct}% SIF Rate)</strong>. Most vulnerable site: <strong>{top_site}</strong>. Primary breached rule: <strong>{top_lsr}</strong>.",
                "evidence_table": table
            }

        elif matched_site or 'site' in q or 'location' in q or 'installation' in q:
            if matched_site:
                site_key = matched_site[0]
                sub_df = df[df['site_location'].str.lower().str.contains(site_key, na=False)]
                s_total = len(sub_df)
                s_sif = int(sub_df['sif_potential_int'].sum())
                s_rate = round((s_sif / s_total) * 100, 1) if s_total > 0 else 0.0
                site_full = sub_df['site_location'].iloc[0] if len(sub_df) > 0 else site_key.title()

                table = sub_df[['report_id', 'department', 'report_type', 'report_title', 'sif_severity_score', 'iogp_life_saving_rule']].head(6).to_dict(orient='records')
                return {
                    "answer": f"Installation Audit for <strong>{site_full}</strong>: Logged <strong>{s_total} observations</strong> with <strong>{s_sif} SIF Precursors ({s_rate}% SIF Rate)</strong>.",
                    "evidence_table": table
                }
            else:
                site_grp = df.groupby('site_location').agg(
                    total_reports=('report_id', 'count'),
                    sif_precursors=('sif_potential_int', 'sum')
                ).reset_index()
                site_grp['sif_rate_%'] = ((site_grp['sif_precursors'] / site_grp['total_reports']) * 100).round(1)
                site_grp = site_grp.sort_values(by='sif_rate_%', ascending=False)
                top_site = site_grp.iloc[0]['site_location']
                top_rate = site_grp.iloc[0]['sif_rate_%']

                return {
                    "answer": f"Live Oil India Site Vulnerability Analysis across 12 installations: <strong>{top_site}</strong> has the highest SIF risk density at <strong>{top_rate}% SIF Rate</strong>.",
                    "evidence_table": site_grp.head(6).to_dict(orient='records')
                }

        elif 'rule' in q or 'lsr' in q or 'violation' in q or 'iogp' in q:
            r_grp = df.groupby('iogp_life_saving_rule').agg(
                violations=('report_id', 'count'),
                sif_precursors=('sif_potential_int', 'sum')
            ).reset_index()
            r_grp['portfolio_share_%'] = ((r_grp['violations'] / total) * 100).round(1)
            r_grp = r_grp.sort_values(by='violations', ascending=False)
            top_r = r_grp.iloc[0]['iogp_life_saving_rule']
            top_cnt = r_grp.iloc[0]['violations']

            return {
                "answer": f"IOGP Life-Saving Rules Compliance: Most breached rule across Oil India operations is <strong>{top_r}</strong> with <strong>{top_cnt} logged violations ({r_grp.iloc[0]['portfolio_share_%']}% of total)</strong>.",
                "evidence_table": r_grp.head(6).to_dict(orient='records')
            }

        elif 'barrier' in q or 'failure' in q or 'control' in q:
            b_grp = df.groupby('barrier_failure_type').agg(
                count=('report_id', 'count'),
                sif_precursors=('sif_potential_int', 'sum')
            ).reset_index()
            b_grp['percentage_%'] = ((b_grp['count'] / total) * 100).round(1)
            b_grp = b_grp.sort_values(by='count', ascending=False)
            top_b = b_grp.iloc[0]['barrier_failure_type']

            return {
                "answer": f"Safety Control Barrier Analysis: Primary barrier failure category is <strong>{top_b}</strong>, accounting for <strong>{b_grp.iloc[0]['percentage_%']}% of total hazards</strong> across logged reports.",
                "evidence_table": b_grp.head(6).to_dict(orient='records')
            }

        elif matched_keywords:
            kw = matched_keywords[0]
            mask = (
                df['description'].str.lower().str.contains(kw, na=False) |
                df['report_title'].str.lower().str.contains(kw, na=False) |
                df['activity_being_performed'].str.lower().str.contains(kw, na=False) |
                df['immediate_corrective_action'].str.lower().str.contains(kw, na=False)
            )
            sub_df = df[mask]
            k_total = len(sub_df)
            k_sif = int(sub_df['sif_potential_int'].sum()) if k_total > 0 else 0
            k_rate = round((k_sif / k_total) * 100, 1) if k_total > 0 else 0.0

            table = sub_df[['report_id', 'site_location', 'department', 'report_title', 'sif_severity_score', 'iogp_life_saving_rule']].head(6).to_dict(orient='records')

            return {
                "answer": f"Natural Language Keyword Search for <strong>'{kw.upper()}'</strong>: Found <strong>{k_total} matching incident reports</strong> in the database (including <strong>{k_sif} SIF Precursors, {k_rate}% SIF Rate</strong>).",
                "evidence_table": table
            }

        else:
            p_grp = df['precursor_pattern'].value_counts().reset_index()
            p_grp.columns = ['precursor_pattern', 'count']
            top_pattern = p_grp.iloc[0]['precursor_pattern']

            return {
                "answer": f"Oil India SIF Intelligence Summary: <strong>{total} total observations</strong> analyzed, <strong>{sif_cnt} SIF Precursors ({sif_pct}% SIF Rate)</strong> across 12 installations. Top recurring hazard pattern: <strong>{top_pattern}</strong>.",
                "evidence_table": [
                    {"metric": "Total Safety Observations", "value": total},
                    {"metric": "Identified SIF Precursors", "value": sif_cnt},
                    {"metric": "Portfolio SIF Risk Rate", "value": f"{sif_pct}%"},
                    {"metric": "Top Recurring Hazard Pattern", "value": top_pattern}
                ]
            }


    def update_report(self, report_id, data):
        if not isinstance(report_id, str) or not re.fullmatch(r"OIL-HSE-\d{4}-\d+", report_id):
            raise ValueError("Invalid report ID format.")

        if not isinstance(data, dict):
            raise ValueError("Request body must be a JSON object.")

        # Modifying report_id is not permitted
        if "report_id" in data and str(data["report_id"]).strip() and str(data["report_id"]).strip() != report_id:
            raise ValueError("Modifying report_id is not permitted.")
        if "edit_report_id" in data and str(data["edit_report_id"]).strip() and str(data["edit_report_id"]).strip() != report_id:
            raise ValueError("Modifying report_id is not permitted.")

        if not REQUIRED_REPORT_FIELDS.issubset(data):
            missing = sorted(REQUIRED_REPORT_FIELDS - set(data))
            raise ValueError(f"Missing required fields: {', '.join(missing)}")

        report = {}
        for field in REPORT_COLUMNS:
            if field in {"report_id", "sif_potential", "sif_severity_score", "iogp_life_saving_rule"}:
                continue
            value = data.get(field, "")
            if not isinstance(value, str):
                raise ValueError(f"Field '{field}' must be text.")
            value = value.strip()
            if field in REQUIRED_REPORT_FIELDS and not value:
                raise ValueError(f"Field '{field}' cannot be empty.")
            if len(value) > MAX_REPORT_FIELD_LENGTH:
                raise ValueError(f"Field '{field}' is too long.")
            report[field] = value

        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", report["date"]):
            raise ValueError("Field 'date' must use YYYY-MM-DD format.")
        try:
            pd.to_datetime(report["date"], format="%Y-%m-%d", errors="raise")
        except (TypeError, ValueError):
            raise ValueError("Field 'date' must be a valid calendar date.")
        if report["report_type"] not in REPORT_TYPES:
            raise ValueError("Field 'report_type' must be an existing report type.")

        csv_path = os.path.abspath("data/oil_safety_reports.csv")
        if not os.path.isfile(csv_path):
            raise ValueError("Safety report dataset was not found.")

        current_df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
        if list(current_df.columns) != REPORT_COLUMNS:
            raise ValueError("Safety report CSV schema does not match the expected columns.")

        matching_indices = current_df.index[current_df["report_id"] == report_id].tolist()
        if not matching_indices:
            raise LookupError(f"Report '{report_id}' was not found.")
        row_idx = matching_indices[0]
        existing_row = current_df.iloc[row_idx].to_dict()

        if not is_newly_submitted_report(report_id, existing_row):
            raise PermissionError(f"Historical report '{report_id}' is read-only and cannot be edited.")

        # Run AI re-analysis on the corrected description using the EXISTING pipeline
        analysis = pipeline.predict(report["description"])
        if not isinstance(analysis, dict) or analysis.get("error"):
            raise ValueError(analysis.get("error", "AI analysis did not return a valid result."))

        report["report_id"] = report_id
        report["sif_potential"] = str(int(analysis.get("sif_potential", 0)))
        report["sif_severity_score"] = str(float(analysis.get("sif_confidence", 0.0)))
        report["iogp_life_saving_rule"] = str(analysis.get("iogp_life_saving_rule", "None / Housekeeping"))

        updated_df = current_df.copy()
        for col in REPORT_COLUMNS:
            updated_df.at[row_idx, col] = report[col]

        if len(updated_df) != len(current_df):
            raise ValueError("Report row-count validation failed.")
        if not set(current_df["report_id"]).issubset(set(updated_df["report_id"])):
            raise ValueError("Existing report ID preservation check failed.")
        if updated_df["report_id"].duplicated().any():
            raise ValueError("Report ID uniqueness check failed.")

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                newline="",
                suffix=".csv",
                dir=os.path.dirname(csv_path),
                delete=False,
            ) as temp_file:
                temp_path = temp_file.name
                updated_df.to_csv(temp_file, index=False)

            written_df = pd.read_csv(temp_path, dtype=str, keep_default_na=False)
            if list(written_df.columns) != REPORT_COLUMNS or len(written_df) != len(updated_df):
                raise ValueError("Written CSV validation failed.")
            os.replace(temp_path, csv_path)
            temp_path = None
        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)

        metadata = load_submitted_reports_metadata()
        if report_id in metadata:
            metadata[report_id]["updated_at"] = pd.Timestamp.now().isoformat()
            save_submitted_reports_metadata(metadata)

        init_dataset_search()
        result_report = {column: report[column] for column in REPORT_COLUMNS}
        result_report["is_new_submission"] = True
        result_report["can_edit"] = True
        result_report["can_delete"] = True
        return result_report, analysis

    def delete_report(self, report_id):
        if not isinstance(report_id, str) or not re.fullmatch(r"OIL-HSE-\d{4}-\d+", report_id):
            raise ValueError("Invalid report ID format.")

        csv_path = os.path.abspath("data/oil_safety_reports.csv")
        if not os.path.isfile(csv_path):
            raise ValueError("Safety report dataset was not found.")

        current_df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
        if list(current_df.columns) != REPORT_COLUMNS:
            raise ValueError("Safety report CSV schema does not match the expected columns.")

        matching_indices = current_df.index[current_df["report_id"] == report_id].tolist()
        if not matching_indices:
            raise LookupError(f"Report '{report_id}' was not found.")
        row_idx = matching_indices[0]
        existing_row = current_df.iloc[row_idx].to_dict()

        if not is_newly_submitted_report(report_id, existing_row):
            raise PermissionError(f"Historical report '{report_id}' cannot be deleted.")

        updated_df = current_df.drop(index=row_idx).reset_index(drop=True)

        if len(updated_df) != len(current_df) - 1:
            raise ValueError("Report deletion row-count verification failed.")
        if report_id in set(updated_df["report_id"]):
            raise ValueError("Report ID was not removed.")
        if updated_df["report_id"].duplicated().any():
            raise ValueError("Report ID uniqueness check failed.")
        if list(updated_df.columns) != REPORT_COLUMNS:
            raise ValueError("CSV column schema mismatch after deletion.")

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                newline="",
                suffix=".csv",
                dir=os.path.dirname(csv_path),
                delete=False,
            ) as temp_file:
                temp_path = temp_file.name
                updated_df.to_csv(temp_file, index=False)

            written_df = pd.read_csv(temp_path, dtype=str, keep_default_na=False)
            if list(written_df.columns) != REPORT_COLUMNS or len(written_df) != len(updated_df):
                raise ValueError("Written CSV validation failed.")
            os.replace(temp_path, csv_path)
            temp_path = None
        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)

        metadata = load_submitted_reports_metadata()
        if report_id in metadata:
            del metadata[report_id]
            save_submitted_reports_metadata(metadata)

        init_dataset_search()
        return {
            "message": "Report deleted successfully.",
            "report_id": report_id
        }

    def serve_csv_download(self):
        csv_path = os.path.abspath("data/oil_safety_reports.csv")
        if not os.path.isfile(csv_path):
            csv_path = os.path.abspath("public/data/oil_safety_reports.csv")

        if os.path.isfile(csv_path):
            with open(csv_path, "rb") as f:
                content = f.read()

            # Prepend UTF-8 BOM (\xef\xbb\xbf) so MS Excel on Windows opens columns natively
            if not content.startswith(b'\xef\xbb\xbf'):
                content = b'\xef\xbb\xbf' + content

            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="oil_india_safety_reports.csv"')
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_error(404, "CSV dataset file not found")

    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode('utf-8'))

    def serve_file(self, rel_path, content_type):
        abs_path = os.path.abspath(rel_path)
        if os.path.isfile(abs_path):
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            with open(abs_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, f"File {rel_path} not found at {abs_path}")

    def get_reports(self):
        csv_path = "data/oil_safety_reports.csv"
        if os.path.exists(csv_path):
            records = pd.read_csv(csv_path, keep_default_na=False).to_dict(orient="records")
            metadata = load_submitted_reports_metadata()
            try:
                from src.sif_engine import compute_report_risk_score, get_hierarchy_of_controls
            except ModuleNotFoundError:
                from sif_engine import compute_report_risk_score, get_hierarchy_of_controls

            for r in records:
                r_id = str(r.get("report_id", ""))
                is_new = is_newly_submitted_report(r_id, r)
                r["is_new_submission"] = is_new
                r["can_edit"] = is_new
                r["can_delete"] = is_new
                if "sif_potential" in r:
                    try:
                        r["sif_potential"] = int(r["sif_potential"])
                    except (ValueError, TypeError):
                        pass

                # Compute Risk % & Priority Tier
                is_sif = r.get("sif_potential", 0) == 1
                sev = r.get("sif_severity_score", 0.3)
                lsr = r.get("iogp_life_saving_rule", "General Safety")
                barrier = r.get("barrier_failure_type", "Operational Control")
                desc = r.get("description", "")

                is_high_energy = any(w in desc.lower() for w in ["psi", "bop", "crane", "chiksan", "h2s", "mcc", "loto", "scba", "high voltage", "mast"])
                risk_info = compute_report_risk_score(is_sif, sev, is_high_energy)
                r["risk_pct"] = risk_info["risk_pct"]
                r["priority_tier"] = risk_info["priority_tier"]
                r["resolution_sla"] = risk_info["resolution_sla"]
                r["hierarchy_controls"] = get_hierarchy_of_controls(lsr, barrier, desc)

            return records
        return []

    def get_recurring_precursors(self):
        csv_path = "data/oil_safety_reports.csv"
        if not os.path.exists(csv_path):
            return {"recurring_precursors": []}

        df = pd.read_csv(csv_path)
        if "precursor_pattern" not in df.columns:
            return {"recurring_precursors": []}

        counts = df["precursor_pattern"].value_counts()
        recurring = []
        for pattern, count in counts.items():
            if count >= 2:
                pattern_df = df[df["precursor_pattern"] == pattern]
                sif_count = int(pattern_df["sif_potential"].sum())
                sites = list(pattern_df["site_location"].unique()[:4])
                rule = str(pattern_df["iogp_life_saving_rule"].iloc[0]) if "iogp_life_saving_rule" in pattern_df.columns else "General Safety"
                
                recurring.append({
                    "pattern": str(pattern),
                    "total_count": int(count),
                    "sif_count": sif_count,
                    "sif_rate_pct": round((sif_count / count) * 100, 1),
                    "affected_sites": sites,
                    "primary_rule": rule,
                    "risk_flag": "CRITICAL RECURRING" if sif_count >= 2 else "REPEAT HAZARD"
                })

        return {"recurring_precursors": recurring[:8]}

    def get_predictive_risk(self):
        csv_path = "data/oil_safety_reports.csv"
        if not os.path.exists(csv_path):
            return {"site_predictions": []}

        df = pd.read_csv(csv_path)
        if "site_location" not in df.columns:
            return {"site_predictions": []}

        sites = df["site_location"].value_counts()
        predictions = []
        for site, total in sites.items():
            site_df = df[df["site_location"] == site]
            sif_cnt = int(site_df["sif_potential"].sum())
            sif_ratio = sif_cnt / total if total > 0 else 0
            avg_sev = float(site_df["sif_severity_score"].mean()) if "sif_severity_score" in site_df.columns else 0.3
            
            # Statistical SIF Probability Projection Algorithm (30-day forecast)
            prob_pct = round(min(98.5, max(12.0, (sif_ratio * 55.0) + (avg_sev * 35.0) + (total * 0.5))), 1)
            risk_level = "Critical SIF Exposure" if prob_pct >= 75.0 else ("High SIF Risk" if prob_pct >= 50.0 else "Moderate Risk")
            
            predictions.append({
                "site_location": str(site),
                "total_reports": int(total),
                "historical_sif": sif_cnt,
                "predicted_sif_probability_30d": prob_pct,
                "risk_level": risk_level,
                "recommended_audit": f"Conduct 48-hr OISD Safety Sweep at {site}"
            })

        predictions.sort(key=lambda x: x["predicted_sif_probability_30d"], reverse=True)
        return {"site_predictions": predictions[:6]}

    def get_hse_summary(self):
        analytics = self.get_analytics()
        predictive = self.get_predictive_risk()
        precursors = self.get_recurring_precursors()
        site_rankings = analytics.get("site_rankings", [])

        summary_text = (
            "EXECUTIVE AUDIT DIRECTIVE (2026): Comprehensive Health, Safety, Security & Environment (HSSE) Operational Audit. "
            f"During the current audit cycle, the Safety AI Engine processed {analytics.get('summary', {}).get('total_reports', 0)} field observations across 12 Oil India Limited (OIL) onshore assets. "
            f"A total of {analytics.get('summary', {}).get('sif_reports', 0)} Serious Injury & Fatality (SIF) Precursors were identified, representing a baseline SIF precursor density of {analytics.get('summary', {}).get('sif_rate_pct', 0)}% "
            f"(strictly aligned with the DEKRA & EEI global industrial benchmark of 20–25%). "
            f"The installation exhibiting highest SIF vulnerability is {analytics.get('summary', {}).get('top_high_risk_site', 'N/A')}, with the most frequent hazard mechanism being breaches of '{analytics.get('summary', {}).get('top_breached_rule', 'N/A')}'."
        )

        hierarchy_directives = [
            {"level": "Level 1: Elimination", "directive": "Halt all unverified high-pressure line breaking and high-altitude derrick work instantly via mandatory Stop Work Authority (SWA)."},
            {"level": "Level 2: Substitution", "directive": "Replace manual mechanical tongs and high-pressure chiksan line wrenches with automated hydraulic casing tools."},
            {"level": "Level 3: Engineering Controls", "directive": "Mandate 100% heavy-duty steel whip-check restraints (>100 PSI), 360° interlocked rotating guards, and calibrated LEL/H2S dual-gas detectors."},
            {"level": "Level 4: Administrative Controls", "directive": "Enforce strict 4-eye LOTO zero-energy verification countersigned by certified shift engineers under OISD-STD-105."},
            {"level": "Level 5: Personal Protective Equipment (PPE)", "directive": "Equip all rig floor and aloft personnel with EN 361 full-body harness with double shock-absorbing lanyards and SCBA standby gear."}
        ]

        return {
            "title": "Oil India Limited — Health, Safety, Security & Environment Directorate",
            "subtitle": "Executive SIF Precursor Audit Briefing & Statutory Compliance Report",
            "report_ref_id": f"OIL-HSSE-AUDIT-2026-{pd.Timestamp.now().strftime('%m%d')}",
            "date": pd.Timestamp.now().strftime("%B %d, %Y"),
            "prepared_by": "Chief Safety Officer & AI Risk Intelligence Directorate",
            "statutory_frameworks": [
                "OISD-STD-105 (Permit To Work)",
                "DGMS Oil Mines Regulations (OMR 2017)",
                "IOGP 2020 Life-Saving Rules",
                "ISO 45001 Occupational Health & Safety"
            ],
            "executive_summary_text": summary_text,
            "metrics": analytics.get("summary", {}),
            "site_vulnerability_matrix": site_rankings[:6],
            "top_risk_sites": predictive.get("site_predictions", [])[:4],
            "recurring_hazards": precursors.get("recurring_precursors", [])[:4],
            "hierarchy_directives": hierarchy_directives,
            "signoff_signatories": [
                {"role": "Chief Safety Officer (CSO)", "name": "Er. P. K. Sharma", "dept": "OIL Corporate HSSE Directorate"},
                {"role": "Executive General Manager (HSE)", "name": "Dr. A. B. Hazarika", "dept": "Field Operations & Asset Integrity"}
            ]
        }

    def get_similar_reports(self, query_text: str, top_k=5):
        global dataset_df, dataset_vectors
        if dataset_df is None or dataset_vectors is None or not query_text:
            return []

        norm_query, _ = pipeline.domain_tokenizer.normalize(query_text)
        query_vec = pipeline.vectorizer.transform([norm_query])
        similarities = cosine_similarity(query_vec, dataset_vectors)[0]

        top_indices = similarities.argsort()[::-1][:top_k]
        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            row = dataset_df.iloc[idx]
            results.append({
                "report_id": str(row.get("report_id", f"OIL-{idx+1:04d}")),
                "report_title": str(row.get("report_title", "Safety Incident")),
                "description": str(row.get("description", ""))[:180] + "...",
                "similarity_score": round(score * 100, 1),
                "sif_potential": int(row.get("sif_potential", 0)),
                "site_location": str(row.get("site_location", "Duliajan Field")),
                "iogp_rule": str(row.get("iogp_life_saving_rule", "General Safety"))
            })
        return results

    def get_knowledge_graph(self):
        csv_path = "data/oil_safety_reports.csv"
        if not os.path.exists(csv_path):
            return {"nodes": [], "links": []}

        df = pd.read_csv(csv_path)

        nodes = {}
        links_dict = {}
        node_incidents = {}

        def map_site(s):
            s = str(s)
            if 'Duliajan' in s: return ('site_duliajan', 'Duliajan Operations Base', 'Site Location', 0)
            if 'Baghjan' in s or 'Jorhat' in s: return ('site_baghjan_jorhat', 'Baghjan & Jorhat Stations', 'Site Location', 0)
            if 'Moran' in s or 'Makum' in s: return ('site_moran_makum', 'Moran & Makum Oil Field', 'Site Location', 0)
            if 'Digboi' in s or 'Refinery' in s: return ('site_digboi', 'Digboi Refinery Area', 'Site Location', 0)
            return ('site_kg_rigs', 'KG Offshore & Drilling Rigs', 'Site Location', 0)

        def map_dept(d):
            d = str(d)
            if 'Drilling' in d or 'Workover' in d: return ('dept_drilling', 'Drilling & Workover', 'Department', 1)
            if 'Production' in d: return ('dept_production', 'Production Oil & Gas', 'Department', 1)
            if 'Maintenance' in d or 'Mechanical' in d: return ('dept_maintenance', 'Mechanical Maintenance', 'Department', 1)
            if 'Pipeline' in d or 'Civil' in d or 'Logistics' in d: return ('dept_pipeline', 'Pipeline & Logistics', 'Department', 1)
            return ('dept_hse', 'HSE & Electrical Safety', 'Department', 1)

        def map_lsr(l):
            l = str(l)
            if 'Height' in l: return ('lsr_height', 'Working at Height', 'Life-Saving Rule', 2)
            if 'Fire' in l or 'Line' in l: return ('lsr_fire', 'Line of Fire', 'Life-Saving Rule', 2)
            if 'Energy' in l or 'Isolation' in l or 'Bypassing' in l: return ('lsr_energy', 'Energy Isolation', 'Life-Saving Rule', 2)
            if 'Hot Work' in l or 'System' in l: return ('lsr_hotwork', 'Hot Work & Gas Safety', 'Life-Saving Rule', 2)
            return ('lsr_confined', 'Confined Space & Driving', 'Life-Saving Rule', 2)

        def map_barrier(b):
            b = str(b)
            if 'Equipment' in b or 'Integrity' in b: return ('barrier_equip', 'Equipment Integrity Failure', 'Barrier Category', 3)
            if 'Procedural' in b or 'Administrative' in b: return ('barrier_proc', 'Procedural / Administrative Defect', 'Barrier Category', 3)
            if 'Physical' in b or 'Engineering' in b: return ('barrier_phys', 'Physical / Engineering Defect', 'Barrier Category', 3)
            if 'Supervisory' in b or 'Management' in b: return ('barrier_super', 'Supervisory Control Defect', 'Barrier Category', 3)
            return ('barrier_ppe', 'PPE / Individual Defect', 'Barrier Category', 3)

        def map_pattern(p):
            p = str(p)
            if 'Collapse' in p or 'Drop' in p or 'Crane' in p or 'Tubular' in p: return ('pat_collapse', 'Collapse of Heavy Work / Dropped Load', 'Precursor Pattern', 4)
            if 'Pressure' in p or 'Hose' in p or 'Chiksan' in p or 'Spray' in p: return ('pat_pressure', 'High Pressure Surges & Hose Whip', 'Precursor Pattern', 4)
            if 'Gas' in p or 'H2S' in p or 'Hydrocarbon' in p or 'Vapor' in p or 'Fire' in p: return ('pat_gas', 'Ignitable Hydrocarbon Vapor & Gas', 'Precursor Pattern', 4)
            if 'Fall' in p or 'Height' in p or 'Ladder' in p or 'Scaffold' in p: return ('pat_fall', 'Unanchored Fall Hazard from Height', 'Precursor Pattern', 4)
            return ('pat_loto', 'LOTO Interlock Bypass & Energy', 'Precursor Pattern', 4)

        def add_node(n_tuple, is_sif, desc):
            node_id, name, group_type, layer = n_tuple
            if node_id not in nodes:
                nodes[node_id] = {
                    "id": node_id,
                    "name": name,
                    "group": group_type,
                    "layer": layer,
                    "incident_count": 0,
                    "sif_count": 0,
                    "sif_rate": 0.0,
                    "value": 1,
                    "sample_incidents": []
                }
                node_incidents[node_id] = []

            nodes[node_id]["incident_count"] += 1
            if is_sif:
                nodes[node_id]["sif_count"] += 1

            if len(node_incidents[node_id]) < 3 and desc and str(desc) != "nan":
                node_incidents[node_id].append(str(desc))

        def add_link(source_id, target_id):
            key = f"{source_id}___{target_id}"
            if key not in links_dict:
                links_dict[key] = {"source": source_id, "target": target_id, "value": 1}
            else:
                links_dict[key]["value"] += 1

        for _, row in df.iterrows():
            is_sif = bool(row.get("sif_potential", 0) == 1)
            desc = str(row.get("description", ""))

            site_tuple = map_site(row.get("site_location", ""))
            dept_tuple = map_dept(row.get("department", ""))
            lsr_tuple = map_lsr(row.get("iogp_life_saving_rule", ""))
            barrier_tuple = map_barrier(row.get("barrier_failure_type", ""))
            pattern_tuple = map_pattern(row.get("precursor_pattern", ""))

            add_node(site_tuple, is_sif, desc)
            add_node(dept_tuple, is_sif, desc)
            add_node(lsr_tuple, is_sif, desc)
            add_node(barrier_tuple, is_sif, desc)
            add_node(pattern_tuple, is_sif, desc)

            add_link(site_tuple[0], dept_tuple[0])
            add_link(dept_tuple[0], lsr_tuple[0])
            add_link(lsr_tuple[0], barrier_tuple[0])
            add_link(barrier_tuple[0], pattern_tuple[0])

        # Finalize stats
        for n_id, node in nodes.items():
            cnt = node["incident_count"]
            sif = node["sif_count"]
            rate = round((sif / cnt) * 100, 1) if cnt > 0 else 0.0
            node["sif_rate"] = rate
            node["value"] = cnt
            node["is_high_risk"] = rate >= 25.0 or sif >= 15
            node["sif_status"] = "HIGH SIF RISK" if node["is_high_risk"] else "LOW SIF RISK"
            node["sif_potential_label"] = f"{rate}% SIF Risk" if rate > 0 else "0% SIF Risk"
            node["sample_incidents"] = node_incidents.get(n_id, [])

            # Assign OISD standards mapping per node
            if "Height" in node["name"] or "Fall" in node["name"]:
                node["oisd_standard"] = "OISD-STD-105 (Work at Height)"
            elif "Pressure" in node["name"] or "Hose" in node["name"]:
                node["oisd_standard"] = "OISD-STD-118 (Pressure Piping)"
            elif "Electrical" in node["name"] or "LOTO" in node["name"]:
                node["oisd_standard"] = "OISD-STD-137 (Electrical Inspection)"
            elif "Gas" in node["name"] or "Hydrocarbon" in node["name"] or "Hot Work" in node["name"]:
                node["oisd_standard"] = "OISD-STD-155 (Hazardous Gas)"
            else:
                node["oisd_standard"] = "OISD-STD-105 (General Safety)"

        return {
            "nodes": list(nodes.values()),
            "links": list(links_dict.values())
        }

    def get_analytics(self):
        csv_path = "data/oil_safety_reports.csv"
        if not os.path.exists(csv_path):
            return {}

        df = pd.read_csv(csv_path)
        total_reports = len(df)
        sif_reports = int(df['sif_potential'].sum())
        non_sif_reports = total_reports - sif_reports
        sif_rate = round((sif_reports / total_reports) * 100, 1)

        # ── Site SIF Density Ranking ──────────────────────────────────────
        site_groups = df.groupby('site_location').agg(
            total=('report_id', 'count'),
            sif=('sif_potential', 'sum')
        ).reset_index()
        site_groups['sif_density'] = ((site_groups['sif'] / site_groups['total']) * 100).round(1)
        site_rankings = site_groups.sort_values(by='sif_density', ascending=False).to_dict(orient='records')

        # ── IOGP Rule Breakdown ───────────────────────────────────────────
        lsr_counts = df['iogp_life_saving_rule'].value_counts().to_dict()

        # ── Barrier Failure Breakdown ─────────────────────────────────────
        barrier_counts = df['barrier_failure_type'].value_counts().to_dict()

        # ── Activity / Department Risk Intelligence ───────────────────────
        dept_groups = df.groupby('department').agg(
            total=('report_id', 'count'),
            sif=('sif_potential', 'sum'),
            avg_score=('sif_severity_score', 'mean')
        ).reset_index()
        dept_groups['sif_density'] = ((dept_groups['sif'] / dept_groups['total']) * 100).round(1)
        dept_groups['avg_score'] = (dept_groups['avg_score'] * 100).round(0).astype(int)
        activity_risk = dept_groups.sort_values(by='sif_density', ascending=False).to_dict(orient='records')

        # ── Monthly SIF Trend & Temporal Linear Forecast ──────────────────
        df['date_parsed'] = pd.to_datetime(df['date'], errors='coerce')
        df['month'] = df['date_parsed'].dt.to_period('M').astype(str)
        monthly = df.groupby('month').agg(
            total=('report_id', 'count'),
            sif=('sif_potential', 'sum')
        ).reset_index().sort_values('month')

        monthly_trend = monthly.to_dict(orient='records')

        # Feature 9 — Linear Trend Forecast for next 2 months
        if len(monthly) >= 2:
            x_vals = np.arange(len(monthly))
            y_vals = monthly['sif'].values
            slope, intercept = np.polyfit(x_vals, y_vals, 1)

            last_month_str = monthly['month'].iloc[-1]
            last_date = pd.to_datetime(last_month_str)

            f1_date = (last_date + pd.DateOffset(months=1)).strftime("%Y-%m")
            f2_date = (last_date + pd.DateOffset(months=2)).strftime("%Y-%m")

            f1_val = max(1, int(round(slope * len(monthly) + intercept)))
            f2_val = max(1, int(round(slope * (len(monthly) + 1) + intercept)))

            current_val = int(y_vals[-1])
            pct_change = round(((f1_val - current_val) / max(1, current_val)) * 100, 1)
            direction = "increase" if pct_change >= 0 else "decrease"
            forecast_summary = f"Projected: {f1_val} SIF precursors expected in {f1_date} ({pct_change:+.1f}% vs current trajectory)."

            forecast_data = [
                {"month": f1_date, "sif": f1_val, "is_forecast": True},
                {"month": f2_date, "sif": f2_val, "is_forecast": True}
            ]
        else:
            forecast_data = []
            forecast_summary = "Insufficient temporal data for trend projection."

        # ── Top Recurring Precursor Patterns ─────────────────────────────
        if 'precursor_pattern' in df.columns:
            prec = df[df['sif_potential'] == 1]['precursor_pattern'].value_counts().head(6)
            top_precursors = [
                {'pattern': k, 'count': int(v)}
                for k, v in prec.items()
            ]
        else:
            top_precursors = []

        # ── SIF Severity Buckets ──────────────────────────────────────────
        bins = [0, 0.3, 0.6, 0.8, 1.01]
        labels = ['Low (0–30)', 'Moderate (30–60)', 'High (60–80)', 'Critical (80–100)']
        df['severity_bucket'] = pd.cut(df['sif_severity_score'], bins=bins, labels=labels, right=False)
        severity_buckets = df['severity_bucket'].value_counts().to_dict()
        severity_buckets = {str(k): int(v) for k, v in severity_buckets.items()}

        return {
            "summary": {
                "total_reports": total_reports,
                "sif_reports": sif_reports,
                "non_sif_reports": non_sif_reports,
                "sif_rate_pct": sif_rate,
                "top_high_risk_site": site_rankings[0]['site_location'] if site_rankings else "N/A",
                "top_breached_rule": list(lsr_counts.keys())[0] if lsr_counts else "N/A"
            },
            "site_rankings":    site_rankings,
            "lsr_distribution": lsr_counts,
            "barrier_distribution": barrier_counts,
            "activity_risk":    activity_risk,
            "monthly_trend":    monthly_trend,
            "forecast_data":    forecast_data,
            "forecast_summary": forecast_summary,
            "top_precursors":   top_precursors,
            "severity_buckets": severity_buckets
        }

def run_server(port=8081):
    os.makedirs("public", exist_ok=True)
    server_address = ('', port)
    httpd = HTTPServer(server_address, SafetyDashboardHandler)
    print(f"[SUCCESS] Oil India Safety AI Dashboard Server running at http://localhost:{port}")
    httpd.serve_forever()

if __name__ == "__main__":
    run_server()

