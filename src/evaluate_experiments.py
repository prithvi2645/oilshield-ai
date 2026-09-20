import os
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, classification_report
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, ExtraTreesClassifier
from sklearn.svm import SVC
from sklearn.naive_bayes import MultinomialNB

try:
    from src.domain_tokenizer import UpstreamDomainTokenizer
except ModuleNotFoundError:
    from domain_tokenizer import UpstreamDomainTokenizer


def build_evaluation_pipeline(model):
    """Build a fold-safe text model so TF-IDF learns only from each train fold."""
    return Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=4000,
            sublinear_tf=True,
            stop_words="english"
        )),
        ("model", model),
    ])

def run_experiments(data_path="data/oil_safety_reports.csv"):
    if not os.path.exists(data_path):
        print(f"[ERROR] Data file {data_path} not found.")
        return

    df = pd.read_csv(data_path)
    print(f"Loaded dataset with {len(df)} records.")

    domain_tokenizer = UpstreamDomainTokenizer()
    X_raw = df['description'].fillna("")
    X_text = [domain_tokenizer.normalize(txt)[0] for txt in X_raw]
    y_sif = df['sif_potential']

    # Candidate Algorithms & Hyperparameters
    models = {
        "Logistic Regression (C=0.5)": LogisticRegression(C=0.5, class_weight='balanced', max_iter=1000, random_state=42),
        "Logistic Regression (C=1.0)": LogisticRegression(C=1.0, class_weight='balanced', max_iter=1000, random_state=42),
        "Logistic Regression (C=2.0) [Current]": LogisticRegression(C=2.0, class_weight='balanced', max_iter=1000, random_state=42),
        "Logistic Regression (C=5.0)": LogisticRegression(C=5.0, class_weight='balanced', max_iter=1000, random_state=42),
        "Random Forest (n=100)": RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42),
        "Random Forest (n=200, depth=10)": RandomForestClassifier(n_estimators=200, max_depth=10, class_weight='balanced', random_state=42),
        "Support Vector Machine (SVC Linear, C=1.0)": SVC(C=1.0, kernel='linear', class_weight='balanced', random_state=42, probability=True),
        "Support Vector Machine (SVC RBF, C=1.0)": SVC(C=1.0, kernel='rbf', class_weight='balanced', random_state=42, probability=True),
        "Multinomial Naive Bayes (alpha=0.5)": MultinomialNB(alpha=0.5),
        "Gradient Boosting (n=100, lr=0.1)": GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, random_state=42),
        "Extra Trees Classifier (n=100)": ExtraTreesClassifier(n_estimators=100, class_weight='balanced', random_state=42)
    }

    scoring = ['accuracy', 'precision', 'recall', 'f1', 'roc_auc']
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    results = []

    print("\n" + "="*80)
    print("       MODEL BENCHMARKING & HYPERPARAMETER EVALUATION (5-FOLD STRATIFIED CV)     ")
    print("="*80)

    for name, model in models.items():
        evaluation_pipeline = build_evaluation_pipeline(model)
        cv_results = cross_validate(evaluation_pipeline, X_text, y_sif, cv=cv, scoring=scoring)
        acc_mean = cv_results['test_accuracy'].mean() * 100
        prec_mean = cv_results['test_precision'].mean() * 100
        rec_mean = cv_results['test_recall'].mean() * 100
        f1_mean = cv_results['test_f1'].mean() * 100
        auc_mean = cv_results['test_roc_auc'].mean() * 100

        results.append({
            "Algorithm / Configuration": name,
            "Accuracy (%)": acc_mean,
            "Precision (%)": prec_mean,
            "Recall (%)": rec_mean,
            "F1 Score (%)": f1_mean,
            "ROC-AUC (%)": auc_mean
        })

    results_df = pd.DataFrame(results).sort_values(by="Accuracy (%)", ascending=False)
    
    print("\n" + results_df.to_string(index=False))
    print("="*80)

if __name__ == "__main__":
    run_experiments()
