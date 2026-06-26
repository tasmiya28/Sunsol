# SunSol - AI-Powered Solar Panel Monitoring & Predictive Analytics System

An end-to-end AI-driven photovoltaic monitoring system that integrates MATLAB Simulink, Machine Learning, Flask, and React to simulate solar panel behavior, predict panel health, estimate efficiency, and provide intelligent maintenance recommendations through a real-time dashboard.

---

## Overview

SunSol is a simulation-first solar panel monitoring platform designed to improve photovoltaic system performance without relying on expensive physical sensor infrastructure during development.

The system combines physics-based simulation with machine learning and full-stack web technologies to deliver:

- Real-time monitoring
- Solar panel health prediction
- Efficiency estimation
- Intelligent maintenance recommendations
- Interactive dashboard
- Automated PDF and Excel report generation

---

## Features

- Physics-based photovoltaic simulation using MATLAB Simulink
- Machine learning-based health state classification
- Solar panel efficiency prediction
- Real-time data streaming
- Interactive React dashboard
- Flask REST API backend
- Automated PDF and Excel report generation
- Predictive maintenance recommendations
- Live analytics and visualization
- Five-class solar panel health detection

---

## Health States

The system classifies solar panels into the following health states:

- Normal
- Dusty
- Overheating
- Shaded
- Faulty

---

## System Architecture

```text
MATLAB Simulink
        │
        ▼
Physics-Based Simulation
        │
        ▼
Synthetic Dataset Generation
        │
        ▼
Machine Learning Training
        │
        ▼
Flask REST API
        │
        ▼
React Dashboard
        │
        ▼
Monitoring • Predictions • Reports
```

---

## Technology Stack

### Simulation

- MATLAB
- MATLAB Simulink

### Machine Learning

- Python
- Scikit-learn
- Random Forest
- Gradient Boosting
- Voting Ensemble
- Joblib

### Backend

- Flask
- REST API
- Pandas
- NumPy
- ReportLab
- OpenPyXL

### Frontend

- React.js
- JavaScript
- HTML
- CSS
- Recharts

---

## Machine Learning Models

### Classification

- Random Forest Classifier
- Gradient Boosting Classifier
- Soft Voting Ensemble

### Regression

- Random Forest Regressor
- Gradient Boosting Regressor

---

## Model Performance

### Health State Classification

| Metric | Score |
|---------|------:|
| Accuracy | **99.91%** |
| Precision | 1.00 |
| Recall | 1.00 |
| F1 Score | 1.00 |

### Efficiency Prediction

| Metric | Value |
|---------|------:|
| R² Score | **0.9999** |
| Mean Absolute Error (MAE) | **0.0042%** |
| Root Mean Squared Error (RMSE) | **0.0061%** |

---

## Project Structure

```text
SunSol/
│
├── backend/
│   ├── app.py
│   ├── models/
│   ├── reports/
│   └── utils/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── matlab/
│   ├── SunSol_Model.slx
│   ├── Layer2_Sweep.m
│   └── run_scenario.m
│
├── dataset/
├── trained_models/
├── documentation/
├── README.md
└── requirements.txt
```

---

## Workflow

1. Simulate photovoltaic system behavior using MATLAB Simulink.
2. Generate a synthetic dataset under varying environmental conditions.
3. Train machine learning models for health classification and efficiency prediction.
4. Deploy trained models using a Flask REST API.
5. Stream real-time simulation data to the backend.
6. Display predictions and analytics through the React dashboard.
7. Generate downloadable PDF and Excel reports automatically.

---

## Dashboard Modules

### System Overview

- Live KPI cards
- Efficiency gauge
- Current panel status
- AI recommendations

### Live Analytics

- Real-time charts
- Live sensor values
- Simulation progress
- Prediction timeline

### Maintenance Reports

- Active alerts
- Maintenance logs
- Maintenance scheduling

### AI Insights

- Health prediction
- Prediction confidence
- Efficiency forecast
- Historical analysis

---

## Input Parameters

- Solar Irradiance
- Temperature
- Dust Factor
- Tilt Angle

---

## Output Parameters

- Maximum Power (Pmax)
- Voltage (Vmp)
- Current (Imp)
- Open Circuit Voltage (Voc)
- Short Circuit Current (Isc)
- Fill Factor
- Efficiency
- Predicted Health State

---

## Applications

- Solar farms
- Renewable energy management
- Predictive maintenance
- Smart energy systems
- Industrial photovoltaic monitoring
- Research and education
- AI-powered energy analytics

---

## Future Enhancements

- Integration with IoT sensors
- ESP32 and Arduino deployment
- Mobile application
- Weather forecast integration
- GPS-based solar tracking
- Deep learning models
- Docker-based cloud deployment
- Multi-panel monitoring

---

