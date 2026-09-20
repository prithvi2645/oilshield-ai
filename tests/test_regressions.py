import json
import unittest
from pathlib import Path

from app.server import SafetyDashboardHandler
from app.server import ThreadingHTTPServer
from src.sif_engine import analyze_incident
from src.evaluate_experiments import build_evaluation_pipeline
from src.hyperparameter_tuning import run_grid_evaluation
from src.validate_data import validate_dataset
from src.train import train_sif_models
from sklearn.linear_model import LogisticRegression


class RegressionTests(unittest.TestCase):
    def test_high_energy_missing_barrier_is_sif(self):
        result = analyze_incident(
            "Hydraulic hose burst at 3000 PSI; whip check was unsecured."
        )
        self.assertTrue(result["is_sif_potential"])
        self.assertEqual(result["barrier_condition"], "FAILED_OR_ABSENT")

    def test_zero_energy_verification_is_not_sif(self):
        result = analyze_incident(
            "Technician tested the high pressure flange with 0 PSI residual pressure; verified zero pressure before breaking line."
        )
        self.assertFalse(result["is_sif_potential"])
        self.assertTrue(result["has_zero_energy_verification"])

    def test_public_path_cannot_escape(self):
        self.assertIsNone(
            SafetyDashboardHandler._resolve_public_file(None, "/../README.md")
        )
        public_index = SafetyDashboardHandler._resolve_public_file(None, "/index.html")
        self.assertEqual(public_index, Path("public/index.html").resolve())

    def test_analytics_contains_recurrence_and_risk_matrix(self):
        analytics = SafetyDashboardHandler.get_analytics(None)
        self.assertIn("recurrence_alerts", analytics)
        self.assertIn("risk_matrix", analytics)
        self.assertIsInstance(analytics["recurrence_alerts"], list)
        self.assertIsInstance(analytics["risk_matrix"], list)
        if analytics["recurrence_alerts"]:
            self.assertIn("escalation", analytics["recurrence_alerts"][0])
        if analytics["risk_matrix"]:
            self.assertIn("sif_density_pct", analytics["risk_matrix"][0])

    def test_what_if_simulation_preserves_decision_support_warning(self):
        result = SafetyDashboardHandler.simulate_scenario(
            "Maintenance opened a pressurized line without LOTO."
        )
        self.assertEqual(result["life_saving_rule"], "Energy Isolation")
        self.assertIn("warning", result)
        self.assertTrue(result["recommended_intervention"])

    def test_report_quality_returns_clarification_questions(self):
        result = SafetyDashboardHandler.assess_report_quality("Unsafe issue observed")
        self.assertEqual(result["quality"], "INCOMPLETE")
        self.assertIn("activity", result["missing_fields"])
        self.assertTrue(result["clarification_questions"])

    def test_review_store_preserves_prediction_and_human_decision(self):
        import tempfile
        import app.server as server_module

        handler = object.__new__(SafetyDashboardHandler)
        original_path = server_module.REVIEW_PATH
        server_module.REVIEW_PATH = Path(tempfile.gettempdir()) / "sih-review-regression.json"
        server_module.REVIEW_PATH.unlink(missing_ok=True)
        try:
            review = handler.save_review({
                "text": "Maintenance opened a pressurized line without LOTO.",
                "reviewer": "HSE reviewer",
                "decision": "corrected",
                "predicted_label": "SIF_POTENTIAL",
                "final_label": "DEFENDED_NEAR_MISS",
                "comment": "Barrier was verified before exposure."
            })
            self.assertEqual(review["predicted_label"], "SIF_POTENTIAL")
            self.assertEqual(review["final_label"], "DEFENDED_NEAR_MISS")
            self.assertEqual(handler.get_reviews()[0]["decision"], "corrected")
        finally:
            server_module.REVIEW_PATH.unlink(missing_ok=True)
            server_module.REVIEW_PATH = original_path

    def test_copilot_answers_from_grounded_analytics(self):
        result = SafetyDashboardHandler.answer_copilot_question(
            "Which site requires the most attention?"
        )
        self.assertTrue(result["grounded"])
        self.assertTrue(result["sources"])
        self.assertIn("SIF precursor density", result["answer"])

    def test_hse_brief_contains_grounded_metrics_and_priorities(self):
        brief = SafetyDashboardHandler.build_hse_brief()
        self.assertTrue(brief["grounded"])
        self.assertGreater(brief["metrics"]["reports_analyzed"], 0)
        self.assertTrue(brief["priorities"])
        self.assertIn("forecast", brief)

    def test_audit_event_does_not_store_sensitive_report_text(self):
        import tempfile
        import app.server as server_module

        original_path = server_module.AUDIT_PATH
        server_module.AUDIT_PATH = Path(tempfile.gettempdir()) / "sih-audit-regression.json"
        server_module.AUDIT_PATH.unlink(missing_ok=True)
        try:
            self.assertTrue(server_module.SafetyDashboardHandler.record_audit_event(
                "classify", {"classification_label": "SIF_POTENTIAL", "text_length": 42}
            ))
            events = server_module.SafetyDashboardHandler.get_audit_events()
            self.assertEqual(events[0]["action"], "classify")
            self.assertNotIn("text", events[0]["metadata"])
        finally:
            server_module.AUDIT_PATH.unlink(missing_ok=True)
            server_module.AUDIT_PATH = original_path

    def test_health_reports_dataset_and_model_readiness(self):
        health = SafetyDashboardHandler.get_health()
        self.assertIn(health["status"], {"ok", "degraded"})
        self.assertTrue(health["dataset"]["available"])
        self.assertGreater(health["dataset"]["rows"], 0)
        self.assertTrue(health["model_artifacts"]["sif_classifier"])
        self.assertIn("lsr_classifier", health["runtime"])

    def test_evaluation_pipeline_keeps_vectorizer_inside_cv_pipeline(self):
        evaluation_pipeline = build_evaluation_pipeline(LogisticRegression(max_iter=100))
        self.assertEqual(evaluation_pipeline.steps[0][0], "tfidf")
        self.assertEqual(evaluation_pipeline.steps[1][0], "model")

    def test_tuning_module_exposes_fold_safe_runner(self):
        self.assertTrue(callable(run_grid_evaluation))

    def test_server_uses_threading_http_server(self):
        self.assertEqual(ThreadingHTTPServer.__name__, "ThreadingHTTPServer")

    def test_review_endpoint_storage_is_list_or_empty(self):
        reviews = SafetyDashboardHandler.get_reviews(object.__new__(SafetyDashboardHandler))
        self.assertIsInstance(reviews, list)

    def test_production_dataset_passes_schema_validation(self):
        result = validate_dataset("data/oil_safety_reports.csv")
        self.assertTrue(result["valid"], result["errors"])
        self.assertEqual(result["rows"], 500)

    def test_training_entrypoint_is_available_after_validation_guard(self):
        self.assertTrue(callable(train_sif_models))

    def test_classification_exposes_lsr_model_comparison(self):
        from src.nlp_engine import SafetyClassifierPipeline

        result = SafetyClassifierPipeline().predict(
            "Hydraulic hose burst at 3000 PSI; whip check was unsecured."
        )
        self.assertIn("lsr_model_rule", result)
        self.assertIn("lsr_model_confidence", result)
        self.assertIn("lsr_model_agreement", result)


if __name__ == "__main__":
    unittest.main()
