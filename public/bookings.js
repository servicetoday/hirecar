const refresh = document.querySelector('#refresh');
const status = document.querySelector('#status');
const rows = document.querySelector('#bookings');
const table = document.querySelector('#table-wrap');

function cell(row, lines) {
  const td = document.createElement('td');
  lines.forEach((text, index) => {
    const span = document.createElement('span');
    span.textContent = text;
    if (index > 0) span.className = 'secondary';
    td.append(span);
  });
  row.append(td);
}

async function loadBookings() {
  refresh.disabled = true;
  status.hidden = false;
  status.className = '';
  status.textContent = 'Loading bookings…';
  table.hidden = true;
  rows.replaceChildren();
  document.querySelector('#count').textContent = '—';
  document.querySelector('#updated').textContent = '';
  try {
    const response = await fetch('/api/bookings/today', { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load bookings. Please try again.');
    const { date, bookings } = await response.json();
    document.querySelector('#date-label').textContent = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date(`${date}T12:00:00+10:00`)) + ' · Sydney time';
    document.querySelector('#count').textContent = bookings.length;
    for (const booking of bookings) {
      const row = document.createElement('tr');
      cell(row, [booking.service_time.slice(0, 5), `#${booking.id}`]);
      cell(row, [booking.customer_name]);
      cell(row, [booking.pickup_location, `To: ${booking.dropoff_location}`]);
      cell(row, [booking.vehicle]);
      cell(row, [booking.phone, booking.email]);
      rows.append(row);
    }
    table.hidden = bookings.length === 0;
    status.hidden = bookings.length > 0;
    status.textContent = 'No bookings scheduled for today.';
    document.querySelector('#updated').textContent = 'Updated ' + new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit'
    }).format(new Date());
  } catch (error) {
    status.className = 'error';
    status.textContent = error.message;
  } finally {
    refresh.disabled = false;
  }
}
refresh.addEventListener('click', loadBookings);
loadBookings();
