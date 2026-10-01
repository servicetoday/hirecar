const path = require('path');
const express = require('express');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const fleetBackend = require('./fleet-backend');

app.use(express.json());
app.get('/fleets.html', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'fleet.html')));
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lemo_australia',
  waitForConnections: true,
  connectionLimit: 10
});

fleetBackend.register(app, pool);

app.post('/api/quotes', async (req, res) => {
  const { pickup, dropoff, serviceDate, serviceTime, vehicle, name, phone, email } = req.body;

  if (!pickup || !dropoff || !serviceDate || !serviceTime || !vehicle || !name || !phone || !email) {
    return res.status(400).json({ message: 'Please complete all booking fields.' });
  }

  try {
    await pool.execute(
      `INSERT INTO quotes
        (pickup_location, dropoff_location, service_date, service_time, vehicle, customer_name, phone, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [pickup, dropoff, serviceDate, serviceTime, vehicle, name, phone, email]
    );

    return res.status(201).json({ message: 'Your quote request is on its way. Our team will be in touch shortly.' });
  } catch (error) {
    console.error('Quote submission failed:', error.message);
    return res.status(500).json({ message: 'We could not save your request. Please call us on 0424 135 786.' });
  }
});

app.post('/api/bookings', async (req, res) => {
  const { pickup, dropoff, serviceDate, serviceTime, vehicle, name, phone, email } = req.body || {};
  const values = [pickup, dropoff, serviceDate, serviceTime, vehicle, name, phone, email];
  if (values.some((value) => typeof value !== 'string' || !value.trim())) {
    return res.status(400).json({ message: 'Please complete all booking fields.' });
  }
  try {
    const [result] = await pool.execute(
      `INSERT INTO bookings
        (pickup_location, dropoff_location, service_date, service_time, vehicle, customer_name, phone, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, values
    );
    res.status(201).json({ bookingId: result.insertId, message: `Your booking has been created. Booking reference: ${result.insertId}.` });
  } catch (error) {
    console.error('Booking submission failed:', error.message);
    res.status(500).json({ message: 'We could not save your booking. Please try again.' });
  }
});

app.get('/api/quotes', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const [quotes] = await pool.execute(
      `SELECT id, pickup_location, dropoff_location,
              DATE_FORMAT(service_date, '%Y-%m-%d') AS service_date,
              service_time, vehicle, customer_name, phone, email
       FROM quotes ORDER BY created_at DESC, id DESC`
    );
    res.json({ quotes });
  } catch (error) {
    console.error('Quote list failed:', error.message);
    res.status(500).json({ message: 'Unable to load quotes. Please try again.' });
  }
});

app.get('/api/bookings/today', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const part = (type) => parts.find((value) => value.type === type).value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  try {
    const [bookings] = await pool.execute(
      `SELECT id, pickup_location, dropoff_location, service_time, vehicle,
              customer_name, phone, email
       FROM bookings WHERE service_date = ? ORDER BY service_time, id`, [date]
    );
    res.json({ date, timeZone: 'Australia/Sydney', bookings });
  } catch (error) {
    console.error('Booking list failed:', error.message);
    res.status(500).json({ message: 'Unable to load bookings. Please try again.' });
  }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

pool.query('CREATE TABLE IF NOT EXISTS bookings LIKE quotes').then(() => fleetBackend.initialize(pool)).then(() => {
  app.listen(port, () => {
    console.log(`LIMO Australia running at http://localhost:${port}`);
  });
}).catch(async (error) => {
  console.error('Database initialization failed:', error.message);
  await pool.end();
  process.exitCode = 1;
});
