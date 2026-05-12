const apiUrl = 'http://192.168.x.x:3000';
let token = null;

const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const loginError = document.getElementById('login-error');
const dashboard = document.getElementById('dashboard');
const loginSection = document.getElementById('login-section');
const housingTable = document.querySelector('#housing-table tbody');
const ticketsTable = document.querySelector('#tickets-table tbody');

loginButton.addEventListener('click', login);
logoutButton.addEventListener('click', logout);

async function login() {
  loginError.textContent = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    loginError.textContent = 'Veuillez remplir tous les champs.';
    return;
  }

  try {
    const response = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Échec de la connexion.');
    }

    const data = await response.json();
    token = data.access_token;
    showDashboard();
    await refreshData();
  } catch (error) {
    loginError.textContent = error.message;
  }
}

function logout() {
  token = null;
  dashboard.classList.add('hidden');
  loginSection.classList.remove('hidden');
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function refreshData() {
  await Promise.all([loadHousing(), loadTickets()]);
}

async function loadHousing() {
  const response = await fetch(`${apiUrl}/housing`, { headers: getHeaders() });
  const housing = await response.json();
  housingTable.innerHTML = housing
    .map(
      (item) => `
      <tr>
        <td>${item.id}</td>
        <td>${item.title}</td>
        <td>${item.address}</td>
      </tr>
    `,
    )
    .join('');
}

async function loadTickets() {
  const response = await fetch(`${apiUrl}/tickets/me`, { headers: getHeaders() });
  const tickets = await response.json();
  ticketsTable.innerHTML = tickets
    .map(
      (ticket) => `
      <tr>
        <td>${ticket.id}</td>
        <td>${ticket.title}</td>
        <td>${ticket.status}</td>
        <td>
          <button onclick="updateStatus(${ticket.id}, 'IN_PROGRESS')">En cours</button>
          <button onclick="updateStatus(${ticket.id}, 'RESOLVED')">Résolu</button>
          <button onclick="updateStatus(${ticket.id}, 'REJECTED')">Refusé</button>
        </td>
      </tr>
    `,
    )
    .join('');
}

async function updateStatus(id, status) {
  try {
    await fetch(`${apiUrl}/tickets/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    await refreshData();
  } catch (error) {
    alert('Impossible de mettre à jour le ticket.');
  }
}

function showDashboard() {
  loginSection.classList.add('hidden');
  dashboard.classList.remove('hidden');
}
