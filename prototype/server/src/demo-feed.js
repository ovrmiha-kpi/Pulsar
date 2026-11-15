/** Швидкий UDP-фідер для перевірки latency (без сайту). */
import dgram from "dgram";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.UDP_PORT || 4101);
// За замовч. повільно — інакше UI здається «симуляцією» і стрибає
const HZ = Number(process.env.HZ || 1);

const sock = dgram.createSocket("udp4");
let i = 0;
const period = Math.max(5, Math.round(1000 / HZ));

console.log(`[demo] UDP → ${HOST}:${PORT} @ ${HZ} Hz`);

setInterval(() => {
  i++;
  const payload = Buffer.from(
    JSON.stringify({
      device_id: "dev001",
      hr: 70 + (i % 40),
      spo2: 94 + (i % 5),
      temp: 21 + (i % 10) * 0.1,
      battery: 80,
      t: new Date().toISOString(),
    })
  );
  sock.send(payload, PORT, HOST);
}, period);
