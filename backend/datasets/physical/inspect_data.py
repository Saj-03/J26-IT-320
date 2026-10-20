import pandas as pd

path = r"d:\RP\J26-IT-320\backend\datasets\physical\Responses 1 - Form responses 1.csv"
df = pd.read_csv(path)
print(f"Total Student Survey Columns: {len(df.columns)}")
with open(r"d:\RP\J26-IT-320\backend\datasets\physical\student_cols.txt", "w", encoding="utf-8") as f:
    for i, col in enumerate(df.columns):
        f.write(f"{i}: {col}\n")
print("Saved columns to student_cols.txt")
