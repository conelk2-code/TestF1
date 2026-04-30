/**
 * F1 RACE CONTROL - REPLAY ENGINE
 * Handles multi-threaded API fetching and state-driven replay simulation.
 */

const RaceEngine = {
    endpoint: "https://api.openf1.org/v1",
    
    state: {
        isPlaying: false,
        lap: 1,
        maxLaps: 0,
        speed: 1200, // ms per lap update
        intervalId: null,
        data: {
            laps: [],
            positions: [],
            drivers: [],
            meeting: null
        }
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
    },

    cacheDOM() {
        this.dom = {
            searchBtn: document.getElementById('search-trigger'),
            yearInput: document.getElementById('year-query'),
            locInput: document.getElementById('loc-query'),
            sessionList: document.getElementById('session-list'),
            playBtn: document.getElementById('play-toggle'),
            lapText: document.getElementById('lap-indicator'),
            slider: document.getElementById('replay-slider'),
            leaderboard: document.querySelector('#main-leaderboard tbody'),
            telemetry: document.querySelector('#telemetry-stream tbody'),
            log: document.getElementById('event-log'),
            meetingName: document.getElementById('meeting-name'),
            sessionInfo: document.getElementById('session-info')
        };
    },

    bindEvents() {
        this.dom.searchBtn.onclick = () => this.fetchSessions();
        this.dom.playBtn.onclick = () => this.toggleReplay();
        this.dom.slider.oninput = (e) => this.jumpToLap(parseInt(e.target.value));
    },

    async fetchSessions() {
        this.log("QUEUING ARCHIVE SEARCH...");
        const yr = this.dom.yearInput.value;
        const loc = this.dom.locInput.value;

        try {
            let url = `${this.endpoint}/sessions?year=${yr}`;
            if (loc) url += `&location=${loc}`;
            
            const res = await fetch(url);
            const data = await res.json();
            
            this.dom.sessionList.innerHTML = '';
            data.forEach(s => {
                const item = document.createElement('div');
                item.className = 'session-item';
                item.innerHTML = `<h4>${s.session_name}</h4><p>${s.meeting_name}</p>`;
                item.onclick = () => this.loadRaceData(s);
                this.dom.sessionList.appendChild(item);
            });
            this.log(`FOUND ${data.length} MATCHING EVENTS.`);
        } catch (e) {
            this.log("CONNECTION ERROR: API UNREACHABLE.");
        }
    },

    async loadRaceData(session) {
        this.log(`SYNCHRONIZING TELEMETRY: ${session.session_key}`);
        this.stopReplay();
        
        this.dom.meetingName.innerText = session.meeting_name.toUpperCase();
        this.dom.sessionInfo.innerText = `${session.location} | KEY: ${session.session_key}`;
        
        try {
            const [laps, pos, drivers] = await Promise.all([
                fetch(`${this.endpoint}/laps?session_key=${session.session_key}`).then(r => r.json()),
                fetch(`${this.endpoint}/position?session_key=${session.session_key}`).then(r => r.json()),
                fetch(`${this.endpoint}/drivers?session_key=${session.session_key}`).then(r => r.json())
            ]);

            this.state.data = { laps, positions: pos, drivers };
            this.state.maxLaps = Math.max(...laps.map(l => l.lap_number));
            this.state.lap = 1;
            
            this.dom.slider.max = this.state.maxLaps;
            this.dom.slider.value = 1;
            
            this.log(`READY: DATA RECONSTRUCTED FOR ${this.state.maxLaps} LAPS.`);
            this.render();
        } catch (e) {
            this.log("CRITICAL ERROR: DATA RECONSTRUCTION FAILED.");
        }
    },

    toggleReplay() {
        if (this.state.isPlaying) {
            this.stopReplay();
        } else {
            this.startReplay();
        }
    },

    startReplay() {
        if (!this.state.data.laps.length) return;
        this.state.isPlaying = true;
        this.dom.playBtn.innerText = "PAUSE_REPLAY";
        this.dom.playBtn.classList.add('active');
        
        this.state.intervalId = setInterval(() => {
            if (this.state.lap < this.state.maxLaps) {
                this.state.lap++;
                this.render();
            } else {
                this.stopReplay();
                this.log("SESSION FINISHED.");
            }
        }, this.state.speed);
    },

    stopReplay() {
        this.state.isPlaying = false;
        this.dom.playBtn.innerText = "RESUME_REPLAY";
        this.dom.playBtn.classList.remove('active');
        clearInterval(this.state.intervalId);
    },

    jumpToLap(lapNum) {
        this.state.lap = lapNum;
        this.render();
    },

    render() {
        const currentLap = this.state.lap;
        this.dom.lapText.innerText = `LAP ${currentLap}`;
        this.dom.slider.value = currentLap;

        // --- Logic: Reconstruct Driver Standings for this lap ---
        const standings = this.state.data.drivers.map(d => {
            // Find driver's lap time for current lap
            const lapData = this.state.data.laps.find(l => l.driver_number === d.driver_number && l.lap_number === currentLap);
            // Find driver's position update closest to this "moment"
            // We use a simple slice-and-find to simulate the chronometer
            const posData = this.state.data.positions
                            .filter(p => p.driver_number === d.driver_number)
                            .filter(p => new Date(p.date) <= new Date(lapData?.date_start || Date.now()))
                            .pop();

            return {
                num: d.driver_number,
                name: d.last_name,
                pos: posData ? posData.position : 20,
                time: lapData ? lapData.lap_duration : 'PIT',
                color: d.team_colour
            };
        }).sort((a, b) => a.pos - b.pos);

        // --- Render Leaderboard ---
        this.dom.leaderboard.innerHTML = standings.map(s => `
            <tr>
                <td><div class="pos-num ${s.pos <= 3 ? 'pos-top' : ''}">${s.pos}</div></td>
                <td>
                    <div class="driver-row">
                        <div style="width:3px; height:18px; background:#${s.color}"></div>
                        <strong>${s.name.toUpperCase()}</strong>
                        <span style="color:var(--text-dim)">#${s.num}</span>
                    </div>
                </td>
                <td>+${(s.pos * 0.725).toFixed(3)}s</td>
                <td style="color:${s.time < 90 ? 'var(--f1-red)' : 'inherit'}">${s.time}</td>
                <td><span style="font-size: 0.6rem; color: var(--text-dim);">LIVE</span></td>
            </tr>
        `).join('');

        // --- Render Telemetry Panel (Top Pace) ---
        const topPace = this.state.data.laps
            .filter(l => l.lap_number === currentLap && l.lap_duration)
            .sort((a,b) => a.lap_duration - b.lap_duration)
            .slice(0, 5);

        this.dom.telemetry.innerHTML = topPace.map(l => `
            <tr>
                <td><strong>#${l.driver_number}</strong></td>
                <td>${l.duration_sector_1?.toFixed(2) || '-'}</td>
                <td>${l.duration_sector_2?.toFixed(2) || '-'}</td>
                <td>${l.duration_sector_3?.toFixed(2) || '-'}</td>
                <td style="color:var(--f1-red)">${l.lap_duration.toFixed(3)}</td>
            </tr>
        `).join('');

        if (currentLap % 10 === 0) this.log(`LAP ${currentLap}: Race order stabilizing.`);
    },

    log(msg) {
        const entry = document.createElement('div');
        entry.className = 'log-msg';
        entry.innerHTML = `<span style="color:var(--text-dim); font-size: 0.6rem;">${new Date().toLocaleTimeString()}</span><br>${msg}`;
        this.dom.log.appendChild(entry);
    }
};

RaceEngine.init();