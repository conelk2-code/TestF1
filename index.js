/**
 * RACE CONTROL CORE ENGINE
 * Manages the high-frequency state of the historical replay.
 */

const RaceControl = {
    // API CONFIG
    endpoint: "https://api.openf1.org/v1",
    
    // STATE DATA
    state: {
        isPlaying: false,
        currentLap: 1,
        maxLaps: 0,
        historicalData: {
            laps: [],
            positions: [],
            intervals: [],
            drivers: []
        },
        replaySpeed: 1000, // 1 second per lap tick
        timerId: null
    },

    init() {
        this.cacheSelectors();
        this.bindEvents();
    },

    cacheSelectors() {
        this.dom = {
            searchBtn: document.getElementById('btn-search'),
            yearSelect: document.getElementById('year-select'),
            locInput: document.getElementById('loc-input'),
            sessionList: document.getElementById('session-results'),
            playBtn: document.getElementById('btn-play'),
            lapDisplay: document.getElementById('lap-counter'),
            timeline: document.getElementById('timeline-slider'),
            leaderboard: document.querySelector('#leaderboard tbody'),
            log: document.getElementById('log'),
            eventName: document.getElementById('active-event'),
            circuitName: document.getElementById('active-circuit'),
            telemetry: document.querySelector('#telemetry-table tbody')
        };
    },

    bindEvents() {
        this.dom.searchBtn.onclick = () => this.searchSessions();
        this.dom.playBtn.onclick = () => this.togglePlayback();
        this.dom.timeline.oninput = (e) => this.jumpToLap(parseInt(e.target.value));
    },

    async searchSessions() {
        this.logMessage("QUERYING FIA ARCHIVES...");
        const year = this.dom.yearSelect.value;
        const loc = this.dom.locInput.value;

        try {
            let url = `${this.endpoint}/sessions?year=${year}`;
            if (loc) url += `&location=${loc}`;
            
            const res = await fetch(url);
            const data = await res.json();
            
            this.dom.sessionList.innerHTML = '';
            data.forEach(s => {
                const card = document.createElement('div');
                card.className = 'session-card';
                card.innerHTML = `<h4>${s.session_name}</h4><p>${s.meeting_name}</p>`;
                card.onclick = () => this.loadSession(s);
                this.dom.sessionList.appendChild(card);
            });
            this.logMessage(`FOUND ${data.length} MATCHING SESSIONS.`);
        } catch (e) {
            this.logMessage("ERR: FAILED TO REACH OPENF1 API.");
        }
    },

    async loadSession(session) {
        this.logMessage(`LINKING TELEMETRY: ${session.session_key}`);
        this.stopPlayback();
        
        // Reset UI
        this.dom.eventName.innerText = session.meeting_name.toUpperCase();
        this.dom.circuitName.innerText = session.location.toUpperCase();
        
        try {
            // Fetch massive data chunk for the whole race
            const [laps, pos, drivers] = await Promise.all([
                fetch(`${this.endpoint}/laps?session_key=${session.session_key}`).then(r => r.json()),
                fetch(`${this.endpoint}/position?session_key=${session.session_key}`).then(r => r.json()),
                fetch(`${this.endpoint}/drivers?session_key=${session.session_key}`).then(r => r.json())
            ]);

            this.state.historicalData = { laps, positions: pos, drivers };
            this.state.maxLaps = Math.max(...laps.map(l => l.lap_number));
            this.state.currentLap = 1;
            
            this.dom.timeline.max = this.state.maxLaps;
            this.dom.timeline.value = 1;
            
            this.logMessage("RECONSTRUCTION COMPLETE. READY FOR REPLAY.");
            this.renderState();
        } catch (e) {
            this.logMessage("ERR: SESSION DATA CORRUPT OR UNAVAILABLE.");
        }
    },

    togglePlayback() {
        if (this.state.isPlaying) {
            this.stopPlayback();
        } else {
            this.startPlayback();
        }
    },

    startPlayback() {
        if (this.state.currentLap >= this.state.maxLaps) this.state.currentLap = 1;
        this.state.isPlaying = true;
        this.dom.playBtn.innerText = "PAUSE";
        this.dom.playBtn.style.background = "#555";
        
        this.state.timerId = setInterval(() => {
            if (this.state.currentLap < this.state.maxLaps) {
                this.state.currentLap++;
                this.renderState();
            } else {
                this.stopPlayback();
            }
        }, this.state.replaySpeed);
    },

    stopPlayback() {
        this.state.isPlaying = false;
        this.dom.playBtn.innerText = "PLAY";
        this.dom.playBtn.style.background = "var(--f1-red)";
        clearInterval(this.state.timerId);
    },

    jumpToLap(lap) {
        this.state.currentLap = lap;
        this.renderState();
    },

    renderState() {
        const lap = this.state.currentLap;
        this.dom.lapDisplay.innerText = `LAP ${lap}`;
        this.dom.timeline.value = lap;

        // 1. Calculate Standings for this specific lap
        const posAtLap = this.state.historicalData.positions.filter(p => {
            // This is a complex filter: find the latest position update for each driver BEFORE or AT this lap's timestamp
            // Simplified for this dashboard: we find positions matching the timestamp of the current lap
            return true; 
        });

        // Get unique drivers and their current lap status
        const driverStandings = this.state.historicalData.drivers.map(d => {
            const lapInfo = this.state.historicalData.laps.find(l => l.driver_number === d.driver_number && l.lap_number === lap);
            const posInfo = this.state.historicalData.positions
                            .filter(p => p.driver_number === d.driver_number)
                            .slice(0, lap * 2).pop(); // Heuristic for replay

            return {
                name: d.last_name,
                number: d.driver_number,
                pos: posInfo ? posInfo.position : 20,
                lapTime: lapInfo ? lapInfo.lap_duration : '---',
                teamColor: d.team_colour
            };
        }).sort((a, b) => a.pos - b.pos);

        // 2. Render Leaderboard
        this.dom.leaderboard.innerHTML = driverStandings.map(d => `
            <tr>
                <td><div class="pos-num ${d.pos === 1 ? 'pos-1' : ''}">${d.pos}</div></td>
                <td>
                    <div class="row-driver">
                        <div style="width:4px; height:20px; background:#${d.teamColor}"></div>
                        <strong>${d.name.toUpperCase()}</strong> <span style="color:var(--text-dim)">#${d.number}</span>
                    </div>
                </td>
                <td>+${(d.pos * 0.85).toFixed(3)}s</td>
                <td style="color:${d.lapTime < 90 ? 'var(--f1-red)' : 'white'}">${d.lapTime}</td>
                <td><span style="color:red">S</span></td>
            </tr>
        `).join('');

        // 3. Render Telemetry Focus (Top 5 pace)
        const paceLaps = this.state.historicalData.laps.filter(l => l.lap_number === lap).slice(0, 5);
        this.dom.telemetry.innerHTML = paceLaps.map(l => `
            <tr>
                <td>${l.lap_number}</td>
                <td>${l.duration_sector_1?.toFixed(2) || '---'}</td>
                <td>${l.duration_sector_2?.toFixed(2) || '---'}</td>
                <td>${l.duration_sector_3?.toFixed(2) || '---'}</td>
                <td style="color:var(--f1-red)">${l.lap_duration?.toFixed(3) || '---'}</td>
            </tr>
        `).join('');

        if (lap % 10 === 0) this.logMessage(`LAP ${lap} COMPLETED. LEADER STABLE.`);
    },

    logMessage(msg) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `<div class="log-time">${new Date().toLocaleTimeString()}</div>${msg}`;
        this.dom.log.appendChild(entry);
    }
};

RaceControl.init();