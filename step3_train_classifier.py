import joblib
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.ensemble import (
    RandomForestClassifier, GradientBoostingClassifier,
    VotingClassifier)
from sklearn.metrics import (
    accuracy_score, classification_report,
    confusion_matrix)

X_train  = joblib.load('models/X_train.pkl')
X_test   = joblib.load('models/X_test.pkl')
y_train  = joblib.load('models/y_clf_train.pkl')
y_test   = joblib.load('models/y_clf_test.pkl')
FEATURES = joblib.load('models/feature_names.pkl')

print("=" * 45)
print("SUNSOL CLASSIFIER TRAINING")
print("=" * 45)
print(f"Features used : {len(FEATURES)}")
print(f"Feature list  : {FEATURES}")
print(f"Train samples : {len(X_train)}")
print(f"Test samples  : {len(X_test)}")
print(f"Classes       : [1,2,3,4,5]")

rf = RandomForestClassifier(
    n_estimators=500,
    max_depth=None,
    min_samples_split=2,
    min_samples_leaf=1,
    max_features='sqrt',
    random_state=42,
    n_jobs=-1,
    class_weight='balanced'
)

gb = GradientBoostingClassifier(
    n_estimators=200,
    learning_rate=0.1,
    max_depth=5,
    random_state=42
)

voting_clf = VotingClassifier(
    estimators=[('rf', rf), ('gb', gb)],
    voting='soft',
    n_jobs=-1
)

print("\nTraining Random Forest...")
rf.fit(X_train, y_train)
rf_pred = rf.predict(X_test)
rf_acc  = accuracy_score(y_test, rf_pred)
print(f"Random Forest accuracy : {rf_acc*100:.2f}%")

print("Training Gradient Boosting...")
gb.fit(X_train, y_train)
gb_pred = gb.predict(X_test)
gb_acc  = accuracy_score(y_test, gb_pred)
print(f"Gradient Boosting accuracy : {gb_acc*100:.2f}%")

print("Training Voting Ensemble...")
voting_clf.fit(X_train, y_train)
v_pred = voting_clf.predict(X_test)
v_acc  = accuracy_score(y_test, v_pred)
print(f"Voting Ensemble accuracy   : {v_acc*100:.2f}%")

best_model = voting_clf
best_pred  = v_pred
best_acc   = v_acc
print(f"\nBest model : Voting Ensemble")
print(f"Final accuracy : {best_acc*100:.2f}%")

LABELS     = ['Normal','Dusty','Overheating',
              'Shaded','Faulty']
LABEL_NUMS = [1, 2, 3, 4, 5]

print("\nClassification report:")
print(classification_report(
    y_test, best_pred,
    labels=LABEL_NUMS,
    target_names=LABELS))

cm = confusion_matrix(y_test, best_pred,
                      labels=LABEL_NUMS)
plt.figure(figsize=(9, 7))
sns.heatmap(cm, annot=True, fmt='d',
            cmap='Purples',
            xticklabels=LABELS,
            yticklabels=LABELS,
            annot_kws={'size': 13})
plt.title(f'Confusion matrix  —  '
          f'accuracy {best_acc*100:.2f}%',
          fontsize=14)
plt.ylabel('Actual', fontsize=12)
plt.xlabel('Predicted', fontsize=12)
plt.tight_layout()
plt.savefig('confusion_matrix.png', dpi=120)
plt.show()

imp  = rf.feature_importances_
order = np.argsort(imp)[::-1]
plt.figure(figsize=(10, 5))
plt.bar([FEATURES[i] for i in order],
        imp[order],
        color='#534AB7', alpha=0.85)
plt.title('Feature importances '
          '(Random Forest — 11 features)')
plt.ylabel('Importance score')
plt.xticks(rotation=25, ha='right')
plt.tight_layout()
plt.savefig('feature_importance.png', dpi=120)
plt.show()

joblib.dump(best_model, 'models/classifier.pkl')
joblib.dump(rf,         'models/rf_classifier.pkl')
print("\nSaved: models/classifier.pkl")
print("Saved: models/rf_classifier.pkl")
print("\nStep 3 complete — proceed to "
      "step4_train_regressor.py")