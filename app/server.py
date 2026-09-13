import os
import sys
import json
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
        elif req_path in ["/data/oil_safety_reports.csv", "/api/export", "/export", "/api/export-csv", "/download-csv"]:
            self.serve_csv_download()
        else:
            # Map request URL to local public folder file
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
        json_path = "data/oil_safety_reports.json"
        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

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

        def add_node(node_id, name, group_type):
            if node_id not in nodes:
                nodes[node_id] = {"id": node_id, "name": name, "group": group_type, "value": 1}
            else:
                nodes[node_id]["value"] += 1

        def add_link(source_id, target_id):
            key = f"{source_id}___{target_id}"
            if key not in links_dict:
                links_dict[key] = {"source": source_id, "target": target_id, "value": 1}
            else:
                links_dict[key]["value"] += 1

        for _, row in df.iterrows():
            dept = str(row.get("department", "Operations"))
            lsr = str(row.get("iogp_life_saving_rule", "General Safety"))
            barrier = str(row.get("barrier_failure_type", "Operational Control"))
            pattern = str(row.get("precursor_pattern", "General Incident")) if pd.notnull(row.get("precursor_pattern")) else "General Hazard"

            dept_id = f"dept_{dept}"
            lsr_id = f"lsr_{lsr}"
            barrier_id = f"barrier_{barrier}"
            pattern_id = f"pattern_{pattern}"

            add_node(dept_id, dept, "Department")
            add_node(lsr_id, lsr, "Life-Saving Rule")
            add_node(barrier_id, barrier, "Barrier Category")
            add_node(pattern_id, pattern, "Precursor Pattern")

            add_link(dept_id, lsr_id)
            add_link(lsr_id, barrier_id)
            add_link(barrier_id, pattern_id)

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

def run_server(port=8080):
    os.makedirs("public", exist_ok=True)
    server_address = ('', port)
    httpd = HTTPServer(server_address, SafetyDashboardHandler)
    print(f"[SUCCESS] Oil India Safety AI Dashboard Server running at http://localhost:{port}")
    httpd.serve_forever()

if __name__ == "__main__":
    run_server()

