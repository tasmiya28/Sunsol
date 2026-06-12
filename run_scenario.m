function run_scenario(scenario_name, G, T, D, theta)
% SunSol real-time simulation — runs exactly 300 seconds (5 minutes)
%
% Usage:
%   run_scenario('Normal',      1000, 25,  0.0,  35)
%   run_scenario('Dusty',        900, 30,  0.65, 35)
%   run_scenario('Overheating', 1000, 72,  0.0,  35)
%   run_scenario('Shaded',       220, 22,  0.0,  35)
%   run_scenario('Faulty',       180, 25,  0.82, 62)

FLASK_URL    = 'http://localhost:5000';
STREAM_URL   = [FLASK_URL '/stream'];
START_URL    = [FLASK_URL '/scenario/start'];
END_URL      = [FLASK_URL '/scenario/end'];
DURATION_S   = 300;   % exactly 5 minutes — DO NOT CHANGE
INTERVAL_S   = 5;     % Simulink step interval in seconds
NUM_STEPS    = DURATION_S / INTERVAL_S;  % = 60 steps

mdl = 'SunSol_mathBlock';
if ~bdIsLoaded(mdl)
    load_system(mdl);
end
set_param(mdl, 'SignalLogging', 'off');
set_param(mdl, 'SaveOutput',    'off');
set_param(mdl, 'FastRestart',   'off');

opts = weboptions('MediaType',     'application/json', ...
                  'RequestMethod', 'post', ...
                  'Timeout',       10);

fprintf('\n=== SunSol Scenario: %s ===\n', scenario_name);
fprintf('G=%g W/m²  T=%g°C  D=%g  θ=%g°\n', G, T, D, theta);
fprintf('Duration: %d seconds  Steps: %d  Interval: %ds\n\n', ...
        DURATION_S, NUM_STEPS, INTERVAL_S);

% Notify Flask — scenario starting
start_body = struct();
start_body.scenario_name = scenario_name;
start_body.G             = G;
start_body.T             = T;
start_body.D             = D;
start_body.theta         = theta;
start_body.duration      = DURATION_S;
start_body.total_steps   = NUM_STEPS;

try
    webwrite(START_URL, jsonencode(start_body), opts);
    fprintf('Flask notified: scenario started.\n\n');
catch ME
    fprintf('WARNING: Could not notify Flask start: %s\n', ME.message);
    fprintf('Make sure Flask is running:  python app.py\n\n');
end

% ── Main simulation loop ──────────────────────────────────
errors = 0;
for step = 1:NUM_STEPS
    elapsed = (step - 1) * INTERVAL_S;

    % Physics-based variation around base values
    % Irradiance: slow sinusoidal cloud-cover model
    G_live = G * (1.0 + 0.04 * sin(2*pi*elapsed / 180));

    % Temperature: thermal mass model — rises slowly then levels off
    T_rise = 3.5 * (1 - exp(-elapsed / 120));
    T_live = T + T_rise + 0.8 * sin(2*pi*elapsed / 90);

    % Dust stays constant per scenario (short run)
    D_live     = D;
    theta_live = theta;

    % Inject into Simulink Constant blocks
    set_param([mdl '/G_irradiance'], 'Value', num2str(G_live));
    set_param([mdl '/T_cell'],       'Value', num2str(T_live));
    set_param([mdl '/D_dust'],       'Value', num2str(D_live));
    set_param([mdl '/theta_tilt'],   'Value', num2str(theta_live));

    try
        simOut = sim(mdl, 'StopTime', '0');

        Vmp   = extractVal(simOut, 'out_Vmp');
        Imp   = extractVal(simOut, 'out_Imp');
        Pmax  = extractVal(simOut, 'out_Pmax');
        Voc   = extractVal(simOut, 'out_Voc');
        Isc   = extractVal(simOut, 'out_Isc');
        FF    = extractVal(simOut, 'out_FF');
        eta   = extractVal(simOut, 'out_eta');

        payload = struct();
        payload.event            = 'data_point';
        payload.step             = step;
        payload.elapsed_seconds  = elapsed;
        payload.scenario_name    = scenario_name;
        payload.Irradiance_Wm2   = G_live;
        payload.Temperature_C    = T_live;
        payload.Dust_factor      = D_live;
        payload.Tilt_deg         = theta_live;
        payload.Vmp_V            = Vmp;
        payload.Imp_A            = Imp;
        payload.Pmax_W           = Pmax;
        payload.Voc_V            = Voc;
        payload.Isc_A            = Isc;
        payload.FF               = FF;
        payload.Efficiency_pct   = eta;

        webwrite(STREAM_URL, jsonencode(payload), opts);
        fprintf('Step %2d/%d  t=%3ds  G=%6.1f  T=%5.1f°C  P=%6.1fW  η=%.2f%%\n', ...
                step, NUM_STEPS, elapsed, G_live, T_live, Pmax, eta);

    catch ME
        errors = errors + 1;
        fprintf('Step %d error: %s\n', step, ME.message);
        if errors > 10
            fprintf('Too many errors — aborting simulation.\n');
            break;
        end
    end

    % Wait exactly INTERVAL_S seconds before next step
    pause(INTERVAL_S);
end

% Notify Flask — scenario complete
try
    end_body = struct();
    end_body.event         = 'scenario_end';
    end_body.scenario_name = scenario_name;
    end_body.steps_done    = step;
    webwrite(END_URL, jsonencode(end_body), opts);
    fprintf('\n=== Scenario complete. Steps: %d. Requesting report... ===\n', step);
catch ME
    fprintf('Could not notify Flask end: %s\n', ME.message);
end

close_system(mdl, 0);
fprintf('Simulation finished. Check dashboard for report download.\n');
end

% ── Helper: extract scalar from SimulationOutput ──────────
function val = extractVal(simOut, varName)
    val = NaN;
    try
        data = simOut.get(varName);
        if isnumeric(data) && ~isempty(data)
            val = data(end);
        elseif isa(data, 'timeseries') && ~isempty(data.Data)
            val = data.Data(end);
        elseif isstruct(data) && isfield(data, 'signals')
            val = data.signals.values(end);
        end
    catch
    end
end