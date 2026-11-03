require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const { connectDB } = require('./config/db');
const { startChangeStreams } = require('./sockets/changeStreams');
const { apiLimiter } = require('./middleware/rateLimit');

const authRoutes = require('./routes/auth');
const needRoutes = require('./routes/needs');
const resourceRoutes = require('./routes/resources');
const volunteerRoutes = require('./routes/volunteers');
const shelterRoutes = require('./routes/shelters');
const deliveryRoutes = require('./routes/deliveries');
const smsRoutes = require('./routes/sms');

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reliefgrid?replicaSet=rs0';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

async function main() {
  await connectDB(MONGODB_URI);

  const app = express();
  app.use(cors({ origin: CLIENT_ORIGIN }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true })); // Twilio-style webhooks post form-encoded bodies

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: CLIENT_ORIGIN } });
  app.set('io', io);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/needs', needRoutes);
  app.use('/api/resources', resourceRoutes);
  app.use('/api/volunteers', volunteerRoutes);
  app.use('/api/shelters', shelterRoutes);
  app.use('/api/deliveries', deliveryRoutes);
  app.use('/api/sms', smsRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  });

  io.on('connection', (socket) => {
    console.log(`[socket] client connected ${socket.id}`);
    socket.on('disconnect', () => console.log(`[socket] client disconnected ${socket.id}`));
  });

  const stopChangeStreams = startChangeStreams(io);

  httpServer.listen(PORT, () => console.log(`[server] listening on :${PORT}`));

  process.on('SIGINT', () => {
    stopChangeStreams();
    httpServer.close(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error('[server] fatal startup error:', err.message);
  process.exit(1);
});
