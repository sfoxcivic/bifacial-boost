const $ = (id) => document.getElementById(id);

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let parsedModules = []; // array of {model, watts, isc, imp, fuse}

async function uploadAndExtract() {
  const fileInput = $('pdf');
  const file = fileInput.files[0];
  if (!file) {
    updateStatus('Please choose a PDF file first.', true);
    return;
  }
  updateStatus('Uploading and extracting…', false);
  try {
    const base64 = await fileToBase64(file);
    const resp = await fetch('/.netlify/functions/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: base64 })
    });
    const data = await resp.json();
    if (data.error) {
      updateStatus('Extraction error: ' + data.error, true);
      return;
    }

    parsedModules = data.modules || [];
    const seen = new Set();
    const uniqueByWatts = [];
    parsedModules.forEach(m => {
      if (m.watts && !seen.has(m.watts)) {
        seen.add(m.watts);
        uniqueByWatts.push(m);
      }
    });

    if (uniqueByWatts.length === 0) {
      updateStatus('No module variants found — you may need to enter values manually.', true);
      $('variantArea').classList.add('hidden');
    } else if (uniqueByWatts.length === 1) {
      populateModuleSelect(uniqueByWatts);
      $('variantArea').classList.remove('hidden');
      updateStatus('One variant found. Please select it to populate values.', false);
    } else {
      populateModuleSelect(uniqueByWatts);
      $('variantArea').classList.remove('hidden');
      updateStatus(uniqueByWatts.length + ' variants found. Please pick the correct wattage.', false);
    }

    $('extractedPreview').textContent = data.raw || data.extractedText || '';
  } catch (err) {
    console.error(err);
    updateStatus('Upload failed: ' + err.message, true);
  }
}

function populateModuleSelect(mods) {
  const sel = $('moduleSelect');
  sel.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '-- select wattage --';
  sel.appendChild(placeholder);
  mods.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.watts + '|' + (m.model || '');
    opt.textContent = (m.watts ? (m.watts + 'W') : 'Unknown') + (m.model ? ' – ' + m.model : '');
    sel.appendChild(opt);
  });
  sel.addEventListener('change', onModuleSelected);
}

function onModuleSelected(e) {
  const val = e.target.value;
  if (!val) return;
  const [watts, model] = val.split('|');
  const match = parsedModules.find(m => String(m.watts) === String(watts) && (m.model === model || !model));
  if (!match) return;
  if (match.isc) $('isc').value = match.isc;
  if (match.imp) $('imp').value = match.imp;
  if (match.fuse) $('fuse').value = match.fuse;
  updateStatus('Module values populated from selected variant.', false);
}

function updateStatus(msg, isError=false) {
  const el = $('extractStatus');
  el.textContent = msg;
  el.className = isError ? 'text-sm text-red-600 mt-2' : 'text-sm text-slate-500 mt-2';
}

function baseBoost(albedo, mount) {
  const table = [
    { max: 0.11, fixed: 0.04, tracker: 0.05 },
    { max: 0.25, fixed: 0.07, tracker: 0.09 },
    { max: 0.40, fixed: 0.10, tracker: 0.12 },
    { max: 0.70, fixed: 0.15, tracker: 0.18 },
    { max: 1.00, fixed: 0.22, tracker: 0.25 }
  ];
  const row = table.find(r => albedo <= r.max);
  return mount === 'tracker' ? row.tracker : row.fixed;
}

function clearanceMultiplier(h) {
  if (h < 0.8) return 0.7;
  if (h < 1.2) return 0.9;
  if (h < 1.5) return 1.0;
  return 1.15;
}

function gcrMultiplier(g) {
  if (g >= 0.60) return 0.85;
  if (g <= 0.40) return 1.10;
  return 1.0;
}

function obstructionMultiplier(o) {
  return o === 'bulky' ? 0.85 : 1.0;
}

function calculateBoost() {
  const albedo = parseFloat($('albedo').value);
  const mount = $('mount').value;
  const clearance = parseFloat($('clearance').value) || 1.2;
  const gcr = parseFloat($('gcr').value) || 0.5;
  const obstruction = $('obstruction').value;

  const isc = parseFloat($('isc').value);
  const imp = parseFloat($('imp').value);
  const fuse = parseFloat($('fuse').value);

  if (!isc || !imp) {
    alert('Please provide module Isc and Imp (either manually or via PDF extraction and module selection).');
    return;
  }

  let boost = baseBoost(albedo, mount);
  boost *= clearanceMultiplier(clearance);
  boost *= gcrMultiplier(gcr);
  boost *= obstructionMultiplier(obstruction);

  const isc_eff = isc * (1 + boost);
  const imp_eff = imp * (1 + boost);

  $('boostVal').textContent = (boost * 100).toFixed(1) + ' %';
  $('iscVal').textContent = isc_eff.toFixed(2);
  $('impVal').textContent = imp_eff.toFixed(2);

  let notes = [];
  if (fuse) {
    notes.push('Sheet max fuse: ' + fuse + ' A');
  }
  notes.push('Apply NEC continuous factors and manufacturer max input currents.');
  $('notesVal').textContent = notes.join(' ');
}

function resetForm() {
  $('pdf').value = '';
  $('isc').value = '';
  $('imp').value = '';
  $('fuse').value = '';
  $('extractedPreview').textContent = 'No extraction performed yet.';
  $('boostVal').textContent = '—';
  $('iscVal').textContent = '—';
  $('impVal').textContent = '—';
  $('notesVal').textContent = '—';
  $('variantArea').classList.add('hidden');
  parsedModules = [];
  updateStatus('No file loaded.', false);
}

document.addEventListener('DOMContentLoaded', () => {
  $('extractBtn').addEventListener('click', uploadAndExtract);
  $('calcBtn').addEventListener('click', calculateBoost);
  $('resetBtn').addEventListener('click', resetForm);
});
