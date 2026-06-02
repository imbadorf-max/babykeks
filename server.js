const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const DATA_FILE = path.join(__dirname, 'data.json');

// Загрузка данных из файла
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) { console.error('Ошибка загрузки:', e); }
  return { events: [] };
}

// Сохранение данных в файл
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data), 'utf8');
}

// REST API
app.get('/api/events', (req, res) => {
  const data = loadData();
  res.json(data.events);
});

app.post('/api/events', (req, res) => {
  const data = loadData();
  const event = { id: Date.now(), ...req.body, time: req.body.time || new Date().toISOString() };
  data.events.push(event);
  saveData(data);
  io.emit('new_event', event);
  res.json({ success: true, event });
});

app.delete('/api/events/:id', (req, res) => {
  const data = loadData();
  data.events = data.events.filter(e => e.id != req.params.id);
  saveData(data);
  io.emit('delete_event', parseInt(req.params.id));
  res.json({ success: true });
});

// Раздача статики
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket — синхронизация в реальном времени
io.on('connection', (socket) => {
  console.log('Клиент подключился:', socket.id);
  const data = loadData();
  socket.emit('all_events', data.events);

  socket.on('add_event', (event) => {
    const data = loadData();
    const ev = { id: Date.now(), ...event, time: event.time || new Date().toISOString() };
    data.events.push(ev);
    saveData(data);
    io.emit('new_event', ev);
  });

  socket.on('delete_event', (id) => {
    const data = loadData();
    data.events = data.events.filter(e => e.id !== id);
    saveData(data);
    io.emit('delete_event', id);
  });

  socket.on('disconnect', () => {
    console.log('Клиент отключился:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`БебиЛог сервер запущен на порту ${PORT}`);
  // Создаём папку public если её нет
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
});
