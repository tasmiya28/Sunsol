import joblib
import numpy as np
import matplotlib.pyplot as plt
from sklearn.ensemble import (
    RandomForestRegressor,
    GradientBoostingRegressor)
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score)

X_train  = joblib.load('models/X_train.pkl')
X_test   = joblib.load('models/X_test.pkl')
y_train  = joblib.load('models/y_reg_train.pkl')
y_test   = joblib.load('models/y_reg_test.pkl')
FEATURES = joblib.load('models/feature_names.pkl')

print("=" * 45)
print("SUNSOL REGRESSOR TRAINING")
print("=" * 45)
print(f"Features used  : {len(FEATURES)}")
print(f"Feature list   : {FEATURES}")
print(f"Train samples  : {len(X_train)}")
print(f"Test samples   : {len(X_test)}")

rf_reg = RandomForestRegressor(
    n_estimators=500,
    max_depth=None,
    random_state=42,
    n_jobs=-1
)

gb_reg = GradientBoostingRegressor(
    n_estimators=200,
    learning_rate=0.1,
    max_depth=5,
    random_state=42
)

print("\nTraining Random Forest Regressor...")
rf_reg.fit(X_train, y_train)
rf_pred = rf_reg.predict(X_test)
rf_r2   = r2_score(y_test, rf_pred)
rf_mae  = mean_absolute_error(y_test, rf_pred)
print(f"RF  — R²: {rf_r2:.6f}  "
      f"MAE: {rf_mae:.4f}%")

print("Training Gradient Boosting Regressor...")
gb_reg.fit(X_train, y_train)
gb_pred = gb_reg.predict(X_test)
gb_r2   = r2_score(y_test, gb_pred)
gb_mae  = mean_absolute_error(y_test, gb_pred)
print(f"GB  — R²: {gb_r2:.6f}  "
      f"MAE: {gb_mae:.4f}%")

if rf_r2 >= gb_r2:
    best_reg  = rf_reg
    best_pred = rf_pred
    best_r2   = rf_r2
    best_mae  = rf_mae
    best_rmse = np.sqrt(mean_squared_error(
                    y_test, rf_pred))
    best_name = "Random Forest"
else:
    best_reg  = gb_reg
    best_pred = gb_pred
    best_r2   = gb_r2
    best_mae  = gb_mae
    best_rmse = np.sqrt(mean_squared_error(
                    y_test, gb_pred))
    best_name = "Gradient Boosting"

print(f"\nBest model : {best_name}")
print(f"R²   : {best_r2:.6f}")
print(f"MAE  : {best_mae:.4f} %")
print(f"RMSE : {best_rmse:.4f} %")

plt.figure(figsize=(7, 7))
plt.scatter(y_test, best_pred,
            alpha=0.3, s=8,
            color='#534AB7',
            label='Predictions')
mn = min(y_test.min(), best_pred.min())
mx = max(y_test.max(), best_pred.max())
plt.plot([mn,mx],[mn,mx],
         'r--', linewidth=2,
         label='Perfect fit')
plt.xlabel('Actual efficiency (%)',
           fontsize=12)
plt.ylabel('Predicted efficiency (%)',
           fontsize=12)
plt.title(f'Regression fit  —  '
          f'R² = {best_r2:.4f}',
          fontsize=13)
plt.legend()
plt.tight_layout()
plt.savefig('regression_fit.png', dpi=120)
plt.show()

joblib.dump(best_reg, 'models/regressor.pkl')
print("\nSaved: models/regressor.pkl")
print("\nStep 4 complete — proceed to "
      "step5_verify.py")