async function loadFleet() {
  const grid = document.querySelector('#fleet-cars');
  const status = document.querySelector('#fleet-status');
  try {
    const response = await fetch('/api/fleet', { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load the fleet. Please refresh to try again.');
    const { cars } = await response.json();
    grid.replaceChildren();
    for (const car of cars) {
      const article = document.createElement('article'); article.className = 'content-card vehicle-card';
      const image = document.createElement('img'); image.src = car.image_url; image.alt = car.name; image.loading = 'lazy';
      const body = document.createElement('div');
      const name = document.createElement('h2'); name.textContent = car.name;
      const description = document.createElement('p'); description.textContent = car.description;
      const passengers = document.createElement('p'); passengers.textContent = `Up to ${car.passengers} passengers`;
      body.append(name, description, passengers); article.append(image, body); grid.append(article);
    }
    status.textContent = cars.length ? '' : 'Our fleet is being updated. Please contact us for availability.';
  } catch (error) { status.textContent = error.message; }
}
loadFleet();
