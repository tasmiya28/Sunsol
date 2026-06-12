import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib
import os

df = pd.read_excel('SunSol_dataset.xlsx',
                   sheet_name='SolarData')

FEATURES = [
    'Irradiance_Wm2', 'Temperature_C',
    'Dust_factor', 'Tilt_deg',
    'Vmp_V', 'Imp_A', 'Pmax_W',
    'Voc_V', 'Isc_A', 'FF',
    'Efficiency_pct'
]
CLF_TARGET = 'Health_label'
REG_TARGET = 'Efficiency_pct'

print("=" * 45)
print("SUNSOL PREPROCESSING")
print("=" * 45)
print(f"Total rows     : {len(df)}")
print(f"Features used  : {len(FEATURES)}")
print(f"Feature list   : {FEATURES}")
print(f"Classes present: "
      f"{sorted(df[CLF_TARGET].unique())}")

X     = df[FEATURES].values
y_clf = df[CLF_TARGET].values.astype(int)
y_reg = df[REG_TARGET].values

X_tr, X_te, \
yc_tr, yc_te, \
yr_tr, yr_te = train_test_split(
    X, y_clf, y_reg,
    test_size=0.2,
    random_state=42,
    stratify=y_clf)

scaler  = StandardScaler()
X_tr_sc = scaler.fit_transform(X_tr)
X_te_sc = scaler.transform(X_te)

os.makedirs('models', exist_ok=True)

joblib.dump(scaler,   'models/scaler.pkl')
joblib.dump(X_tr_sc,  'models/X_train.pkl')
joblib.dump(X_te_sc,  'models/X_test.pkl')
joblib.dump(yc_tr,    'models/y_clf_train.pkl')
joblib.dump(yc_te,    'models/y_clf_test.pkl')
joblib.dump(yr_tr,    'models/y_reg_train.pkl')
joblib.dump(yr_te,    'models/y_reg_test.pkl')
joblib.dump(FEATURES, 'models/feature_names.pkl')

print(f"\nTrain rows     : {len(X_tr_sc)}")
print(f"Test rows      : {len(X_te_sc)}")
print(f"\nClass split in train:")
unique, counts = np.unique(yc_tr,
                           return_counts=True)
labels = {1:'Normal',2:'Dusty',
          3:'Overheating',4:'Shaded',5:'Faulty'}
for u, c in zip(unique, counts):
    print(f"  {labels[u]:12s}: {c} rows "
          f"({100*c/len(yc_tr):.1f}%)")

print("\nSaved to models/ folder:")
print("  scaler.pkl  X_train.pkl  X_test.pkl")
print("  y_clf_train.pkl  y_clf_test.pkl")
print("  y_reg_train.pkl  y_reg_test.pkl")
print("  feature_names.pkl")
print("\nStep 2 complete — proceed to "
      "step3_train_classifier.py")