import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getDatabase, ref, onValue, update
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

// import { firebaseConfig } from './config.js';

const firebaseConfig = {
  apiKey: "AIzaSyC-0rSSOTjf1d_klfRUgcjpqAWA1kuBWC0",
  authDomain: "machines-b2a4e.firebaseapp.com",
  projectId: "machines-b2a4e",
  storageBucket: "machines-b2a4e.appspot.com",
  messagingSenderId: 84871116813,
  appId: "1:84871116813:web:47d1162f322d86555e7d44",
  measurementId: "G-JZNK7Z0ZR1",
  databaseURL: "https://machines-b2a4e-default-rtdb.firebaseio.com/"
};


const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const machineNames = [
  "NH01", "NH06", "RBD_CU", "RBD11", "SC01", "SC02", "SC03", "SKET",
  "DT08", "DT09", "HAMANA", "FS03", "FS08", "FS09", "HV Sheathing", "MV01", "MV02"
];

const machineContainer = document.getElementById('machine-container');
const machines = {};
let currentRole = null;

// Format time
function formatTime(seconds) {
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

// Update timer display and styling
function updateDisplay(id) {
  const m = machines[id];
  document.getElementById(`electrical-${id}`).innerText = formatTime(m.electricalTime);
  document.getElementById(`mechanical-${id}`).innerText = formatTime(m.mechanicalTime);

  const el = document.getElementById(`machine-${id}`);
  el.classList.remove('electrical', 'mechanical', 'blink-electrical', 'blink-mechanical');

  if (m.status === 'Electrical' && m.timer) el.classList.add('electrical', 'blink-electrical');
  if (m.status === 'Mechanical' && m.timer) el.classList.add('mechanical', 'blink-mechanical');
}

function updateStatus(id, status) {
  update(ref(db, 'machines/' + id), { status });
}

function startTimer(id) {
  const m = machines[id];
  if (m.timer || m.status === 'None') return;

  m.timer = setInterval(() => {
    if (m.status === 'Electrical') m.electricalTime++;
    if (m.status === 'Mechanical') m.mechanicalTime++;

    update(ref(db, 'machines/' + id), {
      electricalTime: m.electricalTime,
      mechanicalTime: m.mechanicalTime
    });
  }, 1000);

  update(ref(db, 'machines/' + id), {
    isRunning: true
  });
}

function stopTimer(id) {
  clearInterval(machines[id].timer);
  machines[id].timer = null;

  update(ref(db, 'machines/' + id), {
    isRunning: false
  });

  const el = document.getElementById(`machine-${id}`);
  el.classList.remove('blink-electrical', 'blink-mechanical');
}


function resetTimer(id) {
  stopTimer(id);
  update(ref(db, 'machines/' + id), {
    electricalTime: 0,
    mechanicalTime: 0,
    status: "None",
    isRunning: false
  });
}


function resetAllMachines() {
  if (currentRole !== "admin") return;
  machineNames.forEach(name => {
    update(ref(db, 'machines/' + name), {
      electricalTime: 0,
      mechanicalTime: 0,
      status: "None"
    });
  });
}

function createMachineCard(id) {
  const div = document.createElement('div');
  div.className = 'machine';
  div.id = `machine-${id}`;
  div.innerHTML = `
    <h3>${id}</h3>
    <select onchange="updateStatus('${id}', this.value)">
        <option value="None">None</option>
        <option value="Electrical">Electrical</option>
        <option value="Mechanical">Mechanical</option>
    </select>
    <div class="button-group">
        <button class="start-btn" onclick="startTimer('${id}')">Start</button>
        <button class="stop-btn" onclick="stopTimer('${id}')">Stop</button>
        <button class="reset-btn" onclick="resetTimer('${id}')">Reset</button>
    </div>
    <div class="timers">
        <p>Electrical Idle: <span id="electrical-${id}">00:00:00</span></p>
        <p>Mechanical Idle: <span id="mechanical-${id}">00:00:00</span></p>
    </div>`;
  machineContainer.appendChild(div);
}

// Auth Functions
window.login = () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  signInWithEmailAndPassword(auth, email, password)
    .catch(e => alert("Login failed: " + e.message));
};

window.logout = () => {
    signOut(auth).then(() => {
      // Show login form again after logout
      document.getElementById("login-card").style.display = "block";
      document.getElementById("user-info").style.display = "none";
      document.getElementById("dashboard-section").style.display = "none";
    });
  };
  

function setRoleUI(role) {
    currentRole = role;
    document.getElementById("user-role-label").innerText = `Logged in as ${role}`;
  
    const isAdmin = role === "admin";
    const buttons = document.querySelectorAll(".start-btn, .stop-btn, .reset-btn, select");
    buttons.forEach(btn => btn.disabled = !isAdmin);
    
    // Hide the entire button group for viewers
    const buttonGroups = document.querySelectorAll(".button-group");
    buttonGroups.forEach(group => {
      group.style.display = isAdmin ? "flex" : "none";
    });
    document.getElementById("reset-all-btn").style.display = isAdmin ? "inline-block" : "none";
  }
  

// Auth State
onAuthStateChanged(auth, user => {
    const loginForm = document.getElementById("login-form");
    const loginCard = document.getElementById("login-card");
    const userInfo = document.getElementById("user-info");
    const dashboard = document.getElementById("dashboard-section");
  
    if (!user) {
      loginForm.style.display = "flex";
      userInfo.style.display = "none";
      dashboard.style.display = "none";
      currentRole = null;
      return;
    }
  
    // Fetch role and THEN show dashboard
    onValue(ref(db, 'roles/' + user.uid), snapshot => {
      const role = snapshot.val() || "viewer";
      setRoleUI(role);
      loginForm.style.display = "none";
      loginCard.style.display = "none";
      userInfo.style.display = "flex";
      dashboard.style.display = "block";
    });
  });
  

// Global access for HTML buttons
window.updateStatus = updateStatus;
window.startTimer = startTimer;
window.stopTimer = stopTimer;
window.resetTimer = resetTimer;
window.resetAllMachines = resetAllMachines;
window.generateGraph = generateGraph;


// Init Machines
machineNames.forEach(name => {
  machines[name] = {
    name,
    status: "None",
    electricalTime: 0,
    mechanicalTime: 0,
    timer: null
  };
  createMachineCard(name);

  onValue(ref(db, 'machines/' + name), snapshot => {
    const data = snapshot.val();
    if (!data) return;
  
    const m = machines[name];
    m.status = data.status || "None";
    m.electricalTime = data.electricalTime || 0;
    m.mechanicalTime = data.mechanicalTime || 0;
    const isRunning = data.isRunning || false;
  
    document.querySelector(`#machine-${name} select`).value = m.status;
    updateDisplay(name);
  
    if ((m.status === "Electrical" || m.status === "Mechanical") && isRunning && !m.timer) {
      startTimer(name);
    } else if (!isRunning && m.timer) {
      stopTimer(name);
    }
  });
  
});


//GRAPH
let machineChart = null; // Place this outside the function at the top of your script

function generateGraph() {
  const timeUnit = document.getElementById("time-unit-selector").value; // Get selected time unit (seconds, minutes, hours)
  const machineNames = Object.keys(machines);

  // Function to convert seconds to the selected time unit
  function convertTime(timeInSeconds, unit) {
    if (unit === 'minutes') {
      return timeInSeconds / 60; // Convert to minutes
    } else if (unit === 'hours') {
      return timeInSeconds / 3600; // Convert to hours
    }
    return timeInSeconds; // Default is seconds
  }

  // Map machine names to their corresponding times in the selected unit
  const electricalTimes = machineNames.map(name => convertTime(machines[name].electricalTime, timeUnit));
  const mechanicalTimes = machineNames.map(name => convertTime(machines[name].mechanicalTime, timeUnit));

  const ctx = document.getElementById('machineGraph').getContext('2d');

  // Hide the generate button and show the graph
  document.getElementById("generate-graph-btn").style.display = "none";
  document.getElementById("machineGraph").style.display = "block";

  // Set chart background color and opacity
  const chartBackgroundColor = 'rgba(255, 255, 255, 0.8)'; // Slightly opaque white background for chart area
  if (machineChart) {
    machineChart.destroy();
  }
  // Create the chart with updated background color
  machineChart = new Chart(ctx, {
    type: 'bar', // Bar chart
    data: {
      labels: machineNames,
      datasets: [{
        label: 'Electrical Time (' + timeUnit + ')',
        data: electricalTimes,
        backgroundColor: 'rgba(54, 162, 235, 0.6)', // Blue for electrical, slightly more opaque
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }, {
        label: 'Mechanical Time (' + timeUnit + ')',
        data: mechanicalTimes,
        backgroundColor: 'rgba(255, 99, 132, 0.6)', // Red for mechanical, slightly more opaque
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#ffffff'  // White ticks on Y axis
          },
          grid: {
            color: '#444' // Soft grid lines for contrast
          }
        },
        x: {
          ticks: {
            color: '#ffffff'  // White ticks on X axis
          },
          grid: {
            color: '#444' // Soft grid lines for contrast
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#ffffff' // White text for legend labels
          }
        },
        tooltip: {
          backgroundColor: '#000',
          titleColor: '#fff',
          bodyColor: '#fff'
        }
      }
    },    
    // Background color for the canvas itself
    backgroundColor: chartBackgroundColor
  });
}

