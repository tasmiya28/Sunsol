import joblib
import numpy as np
import pandas as pd

clf      = joblib.load('models/classifier.pkl')
reg      = joblib.load('models/regressor.pkl')
scaler   = joblib.load('models/scaler.pkl')
FEATURES = joblib.load('models/feature_names.pkl')

print("=" * 50)
print("SUNSOL LAYER 3 — FINAL VERIFICATION")
print("=" * 50)
print(f"Classifier : {type(clf).__name__}")
print(f"Regressor  : {type(reg).__name__}")
print(f"Scaler     : {type(scaler).__name__}")
print(f"Features   : {len(FEATURES)} features")
print(f"List       : {FEATURES}")

LABEL_MAP = {
    1:'Normal', 2:'Dusty',
    3:'Overheating', 4:'Shaded', 5:'Faulty'
}

# Each row: 11 features in exact FEATURES order
# Irradiance, Temp, Dust, Tilt,
# Vmp, Imp, Pmax, Voc, Isc, FF, Efficiency
test_cases = {
    'Normal panel'  :[1000,25,0.0,35,
                      26.5,7.80,195.0,
                      32.1,8.90,0.740,12.10],
    'Dusty panel'   :[ 700,30,0.6,35,
                      22.0,5.50,115.0,
                      30.5,6.20,0.610, 7.50],
    'Overheating'   :[1000,72,0.0,35,
                      24.0,7.60,175.0,
                      29.5,8.70,0.690,10.80],
    'Shaded panel'  :[ 200,25,0.0,35,
                      18.5,2.10, 35.0,
                      29.0,2.50,0.520, 3.20],
    'Faulty panel'  :[ 150,25,0.8,60,
                      15.0,1.50, 20.0,
                      27.5,1.80,0.480, 2.10],
}

print("\n" + "-"*50)
print(f"{'Case':<16} {'Predicted':<14} "
      f"{'Confidence':>10}  {'η Pred':>8}")
print("-"*50)

all_passed = True
for name, vals in test_cases.items():
    sample    = np.array([vals])
    sample_sc = scaler.transform(sample)
    pred_lbl  = clf.predict(sample_sc)[0]
    pred_prob = max(
        clf.predict_proba(sample_sc)[0]) * 100
    pred_eta  = reg.predict(sample_sc)[0]
    flag = "" if pred_prob >= 60 else " (?)"
    if pred_prob < 50:
        all_passed = False
    print(f"{name:<16} "
          f"{LABEL_MAP[pred_lbl]:<14} "
          f"{pred_prob:>9.1f}%  "
          f"{pred_eta:>7.2f}%{flag}")

print("-"*50)

df = pd.read_excel('SunSol_dataset.xlsx',
                   sheet_name='SolarData')
X_all = scaler.transform(df[FEATURES].values)
all_preds = clf.predict(X_all)
all_eta   = reg.predict(X_all)

from sklearn.metrics import accuracy_score
full_acc = accuracy_score(
    df['Health_label'].values, all_preds)

print(f"\nFull dataset accuracy : "
      f"{full_acc*100:.2f}%")
print(f"Efficiency pred range : "
      f"{all_eta.min():.2f}% "
      f"to {all_eta.max():.2f}%")

print("\n" + "="*50)
if all_passed:
    print("ALL CHECKS PASSED")
    print("Layer 3 complete — ready for Layer 4")
    print("Files in models/ folder:")
    import os
    for f in sorted(os.listdir('models')):
        size = os.path.getsize(
                   f'models/{f}') / 1024
        print(f"  {f:<25} {size:>7.1f} KB")
else:
    print("WARNING — some predictions low confidence")
    print("Consider retraining with more data")
print("="*50)