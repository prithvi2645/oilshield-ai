import argparse
from pathlib import Path

import pandas as pd

REQUIRED_COLUMNS = {
    "report_id",
    "date",
    "site_location",
    "department",
    "description",
    "sif_potential",
    "sif_severity_score",
    "iogp_life_saving_rule",
    "barrier_failure_type",
    "precursor_pattern",
}


def validate_dataset(data_path="data/oil_safety_reports.csv"):
    path = Path(data_path)
    errors = []
    if not path.exists():
        return {"valid": False, "path": str(path), "rows": 0, "errors": ["Dataset file does not exist"]}

    try:
        frame = pd.read_csv(path)
    except (OSError, pd.errors.ParserError, UnicodeDecodeError) as error:
        return {"valid": False, "path": str(path), "rows": 0, "errors": [f"Could not read dataset: {error}"]}

    missing = sorted(REQUIRED_COLUMNS - set(frame.columns))
    if missing:
        errors.append(f"Missing required columns: {', '.join(missing)}")

    if frame.empty:
        errors.append("Dataset has no rows")

    if "report_id" in frame:
        if frame["report_id"].isna().any():
            errors.append("report_id contains null values")
        if frame["report_id"].duplicated().any():
            errors.append("report_id contains duplicates")

    if "date" in frame and frame["date"].notna().any():
        invalid_dates = pd.to_datetime(frame["date"], errors="coerce").isna().sum()
        if invalid_dates:
            errors.append(f"date contains {int(invalid_dates)} invalid values")

    if "sif_potential" in frame:
        values = set(frame["sif_potential"].dropna().unique())
        if not values.issubset({0, 1}):
            errors.append("sif_potential must contain only 0 or 1")

    if "sif_severity_score" in frame:
        scores = pd.to_numeric(frame["sif_severity_score"], errors="coerce")
        if scores.isna().any() or ((scores < 0) | (scores > 1)).any():
            errors.append("sif_severity_score must be numeric values from 0 to 1")

    text_columns = REQUIRED_COLUMNS - {"sif_potential", "sif_severity_score", "date"}
    for column in text_columns.intersection(frame.columns):
        if frame[column].isna().any():
            errors.append(f"{column} contains null values")

    return {
        "valid": not errors,
        "path": str(path),
        "rows": int(len(frame)),
        "columns": list(frame.columns),
        "errors": errors,
    }


def main():
    parser = argparse.ArgumentParser(description="Validate the OIL safety report dataset")
    parser.add_argument("data_path", nargs="?", default="data/oil_safety_reports.csv")
    args = parser.parse_args()
    result = validate_dataset(args.data_path)
    if result["valid"]:
        print(f"Dataset validation passed: {result['rows']} rows")
        return 0
    print("Dataset validation failed:")
    for error in result["errors"]:
        print(f"- {error}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
