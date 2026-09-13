import os
import pickle
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, recall_score, f1_score, precision_score

try:
    from src.domain_tokenizer import UpstreamDomainTokenizer
except ModuleNotFoundError:
    from domain_tokenizer import UpstreamDomainTokenizer

domain_tokenizer = UpstreamDomainTokenizer()

# Ensure models directory exists
os.makedirs("models", exist_ok=True)

def train_sif_models(data_path="data/oil_safety_reports.csv"):
    print("==========================================================")
    print("      TRAINING OIL SAFETY AI & SIF CLASSIFIER MODELS      ")
    print("==========================================================")
    
    if not os.path.exists(data_path):
        print(f"[ERROR] Training dataset {data_path} not found.")
        return False

    # 1. Load Dataset
    df = pd.read_csv(data_path)
    print(f"Loaded {len(df)} records from {data_path}")

    # Prepare features and targets with Layer 1 normalization
    X_raw = df['description'].fillna("")
    X_text = [domain_tokenizer.normalize(txt)[0] for txt in X_raw]
    y_sif = df['sif_potential']
    y_lsr = df['iogp_life_saving_rule']

    # 2. Fit TF-IDF Vectorizer
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=4000,
        sublinear_tf=True,
        stop_words='english'
    )
    X_vec = vectorizer.fit_transform(X_text)

    # 3. Train SIF Classifier (Logistic Regression with class weighting)
    sif_classifier = LogisticRegression(
        C=2.0,
        class_weight='balanced',
        max_iter=1000,
        random_state=42
    )
    sif_classifier.fit(X_vec, y_sif)

    # 4. Train IOGP Life-Saving Rules Classifier
    lsr_classifier = RandomForestClassifier(
        n_estimators=100,
        random_state=42,
        class_weight='balanced'
    )
    lsr_classifier.fit(X_vec, y_lsr)

    # 5. Evaluate Performance (Training & 5-Fold Cross-Validation)
    from sklearn.model_selection import cross_val_score, StratifiedKFold
    from sklearn.metrics import accuracy_score, roc_auc_score

    y_sif_pred = sif_classifier.predict(X_vec)
    acc = accuracy_score(y_sif, y_sif_pred)
    rec = recall_score(y_sif, y_sif_pred)
    prec = precision_score(y_sif, y_sif_pred)
    f1 = f1_score(y_sif, y_sif_pred)

    # 5-Fold Cross Validation Evaluation
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_acc = cross_val_score(sif_classifier, X_vec, y_sif, cv=skf, scoring='accuracy').mean()
    cv_rec = cross_val_score(sif_classifier, X_vec, y_sif, cv=skf, scoring='recall').mean()
    cv_prec = cross_val_score(sif_classifier, X_vec, y_sif, cv=skf, scoring='precision').mean()
    cv_f1 = cross_val_score(sif_classifier, X_vec, y_sif, cv=skf, scoring='f1').mean()

    print("\n--- SIF CLASSIFIER EVALUATION METRICS ---")
    print(f"  * SIF Accuracy:                {acc*100:.2f}% (5-Fold CV Accuracy: {cv_acc*100:.2f}%)")
    print(f"  * SIF Recall (Critical Target): {rec*100:.2f}% (5-Fold CV Recall:   {cv_rec*100:.2f}%)")
    print(f"  * SIF Precision:               {prec*100:.2f}% (5-Fold CV Precision: {cv_prec*100:.2f}%)")
    print(f"  * Macro F1-Score:              {f1*100:.2f}% (5-Fold CV F1-Score:  {cv_f1*100:.2f}%)")
    print("\nDetailed Classification Report:")
    print(classification_report(y_sif, y_sif_pred, target_names=["Non-SIF (0)", "SIF-Potential (1)"]))

    # 6. Save Model Artifacts
    vec_path = os.path.join("models", "tfidf_vectorizer.pkl")
    sif_path = os.path.join("models", "sif_classifier.pkl")
    lsr_path = os.path.join("models", "lsr_classifier.pkl")

    with open(vec_path, "wb") as f:
        pickle.dump(vectorizer, f)
    with open(sif_path, "wb") as f:
        pickle.dump(sif_classifier, f)
    with open(lsr_path, "wb") as f:
        pickle.dump(lsr_classifier, f)

    print(f"[SUCCESS] Serialized vectorizer -> {vec_path}")
    print(f"[SUCCESS] Serialized SIF model -> {sif_path}")
    print(f"[SUCCESS] Serialized LSR model -> {lsr_path}")
    return True

if __name__ == "__main__":
    train_sif_models("data/oil_safety_reports.csv")
