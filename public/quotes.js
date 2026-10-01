const refresh = document.querySelector('#refresh');
const status = document.querySelector('#status');
const rows = document.querySelector('#quotes');
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

async function loadQuotes() {
  refresh.disabled = true;
  status.hidden = false;
  status.className = '';
  status.textContent = 'Loading quotes...';
  table.hidden = true;
  rows.replaceChildren();
  document.querySelector('#count').textContent = '\u2014';
  document.querySelector('#updated').textContent = '';
  try {
    const response = await fetch('/api/quotes', { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load quotes. Please try again.');
    const { quotes } = await response.json();
    document.querySelector('#count').textContent = quotes.length;
    for (const quote of quotes) {
      const row = document.createElement('tr');
      const [year, month, day] = quote.service_date.split('-');
      cell(row, [`${day}/${month}/${year}`, `${quote.service_time.slice(0, 5)} | #${quote.id}`]);
      cell(row, [quote.customer_name]);
      cell(row, [quote.pickup_location, `To: ${quote.dropoff_location}`]);
      cell(row, [quote.vehicle]);
      cell(row, [quote.phone, quote.email]);
      rows.append(row);
    }
    table.hidden = quotes.length === 0;
    status.hidden = quotes.length > 0;
    status.textContent = 'No quote requests yet.';
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
refresh.addEventListener('click', loadQuotes);
loadQuotes();
