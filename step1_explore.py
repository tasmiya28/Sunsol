import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

df = pd.read_excel('SunSol_dataset.xlsx',
                   sheet_name='SolarData')

FEATURES = [
    'Irradiance_Wm2', 'Temperature_C',
    'Dust_factor', 'Tilt_deg',
    'Vmp_V', 'Imp_A', 'Pmax_W',
    'Voc_V', 'Isc_A', 'FF',
    'Efficiency_pct'
]

print("=" * 45)
print("SUNSOL DATASET EXPLORATION")
print("=" * 45)
print(f"Shape          : {df.shape}")
print(f"Total features : {len(FEATURES)}")
print(f"Feature list   : {FEATURES}")
print(f"\nHealth class distribution:")
print(df['Health_state'].value_counts())
print(f"\nHealth label counts:")
print(df['Health_label'].value_counts().sort_index())
print(f"\nFeature statistics:")
print(df[FEATURES].describe().round(3))

missing = df[FEATURES].isnull().sum()
print(f"\nMissing values per feature:")
print(missing)

fig, axes = plt.subplots(2, 3, figsize=(16, 9))
colors = ['#1D9E75','#534AB7','#E24B4A',
          '#BA7517','#888780']

counts = df['Health_state'].value_counts()
axes[0,0].bar(counts.index, counts.values,
              color=colors[:len(counts)])
axes[0,0].set_title('Health class distribution')
axes[0,0].set_xlabel('Health state')
axes[0,0].set_ylabel('Count')
axes[0,0].tick_params(axis='x', rotation=15)

axes[0,1].hist(df['Efficiency_pct'], bins=40,
               color='#534AB7', alpha=0.8)
axes[0,1].set_title('Efficiency distribution')
axes[0,1].set_xlabel('Efficiency (%)')
axes[0,1].set_ylabel('Count')

axes[0,2].hist(df['Irradiance_Wm2'], bins=30,
               color='#1D9E75', alpha=0.8)
axes[0,2].set_title('Irradiance distribution')
axes[0,2].set_xlabel('W/m²')
axes[0,2].set_ylabel('Count')

axes[1,0].hist(df['Temperature_C'], bins=30,
               color='#E24B4A', alpha=0.8)
axes[1,0].set_title('Temperature distribution')
axes[1,0].set_xlabel('°C')
axes[1,0].set_ylabel('Count')

axes[1,1].scatter(df['Irradiance_Wm2'],
                  df['Efficiency_pct'],
                  c=df['Health_label'],
                  cmap='tab10', s=5, alpha=0.5)
axes[1,1].set_title('Irradiance vs Efficiency')
axes[1,1].set_xlabel('Irradiance (W/m²)')
axes[1,1].set_ylabel('Efficiency (%)')

axes[1,2].scatter(df['Temperature_C'],
                  df['Pmax_W'],
                  c=df['Health_label'],
                  cmap='tab10', s=5, alpha=0.5)
axes[1,2].set_title('Temperature vs Pmax')
axes[1,2].set_xlabel('Temperature (°C)')
axes[1,2].set_ylabel('Pmax (W)')

plt.tight_layout()
plt.savefig('exploration.png', dpi=120)
plt.show()
print("\nSaved: exploration.png")
print("Step 1 complete — proceed to step2_preprocess.py")