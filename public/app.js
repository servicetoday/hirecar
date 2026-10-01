const form = document.querySelector('#quote-form');
const statusMessage = document.querySelector('#form-status');
const quoteDetails = document.querySelector('.quote-details');
const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.main-nav');

menuToggle.addEventListener('click', () => {
  const isOpen = navigation.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

document.querySelectorAll('.main-nav a').forEach((link) => {
  link.addEventListener('click', () => {
    navigation.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
});

if (!form) {
  // Interior pages only need the shared menu behavior.
} else form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  const data = Object.fromEntries(new FormData(form));

  if (!quoteDetails.classList.contains('visible')) {
    quoteDetails.classList.add('visible');
    quoteDetails.setAttribute('aria-hidden', 'false');
    statusMessage.textContent = 'Add your contact details so we can confirm your journey.';
    statusMessage.className = 'form-status';
    form.querySelector('#name').focus();
    return;
  }

  if (!data.name || !data.phone || !data.email) {
    statusMessage.textContent = 'Please provide your contact details so we can confirm your journey.';
    statusMessage.className = 'form-status error';
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Sending...';
  statusMessage.textContent = '';

  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    statusMessage.textContent = result.message;
    statusMessage.className = 'form-status success';
    form.reset();
  } catch (error) {
    statusMessage.textContent = error.message || 'Something went wrong. Please call us directly.';
    statusMessage.className = 'form-status error';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Book now';
  }
});
