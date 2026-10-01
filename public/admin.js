const $ = selector => document.querySelector(selector);
let csrf = '';
let editing = null;
function message(text, error = false) { $('#message').textContent = text; $('#message').className = error ? 'error' : ''; }
function signedIn(value) { $('#login-form').hidden = value; $('#workspace').hidden = !value; $('#logout').hidden = !value; if (!value) { csrf = ''; $('#car-list').replaceChildren(); resetEditor(); } }
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) { if (response.status === 401) signedIn(false); throw new Error(data.message || 'Request failed. Please try again.'); }
  return data;
}
function resetEditor() { editing = null; $('#car-form').reset(); $('#editor-title').textContent = 'Add a car'; $('#save').textContent = 'Add car'; $('#cancel').hidden = true; }
async function loadCars() {
  const { cars } = await api('/api/fleet');
  $('#car-count').textContent = `(${cars.length})`;
  $('#car-list').replaceChildren();
  if (!cars.length) $('#car-list').textContent = 'No cars yet. Add your first car using the form.';
  for (const car of cars) {
    const article = document.createElement('article'); article.className = 'admin-car';
    const image = document.createElement('img'); image.src = car.image_url; image.alt = car.name; image.loading = 'lazy';
    const body = document.createElement('div');
    const name = document.createElement('h3'); name.textContent = car.name;
    const description = document.createElement('p'); description.textContent = `${car.description} · ${car.passengers} passengers`;
    const edit = document.createElement('button'); edit.className = 'button'; edit.textContent = 'Edit'; edit.setAttribute('aria-label', `Edit ${car.name}`);
    edit.onclick = () => { editing = car.id; $('#car-name').value = car.name; $('#description').value = car.description; $('#image-url').value = car.image_url; $('#passengers').value = car.passengers; $('#editor-title').textContent = 'Edit car'; $('#save').textContent = 'Save changes'; $('#cancel').hidden = false; $('#car-name').focus(); };
    const remove = document.createElement('button'); remove.className = 'button delete'; remove.textContent = 'Delete'; remove.setAttribute('aria-label', `Delete ${car.name}`);
    remove.onclick = async () => {
      if (!confirm(`Delete ${car.name} from the fleet?`)) return;
      remove.disabled = true;
      try { await api(`/api/admin/fleet/${car.id}`, { method: 'DELETE' }); if (editing === car.id) resetEditor(); message('Car deleted.'); await loadCars(); }
      catch (error) { message(error.message, true); } finally { remove.disabled = false; }
    };
    body.append(name, description, edit, remove); article.append(image, body); $('#car-list').append(article);
  }
}
$('#login-form').onsubmit = async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try { const session = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: $('#username').value, password: $('#password').value }) }); csrf = session.csrf; $('#password').value = ''; signedIn(true); message(`Logged in as ${session.username}.`); await loadCars(); }
  catch (error) { message(error.message, true); } finally { button.disabled = false; }
};
$('#car-form').onsubmit = async event => {
  event.preventDefault(); $('#save').disabled = true;
  try {
    const data = { name: $('#car-name').value, description: $('#description').value, image_url: $('#image-url').value, passengers: Number($('#passengers').value) };
    await api(editing === null ? '/api/admin/fleet' : `/api/admin/fleet/${editing}`, { method: editing === null ? 'POST' : 'PUT', body: JSON.stringify(data) });
    resetEditor(); message('Car saved. The public fleet page now uses the updated details.'); await loadCars();
  } catch (error) { message(error.message, true); } finally { $('#save').disabled = false; }
};
$('#cancel').onclick = resetEditor;
$('#reload').onclick = () => loadCars().catch(error => message(error.message, true));
$('#logout').onclick = async () => { try { await api('/api/admin/logout', { method: 'POST' }); signedIn(false); message('Logged out.'); } catch (error) { message(error.message, true); } };
(async () => { try { const session = await api('/api/admin/session'); csrf = session.csrf; signedIn(true); await loadCars(); } catch (error) { if (csrf) message(error.message, true); } })();
