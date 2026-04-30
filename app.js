<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenF1 | Historical Intelligence Suite</title>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@300;400;600;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css"> <style>
        :root {
            --f1-red: #ff1801; --f1-black: #0b0b0f; --f1-dark: #15151e;
            --f1-gray: #25252e; --text-main: #ffffff; --text-dim: #8b8b93;
            --accent-blue: #00d2ff; --glass: rgba(255, 255, 255, 0.03); --border: rgba(255, 255, 255, 0.1);
        }
        body { margin: 0; background: var(--f1-black); color: var(--text-main); font-family: 'Plus Jakarta Sans', sans-serif; display: flex; height: 100vh; overflow: hidden; }
        aside { width: 340px; background: var(--f1-dark); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
        .brand { padding: 25px; font-weight: 800; font-size: 1.4rem; color: var(--f1-red); border-bottom: 1px solid var(--border); }
        .search-area { padding: 20px; background: rgba(0,0,0,0.2); }
        .search-area select, .search-area input { width: 100%; background: var(--f1-black); border: 1px solid var(--border); color: white; padding: 12px; border-radius: 6px; margin-bottom: 10px; }
        #sessionList { flex: 1; overflow-y: auto; padding: 10px; }
        .session-card { padding: 12px; border-radius: 8px; margin-bottom: 8px; cursor: pointer; border: 1px solid transparent; transition: 0.2s; font-size: 0.85rem; }
        .session-card:hover { background: var(--f1-gray); border-color: var(--f1-red); }
        
        main { flex: 1; overflow-y: auto; padding: 40px; }
        .dashboard-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
        .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 20px; }
        .card { background: var(--f1-dark); border-radius: 16px; padding: 24px; border: 1px solid var(--border); grid-column: span 12; }
        .card.half { grid-column: span 6; }
        
        table { width: 100%; border-collapse: collapse; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }
        th { text-align: left; color: var(--text-dim); padding: 10px; border-bottom: 1px solid var(--border); }
        td { padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.02); }
        
        .replay-controls { display: flex; gap: 10px; align-items: center; margin-top: 10px; }
        #replay-progress { flex: 1; accent-color: var(--f1-red); }
        .status-pill { padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; }
        .pill-red { background: rgba(255, 24, 1, 0.2); color: var(--f1-red); }
    </style>
</head>
<body>

    <aside>
        <div class="brand">OPENF1_PRO_ARCHIVE</div>
        <div class="search-area">
            <select id="yearSelect">
                <option value="2025">2025 Season</option>
                <option value="2024">2024 Season</option>
                <option value="2023" selected>2023 Season</option>
            </select>
            <input type="text" id="locInput" placeholder="Location (e.g. Spa)">
            <button onclick="ui.search()" style="width:100%; background: var(--f1-red); color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">SEARCH RECORDS</button>
        </div>
        <div id="sessionList"></div>
    </aside>

    <main>
        <div class="dashboard-header">
            <div>
                <h1 id="active-title" style="margin:0">Intelligence Dashboard</h1>
                <p id="active-subtitle" style="color:var(--text-dim)">Select a historical session to reconstruct telemetry.</p>
            </div>
            <div id="replay-box" style="display:none; text-align: right;">
                <span class="status-pill pill-red">Race Replay Mode</span>
                <div class="replay-controls">
                    <button onclick="engine.toggleReplay()" id="playBtn">PLAY REPLAY</button>
                    <input type="range" id="replay-progress" value="0" min="0" max="100">
                </div>
            </div>
        </div>

        <div class="grid">
            <div class="card half">
                <h2>Live Standings Replay</h2>
                <table id="leaderboard">
                    <thead><tr><th>POS</th><th>DRIVER</th><th>GAP</th><th>STATUS</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>

            <div class="card half">
                <h2>Pit Stop & Interval Analysis</h2>
                <table id="intervals">
                    <thead><tr><th>LAP</th><th>DRIVER</th><th>INTERVAL</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>

            <div class="card">
                <h2>Telemetry Stream (Lap Times)</h2>
                <table id="laps">
                    <thead><tr><th>LAP NO</th><th>DRIVER #</th><th>S1</th><th>S2</th><th>S3</th><th>LAP TIME</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    </main>

    <script src="app.js"></script>
</body>
</html>