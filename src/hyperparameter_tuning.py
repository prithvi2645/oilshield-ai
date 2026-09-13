import os
import sys
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.metrics import accuracy_score, recall_score, f1_score
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier

try:
    from src.domain_tokenizer import UpstreamDomainTokenizer
except ModuleNotFoundError:
    from domain_tokenizer import UpstreamDomainTokenizer

def run_grid_evaluation(data_path="data/oil_safety_reports.csv"):
    if not os.path.exists(data_path):
        print(f"[ERROR] Data file {data_path} not found.", flush=True)
        return

    df = pd.read_csv(data_path)
    print(f"Loaded {len(df)} records from {data_path}\n", flush=True)

    domain_tokenizer = UpstreamDomainTokenizer()
    X_raw = df['description'].fillna("")
    X_text = [domain_tokenizer.normalize(txt)[0] for txt in X_raw]
    y_sif = df['sif_potential']
    y_lsr = df['iogp_life_saving_rule']

    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=4000,
        sublinear_tf=True,
        stop_words='english'
    )
    X_vec = vectorizer.fit_transform(X_text)
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    # 1. SIF CLASSIFIER (Logistic Regression) Hyperparameters
    print("="*85, flush=True)
    print(" 1. SIF CLASSIFIER (LogisticRegression) - HYPERPARAMETER ACCURACY MATRIX ", flush=True)
    print("="*85, flush=True)

    c_values = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 50.0]
    class_weights = ['balanced', None]
    
    sif_results = []
    for cw in class_weights:
        for c in c_values:
            clf = LogisticRegression(C=c, class_weight=cw, max_iter=1000, random_state=42)
            clf.fit(X_vec, y_sif)
            y_pred = clf.predict(X_vec)

            train_acc = accuracy_score(y_sif, y_pred) * 100
            train_rec = recall_score(y_sif, y_pred) * 100

            cv_acc = cross_val_score(clf, X_vec, y_sif, cv=skf, scoring='accuracy').mean() * 100
            cv_rec = cross_val_score(clf, X_vec, y_sif, cv=skf, scoring='recall').mean() * 100
            cv_f1 = cross_val_score(clf, X_vec, y_sif, cv=skf, scoring='f1').mean() * 100

            sif_results.append({
                "C Param": c,
                "Class Weight": str(cw),
                "Train Acc (%)": f"{train_acc:.2f}%",
                "5-Fold CV Acc (%)": f"{cv_acc:.2f}%",
                "CV Recall (%)": f"{cv_rec:.2f}%",
                "CV F1 (%)": f"{cv_f1:.2f}%"
            })

    sif_df = pd.DataFrame(sif_results)
    print(sif_df.to_string(index=False), flush=True)

    # 2. LSR CLASSIFIER (RandomForestClassifier) Hyperparameters
    print("\n" + "="*85, flush=True)
    print(" 2. LSR CLASSIFIER (RandomForestClassifier) - HYPERPARAMETER ACCURACY MATRIX ", flush=True)
    print("="*85, flush=True)

    n_estimators_list = [25, 50, 100, 200]
    max_depths = [None, 5, 10, 15]
    
    lsr_results = []
    for n in n_estimators_list:
        for md in max_depths:
            rf = RandomForestClassifier(
                n_estimators=n,
                max_depth=md,
                class_weight='balanced',
                random_state=42
            )
            rf.fit(X_vec, y_lsr)
            y_pred_lsr = rf.predict(X_vec)

            train_acc = accuracy_score(y_lsr, y_pred_lsr) * 100
            cv_acc = cross_val_score(rf, X_vec, y_lsr, cv=skf, scoring='accuracy').mean() * 100

            lsr_results.append({
                "n_estimators": n,
                "max_depth": str(md),
                "Class Weight": "balanced",
                "Train Acc (%)": f"{train_acc:.2f}%",
                "5-Fold CV Acc (%)": f"{cv_acc:.2f}%"
            })

    lsr_df = pd.DataFrame(lsr_results)
    print(lsr_df.to_string(index=False), flush=True)
    print("="*85, flush=True)

if __name__ == "__main__":
    run_grid_evaluation()
