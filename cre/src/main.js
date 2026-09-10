import Chart from "chart.js/auto";
import { customers, transactions } from "./data/retailData.js";

const state = {
  dateRange: "90",
  store: "All stores",
  channel: "All channels",
  metric: "revenue"
};

let revenueChart = null;
let riskChart = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

/* =========================
   FORMATTERS
========================= */

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "₹0";

  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(1)}Cr`;
  }

  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }

  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }

  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function formatNumber(value) {
  return Math.round(value).toLocaleString("en-IN");
}

/* =========================
   DATE FILTER
========================= */

function getStartDate() {
  const today = new Date("2026-09-10");

  if (state.dateRange === "30") {
    const date = new Date(today);
    date.setDate(date.getDate() - 30);
    return date;
  }

  if (state.dateRange === "60") {
    const date = new Date(today);
    date.setDate(date.getDate() - 60);
    return date;
  }

  if (state.dateRange === "90") {
    const date = new Date(today);
    date.setDate(date.getDate() - 90);
    return date;
  }

  return new Date("2026-01-01");
}

/* =========================
   FILTER TRANSACTIONS
========================= */

function getFilteredTransactions() {
  const startDate = getStartDate();

  return transactions.filter((transaction) => {
    const transactionDate = new Date(transaction.date);

    const dateMatch = transactionDate >= startDate;

    const storeMatch =
      state.store === "All stores" ||
      transaction.region === state.store;

    const channelMatch =
      state.channel === "All channels" ||
      transaction.channel === state.channel;

    return dateMatch && storeMatch && channelMatch;
  });
}

/* =========================
   FILTER CUSTOMERS
========================= */

function getFilteredCustomers() {
  const filteredTransactions = getFilteredTransactions();

  const customerIds = new Set(
    filteredTransactions.map(
      (transaction) => transaction.customerId
    )
  );

  return customers.filter((customer) => {
    const customerMatch =
      customerIds.size === 0 ||
      customerIds.has(customer.id);

    const storeMatch =
      state.store === "All stores" ||
      customer.region === state.store;

    return customerMatch && storeMatch;
  });
}

/* =========================
   CALCULATE METRICS
========================= */

function calculateMetrics(data, filteredCustomers) {
  const revenue = data.reduce(
    (sum, transaction) => sum + Number(transaction.revenue || 0),
    0
  );

  const orders = data.length;

  const uniqueCustomers = new Set(
    data.map((transaction) => transaction.customerId)
  ).size;

  const customerOrders = {};

  data.forEach((transaction) => {
    customerOrders[transaction.customerId] =
      (customerOrders[transaction.customerId] || 0) + 1;
  });

  const repeatCustomers = Object.values(customerOrders)
    .filter((count) => count >= 2)
    .length;

  const repeatPurchaseRate =
    uniqueCustomers > 0
      ? (repeatCustomers / uniqueCustomers) * 100
      : 0;

  const atRiskCustomers = filteredCustomers.filter(
    (customer) => Number(customer.churnRisk || 0) >= 60
  );

  const atRiskRevenue = atRiskCustomers.reduce(
    (sum, customer) =>
      sum + Number(customer.lifetimeValue || 0),
    0
  );

  const campaignLift = Math.min(
    30,
    10 + repeatPurchaseRate * 0.3
  );

  const averageOrderValue =
    orders > 0 ? revenue / orders : 0;

  return {
    revenue,
    orders,
    uniqueCustomers,
    repeatPurchaseRate,
    atRiskRevenue,
    campaignLift,
    averageOrderValue,
    atRiskCustomers: atRiskCustomers.length
  };
}

/* =========================
   UPDATE KPI CARDS
========================= */

function updateKpis(metrics) {
  const cards = $$(".metric-card");

  if (cards.length < 4) return;

  const values = cards[0].querySelector(".metric-value");
  const repeatRate = cards[1].querySelector(".metric-value");
  const risk = cards[2].querySelector(".metric-value");
  const lift = cards[3].querySelector(".metric-value");

  if (values) {
    if (state.metric === "customers") {
      values.textContent = formatNumber(
        metrics.uniqueCustomers
      );
    } else if (state.metric === "orders") {
      values.textContent = formatNumber(
        metrics.orders
      );
    } else {
      values.textContent = formatCurrency(
        metrics.revenue
      );
    }
  }

  if (repeatRate) {
    repeatRate.textContent =
      `${metrics.repeatPurchaseRate.toFixed(1)}%`;
  }

  if (risk) {
    risk.textContent =
      formatCurrency(metrics.atRiskRevenue);
  }

  if (lift) {
    lift.textContent =
      `+${metrics.campaignLift.toFixed(1)}%`;
  }
}

/* =========================
   UPDATE KPI LABELS
========================= */

function updateMetricLabels() {
  const cards = $$(".metric-card");

  if (!cards.length) return;

  const firstLabel =
    cards[0].querySelector("p");

  if (!firstLabel) return;

  if (state.metric === "customers") {
    firstLabel.textContent = "Active customers";
  } else if (state.metric === "orders") {
    firstLabel.textContent = "Total orders";
  } else {
    firstLabel.textContent = "Repeat revenue";
  }
}

/* =========================
   REVENUE CHART
========================= */

function createRevenueChart(data) {
  const canvas = $("#revenueChart");

  if (!canvas) return;

  if (revenueChart) {
    revenueChart.destroy();
    revenueChart = null;
  }

  const grouped = {};

  data.forEach((transaction) => {
    const date = transaction.date;

    grouped[date] =
      (grouped[date] || 0) +
      Number(transaction.revenue || 0);
  });

  const dates = Object.keys(grouped).sort();

  const recentDates = dates.slice(-12);

  let values;

  if (state.metric === "orders") {
    const orderGroups = {};

    data.forEach((transaction) => {
      orderGroups[transaction.date] =
        (orderGroups[transaction.date] || 0) + 1;
    });

    values = recentDates.map(
      (date) => orderGroups[date] || 0
    );
  } else if (state.metric === "customers") {
    const customerGroups = {};

    data.forEach((transaction) => {
      if (!customerGroups[transaction.date]) {
        customerGroups[transaction.date] = new Set();
      }

      customerGroups[transaction.date].add(
        transaction.customerId
      );
    });

    values = recentDates.map(
      (date) =>
        customerGroups[date]
          ? customerGroups[date].size
          : 0
    );
  } else {
    values = recentDates.map(
      (date) => grouped[date] || 0
    );
  }

  const chartLabel =
    state.metric === "customers"
      ? "Customers"
      : state.metric === "orders"
      ? "Orders"
      : "Revenue";

  revenueChart = new Chart(canvas, {
    type: "line",

    data: {
      labels: recentDates.map((date) =>
        new Date(date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short"
        })
      ),

      datasets: [
        {
          label: chartLabel,
          data: values,
          tension: 0.35,
          fill: true,
          borderWidth: 2,
          pointRadius: 3
        }
      ]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        intersect: false,
        mode: "index"
      },

      plugins: {
        legend: {
          display: false
        },

        tooltip: {
          callbacks: {
            label: (context) => {
              if (state.metric === "revenue") {
                return ` Revenue: ${formatCurrency(
                  context.raw
                )}`;
              }

              if (state.metric === "orders") {
                return ` Orders: ${formatNumber(
                  context.raw
                )}`;
              }

              return ` Customers: ${formatNumber(
                context.raw
              )}`;
            }
          }
        }
      },

      scales: {
        y: {
          beginAtZero: true,

          ticks: {
            callback: (value) => {
              if (state.metric === "revenue") {
                return formatCurrency(value);
              }

              return formatNumber(value);
            }
          }
        }
      }
    }
  });
}

/* =========================
   RISK CHART
========================= */

function createRiskChart(filteredCustomers) {
  const canvas = $("#riskChart");

  if (!canvas) return;

  if (riskChart) {
    riskChart.destroy();
    riskChart = null;
  }

  const counts = {
    Low: filteredCustomers.filter(
      (customer) =>
        Number(customer.churnRisk || 0) < 35
    ).length,

    Medium: filteredCustomers.filter(
      (customer) =>
        Number(customer.churnRisk || 0) >= 35 &&
        Number(customer.churnRisk || 0) < 60
    ).length,

    High: filteredCustomers.filter(
      (customer) =>
        Number(customer.churnRisk || 0) >= 60
    ).length
  };

  riskChart = new Chart(canvas, {
    type: "doughnut",

    data: {
      labels: Object.keys(counts),

      datasets: [
        {
          data: Object.values(counts),
          borderWidth: 0
        }
      ]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",

      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

/* =========================
   UPDATE FILTER LABELS
========================= */

function updateFilterLabels() {
  $$("[data-filter-label]").forEach((element) => {
    const filter = element.dataset.filterLabel;

    if (filter === "date") {
      element.textContent =
        state.dateRange === "30"
          ? "Last 30 days"
          : state.dateRange === "60"
          ? "Last 60 days"
          : state.dateRange === "90"
          ? "Last 90 days"
          : "This year";
    }

    if (filter === "store") {
      element.textContent = state.store;
    }

    if (filter === "channel") {
      element.textContent = state.channel;
    }
  });
}

/* =========================
   HIGHLIGHT ACTIVE FILTER
========================= */

function updateActiveFilters() {
  $$("[data-date-range]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.dateRange === state.dateRange
    );
  });

  $$("[data-store]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.store === state.store
    );
  });

  $$("[data-channel]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.channel === state.channel
    );
  });

  $$("[data-metric]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.metric === state.metric
    );
  });
}

/* =========================
   FILTER BUTTONS
========================= */

function setupFilterButtons() {
  document.addEventListener("click", (event) => {
    const dateButton =
      event.target.closest("[data-date-range]");

    const storeButton =
      event.target.closest("[data-store]");

    const channelButton =
      event.target.closest("[data-channel]");

    const metricButton =
      event.target.closest("[data-metric]");

    if (dateButton) {
      state.dateRange =
        dateButton.dataset.dateRange;

      updateDashboard();
      return;
    }

    if (storeButton) {
      state.store =
        storeButton.dataset.store;

      updateDashboard();
      return;
    }

    if (channelButton) {
      state.channel =
        channelButton.dataset.channel;

      updateDashboard();
      return;
    }

    if (metricButton) {
      state.metric =
        metricButton.dataset.metric;

      updateDashboard();
    }
  });
}

/* =========================
   NATIVE SELECT FILTERS
========================= */

function setupSelectFilters() {
  $$("select").forEach((select) => {
    select.addEventListener("change", () => {
      const value = select.value;

      const text = value.trim();

      if (
        text.includes("30") ||
        text === "30"
      ) {
        state.dateRange = "30";
      } else if (
        text.includes("60") ||
        text === "60"
      ) {
        state.dateRange = "60";
      } else if (
        text.includes("90") ||
        text === "90"
      ) {
        state.dateRange = "90";
      } else if (
        text.toLowerCase().includes("year")
      ) {
        state.dateRange = "year";
      }

      if (
        [
          "All stores",
          "North",
          "South",
          "East",
          "West"
        ].includes(text)
      ) {
        state.store = text;
      }

      if (
        [
          "All channels",
          "Online",
          "Store",
          "Mobile"
        ].includes(text)
      ) {
        state.channel = text;
      }

      updateDashboard();
    });
  });
}

/* =========================
   NAVIGATION
========================= */

function setupNavigation() {
  $$("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      $$("[data-section]").forEach((item) => {
        item.classList.remove("active");
      });

      button.classList.add("active");

      const section =
        button.dataset.section;

      $$("[data-view]").forEach((view) => {
        view.classList.remove("active");
      });

      const target =
        $(`[data-view="${section}"]`);

      if (target) {
        target.classList.add("active");
      }
    });
  });
}

/* =========================
   MODAL
========================= */

function setupModal() {
  const modal = $("#modal");

  const askButton = $("#askAt");
  const playbookButton = $("#viewPlaybook");
  const closeButton = $("#closeModal");

  if (askButton && modal) {
    askButton.onclick = () => {
      if (typeof modal.showModal === "function") {
        modal.showModal();
      } else {
        modal.setAttribute("open", "");
      }
    };
  }

  if (playbookButton && modal) {
    playbookButton.onclick = () => {
      if (typeof modal.showModal === "function") {
        modal.showModal();
      } else {
        modal.setAttribute("open", "");
      }
    };
  }

  if (closeButton && modal) {
    closeButton.onclick = () => {
      modal.close();
    };
  }
}

/* =========================
   EXPLAIN BUTTON
========================= */

function setupExplainButton() {
  const button = $("#explainBtn");

  if (!button) return;

  button.onclick = () => {
    button.textContent =
      "✓ Query uses date partition + customer index";

    button.classList.add("explained");
  };
}

/* =========================
   MAIN DASHBOARD UPDATE
========================= */

function updateDashboard() {
  const filteredTransactions =
    getFilteredTransactions();

  const filteredCustomers =
    getFilteredCustomers();

  const metrics = calculateMetrics(
    filteredTransactions,
    filteredCustomers
  );

  updateKpis(metrics);
  updateMetricLabels();

  createRevenueChart(filteredTransactions);
  createRiskChart(filteredCustomers);

  updateFilterLabels();
  updateActiveFilters();

  console.log("Dashboard updated", {
    filters: state,
    customers: filteredCustomers.length,
    orders: filteredTransactions.length,
    revenue: metrics.revenue
  });
}

/* =========================
   INITIALIZE
========================= */

function initialize() {
  setupFilterButtons();
  setupSelectFilters();
  setupNavigation();
  setupModal();
  setupExplainButton();

  updateDashboard();
}

initialize();