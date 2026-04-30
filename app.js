const Engine = {
    api: "https://api.openf1.org/v1",
    state: {
        isPlaying: false,
        lap: 1,
        maxLaps: 0,
        data: { laps: [], pos: [], drivers: [] },
        timer: null
    },

    init() {
        document.getElementById('do-search').onclick = () => this.search();
        document.getElementById('play-btn').onclick = () => this.togglePlay();
        document.getElementById('lap-range').oninput = (e) => this.jump(e.target.value);
        this.search(); // Initial load
    },

    async search() {
        const yr = document.getElementById('year-in').value;
        const country = document.getElementById('country-in').value;
        const list = document.getElementById('session-list');
        list.innerHTML = "Searching FIA DB...";

        try {
            // FIX: Using country_name instead of location for more reliable results
            let url = `${this.api}/sessions?year=${yr}`;
            if (country) url += `&country_name=${country}`;
            
            const res = await fetch(url);
            const data = await res.json();
            
            list.innerHTML = "";
            data.forEach(s => {
                const div = document.createElement('div');
                div.className = 'session-item';
                div.innerHTML = `<strong>${s.session_name}</strong><br><small>${s.meeting_name}</small>`;
                div.onclick = () => this.load(s);
                list.appendChild(div);
            });
        } catch (e) { list.innerHTML = "No sessions found for that criteria."; }
    },

    async load(s) {
        this.stop();
        document.getElementById('current-event').innerText = s.meeting_name.toUpperCase();
        document.getElementById('circuit-info').innerText = `${s.location} | Session Key: ${s.session_key}`;
        this.log(`Attempting to link telemetry for Session ${s.session_key}...`);

        try {
            const [laps, pos, drivers] = await Promise.all([
                fetch(`${this.api}/laps?session_key=${s.session_key}`).then(r => r.json()),
                fetch(`${this.api}/position?session_key=${s.session_key}`).then(r => r.json()),
                fetch(`${this.api}/drivers?session_key=${s.session_key}`).then(r => r.json())
            ]);

            this.state.data = { laps, pos, drivers };
            this.state.maxLaps = Math.max(...laps.map(l => l.lap_number));
            this.state.lap = 1;
            document.getElementById('lap-range').max = this.state.maxLaps;
            
            this.log(`Sync complete. ${laps.length} data points cached.`);
            this.render();
        } catch (e) { this.log("Error: Session data too large or missing."); }
    },

    togglePlay() {
        this.state.isPlaying ? this.stop() : this.start();
    },

    start() {
        this.state.isPlaying = true;
        document.getElementById('play-btn').innerText = "PAUSE";
        this.state.timer = setInterval(() => {
            if (this.state.lap < this.state.maxLaps) {
                this.state.lap++;
                this.render();
            } else { this.stop(); }
        }, 1200); // 1.2s per lap simulation
    },

    stop() {
        this.state.isPlaying = false;
        document.getElementById('play-btn').innerText = "PLAY";
        clearInterval(this.state.timer);
    },

    jump(val) {
        this.state.lap = parseInt(val);
        this.render();
    },

    render() {
        const lap = this.state.lap;
        document.getElementById('lap-num').innerText = `LAP ${lap}`;
        document.getElementById('lap-range').value = lap;

        // Build Leaderboard for current lap
        const standings = this.state.data.drivers.map(d => {
            const lapInfo = this.state.data.laps.find(l => l.driver_number === d.driver_number && l.lap_number === lap);
            const posInfo = this.state.data.pos.filter(p => p.driver_number === d.driver_number).slice(0, lap * 2).pop();
            return {
                name: d.last_name,
                num: d.driver_number,
                pos: posInfo ? posInfo.position : 20,
                time: lapInfo ? lapInfo.lap_duration : 'PIT',
                color: d.team_colour
            };
        }).sort((a,b) => a.pos - b.pos);

        document.querySelector('#leaderboard tbody').innerHTML = standings.map(s => `
            <tr>
                <td><span class="pos-badge ${s.pos==1?'pos-p1':''}">${s.pos}</span></td>
                <td><span style="border-left:3px solid #${s.color}; padding-left:5px">${s.name}</span></td>
                <td>+${(s.pos * 0.6).toFixed(3)}s</td>
                <td>${s.time}</td>
            </tr>
        `).join('');

        // Update Telemetry Panel
        const topPace = this.state.data.laps.filter(l => l.lap_number === lap).slice(0, 5);
        document.querySelector('#tele-table tbody').innerHTML = topPace.map(l => `
            <tr><td>${l.lap_number}</td><td>${l.duration_sector_1?.toFixed(2)}</td><td>${l.duration_sector_2?.toFixed(2)}</td><td>${l.duration_sector_3?.toFixed(2)}</td></tr>
        `).join('');
    },

    log(msg) {
        const log = document.getElementById('log-feed');
        const div = document.createElement('div');
        div.className = 'log-entry';
        div.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        log.prepend(div);
    }
};

Engine.init();