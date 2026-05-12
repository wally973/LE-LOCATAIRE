const apiUrl = 'http://192.168.x.x:3000';
let token = null;

const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const loginError = document.getElementById('login-error');
const dashboard = document.getElementById('dashboard');
const loginSection = document.getElementById('login-section');

const userCount = document.getElementById('user-count');
const ticketCount = document.getElementById('ticket-count');
const housingCount = document.getElementById('housing-count');
const usersTable = document.querySelector('#users-table tbody');
const ticketsTable = document.querySelector('#tickets-table tbody');
const housingTable = document.querySelector('#housing-table tbody');

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
  await Promise.all([loadUsers(), loadTickets(), loadHousing()]);
}

async function loadUsers() {
  const response = await fetch(`${apiUrl}/users`, { headers: getHeaders() });
  const users = await response.json();
  userCount.textContent = users.length;
  usersTable.innerHTML = users
    .map(
      (user) => `
      <tr>
        <td>${user.id}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td>
          <button onclick="changeRole(${user.id}, 'ADMIN')">ADMIN</button>
          <button onclick="changeRole(${user.id}, 'BAILLEUR')">BAILLEUR</button>
          <button onclick="changeRole(${user.id}, 'TENANT')">TENANT</button>
        </td>
      </tr>
    `,
    )
    .join('');
}

async function loadTickets() {
  const response = await fetch(`${apiUrl}/tickets/me`, { headers: getHeaders() });
  const tickets = await response.json();
  ticketCount.textContent = tickets.length;
  ticketsTable.innerHTML = tickets
    .map(
      (ticket) => `
      <tr>
        <td>${ticket.id}</td>
        <td>${ticket.title}</td>
        <td>${ticket.tenant?.email ?? 'N/A'}</td>
        <td>${ticket.status}</td>
      </tr>
    `,
    )
    .join('');
}

async function loadHousing() {
  const response = await fetch(`${apiUrl}/housing`, { headers: getHeaders() });
  const housing = await response.json();
  housingCount.textContent = housing.length;
  housingTable.innerHTML = housing
    .map(
      (item) => `
      <tr>
        <td>${item.id}</td>
        <td>${item.title}</td>
        <td>${item.address}</td>
        <td>${item.landlord?.email ?? 'N/A'}</td>
      </tr>
    `,
    )
    .join('');
}

async function changeRole(id, role) {
  try {
    await fetch(`${apiUrl}/users/${id}/role`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ role }),
    });
    await refreshData();
  } catch (error) {
    alert('Impossible de changer le rôle.');
  }
}

function showDashboard() {
  loginSection.classList.add('hidden');
  dashboard.classList.remove('hidden');
}
