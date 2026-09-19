import os
import sys
import json
import urllib.parse
import threading
from datetime import datetime, timezone
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import pandas as pd
import numpy as np

BASE_DIR = Path(__file__).resolve().parents[1]
PUBLIC_DIR = BASE_DIR / "public"
DATA_DIR = BASE_DIR / "data"
REVIEW_PATH = DATA_DIR / "review_decisions.json"
AUDIT_PATH = DATA_DIR / "audit_events.json"
MAX_REQUEST_BYTES = 64 * 1024
review_lock = threading.RLock()
audit_lock = threading.RLock()

sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "src"))

try:
    from src.nlp_engine import SafetyClassifierPipeline
except ModuleNotFoundError:
    from nlp_engine import SafetyClassifierPipeline

from sklearn.metrics.pairwise import cosine_similarity

# Initialize AI Pipeline & Pre-compute Dataset Vectors for Similarity Search
pipeline = SafetyClassifierPipeline()
pipeline.train(str(DATA_DIR / "oil_safety_reports.csv"))

dataset_df = None
dataset_vectors = None

def init_dataset_search():
    global dataset_df, dataset_vectors
    csv_path = DATA_DIR / "oil_safety_reports.csv"
    if csv_path.exists():
        dataset_df = pd.read_csv(csv_path)
        descriptions = dataset_df['description'].fillna("").tolist()
        if pipeline.vectorizer:
            norm_texts = [pipeline.domain_tokenizer.normalize(txt)[0] for txt in descriptions]
            dataset_vectors = pipeline.vectorizer.transform(norm_texts)
            print(f"[SUCCESS] Pre-computed TF-IDF similarity matrix for {len(descriptions)} reports.")

init_dataset_search()

class SafetyDashboardHandler(SimpleHTTPRequestHandler):
    def _resolve_public_file(self, request_path):
        clean_path = urllib.parse.unquote(request_path.lstrip("/"))
        candidate = (PUBLIC_DIR / clean_path).resolve()
        if candidate != PUBLIC_DIR and PUBLIC_DIR not in candidate.parents:
            return None
        return candidate

    def _read_json_body(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
        except (TypeError, ValueError):
            raise ValueError("Invalid Content-Length header")
        if content_length <= 0:
            raise ValueError("Request body is required")
        if content_length > MAX_REQUEST_BYTES:
            raise ValueError("Request body exceeds 64 KB limit")
        try:
            return json.loads(self.rfile.read(content_length).decode('utf-8'))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ValueError("Request body must be valid UTF-8 JSON")

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        req_path = parsed_path.path
        
        if req_path == "/api/reports":
            self.send_json_response(self.get_reports())
        elif req_path == "/api/health":
            self.send_json_response(self.get_health())
        elif req_path == "/api/reviews":
            self.send_json_response(self.get_reviews())
        elif req_path == "/api/audit-events":
            self.send_json_response(self.get_audit_events())
        elif req_path == "/api/analytics":
            self.send_json_response(self.get_analytics())
        elif req_path == "/api/knowledge-graph":
            self.send_json_response(self.get_knowledge_graph())
        elif req_path == "/api/brief":
            self.send_json_response(self.build_hse_brief())
        elif req_path in ["/data/oil_safety_reports.csv", "/api/export", "/export", "/api/export-csv", "/download-csv"]:
            self.serve_csv_download()
        else:
            # Map request URL to local public folder file
            clean_path = urllib.parse.unquote(req_path.lstrip("/"))
            if not clean_path or clean_path == "index.html":
                local_file = PUBLIC_DIR / "index.html"
                mime = "text/html"
            else:
                local_file = self._resolve_public_file(req_path)
                if local_file is None:
                    self.send_error(404, "File not found")
                    return
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
            try:
                data = self._read_json_body()
                if not isinstance(data, dict):
                    raise ValueError("JSON body must be an object")
                text = data.get("text", "")
                if not isinstance(text, str) or len(text) > 20_000:
                    raise ValueError("text must be a string no longer than 20,000 characters")
                result = pipeline.predict(text)
                self.record_audit_event("classify", {
                    "classification_label": result.get("classification_label"),
                    "confidence_band": result.get("confidence_band"),
                    "text_length": len(text),
                })
                self.send_json_response(result)
            except Exception as e:
                self.send_json_response({"error": str(e)}, status=400)
        elif self.path == "/api/similar":
            try:
                data = self._read_json_body()
                if not isinstance(data, dict):
                    raise ValueError("JSON body must be an object")
                text = data.get("text", "")
                if not isinstance(text, str) or len(text) > 20_000:
                    raise ValueError("text must be a string no longer than 20,000 characters")
                similar_reports = self.get_similar_reports(text)
                self.send_json_response(similar_reports)
            except Exception as e:
                self.send_json_response({"error": str(e)}, status=400)
        elif self.path == "/api/reviews":
            try:
                data = self._read_json_body()
                review = self.save_review(data)
                self.record_audit_event("human_review", {
                    "review_id": review["review_id"],
                    "decision": review["decision"],
                    "predicted_label": review["predicted_label"],
                    "final_label": review["final_label"],
                })
                self.send_json_response(review, status=201)
            except Exception as e:
                self.send_json_response({"error": str(e)}, status=400)
        elif self.path == "/api/simulate":
            try:
                data = self._read_json_body()
                if not isinstance(data, dict):
                    raise ValueError("JSON body must be an object")
                text = data.get("text", "")
                if not isinstance(text, str) or not text.strip() or len(text) > 20_000:
                    raise ValueError("text must be a non-empty string no longer than 20,000 characters")
                result = self.simulate_scenario(text)
                self.record_audit_event("simulate", {
                    "life_saving_rule": result.get("life_saving_rule"),
                    "barrier_condition": result.get("barrier_condition"),
                    "text_length": len(text),
                })
                self.send_json_response(result)
            except Exception as e:
                self.send_json_response({"error": str(e)}, status=400)
        elif self.path == "/api/report-quality":
            try:
                data = self._read_json_body()
                if not isinstance(data, dict):
                    raise ValueError("JSON body must be an object")
                text = data.get("text", "")
                if not isinstance(text, str) or len(text) > 20_000:
                    raise ValueError("text must be a string no longer than 20,000 characters")
                result = self.assess_report_quality(text)
                self.record_audit_event("report_quality", {
                    "quality": result.get("quality"),
                    "missing_fields": result.get("missing_fields", []),
                    "text_length": len(text),
                })
                self.send_json_response(result)
            except Exception as e:
                self.send_json_response({"error": str(e)}, status=400)
        elif self.path == "/api/copilot":
            try:
                data = self._read_json_body()
                if not isinstance(data, dict):
                    raise ValueError("JSON body must be an object")
                question = data.get("question", "")
                if not isinstance(question, str) or not question.strip() or len(question) > 2_000:
                    raise ValueError("question must be a non-empty string no longer than 2,000 characters")
                result = self.answer_copilot_question(question)
                self.record_audit_event("copilot", {
                    "source_types": [source.get("type") for source in result.get("sources", [])],
                    "question_length": len(question),
                })
                self.send_json_response(result)
            except Exception as e:
                self.send_json_response({"error": str(e)}, status=400)
        else:
            self.send_error(404, "Endpoint not found")

    def serve_csv_download(self):
        csv_path = DATA_DIR / "oil_safety_reports.csv"
        if not csv_path.is_file():
            csv_path = PUBLIC_DIR / "data" / "oil_safety_reports.csv"

        if csv_path.is_file():
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
        abs_path = Path(rel_path).resolve()
        if abs_path.is_file():
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            with open(abs_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, f"File {rel_path} not found at {abs_path}")

    def get_reports(self):
        json_path = DATA_DIR / "oil_safety_reports.json"
        if json_path.exists():
            with open(json_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

    @staticmethod
    def get_health():
        dataset_path = DATA_DIR / "oil_safety_reports.csv"
        artifacts = {
            "tfidf_vectorizer": (BASE_DIR / "models" / "tfidf_vectorizer.pkl").exists(),
            "sif_classifier": (BASE_DIR / "models" / "sif_classifier.pkl").exists(),
            "lsr_classifier": (BASE_DIR / "models" / "lsr_classifier.pkl").exists(),
        }
        dataset_rows = 0
        if dataset_path.exists():
            try:
                dataset_rows = int(pd.read_csv(dataset_path, usecols=["report_id"]).shape[0])
            except (OSError, ValueError, pd.errors.ParserError):
                dataset_rows = 0
        return {
            "status": "ok" if dataset_rows and all(artifacts.values()) else "degraded",
            "dataset": {
                "available": dataset_path.exists(),
                "rows": dataset_rows,
            },
            "model_artifacts": artifacts,
            "runtime": {
                "sif_classifier": "hybrid_rule_engine_plus_logistic_regression",
                "lsr_classifier": "semantic_tfidf_matcher",
                "review_store_available": REVIEW_PATH.exists(),
                "audit_store_available": AUDIT_PATH.exists(),
            },
        }

    def get_reviews(self):
        if not REVIEW_PATH.exists():
            return []
        try:
            with review_lock, open(REVIEW_PATH, "r", encoding="utf-8") as review_file:
                reviews = json.load(review_file)
            return reviews if isinstance(reviews, list) else []
        except (OSError, json.JSONDecodeError):
            return []

    @staticmethod
    def get_audit_events():
        if not AUDIT_PATH.exists():
            return []
        try:
            with audit_lock, open(AUDIT_PATH, "r", encoding="utf-8") as audit_file:
                events = json.load(audit_file)
            return events if isinstance(events, list) else []
        except (OSError, json.JSONDecodeError):
            return []

    @staticmethod
    def record_audit_event(action, metadata=None):
        event = {
            "event_id": f"AUD-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "metadata": metadata if isinstance(metadata, dict) else {},
        }
        try:
            DATA_DIR.mkdir(exist_ok=True)
            with audit_lock:
                events = SafetyDashboardHandler.get_audit_events()
                events.append(event)
                with open(AUDIT_PATH, "w", encoding="utf-8") as audit_file:
                    json.dump(events[-2_000:], audit_file, indent=2, ensure_ascii=False)
        except OSError:
            # Auditing must never make a safety assessment unavailable.
            return False
        return True

    @staticmethod
    def build_hse_brief():
        analytics = SafetyDashboardHandler.get_analytics(None)
        summary = analytics.get("summary", {})
        recurrence = analytics.get("recurrence_alerts", [])
        forecast = analytics.get("forecast_summary", "No forecast is available.")
        top_site = summary.get("top_high_risk_site", "N/A")
        top_rule = summary.get("top_breached_rule", "N/A")
        critical_alerts = [item for item in recurrence if item.get("escalation") == "MANAGEMENT_ALERT"]
        priorities = [
            f"Review {top_site}, the highest-density SIF precursor site in the current dataset.",
            f"Prioritize controls related to {top_rule} across active work fronts.",
        ]
        if critical_alerts:
            first = critical_alerts[0]
            priorities.append(
                f"Escalate recurring pattern '{first['precursor_pattern']}' at {first['site_location']} "
                f"({first['occurrences']} occurrences)."
            )
        return {
            "title": "OIL HSSE Safety Intelligence Brief",
            "period": "Current loaded reporting dataset",
            "metrics": {
                "reports_analyzed": summary.get("total_reports", 0),
                "sif_potential_reports": summary.get("sif_reports", 0),
                "sif_rate_pct": summary.get("sif_rate_pct", 0),
                "highest_risk_site": top_site,
                "top_life_saving_rule": top_rule,
            },
            "priorities": priorities,
            "recurrence_alert_count": len(recurrence),
            "forecast": forecast,
            "grounded": True,
            "disclaimer": "Brief is generated from the current dataset and requires HSE validation before operational use.",
        }

    def save_review(self, data):
        if not isinstance(data, dict):
            raise ValueError("JSON body must be an object")
        decision = data.get("decision")
        if decision not in {"accepted", "rejected", "corrected"}:
            raise ValueError("decision must be accepted, rejected, or corrected")
        report_text = data.get("text", "")
        if not isinstance(report_text, str) or not report_text.strip() or len(report_text) > 20_000:
            raise ValueError("text must be a non-empty string no longer than 20,000 characters")
        reviewer = data.get("reviewer", "anonymous")
        if not isinstance(reviewer, str) or len(reviewer) > 120:
            raise ValueError("reviewer must be a string no longer than 120 characters")
        review = {
            "review_id": f"REV-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "reviewer": reviewer.strip() or "anonymous",
            "decision": decision,
            "text": report_text.strip(),
            "predicted_label": data.get("predicted_label", "UNKNOWN"),
            "final_label": data.get("final_label", data.get("predicted_label", "UNKNOWN")),
            "comment": str(data.get("comment", ""))[:2_000],
        }
        DATA_DIR.mkdir(exist_ok=True)
        with review_lock:
            reviews = self.get_reviews()
            reviews.append(review)
            with open(REVIEW_PATH, "w", encoding="utf-8") as review_file:
                json.dump(reviews, review_file, indent=2, ensure_ascii=False)
        return review

    @staticmethod
    def simulate_scenario(text):
        result = pipeline.predict(text)
        rule = result.get("iogp_life_saving_rule", "None / General Safety")
        energy_sources = result.get("energy_sources", [])
        barrier_condition = result.get("barrier_condition", "UNKNOWN_OR_NOT_MENTIONED")
        if barrier_condition == "FAILED_OR_ABSENT":
            first_step = "Uncontrolled hazard remains available to the exposed worker."
            second_step = "A release, fall, strike, or toxic exposure can occur before recovery."
        elif energy_sources:
            first_step = "High-energy hazard remains present while barrier status is unconfirmed."
            second_step = "Worker exposure could escalate into a serious injury or fatality."
        else:
            first_step = "No high-energy pathway was detected in the supplied report."
            second_step = "The scenario remains a lower-priority observation unless missing context changes the assessment."

        intervention = {
            "Energy Isolation": "Verify isolation, lockout/tagout, and zero-energy state before work authorization.",
            "Confined Space": "Stop entry, complete atmospheric testing, issue the permit, and assign a trained attendant.",
            "Hot Work": "Stop hot work, verify gas readings, control ignition sources, and establish a fire watch.",
            "Line of Fire": "Remove personnel from the exclusion zone and secure or depressurize the energy source.",
            "Work at Height": "Stop elevated work and verify engineered fall protection before resuming.",
        }.get(rule, "Apply the strongest available engineering or administrative control before resuming the task.")
        return {
            "input_text": text,
            "starting_assessment": result.get("classification_label", "UNKNOWN"),
            "life_saving_rule": rule,
            "barrier_condition": barrier_condition,
            "steps": [
                {"stage": "Barrier absent or ineffective", "outcome": first_step},
                {"stage": "Potential consequence", "outcome": second_step},
            ],
            "recommended_intervention": intervention,
            "warning": "This is a decision-support scenario, not a prediction that an accident will occur.",
        }

    @staticmethod
    def assess_report_quality(text):
        normalized = text.strip().lower() if isinstance(text, str) else ""
        checks = [
            ("activity", ("activity", "during", "while", "maintenance", "inspection", "welding", "entry")),
            ("location", ("at ", "near ", "inside ", "site", "rig", "plant", "station")),
            ("exposure", ("worker", "technician", "contractor", "operator", "personnel", "exposed")),
            ("barrier", ("without", "missing", "failed", "unsecured", "isolated", "permit", "guard", "testing")),
            ("consequence", ("could", "potential", "risk", "injury", "fatal", "exposure", "struck", "fall")),
        ]
        missing = [
            label for label, terms in checks
            if not any(term in normalized for term in terms)
        ]
        questions = {
            "activity": "What activity was being performed?",
            "location": "Where did the observation occur?",
            "exposure": "Who was exposed, or could have been exposed?",
            "barrier": "Which safety barrier was absent, failed, or effective?",
            "consequence": "What serious consequence could have occurred?",
        }
        return {
            "quality": "INCOMPLETE" if missing else "SUFFICIENT",
            "missing_fields": missing,
            "clarification_questions": [questions[field] for field in missing],
        }

    @staticmethod
    def answer_copilot_question(question):
        analytics = SafetyDashboardHandler.get_analytics(None)
        normalized = question.lower()
        summary = analytics.get("summary", {})
        sources = []

        if any(term in normalized for term in ("site", "location", "installation")) and any(
            term in normalized for term in ("risk", "attention", "highest", "priority")
        ):
            site = summary.get("top_high_risk_site", "N/A")
            ranking = next((row for row in analytics.get("site_rankings", []) if row.get("site_location") == site), None)
            density = ranking.get("sif_density", 0) if ranking else 0
            answer = f"{site} currently has the highest SIF precursor density at {density}% in the loaded dataset."
            sources.append({"type": "site_ranking", "site": site, "sif_density_pct": density})
        elif any(term in normalized for term in ("rule", "lsr", "life-saving")):
            rule = summary.get("top_breached_rule", "N/A")
            count = analytics.get("lsr_distribution", {}).get(rule, 0)
            answer = f"{rule} is the most frequent Life-Saving Rule category, appearing in {count} reports."
            sources.append({"type": "lsr_distribution", "rule": rule, "reports": count})
        elif any(term in normalized for term in ("repeat", "recurr", "pattern", "again")):
            alerts = analytics.get("recurrence_alerts", [])
            if alerts:
                first = alerts[0]
                answer = (
                    f"The leading recurring precursor is {first['precursor_pattern']} at "
                    f"{first['site_location']}, observed {first['occurrences']} times. "
                    f"Recommended response: {first['escalation'].replace('_', ' ').lower()}."
                )
                sources.append({"type": "recurrence_alert", **first})
            else:
                answer = "No repeated SIF precursor pattern currently meets the escalation threshold."
        elif any(term in normalized for term in ("forecast", "next month", "future", "trend")):
            forecast = analytics.get("forecast_data", [])
            answer = analytics.get("forecast_summary", "No forecast is available.")
            sources.append({"type": "forecast", "data": forecast})
        elif any(term in normalized for term in ("how many", "count", "reports", "observations")):
            total = summary.get("total_reports", 0)
            sif = summary.get("sif_reports", 0)
            answer = f"The dataset contains {total} reports, including {sif} SIF-potential reports ({summary.get('sif_rate_pct', 0)}%)."
            sources.append({"type": "summary", "total_reports": total, "sif_reports": sif})
        else:
            answer = (
                "I can answer questions about highest-risk sites, breached Life-Saving Rules, "
                "recurring precursor patterns, forecast trends, and report counts."
            )

        return {
            "question": question.strip(),
            "answer": answer,
            "sources": sources,
            "grounded": True,
            "disclaimer": "Answer generated from the current safety dataset and analytics; validate operational decisions with HSE review.",
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
        csv_path = DATA_DIR / "oil_safety_reports.csv"
        if not csv_path.exists():
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
        csv_path = DATA_DIR / "oil_safety_reports.csv"
        if not csv_path.exists():
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

        recurrence_alerts = SafetyDashboardHandler._build_recurrence_alerts(df)
        risk_matrix = SafetyDashboardHandler._build_risk_matrix(df)

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
            "severity_buckets": severity_buckets,
            "recurrence_alerts": recurrence_alerts,
            "risk_matrix": risk_matrix
        }

    @staticmethod
    def _build_recurrence_alerts(df):
        required_columns = {
            "site_location", "department", "precursor_pattern", "sif_potential"
        }
        if not required_columns.issubset(df.columns):
            return []

        grouped = (
            df[df["sif_potential"] == 1]
            .groupby(["site_location", "department", "precursor_pattern"], dropna=False)
            .agg(occurrences=("report_id", "count"))
            .reset_index()
        )
        grouped = grouped[grouped["occurrences"] >= 2]
        grouped["escalation"] = grouped["occurrences"].map(
            lambda count: "MANAGEMENT_ALERT" if count >= 5 else ("ESCALATE" if count >= 3 else "MONITOR")
        )
        grouped = grouped.sort_values(
            ["occurrences", "site_location", "precursor_pattern"],
            ascending=[False, True, True]
        ).head(25)
        return [
            {
                "site_location": str(row["site_location"]),
                "department": str(row["department"]),
                "precursor_pattern": str(row["precursor_pattern"]),
                "occurrences": int(row["occurrences"]),
                "escalation": row["escalation"],
            }
            for _, row in grouped.iterrows()
        ]

    @staticmethod
    def _build_risk_matrix(df):
        dimensions = [
            "site_location", "department", "iogp_life_saving_rule",
            "barrier_failure_type"
        ]
        if not set(dimensions).issubset(df.columns):
            return []

        grouped = (
            df.groupby(dimensions, dropna=False)
            .agg(
                reports=("report_id", "count"),
                sif_reports=("sif_potential", "sum"),
                average_severity=("sif_severity_score", "mean")
            )
            .reset_index()
        )
        grouped["sif_density_pct"] = (
            grouped["sif_reports"] / grouped["reports"] * 100
        ).round(1)
        grouped["average_severity_pct"] = (
            grouped["average_severity"] * 100
        ).round(1)
        grouped = grouped.sort_values(
            ["sif_density_pct", "sif_reports", "reports"],
            ascending=[False, False, False]
        ).head(50)
        return [
            {
                "site_location": str(row["site_location"]),
                "department": str(row["department"]),
                "iogp_life_saving_rule": str(row["iogp_life_saving_rule"]),
                "barrier_failure_type": str(row["barrier_failure_type"]),
                "reports": int(row["reports"]),
                "sif_reports": int(row["sif_reports"]),
                "sif_density_pct": float(row["sif_density_pct"]),
                "average_severity_pct": float(row["average_severity_pct"]),
            }
            for _, row in grouped.iterrows()
        ]

def run_server(port=8080):
    PUBLIC_DIR.mkdir(exist_ok=True)
    server_address = ('', port)
    httpd = ThreadingHTTPServer(server_address, SafetyDashboardHandler)
    print(f"[SUCCESS] Oil India Safety AI Dashboard Server running at http://localhost:{port}")
    httpd.serve_forever()

if __name__ == "__main__":
    run_server()

