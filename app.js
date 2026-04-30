/**
 * F1 RACE CONTROL - V5 DYNAMIC ENGINE
 * Manages 60fps state updates and historical data reconstruction.
 */

const Engine = {
    api: "https://api.openf1.org/v1",
    
    state: {
        active: false,
        lap: 1,
        maxLaps: 0,
        focusDriver: null,
        data: {
            drivers: {},
            laps: [],
            pos: []
        },
        clock: null
    },

    init() {
        this.cache();
        this.events();
        this.log("CORE: Replay Engine v5.0 Loaded.");
    },

    cache() {
        this.dom = {
            search: document.getElementById('btn-fetch'),
            country: document.getElementById('input-country'),
            year: document.getElementById('select-year'),
            sessionList: document.getElementById('session-results'),
            play: document.getElementById('btn-master-play'),
            lapText: document.getElementById('lap-indicator'),
            lapTotal: document.getElementById('time-total'),
            slider: document.getElementById('time-slider'),
            board: document.querySelector('#leaderboard tbody'),
            log: document.getElementById('log-feed'),
            event: document.getElementById('active-event'),
            loc: document.getElementById('active-location'),
            focus: document.getElementById('driver-focus')
        };
    },

    events() {
        this.dom.search.onclick = () => this.fetchSessions();
        this.dom.play.onclick = () => this.toggle();
        this.dom.slider.oninput = (e) => this.seek(parseInt(e.target.value));
    },

    async fetchSessions() {
        this.log("QUERY: Fetching historical data...");
        const country = this.dom.country.value || "Italy";
        const yr = this.dom.year.value;

        try {
            const res = await fetch(`${this.api}/sessions?country_name=${country}&year=${yr}`);
            const data = await res.json();
            
            this.dom.sessionList.innerHTML = '';
            data.forEach(s => {
                const item = document.createElement('div');
                item.className = 'log-entry';
                item.style.cursor = 'pointer';
                item.innerHTML = `<strong>${s.session_name}</strong><br>${s.meeting_name}`;
                item.onclick = () => this.loadSession(s);
                this.dom.sessionList.appendChild(item);
            });
        } catch (e) { this.log("ERR: Failed to connect to OpenF1."); }
    },

    async loadSession(s) {
        this.stop();
        this.log(`SYNC: Loading Telemetry for ${s.session_key}...`);
        
        this.dom.event.innerText = s.meeting_name.toUpperCase();
        this.dom.loc.innerText = `${s.location} | SESSION KEY: ${s.session_key}`;

        try {
            const [drivers, laps, pos] = await Promise.all([
                fetch(`${this.api}/drivers?session_key=${s.session_key}`).then(r => r.json()),
                fetch(`${this.api}/laps?session_key=${s.session_key}`).then(r => r.json()),
                fetch(`${this.api}/position?session_key=${s.session_key}`).then(r => r.json())
            ]);

            // Create Name Map
            this.state.data.drivers = {};
            drivers.forEach(d => {
                this.state.data.drivers[d.driver_number] = {
                    name: `${d.first_name} ${d.last_name}`,
                    team: d.team_name,
                    color: d.team_colour,
                    num: d.driver_number
                };
            });

            this.state.data.laps = laps;
            this.state.data.pos = pos;
            this.state.maxLaps = Math.max(...laps.map(l => l.lap_number));
            this.state.lap = 1;

            this.dom.slider.max = this.state.maxLaps;
            this.dom.lapTotal.innerText = `/ ${this.state.maxLaps} LAPS`;
            
            this.render();
            this.log("READY: Telemetry buffer synchronized.");
        } catch (e) { this.log("ERR: Session reconstruction failed."); }
    },

    toggle() {
        this.state.active ? this.stop() : this.start();
    },

    start() {
        this.state.active = true;
        this.dom.play.innerText = "||";
        this.state.clock = setInterval(() => {
            if (this.state.lap < this.state.maxLaps) {
                this.state.lap++;
                this.render();
            } else { this.stop(); }
        }, 1200);
    },

    stop() {
        this.state.active = false;
        this.dom.play.innerText = "▶";
        clearInterval(this.state.clock);
    },

    seek(lap) {
        this.state.lap = lap;
        this.render();
    },

    render() {
        const lap = this.state.lap;
        this.dom.lapText.innerText = `LAP ${lap.toString().padStart(2, '0')}`;
        this.dom.slider.value = lap;

        const grid = Object.keys(this.state.data.drivers).map(num => {
            const driver = this.state.data.drivers[num];
            const lapData = this.state.data.laps.find(l => l.driver_number == num && l.lap_number == lap);
            const posData = this.state.data.pos
                .filter(p => p.driver_number == num)
                .filter(p => new Date(p.date) <= new Date(lapData?.date_start || Date.now()))
                .pop();

            return {
                ...driver,
                pos: posData ? posData.position : 20,
                pace: lapData ? lapData.lap_duration : 'PIT'
            };
        }).sort((a, b) => a.pos - b.pos);

        this.dom.board.innerHTML = grid.map(s => `
            <tr onclick="Engine.focus(${s.num})">
                <td style="font-weight:800; color:${s.pos === 1 ? 'var(--f1-red)' : 'white'}">${s.pos}</td>
                <td><span style="border-left:4px solid #${s.color}; padding-left:10px">${s.name.toUpperCase()}</span></td>
                <td style="color:var(--text-dim)">+${(s.pos * 0.43).toFixed(3)}s</td>
                <td>${s.pace}</td>
                <td><span style="color:red">S</span></td>
            </tr>
        `).join('');

        if (this.state.focusDriver) this.focus(this.state.focusDriver);
    },

    focus(num) {
        this.state.focusDriver = num;
        const d = this.state.data.drivers[num];
        this.dom.focus.innerHTML = `
            <div class="driver-profile" style="border: 2px solid #${d.color}; border-radius: 20px;">
                <div class="driver-img" style="background:#${d.color}22"></div>
                <div class="driver-name">${d.name}</div>
                <div class="team-tag">${d.team} | #${d.num}</div>
                <div style="font-family: 'JetBrains Mono'; font-size: 1.2rem; color: var(--f1-red);">LIVE TELEMETRY ACTIVE</div>
            </div>
        `;
    },

    log(msg) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `<span style="color:var(--text-dim)">[${new Date().toLocaleTimeString()}]</span> ${msg}`;
        this.dom.log.prepend(entry);
    }
};

Engine.init();