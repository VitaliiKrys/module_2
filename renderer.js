const { ipcRenderer } = require("electron");
const natural = require("natural");
const fs = require("fs");
const path = require("path");

let classifier = new natural.BayesClassifier();
let modelTrained = false;

let stats = {};

function loadConfig() {
  try {
    if (!fs.existsSync("config.json")) {
      alert("config.json не знайдено!");
      return null;
    }
    return JSON.parse(fs.readFileSync("config.json", "utf-8"));
  } catch (err) {
    alert("Помилка читання config.json");
    return null;
  }
}

function cleanText(text) {
  return text.toLowerCase().trim();
}

function trainModel() {
  const config = loadConfig();
  if (!config) return;

  const docPath = config.defaultDocPath;

  if (!fs.existsSync(docPath)) {
    alert("Папка documents не знайдена!");
    return;
  }

  const files = fs.readdirSync(docPath);

  if (files.length === 0) {
    alert("У папці documents немає файлів!");
    return;
  }

  let trainedCount = 0;

  files.forEach(file => {
    const filePath = path.join(docPath, file);

    if (!file.includes("_")) return;

    try {
      const text = fs.readFileSync(filePath, "utf-8");
      const cleaned = cleanText(text);

      if (cleaned.length < 5) return;

      const category = file.split("_")[0];

      classifier.addDocument(cleaned, category);
      trainedCount++;

      ipcRenderer.send("log-message", `Added ${file} as ${category}`);
    } catch (err) {
      ipcRenderer.send("log-message", `Error reading ${file}: ${err.message}`);
    }
  });

  if (trainedCount === 0) {
    alert("Немає валідних даних для навчання!");
    return;
  }

  classifier.train();
  modelTrained = true;

  ipcRenderer.send("log-message", "Model trained successfully");
  alert("Модель навчена!");
}

async function classifyDocument() {
  if (!modelTrained) {
    alert("Спершу навчіть модель!");
    return;
  }

  const filePath = await ipcRenderer.invoke("select-file");
  if (!filePath) {
    ipcRenderer.send("log-message", "User cancelled file selection");
    return;
  }

  try {
    const text = fs.readFileSync(filePath, "utf-8");
    const cleaned = cleanText(text);

    if (cleaned.length < 3) {
      alert("Файл занадто порожній для класифікації!");
      return;
    }

    const result = classifier.classify(cleaned);

    if (!stats[result]) {
      stats[result] = 0;
    }
    stats[result]++;

    ipcRenderer.send("log-message", `Classified ${filePath} as ${result}`);

    document.getElementById("result").innerText = `Категорія: ${result}`;

    updateStats();
  } catch (err) {
    ipcRenderer.send("log-message", `Classification error: ${err.message}`);
    alert("Помилка при класифікації файлу");
  }
}

function updateStats() {
  const statsDiv = document.getElementById("stats");

  let text = "Статистика:\n";

  for (let key in stats) {
    text += `${key}: ${stats[key]}\n`;
  }

  statsDiv.innerText = text;
}

function saveStats() {
  try {
    fs.writeFileSync("stats.json", JSON.stringify(stats, null, 2));
    ipcRenderer.send("log-message", "Stats saved");
    alert("Статистика збережена!");
  } catch (err) {
    ipcRenderer.send("log-message", `Stats save error: ${err.message}`);
  }
}

function loadStats() {
  try {
    if (!fs.existsSync("stats.json")) return;

    stats = JSON.parse(fs.readFileSync("stats.json", "utf-8"));
    updateStats();

    ipcRenderer.send("log-message", "Stats loaded");
  } catch (err) {
    ipcRenderer.send("log-message", `Stats load error: ${err.message}`);
  }
}

window.onload = () => {
  document.getElementById("trainBtn").onclick = trainModel;
  document.getElementById("classifyBtn").onclick = classifyDocument;

  document.getElementById("saveStatsBtn").onclick = saveStats;

  loadStats();
  updateStats();
};