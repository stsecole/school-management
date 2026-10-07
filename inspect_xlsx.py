#!/usr/bin/env python3
"""Inspect Excel files: sheets, headers, sample rows, dtypes, merged cells."""
import sys
import openpyxl
import pandas as pd

FILES = [
    "/home/z/my-project/upload/متابعة المهام.xlsx",
    "/home/z/my-project/upload/قوائم-الحضور (4).xlsx",
    "/home/z/my-project/upload/تسجيلات-تقني-سامي-فيفري-2023.xlsx",
]


def inspect(path):
    print("=" * 100)
    print("FILE:", path)
    print("=" * 100)

    # 1) openpyxl pass: sheet names, dims, merged cells, raw header rows
    try:
        wb = openpyxl.load_workbook(path, data_only=True, read_only=False)
    except Exception as e:
        print("  [openpyxl load error]", e)
        wb = None

    if wb is not None:
        print("Sheet names (openpyxl):", wb.sheetnames)
        for ws in wb.worksheets:
            print("\n  ---- SHEET (openpyxl):", repr(ws.title), "----")
            print("   max_row:", ws.max_row, "max_col:", ws.max_column)
            # merged ranges (first 20)
            merged = list(ws.merged_cells.ranges)
            print("   merged ranges count:", len(merged))
            for mr in merged[:20]:
                print("      merged:", str(mr))
            # Print first 6 raw rows as lists (truncated cells)
            for ridx, row in enumerate(ws.iter_rows(min_row=1, max_row=6, values_only=True), start=1):
                cells = [("" if v is None else str(v))[:40] for v in row]
                print(f"   row{ridx}:", cells)

    # 2) pandas pass: per-sheet DataFrame with header inference
    try:
        xls = pd.ExcelFile(path)
    except Exception as e:
        print("  [pandas open error]", e)
        return
    print("\n  pandas sheet names:", xls.sheet_names)
    for sheet in xls.sheet_names:
        print("\n  ==== pandas SHEET:", repr(sheet), "====")
        # Read with no header first to see raw top rows
        try:
            raw = pd.read_excel(path, sheet_name=sheet, header=None, nrows=8)
        except Exception as e:
            print("    [read error header=None]", e)
            continue
        print("    raw top 8 rows (no header):")
        for i, row in raw.iterrows():
            vals = [("" if pd.isna(v) else str(v))[:35] for v in row.tolist()]
            print(f"      r{i}:", vals)

        # Try header=0 read
        try:
            df = pd.read_excel(path, sheet_name=sheet, header=0)
        except Exception as e:
            print("    [read error header=0]", e)
            continue
        print("    shape (header=0):", df.shape)
        print("    columns:", list(df.columns))
        print("    dtypes:")
        for c in df.columns:
            print(f"       {c!r}: {df[c].dtype}")
        print("    first 5 rows:")
        with pd.option_context("display.max_columns", None, "display.width", 200,
                               "display.max_colwidth", 40):
            print(df.head(5).to_string(index=False))
        # Non-null counts and unique sample values
        print("    non-null counts:")
        print(df.count().to_string())
        print("    unique value samples (first 5 uniques per col, max 8 cols):")
        for c in list(df.columns)[:12]:
            uniques = df[c].dropna().astype(str).unique()[:5]
            print(f"       {c!r}: {list(uniques)}")
    print("\n")


def main():
    for f in FILES:
        try:
            inspect(f)
        except Exception as e:
            print("ERROR inspecting", f, "->", repr(e))


if __name__ == "__main__":
    main()
