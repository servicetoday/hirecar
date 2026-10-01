const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const sessions = new Map();
const attempts = new Map();
const lifetime = 8 * 60 * 60 * 1000;

async function initialize(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_users (
    username VARCHAR(100) PRIMARY KEY, salt VARCHAR(64) NOT NULL, password_hash VARCHAR(128) NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS fleet_cars (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL,
    description VARCHAR(1000) NOT NULL, image_url VARCHAR(2000) NOT NULL,
    passengers INT UNSIGNED NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query('CREATE TABLE IF NOT EXISTS app_seeds (name VARCHAR(100) PRIMARY KEY)');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt('1234', salt, 64)).toString('hex');
  await pool.execute('INSERT IGNORE INTO admin_users (username,salt,password_hash) VALUES (?,?,?)', ['altaf', salt, hash]);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [seed] = await connection.execute('INSERT IGNORE INTO app_seeds (name) VALUES (?)', ['initial-fleet']);
    if (seed.affectedRows) {
      const cars = [
        ['Mercedes-Benz S-Class', 'Executive comfort for up to 3 passengers.', 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=900&q=85', 3],
        ['Mercedes-Benz V-Class', 'Flexible luxury for up to 7 passengers.', 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=900&q=85', 7],
        ['Luxury SUV', 'Confident space for journeys beyond the city.', 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=900&q=85', 5]
      ];
      for (const car of cars) await connection.execute('INSERT INTO fleet_cars (name,description,image_url,passengers) VALUES (?,?,?,?)', car);
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

function register(app, pool) {
  const route = (handler) => async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { await handler(req, res); }
    catch (error) { console.error('Fleet API failed:', error.message); res.status(500).json({ message: 'Unable to complete the request. Please try again.' }); }
  };
  const token = req => (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('fleet_session='))?.slice(14);
  const auth = (req, res, next) => {
    const session = sessions.get(token(req));
    res.set('Cache-Control', 'no-store');
    if (!session || session.expires <= Date.now()) return res.status(401).json({ message: 'Please log in.' });
    if (req.method !== 'GET' && req.headers['x-csrf-token'] !== session.csrf) return res.status(403).json({ message: 'Please reload and try again.' });
    req.admin = session;
    next();
  };
  app.post('/api/admin/login', route(async (req, res) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
    const attempt = attempts.get(req.ip) || { count: 0, expires: now + 15 * 60 * 1000 };
    if (attempt.count >= 10) return res.status(429).json({ message: 'Too many login attempts. Try again in 15 minutes.' });
    attempt.count++; attempts.set(req.ip, attempt);
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || password.length > 200) return res.status(400).json({ message: 'Enter your username and password.' });
    const [users] = await pool.execute('SELECT * FROM admin_users WHERE username=?', [username]);
    const user = users[0];
    const hash = await scrypt(password, user?.salt || 'missing-user', 64);
    if (!user || !crypto.timingSafeEqual(hash, Buffer.from(user.password_hash, 'hex'))) return res.status(401).json({ message: 'Incorrect username or password.' });
    attempts.delete(req.ip);
    for (const [key, value] of sessions) if (value.expires <= now) sessions.delete(key);
    sessions.delete(token(req));
    const id = crypto.randomBytes(32).toString('hex');
    const session = { username: user.username, csrf: crypto.randomBytes(32).toString('hex'), expires: now + lifetime };
    sessions.set(id, session);
    res.cookie('fleet_session', id, { httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: lifetime, path: '/' });
    res.json({ username: session.username, csrf: session.csrf });
  }));
  app.get('/api/admin/session', auth, (req, res) => res.json({ username: req.admin.username, csrf: req.admin.csrf }));
  app.post('/api/admin/logout', auth, (req, res) => {
    sessions.delete(token(req)); res.clearCookie('fleet_session', { path: '/' }); res.json({ message: 'Logged out.' });
  });
  app.get('/api/fleet', route(async (_req, res) => {
    const [cars] = await pool.query('SELECT * FROM fleet_cars ORDER BY id');
    res.json({ cars });
  }));
  function values(body) {
    const { name, description, image_url, passengers } = body || {};
    if (typeof name !== 'string' || !name.trim() || name.length > 100 || typeof description !== 'string' || !description.trim() || description.length > 1000 || typeof image_url !== 'string' || image_url.length > 2000 || !Number.isInteger(passengers) || passengers < 1 || passengers > 100) return null;
    try { if (!['http:', 'https:'].includes(new URL(image_url).protocol)) return null; } catch { return null; }
    return [name.trim(), description.trim(), image_url.trim(), passengers];
  }
  app.post('/api/admin/fleet', auth, route(async (req, res) => {
    const data = values(req.body);
    if (!data) return res.status(400).json({ message: 'Enter a name, description, valid image URL, and 1–100 passengers.' });
    const [result] = await pool.execute('INSERT INTO fleet_cars (name,description,image_url,passengers) VALUES (?,?,?,?)', data);
    res.status(201).json({ id: result.insertId });
  }));
  app.put('/api/admin/fleet/:id', auth, route(async (req, res) => {
    const data = values(req.body);
    if (!data || !/^\d+$/.test(req.params.id)) return res.status(400).json({ message: 'Check the car details and image URL.' });
    const [result] = await pool.execute('UPDATE fleet_cars SET name=?,description=?,image_url=?,passengers=? WHERE id=?', [...data, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Car not found.' });
    res.json({ message: 'Car updated.' });
  }));
  app.delete('/api/admin/fleet/:id', auth, route(async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ message: 'Invalid car.' });
    const [result] = await pool.execute('DELETE FROM fleet_cars WHERE id=?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Car not found.' });
    res.json({ message: 'Car deleted.' });
  }));
}
module.exports = { initialize, register };
