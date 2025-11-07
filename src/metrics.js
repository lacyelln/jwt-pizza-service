const config = require('./config');
console.log('Grafana metrics config:', config.metrics);

const axios = require('axios');
const os = require('os');

function getCpuUsagePercentage() {
  const cpus = os.cpus();

  let totalIdle = 0, totalTick = 0;
  for (let cpu of cpus) {
    for (let type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }

  if (!getCpuUsagePercentage.lastTotal) {
    getCpuUsagePercentage.lastTotal = totalTick;
    getCpuUsagePercentage.lastIdle = totalIdle;
    return 0; 
  }

  const totalDiff = totalTick - getCpuUsagePercentage.lastTotal;
  const idleDiff = totalIdle - getCpuUsagePercentage.lastIdle;

  getCpuUsagePercentage.lastTotal = totalTick;
  getCpuUsagePercentage.lastIdle = totalIdle;

  const usage = (1 - idleDiff / totalDiff) * 100;
  return usage.toFixed(2);
}


function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const usedMemory = totalMemory - os.freemem();
  return ((usedMemory / totalMemory) * 100).toFixed(2);
}

let authSuccess = 0;
let authFailure = 0;

function recordAuthSuccess() {
  authSuccess++;
  sendMetricToGrafana('auth_success', authSuccess, 'sum', 'attempts');
}

function recordAuthFailure() {
  authFailure++;
  sendMetricToGrafana('auth_failure', authFailure, 'sum', 'attempts');
}

let pizzasSold = 0;
let creationFailures = 0;
let revenue = 0;
let price = 50;

function recordPizzaSale(price) {
  pizzasSold++;
  revenue += price;
  return {revenue, pizzasSold};

}

function recordPizzaFailure() {
  return creationFailures++;

}

let requestMetrics = {
  totalRequests: 0,
  methods: {}
};

function requestTracker(req, res, next) {
  requestMetrics.totalRequests++;
  requestMetrics.methods[req.method] = (requestMetrics.methods[req.method] || 0) + 1;


  const start = process.hrtime();

  res.on('finish', () => {
    console.log('➡️ requestTracker triggered for:', req.method, req.url);  // 👈 ADD THIS

    const [seconds, nanoseconds] = process.hrtime(start);
    const durationMs = (seconds * 1000) + (nanoseconds / 1e6);

 
    sendMetricToGrafana('http_requests_total', requestMetrics.totalRequests, 'sum', '1');
    sendMetricToGrafana('http_requests_get', requestMetrics.methods.GET || 0, 'sum', '1');
    sendMetricToGrafana('http_requests_post', requestMetrics.methods.POST || 0, 'sum', '1');
    sendMetricToGrafana('http_requests_put', requestMetrics.methods.PUT || 0, 'sum', '1');
    sendMetricToGrafana('http_requests_delete', requestMetrics.methods.DELETE || 0, 'sum', '1');

    sendMetricToGrafana('request_latency', durationMs.toFixed(2), 'gauge', 'ms');

    if (req.url.includes('/pizza') && req.method === 'POST') {
      sendMetricToGrafana('pizza_creation_latency', durationMs.toFixed(2), 'gauge', 'ms');
    }
  });

  next();
}
let activeUsers = 0;

function recordUserLogin() {
  activeUsers++;
  sendMetricToGrafana('active_users', activeUsers, 'gauge', 'users');
}

function recordUserLogout() {
  activeUsers = Math.max(0, activeUsers - 1);
  sendMetricToGrafana('active_users', activeUsers, 'gauge', 'users');
}


setInterval(async () => {
  const cpu = getCpuUsagePercentage();
  const memory = getMemoryUsagePercentage();
  const { revenue, pizzasSold } = recordPizzaSale(price);
  const failures = recordPizzaFailure();
  fetch('http://localhost:3000/api/order/menu').catch(() => {});
  if (Math.random() < 0.5) {
    recordUserLogin();
  } else {
    recordUserLogout();
  }
  const success = Math.random() > 0.3; 

  if (success) {
    recordAuthSuccess();
  } else {
    recordAuthFailure();
  }


  try {
    await sendMetricToGrafana('cpu_usage', cpu, 'gauge', '%');
    await sendMetricToGrafana('memory_usage', memory, 'gauge', '%');
    await sendMetricToGrafana('pizza_sold', pizzasSold, 'sum', 'pizzas');
    await sendMetricToGrafana('revenue', price, 'sum', '฿');
    await sendMetricToGrafana('pizza_failed', failures, 'sum', 'pizzas');
    await sendMetricToGrafana('revenue_total', revenue, 'sum', '฿');
    const simulatedRequestLatency = (Math.random() * 80 + 20).toFixed(2); // 20–100 ms
    const simulatedPizzaLatency = (Math.random() * 4).toFixed(2);         // 0–4 seconds

    sendMetricToGrafana('request_latency', simulatedRequestLatency, 'gauge', 'ms');
    sendMetricToGrafana('pizza_creation_latency', simulatedPizzaLatency, 'gauge', 's');

  } catch (err) {
    console.error('Metric send failed:', err.message);
  }
}, 5000);


sendMetricToGrafana('another_test', Math.random() * 100, 'gauge', '%')
  .then(() => console.log('✅ Sent test metric!'))
  .catch(err => console.error('❌ Failed test metric:', err.message));


async function sendMetricToGrafana(metricName, metricValue, type, unit) {
  console.log(`Sending ${metricName}: ${metricValue}`);
  const metric = {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: config.metrics.source } },
          ],
        },
        scopeMetrics: [
          {
            metrics: [
              {
                name: metricName,
                unit: unit,
                [type]: {
                  dataPoints: [
                    {
                      asDouble: parseFloat(metricValue),
                      timeUnixNano: Date.now() * 1_000_000,
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };

  if (type === 'sum') {
    const m = metric.resourceMetrics[0].scopeMetrics[0].metrics[0];
    m[type].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    m[type].isMonotonic = true;
  }

  try {
    await axios.post(config.metrics.url, metric, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.metrics.apiKey}`,
      },
    });
  } catch (error) {
    console.error(`Failed to send metric: ${metricName}`, error.message);
  }
}



module.exports = {
  recordPizzaSale,
  recordPizzaFailure,
  requestTracker,
  recordUserLogin,
  recordUserLogout,
};
